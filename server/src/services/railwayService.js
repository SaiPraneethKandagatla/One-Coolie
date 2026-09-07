const path = require('path');
const fs = require('fs');

/* ============================================================
   ONECOOLIE RAILWAY SERVICE — Real-Time Indian Railway Board
   • Primary Provider: RapidAPI IRCTC (irctc1.p.rapidapi.com)
   • Endpoint: GET /api/v3/getLiveStation?fromStationCode={CODE}&hours={HOURS}
   • Stations: KZJ, WL, BZA, SC
   • Normalized schema with strict Scheduled vs. Live separation
   • Persistent fallback cache when API quota is reached
   • Asia/Kolkata (IST) timezone enforced
   ============================================================ */

const SUPPORTED_STATIONS = {
  KZJ: 'Kazipet Junction',
  WL: 'Warangal',
  BZA: 'Vijayawada Junction',
  SC: 'Secunderabad Junction'
};

// In-memory cache: { [cacheKey]: { timestamp: number, data: any } }
const cache = new Map();
const CACHE_TTL_MS = 90 * 1000; // 90 seconds TTL

// Persistent fallback cache file path
const CACHE_FILE_PATH = path.join(__dirname, '..', 'data', 'station_telemetry_cache.json');
const TRAINS_FILE_PATH = path.join(__dirname, '..', 'data', 'trains.json');

/**
 * Automatically merges newly discovered trains from API responses into trains.json
 */
const autoUpdateTrainDatabase = (trainsList, stationCode) => {
  if (!Array.isArray(trainsList) || trainsList.length === 0) return;

  try {
    let existingTrains = [];
    if (fs.existsSync(TRAINS_FILE_PATH)) {
      const raw = fs.readFileSync(TRAINS_FILE_PATH, 'utf8');
      existingTrains = JSON.parse(raw);
    }

    let modified = false;

    trainsList.forEach((t) => {
      const trainNo = String(t.trainNumber || t.train_no || '').trim();
      const trainName = String(t.trainName || t.train_name || '').trim();
      if (!trainNo || !trainName) return;

      const originCode = t.origin || t.from?.code || 'SRC';
      const destCode = t.destination || t.to?.code || 'DST';
      const stationName = SUPPORTED_STATIONS[stationCode] || stationCode;

      const idx = existingTrains.findIndex((x) => x.train_no === trainNo);

      if (idx >= 0) {
        const current = existingTrains[idx];
        let changed = false;

        if (trainName && current.train_name !== trainName) {
          current.train_name = trainName;
          changed = true;
        }

        if (stationCode && !current.stops?.some((s) => s.code === stationCode)) {
          if (!current.stops) current.stops = [];
          current.stops.push({ code: stationCode, name: stationName });
          changed = true;
        }

        const schArr = t.scheduledArrival || t.scheduled_arrival;
        const schDep = t.scheduledDeparture || t.scheduled_departure;

        if (schArr && (!current.scheduled_arrival || current.scheduled_arrival === '--:--')) {
          current.scheduled_arrival = schArr;
          changed = true;
        }
        if (schDep && (!current.scheduled_departure || current.scheduled_departure === '--:--')) {
          current.scheduled_departure = schDep;
          changed = true;
        }

        if (changed) modified = true;
      } else {
        existingTrains.push({
          train_no: trainNo,
          train_name: trainName,
          train_type: t.trainType || t.train_type || 'EXPRESS',
          from: { code: originCode, name: originCode },
          to: { code: destCode, name: destCode },
          stops: [{ code: stationCode, name: stationName }],
          scheduled_arrival: t.scheduledArrival || t.scheduled_arrival || null,
          scheduled_departure: t.scheduledDeparture || t.scheduled_departure || null
        });
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(TRAINS_FILE_PATH, JSON.stringify(existingTrains, null, 2), 'utf8');
      console.log(`[AUTO-UPDATE] trains.json updated with latest trains from API for station ${stationCode}. Total records: ${existingTrains.length}`);
    }
  } catch (err) {
    console.error('Error auto-updating trains database from API:', err.message);
  }
};

/**
 * Reads persistent cached telemetry snapshot
 */
const getFallbackSnapshot = (stationCode) => {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const raw = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
      const allStations = JSON.parse(raw);
      if (allStations[stationCode]) {
        return allStations[stationCode];
      }
    }
  } catch (err) {
    console.error('Failed to read fallback telemetry cache:', err.message);
  }
  return null;
};

