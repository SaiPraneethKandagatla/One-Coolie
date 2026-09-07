import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Zap, Calendar, ArrowRight, Building2, Train, MapPin, ChevronRight, ChevronLeft, Info, X } from 'lucide-react';
import axios from '../api/axios';
import { STATIONS } from '../utils/services';
import TrainLoader from './TrainLoader';

/* ============================================================
   TRAIN SEARCH COMPONENT — Real-Time Indian Railway Feed
   Redesigned to match premium card layout with 5-trains pagination
   ============================================================ */

const ITEMS_PER_PAGE = 5;

export default function TrainSearch({ onSelect, station, selectedTrain }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const debounceTimeout = useRef(null);
  const wrapperRef = useRef(null);
  const isSelectionChange = useRef(false);

  const stationObj = STATIONS.find((s) => s.code === station) || {
    code: station || 'KZJ',
    name: station === 'KZJ' ? 'Kazipet Jn' : station || 'Station'
  };

  // Reset pagination on search query, station, or result set changes
  useEffect(() => {
    setCurrentPage(1);
  }, [query, station, results.length]);

  // Fetch real-time trains for current station or search query
  const searchTrains = useCallback(async (searchQuery = '') => {
    setIsLoading(true);
    try {
      const { data } = await axios.get('/trains/search', {
        params: {
          query: searchQuery,
          station: station || undefined
        }
      });
      setResults(data || []);
      setIsOpen(true);
    } catch (err) {
      console.error('Error querying trains:', err);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [station]);

  // Synchronize when external selectedTrain changes or gets cleared
  useEffect(() => {
    if (!selectedTrain) {
      isSelectionChange.current = false;
    } else {
      isSelectionChange.current = true;
      setQuery(`${selectedTrain.train_no} · ${selectedTrain.train_name}`);
      setIsOpen(false);
    }
  }, [selectedTrain]);

  // Query on user input
  useEffect(() => {
    if (isSelectionChange.current) {
      isSelectionChange.current = false;
      return;
    }

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

    if (query.trim().length === 0) {
      if (station) {
        searchTrains('');
      } else {
        setResults([]);
        setIsOpen(true);
      }
      return;
    }

    debounceTimeout.current = setTimeout(() => {
      searchTrains(query.trim());
    }, 300);

    return () => clearTimeout(debounceTimeout.current);
  }, [query, station, searchTrains]);

  const handleSelect = (train) => {
    isSelectionChange.current = true;
    setQuery(`${train.train_no} · ${train.train_name}`);
    setIsOpen(false);
    if (onSelect) {
      onSelect({
        train_no: train.train_no,
        train_name: train.train_name,
        from: train.from,
        to: train.to,
        stops: train.stops || [{ code: station }],
        platform: train.platform,
        expected_arrival: train.expected_arrival,
        expected_departure: train.expected_departure,
        scheduled_arrival: train.scheduled_arrival,
        scheduled_departure: train.scheduled_departure,
        delay_minutes: train.delay_minutes,
        status: train.status,
        is_live: train.is_live
      });
    }
  };

  // Utility: determine if train arrival/departure falls in 0-4 hour window from current IST time
  const getTrainTimeInfo = useCallback((train) => {
    const timeStr = train.expected_arrival || train.scheduled_arrival || train.expected_departure || train.scheduled_departure;

    if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) {
      const isLive = Boolean(train.is_live);
      return { isWithin4Hours: isLive, diffMinutes: 0 };
    }

    const str = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const now = new Date(str);
    const currentDayMinutes = now.getHours() * 60 + now.getMinutes();

    const parts = timeStr.split(':');
    const hh = parseInt(parts[0], 10);
    const mm = parseInt(parts[1], 10);

    if (isNaN(hh) || isNaN(mm)) {
      const isLive = Boolean(train.is_live);
      return { isWithin4Hours: isLive, diffMinutes: 0 };
    }

    let trainMin = hh * 60 + mm;
    let diff = trainMin - currentDayMinutes;

    if (diff < -720) diff += 1440;
    if (diff > 720) diff -= 1440;

    // Active live window: from -10 mins (at station) up to +240 mins (4 hours)
    const isWithin4Hours = (diff >= -10 && diff <= 240);

    return { isWithin4Hours, diffMinutes: diff };
  }, []);

  // Real-time clock tick every 30 seconds to update train status dynamically as time advances into 4h window
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setClockTick((t) => t + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Pagination Slice
  const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedResults = results.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div ref={wrapperRef} className="space-y-3.5 w-full max-w-full min-w-0">

      {/* ── Top Header Row ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
        <label className="text-sm sm:text-base font-bold text-zinc-900 tracking-tight">
          Train Number or Name
        </label>
        {station && (
          <button
            type="button"
            onClick={() => searchTrains('')}
            className="bg-blue-50 hover:bg-blue-100/80 text-blue-600 font-bold px-3.5 py-1.5 rounded-full text-xs transition-all flex items-center gap-1.5 border border-blue-100 cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
          >
            <Zap className="w-3.5 h-3.5 text-blue-600 fill-blue-600 animate-pulse" />
            <span>Live Trains at {station}</span>
          </button>
        )}
      </div>

      {/* ── Search Input Box ────────────────────────────────────── */}
      <div className="relative w-full min-w-0">
        <Search className="w-4.5 h-4.5 text-blue-600 absolute left-4 top-1/2 -translate-y-1/2 shrink-0 pointer-events-none" />
        <input
          type="text"
          value={query}
          onFocus={() => {
            if (!selectedTrain) {
              if (results.length === 0 && station) searchTrains(query);
              else setIsOpen(true);
            }
          }}
          onChange={(e) => {
            isSelectionChange.current = false;
            setQuery(e.target.value);
            setIsOpen(true);
            if (selectedTrain && onSelect) {
              onSelect(null);
            }
          }}
          placeholder={`Search train number or name (e.g. 12615, Charminar Express...)`}
          className="w-full pl-11 pr-11 py-3.5 bg-[#fafbfc] border border-blue-200/80 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 rounded-2xl text-sm font-medium text-zinc-900 outline-none transition-all placeholder:text-zinc-400 shadow-2xs"
        />

        {query ? (
          <button
            type="button"
            onClick={() => {
              isSelectionChange.current = false;
              setQuery('');
              setIsOpen(true);
              if (onSelect) onSelect(null);
              if (station) searchTrains('');
            }}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        ) : isLoading ? (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : null}
      </div>

      {/* ── Station Filter Indicator Bar ──────────────────────────── */}
      {!selectedTrain && (
        <div className="p-3 bg-[#f0f7ff] border border-blue-100/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs font-semibold text-zinc-700 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate">
              Station: <strong className="text-zinc-900 font-extrabold">{stationObj.code} – {stationObj.name}</strong>
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/80 shrink-0 self-start sm:self-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            Showing Live (0–4 hrs) &amp; Advance Schedule
          </span>
        </div>
      )}

      {/* ── Train List Result Cards (5 Per Page) ────────────────── */}
      {isOpen && !selectedTrain && (
        <div className="space-y-3 pt-1 animate-fade-in w-full min-w-0">
          {isLoading ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-200/80 shadow-2xs">
              <TrainLoader
                fullScreen={false}
                size="sm"
                text="Scanning Live Trains..."
                subtext={`Checking real-time railway schedule for station ${stationObj.code}...`}
              />
            </div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center bg-white rounded-2xl border border-slate-200/70 text-xs text-zinc-500">
              No trains found matching "{query}". Enter specific train number or station name.
            </div>
          ) : (
            paginatedResults.map((train) => {
              const timeInfo = getTrainTimeInfo(train);
              const isWithin4Hours = timeInfo.isWithin4Hours;
              const isLive = train.is_live && isWithin4Hours;
              const hasDelay = isLive && train.delay_minutes > 5;
              const isSelected = query.includes(train.train_no);

              return (
                <div
                  key={`${train.train_no}-${train.expected_arrival || train.scheduled_arrival || ''}`}
                  onClick={() => handleSelect(train)}
                  className={`bg-white hover:bg-slate-50/90 border rounded-2xl p-3.5 sm:p-4 transition-all cursor-pointer shadow-xs hover:shadow-md group flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 min-w-0 ${isSelected ? 'border-blue-600 ring-2 ring-blue-600/10 bg-blue-50/20' : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                >
                  {/* Left Column: Train Details */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Blue Train Icon Box */}
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-50/90 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Train className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="font-mono text-sm sm:text-base font-black text-zinc-900">
                          {train.train_no}
                        </span>
                        <p className="font-bold text-sm sm:text-base text-zinc-900 truncate">
                          {train.train_name}
                        </p>
                      </div>

                      <p className="text-xs text-zinc-500 font-medium truncate">
                        {train.from?.name || 'Origin'} → {train.to?.name || 'Destination'}
                      </p>

                      {/* Status Badges Row */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {isWithin4Hours ? (
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${hasDelay
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${hasDelay ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`} />
                            {hasDelay ? `Delayed by ${train.delay_minutes} min` : train.status || 'On Time'}
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200/90 inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-purple-600" />
                            Advance Schedule
                          </span>
                        )}

                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1 ${isWithin4Hours
                              ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
                              : 'bg-slate-100 text-zinc-600 border border-slate-200'
                            }`}
                        >
                          {isWithin4Hours ? (
                            <>
                              <Zap className="w-3 h-3 text-blue-600 fill-blue-600 animate-pulse" />
                              Live Update
                            </>
                          ) : (
                            'Scheduled'
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Platform & Arrival Time */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-left sm:text-right space-y-0.5">
                      <div className="flex items-center sm:justify-end gap-1.5">
                        <span className="text-xs text-zinc-500 font-medium">Platform</span>
                        <span
                          className={`w-6 h-6 rounded-lg font-black font-mono text-xs inline-flex items-center justify-center border shadow-2xs ${isWithin4Hours
                              ? 'bg-blue-50 text-blue-600 border-blue-100'
                              : 'bg-slate-100 text-zinc-600 border-slate-200'
                            }`}
                        >
                          {train.platform || '1'}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 font-medium">
                        {isWithin4Hours ? `Arriving at ${station}` : `Scheduled at ${station}`}
                      </p>
                      <p
                        className={`text-sm sm:text-base font-black font-mono ${isWithin4Hours ? 'text-zinc-900' : 'text-purple-900/90'
                          }`}
                      >
                        {train.expected_arrival || train.scheduled_arrival || '11:25 AM'}
                      </p>
                    </div>

                    <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition-colors shrink-0 border border-blue-100/60">
                      <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Pagination Controls (5 Trains Per Page) ────────────────── */}
      {results.length > ITEMS_PER_PAGE && (
        <div className="p-3 bg-white rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3 text-xs font-medium shadow-2xs animate-fade-in">
          <div className="text-zinc-500 font-mono text-[11px] sm:text-xs">
            Showing <span className="font-bold text-zinc-900">{startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, results.length)}</span> of <span className="font-bold text-zinc-900">{results.length}</span> trains
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => {
                setCurrentPage((p) => Math.max(1, p - 1));
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-zinc-800 font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all flex items-center gap-1 shadow-2xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Previous</span>
            </button>

            <span className="px-2.5 py-1 font-mono font-bold text-xs text-blue-600 bg-blue-50 rounded-lg border border-blue-100">
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => {
                setCurrentPage((p) => Math.min(totalPages, p + 1));
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-zinc-800 font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all flex items-center gap-1 shadow-2xs"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* End of TrainSearch */}
    </div>
  );
}