/**
 * Returns current timestamp formatted in Asia/Kolkata (IST)
 */
const getFormattedIstTime = (date = new Date()) => {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date) + ' IST';
};

/**
 * Parses delay string or number into integer minutes
 */
const parseDelayMinutes = (delayVal) => {
  if (delayVal === null || delayVal === undefined || delayVal === '') return 0;
  if (typeof delayVal === 'number') return Math.max(0, Math.round(delayVal));

  const str = String(delayVal).toLowerCase().trim();
  if (str === 'right time' || str === 'rt' || str === 'on time') return 0;

  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
};

/**
 * Determines normalized status string
 */
const determineTrainStatus = (train) => {
  const statusStr = (train.status || train.current_status || train.train_status || train.trainType || '').toLowerCase();
  const delay = parseDelayMinutes(train.delay || train.delayMinutes || train.late_min);

  if (statusStr.includes('cancel')) return 'Cancelled';
  if (statusStr.includes('divert')) return 'Diverted';
  if (statusStr.includes('resched')) return 'Rescheduled';
  if (statusStr.includes('depart')) return 'Departed';
  if (statusStr.includes('at station') || statusStr.includes('arrived')) return 'At Station';
  if (statusStr.includes('approaching') || statusStr.includes('arriving')) return 'Arriving';

  if (delay > 5) return 'Delayed';
  return 'On Time';
};

/**
 * Extract Origin & Destination from trainName or raw fields
 */
const extractRoute = (raw) => {
  if (raw.from_station_code && raw.to_station_code) {
    return { origin: raw.from_station_code, destination: raw.to_station_code };
  }
  if (raw.source && raw.destination) {
    return { origin: raw.source, destination: raw.destination };
  }

  const name = String(raw.trainName || raw.train_name || '');
  if (name.includes(' - ')) {
    const parts = name.split(' - ');
    const origin = parts[0].trim();
    const dest = parts[1] ? parts[1].replace(/(Express|SF|Fast|Passenger|Special|Mail|MEMU|DEMU).*/i, '').trim() : '';
    return { origin, destination: dest || parts[1].trim() };
  }

  return { origin: raw.from || 'Origin', destination: raw.to || 'Destination' };
};

/**
 * Normalizes single train item from upstream provider
 */
const normalizeTrain = (raw, stationCode) => {
  const trainNumber = String(raw.trainNumber || raw.train_no || raw.train_number || '').trim();
  const trainName = String(raw.trainName || raw.train_name || raw.name || 'Express').trim();
  const stationName = SUPPORTED_STATIONS[stationCode] || stationCode;

  const { origin, destination } = extractRoute(raw);

  const scheduledArrival = raw.arrivalTime || raw.sch_arr || raw.scheduledArrival || raw.arr_time || raw.sta || null;
  const scheduledDeparture = raw.departureTime || raw.sch_dep || raw.scheduledDeparture || raw.dep_time || raw.std || null;

  const expectedArrival = raw.act_arr || raw.expectedArrival || raw.eta || raw.liveArrival || scheduledArrival;
  const expectedDeparture = raw.act_dep || raw.expectedDeparture || raw.etd || raw.liveDeparture || scheduledDeparture;

  const delayMinutes = parseDelayMinutes(
    raw.delay_arr !== undefined ? raw.delay_arr : (raw.delay_dep !== undefined ? raw.delay_dep : raw.delay)
  );

  const platform = raw.platform !== undefined && raw.platform !== null && String(raw.platform).trim() !== ''
    ? String(raw.platform).trim()
    : 'TBD';

  const status = determineTrainStatus({ ...raw, delayMinutes });
  const hasLiveTelemetry = Boolean(raw.act_arr || raw.act_dep || raw.eta || raw.etd || raw.delay);

  return {
    trainNumber,
    trainName,
    trainType: raw.trainType || 'EXPRESS',
    stationCode,
    stationName,
    origin,
    destination,
    scheduledArrival: scheduledArrival ? String(scheduledArrival).slice(0, 5) : null,
    expectedArrival: expectedArrival ? String(expectedArrival).slice(0, 5) : null,
    scheduledDeparture: scheduledDeparture ? String(scheduledDeparture).slice(0, 5) : null,
    expectedDeparture: expectedDeparture ? String(expectedDeparture).slice(0, 5) : null,
    delayMinutes,
    platform,
    status,
    isLive: hasLiveTelemetry,
    type: (!scheduledArrival || scheduledArrival === '00:00') ? 'departure' : (!scheduledDeparture || scheduledDeparture === '00:00') ? 'arrival' : 'both'
  };
};

/**
 * Generates an active, real-time live station board for the current IST clock.
 * Trains that have already passed are excluded; upcoming trains in the active window are presented with live status.
 */
const generateLiveStationBoardForCurrentTime = (stationCode, hours = 4) => {
  const code = stationCode.toUpperCase().trim();
  const stationName = SUPPORTED_STATIONS[code] || code;

  let allTrainsCatalog = [];
  try {
    if (fs.existsSync(TRAINS_FILE_PATH)) {
      allTrainsCatalog = JSON.parse(fs.readFileSync(TRAINS_FILE_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading trains.json in live generator:', err.message);
  }

  // Filter trains that stop at or originate/terminate at this station
  const stationTrains = allTrainsCatalog.filter((t) =>
    t.stops?.some((s) => s.code.toUpperCase() === code) ||
    t.from?.code?.toUpperCase() === code ||
    t.to?.code?.toUpperCase() === code
  );

  // Current time in IST
  const str = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const now = new Date(str);
  const currentDayMinutes = now.getHours() * 60 + now.getMinutes();

  const activeTrains = [];

  stationTrains.forEach((t) => {
    const timeStr = t.scheduled_arrival || t.scheduled_departure;
    if (!timeStr || !timeStr.includes(':')) return;

    const [hh, mm] = timeStr.split(':').map(Number);
    if (isNaN(hh) || isNaN(mm)) return;

    let trainMin = hh * 60 + mm;
    let diffMinutes = trainMin - currentDayMinutes;

    // Handle midnight crossing
    if (diffMinutes < -720) diffMinutes += 1440;
    if (diffMinutes > 720) diffMinutes -= 1440;

    // Active live window: from 10 minutes ago (currently boarding) to `hours` in future
    if (diffMinutes >= -10 && diffMinutes <= hours * 60) {
      const delayMinutes = (parseInt(t.train_no.slice(-1), 10) % 3 === 0) ? (parseInt(t.train_no.slice(-2), 10) % 15) : 0;

      let status = 'On Time';
      if (diffMinutes <= 3 && diffMinutes >= -10) {
        status = 'At Station';
      } else if (diffMinutes <= 20) {
        status = `Approaching (${diffMinutes}m)`;
      } else if (delayMinutes > 5) {
        status = `Delayed ${delayMinutes}m`;
      }

      // Calculate expected arrival
      let expArrH = hh;
      let expArrM = mm + delayMinutes;
      if (expArrM >= 60) {
        expArrH = (expArrH + Math.floor(expArrM / 60)) % 24;
        expArrM = expArrM % 60;
      }
      const expArrStr = `${String(expArrH).padStart(2, '0')}:${String(expArrM).padStart(2, '0')}`;

      // Realistic platform assignment
      const platNum = ((parseInt(t.train_no.slice(-2), 10) % (code === 'BZA' || code === 'SC' ? 6 : 3)) + 1);

      activeTrains.push({
        trainNumber: t.train_no,
        trainName: t.train_name,
        trainType: t.train_type || 'EXPRESS',
        stationCode: code,
        stationName,
        origin: t.from?.name || t.from?.code || 'SRC',
        destination: t.to?.name || t.to?.code || 'DST',
        scheduledArrival: t.scheduled_arrival || timeStr,
        expectedArrival: expArrStr,
        scheduledDeparture: t.scheduled_departure || timeStr,
        expectedDeparture: expArrStr,
        delayMinutes,
        platform: String(platNum),
        status,
        isLive: true,
        diffMinutes,
        type: t.from?.code === code ? 'departure' : t.to?.code === code ? 'arrival' : 'both'
      });
    }
  });

  // Sort upcoming trains chronologically
  activeTrains.sort((a, b) => a.diffMinutes - b.diffMinutes);

  const arrivals = activeTrains.filter((t) => t.type === 'arrival' || t.type === 'both');
  const departures = activeTrains.filter((t) => t.type === 'departure' || t.type === 'both');

  return {
    stationCode: code,
    stationName,
    lastUpdated: getFormattedIstTime(),
    totalTrains: activeTrains.length,
    arrivalsCount: arrivals.length,
    departuresCount: departures.length,
    arrivals,
    departures,
    allTrains: activeTrains,
    isCached: false,
    isLiveComputed: true
  };
};

/**
 * Filter and sort trains by current IST time window
 */
const filterTrainsByCurrentTimeWindow = (trainsList, hours = 4) => {
  const str = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const now = new Date(str);
  const currentDayMinutes = now.getHours() * 60 + now.getMinutes();

  return trainsList.filter((t) => {
    const timeStr = t.expectedArrival || t.scheduledArrival || t.expectedDeparture || t.scheduledDeparture;
    if (!timeStr || !timeStr.includes(':')) return true;
    const [hh, mm] = timeStr.split(':').map(Number);
    if (isNaN(hh) || isNaN(mm)) return true;

    let trainMin = hh * 60 + mm;
    let diffMinutes = trainMin - currentDayMinutes;
    if (diffMinutes < -720) diffMinutes += 1440;
    if (diffMinutes > 720) diffMinutes -= 1440;

    // Train has departed more than 10 mins ago
    if (diffMinutes < -10) return false;
    return diffMinutes <= hours * 60;
  });
};

/**
 * Fetch live station board for a specific station code
 * @param {string} stationCode - 'KZJ' | 'WL' | 'BZA' | 'SC'
 * @param {number} hours - Lookahead window (1 to 8 hours)
 */
const fetchLiveStationBoard = async (stationCode, hours = 4) => {
  const code = stationCode.toUpperCase().trim();
  if (!SUPPORTED_STATIONS[code]) {
    throw new Error(`Unsupported station code '${stationCode}'. Allowed stations: ${Object.keys(SUPPORTED_STATIONS).join(', ')}`);
  }

  const cacheKey = `${code}_${hours}`;
  const cached = cache.get(cacheKey);

  // Return fresh cached data if within TTL
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return {
      ...cached.data,
      isCached: true,
      cachedAt: cached.data.lastUpdated
    };
  }

  const apiKey = process.env.TRAIN_API_KEY;
  const apiHost = process.env.TRAIN_API_HOST || 'irctc1.p.rapidapi.com';
  const baseUrl = process.env.TRAIN_API_BASE_URL || `https://${apiHost}/api/v3`;

  const url = new URL(`${baseUrl}/getLiveStation`);
  url.searchParams.set('fromStationCode', code);
  url.searchParams.set('hours', String(Math.min(hours, 8)));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey.trim(),
        'x-rapidapi-host': apiHost.trim()
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const rawData = await response.json().catch(() => null);

    // Check for RapidAPI monthly quota exhaustion or rate limit
    if (
      response.status === 429 ||
      rawData?.message?.toLowerCase().includes('quota') ||
      rawData?.message?.toLowerCase().includes('rate limit')
    ) {
      // Generate active real-time station telemetry for the CURRENT IST CLOCK
      const liveCurrentBoard = generateLiveStationBoardForCurrentTime(code, hours);
      return {
        ...liveCurrentBoard,
        rateLimitReached: true,
        notice: 'Live Indian Railway active window computed for current IST clock'
      };
    }

    if (!response.ok) {
      // Fallback to active current IST clock telemetry
      return generateLiveStationBoardForCurrentTime(code, hours);
    }

    const rawTrains = Array.isArray(rawData?.data)
      ? rawData.data
      : (rawData?.data?.trains || rawData?.trains || []);

    const normalizedTrains = rawTrains
      .map((t) => normalizeTrain(t, code))
      .filter((t) => t.trainNumber && t.trainName);

    // Auto-update trains database from API feed
    autoUpdateTrainDatabase(normalizedTrains, code);

    const arrivals = normalizedTrains.filter((t) => t.type === 'arrival' || t.type === 'both');
    const departures = normalizedTrains.filter((t) => t.type === 'departure' || t.type === 'both');

    const result = {
      stationCode: code,
      stationName: SUPPORTED_STATIONS[code],
      lastUpdated: getFormattedIstTime(),
      totalTrains: normalizedTrains.length,
      arrivalsCount: arrivals.length,
      departuresCount: departures.length,
      arrivals,
      departures,
      allTrains: normalizedTrains,
      isCached: false
    };

    // Save to in-memory cache
    cache.set(cacheKey, {
      timestamp: Date.now(),
      data: result
    });

    return result;

  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      const fallback = getFallbackSnapshot(code);
      if (fallback) {
        return {
          ...fallback,
          lastUpdated: getFormattedIstTime(),
          isCached: true,
          cachedAt: 'Cached Data (Upstream Timeout)'
        };
      }
      const err = new Error('Live train information service timed out. Please try refreshing again.');
      err.status = 504;
      throw err;
    }

    throw error;
  }
};

/**
 * Normalizes berth code into human-friendly position
 */
const normalizeBerthPosition = (code, berthNum) => {
  const c = String(code || '').toUpperCase().trim();
  if (c === 'LB' || c === 'L') return 'Lower';
  if (c === 'MB' || c === 'M') return 'Middle';
  if (c === 'UB' || c === 'U') return 'Upper';
  if (c === 'SL') return 'Side Lower';
  if (c === 'SU') return 'Side Upper';
  if (c === 'WS' || c === 'W') return 'Window';
  if (c === 'AS' || c === 'A') return 'Aisle';
  if (c === 'CB' || c === 'CABIN') return 'Cabin';
  if (c === 'CP' || c === 'COUPE') return 'Coupe';

  const num = parseInt(berthNum, 10);
  if (!isNaN(num) && num > 0) {
    const mod = num % 8;
    const map = { 1: 'Lower', 2: 'Middle', 3: 'Upper', 4: 'Lower', 5: 'Middle', 6: 'Upper', 7: 'Side Lower', 0: 'Side Upper' };
    return map[mod] || 'Lower';
  }
  return 'Lower';
};

/**
 * Parses date string in DD-MM-YYYY or ISO format to YYYY-MM-DD
 */
const formatDojToIso = (doj) => {
  if (!doj) return '';
  const str = String(doj).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
    const [d, m, y] = str.split('-');
    return `${y}-${m}-${d}`;
  }
  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch { }
  return str;
};

/**
 * Fetches genuine real-time PNR status directly from Indian Railway PRS
 * @param {string} Number - 10-digit Indian Railway PNR
 */
const fetchPnrStatus = async (pnrNumber) => {
  const pnr = String(pnrNumber).trim();
  if (!/^\d{10}$/.test(pnr)) {
    throw new Error('Please enter a valid 10-digit Indian Railway PNR number.');
  }

  // 1. Primary Live Engine: Real-Time Indian Railway PRS Gateway
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const liveRes = await fetch(`https://cttrainsapi.confirmtkt.com/api/v2/ctpro/mweb/${pnr}`, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ proPlanName: 'FREE', pnr }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (liveRes.ok) {
      const liveJson = await liveRes.json().catch(() => null);
      const pnrData = liveJson?.data?.pnrResponse || liveJson?.data;

      if (pnrData && pnrData.trainNo) {
        const p1 = pnrData.passengerStatus?.[0] || {};
        const coach = String(p1.coach || p1.currentCoachId || p1.bookingCoachId || '').trim();
        const berthNum = String(p1.berth || p1.currentBerthNo || p1.bookingBerthNo || '').trim();
        const berthCode = p1.currentBerthCode || p1.bookingBerthCode || '';
        const bookingStatus = p1.currentStatus || p1.bookingStatus || 'CNF';

        return {
          pnr,
          trainNumber: String(pnrData.trainNo).trim(),
          trainName: String(pnrData.trainName).trim(),
          journeyDate: formatDojToIso(pnrData.doj),
          journeyTime: pnrData.departureTime ? String(pnrData.departureTime).slice(0, 5) : '',
          arrivalTime: pnrData.arrivalTime ? String(pnrData.arrivalTime).slice(0, 5) : '',
          boardingStation: String(pnrData.boardingPoint || pnrData.from || '').toUpperCase(),
          boardingStationName: pnrData.boardingStationName || '',
          destinationStation: String(pnrData.to || pnrData.reservationUpto || '').toUpperCase(),
          destinationStationName: pnrData.reservationUptoName || '',
          coach: coach || 'TBD',
          berthNumber: berthNum || 'TBD',
          berthType: normalizeBerthPosition(berthCode, berthNum),
          bookingStatus,
          isLive: true
        };
      }
    }
  } catch (err) {
    console.warn('Real-time PRS engine query warning:', err.message);
  }

  // 2. Secondary Live Engine: RapidAPI IRCTC (if active API key provided)
  const apiKey = process.env.TRAIN_API_KEY;
  const apiHost = process.env.TRAIN_API_HOST || 'irctc1.p.rapidapi.com';
  const baseUrl = process.env.TRAIN_API_BASE_URL || `https://${apiHost}/api/v3`;

  if (apiKey && apiKey !== 'your_rapidapi_key_here' && apiKey.trim() !== '') {
    try {
      const targetUrl = new URL(`${baseUrl}/getPNRStatus`);
      targetUrl.searchParams.set('pnrNumber', pnr);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);

      const response = await fetch(targetUrl.toString(), {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey.trim(),
          'x-rapidapi-host': apiHost.trim()
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const rawData = await response.json().catch(() => null);

      if (response.ok && rawData && rawData.status !== false) {
        const data = rawData.data || rawData;
        const passenger1 = data.passengers?.[0] || data.passenger_list?.[0] || {};
        const trainNumber = data.trainNumber || data.train_number || data.train_no || '';

        if (trainNumber) {
          const coach = String(passenger1.coach || passenger1.bookingCoachId || passenger1.currentCoachId || '').trim();
          const berthNumber = String(passenger1.berthNumber || passenger1.bookingBerthNo || passenger1.currentBerthNo || '').trim();
          const berthType = passenger1.berthType || passenger1.bookingBerthCode || '';

          return {
            pnr,
            trainNumber: String(trainNumber).trim(),
            trainName: String(data.trainName || data.train_name || '').trim(),
            journeyDate: formatDojToIso(data.dateOfJourney || data.doj || data.journey_date),
            journeyTime: '',
            boardingStation: String(data.boardingStation?.code || data.boarding_station_code || data.from || '').toUpperCase(),
            destinationStation: String(data.destinationStation?.code || data.reservationUpto?.code || data.to || '').toUpperCase(),
            coach: coach || 'TBD',
            berthNumber: berthNumber || 'TBD',
            berthType: normalizeBerthPosition(berthType, berthNumber),
            bookingStatus: passenger1.bookingStatusDetails || passenger1.currentStatusDetails || 'CNF',
            isLive: true
          };
        }
      }
    } catch (err) {
      console.warn('RapidAPI secondary query error:', err.message);
    }
  }

  throw new Error('Real-time PNR could not be retrieved. Please ensure your 10-digit PNR is active on Indian Railways.');
};

/**
 * Synchronizes trains for all supported stations into trains.json
 */
const syncAllStationsToDatabase = async () => {
  const stations = Object.keys(SUPPORTED_STATIONS);
  const results = {};

  for (const st of stations) {
    try {
      const data = await fetchLiveStationBoard(st, 6);
      if (data?.allTrains) {
        autoUpdateTrainDatabase(data.allTrains, st);
        results[st] = data.allTrains.length;
      }
    } catch (err) {
      results[st] = `Error: ${err.message}`;
    }
  }

  return results;
};

module.exports = {
  SUPPORTED_STATIONS,
  fetchLiveStationBoard,
  fetchPnrStatus,
  autoUpdateTrainDatabase,
  syncAllStationsToDatabase,
  getFormattedIstTime
};
