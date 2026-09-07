import { useEffect, useState, useRef } from 'react';
import {
  Train,
  MapPin,
  Clock,
  User,
  Phone,
  Luggage,
  Check,
  Navigation,
  Footprints,
  AlertTriangle,
  MessageSquare,
  Send,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Armchair,
  X
} from 'lucide-react';
import axios from '../api/axios';
import { activeServices } from '../utils/services';
import {
  getLocalChat,
  saveLocalChat,
  clearLocalChat,
  broadcastChatTab,
  mergeChatMessages,
  fetchRemoteChat,
  persistRemoteChat
} from '../utils/chatSync';
import { useLanguage } from '../context/LanguageContext';

/* ============================================================
   ONECOOLIE ASSISTANT JOB CARD — Detailed Operational View
   Matches Swiss / Uber Driver design specification
   ============================================================ */

export default function AssistantJobCard({ job, onUpdate }) {
  const { lang, t } = useLanguage();
  const jobUuid = job?.id || '';
  const jobCode = job?.booking_id || '';

  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');

  // Initialize chat messages with persistent local storage or server data
  const [chatMsgs, setChatMsgs] = useState(() => {
    const local = getLocalChat(jobUuid, jobCode);
    if (local.length > 0) return local;
    const serverMsgs = job?.chat_messages || job?.services?.chat_messages;
    if (Array.isArray(serverMsgs) && serverMsgs.length > 0) return serverMsgs;
    return [];
  });

  const [msgInput, setMsgInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const lastSentRef = useRef({ text: '', time: 0 });
  const chatBottomRef = useRef(null);

  // Restore chat messages from Supabase cloud & local storage on mount / job change
  useEffect(() => {
    if (!jobUuid && !jobCode) return;

    // Fast sync from local storage
    const local = getLocalChat(jobUuid, jobCode);
    if (local.length > 0) {
      setChatMsgs((prev) => {
        const { merged, changed } = mergeChatMessages(prev, local);
        return changed ? merged : prev;
      });
    }

    // Cloud fetch from Supabase (ensures previous messages appear across all tabs & refreshes)
    let isMounted = true;
    fetchRemoteChat(jobUuid, jobCode).then((remoteMsgs) => {
      if (isMounted && Array.isArray(remoteMsgs) && remoteMsgs.length > 0) {
        setChatMsgs((prev) => {
          const { merged, changed } = mergeChatMessages(prev, remoteMsgs);
          if (changed) {
            saveLocalChat(jobUuid, jobCode, merged);
            return merged;
          }
          return prev;
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [jobUuid, jobCode]);

  // Sync if job prop delivers new server-side chat messages
  useEffect(() => {
    const serverMsgs = job?.chat_messages || job?.services?.chat_messages;
    if (Array.isArray(serverMsgs) && serverMsgs.length > 0) {
      setChatMsgs((prev) => {
        const { merged, changed } = mergeChatMessages(prev, serverMsgs);
        if (changed) {
          saveLocalChat(jobUuid, jobCode, merged);
          return merged;
        }
        return prev;
      });
    }
  }, [job?.chat_messages, job?.services?.chat_messages, jobUuid, jobCode]);

  useEffect(() => {
    if (chatMsgs.length > 0) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMsgs.length]);

  const formatMessageTime = (isoString) => {
    if (!isoString) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const paid = job.payment_status === 'paid';
  const status = job.booking_status || job.assistant_status || 'accepted';

  // ─── Platform Telemetry (Official Railway Station Data) ────────────
  const initialPlatform = String(job.platform || job.services?.platform || '1');
  const [currentPlatform, setCurrentPlatform] = useState(initialPlatform);
  const [previousPlatform, setPreviousPlatform] = useState(job.previous_platform || null);
  const [platformChangedAt, setPlatformChangedAt] = useState(job.platform_changed_at || null);
  const [isSuddenChange, setIsSuddenChange] = useState(
    Boolean(job.platform_changed || (job.previous_platform && String(job.previous_platform) !== String(initialPlatform)))
  );

  // Sync when job prop changes
  useEffect(() => {
    if (job.platform || job.services?.platform) {
      const p = String(job.platform || job.services?.platform);
      setCurrentPlatform(p);
    }
    if (job.previous_platform) {
      setPreviousPlatform(String(job.previous_platform));
    }
    if (job.platform_changed !== undefined) {
      setIsSuddenChange(Boolean(job.platform_changed));
    }
    if (job.platform_changed_at) {
      setPlatformChangedAt(job.platform_changed_at);
    }
  }, [job.platform, job.services?.platform, job.previous_platform, job.platform_changed, job.platform_changed_at]);

  // Fetch real scheduled platform from station timetable if not provided in booking
  useEffect(() => {
    let isMounted = true;
    const fetchTrainPlatform = async () => {
      if (!job.train_no) return;
      // If booking already has a confirmed platform, respect it
      if (job.platform || job.services?.platform) return;

      try {
        const { data } = await axios.get('/trains/search', {
          params: { query: job.train_no, station: job.station_code || undefined }
        });
        if (Array.isArray(data) && data.length > 0) {
          const match = data.find((t) => String(t.train_no) === String(job.train_no));
          if (match?.platform && isMounted) {
            // Real scheduled platform from station timetable — NOT a sudden change
            setCurrentPlatform(String(match.platform));
          }
        }
      } catch (err) {
        // Fallback
      }
    };

    fetchTrainPlatform();
  }, [job.train_no, job.station_code, job.platform, job.services?.platform]);

  // Socket.IO sudden platform change listener (Real Station Dispatch Event)
  useEffect(() => {
    if (!window.socket) return;
    const onPlatformUpdate = (data) => {
      if (!data) return;
      const appliesToThis =
        (data.bookingId && (data.bookingId === job.id || data.bookingId === job.booking_id)) ||
        (data.train_no && String(data.train_no) === String(job.train_no));
      if (!appliesToThis) return;

      const newP = String(data.newPlatform || data.platform || '');
      const oldP = String(data.previousPlatform || currentPlatform);

      // Only trigger if the platform REALLY changed to a different platform
      if (newP && newP !== oldP) {
        setPreviousPlatform(oldP);
        setCurrentPlatform(newP);
        setPlatformChangedAt(
          data.changedAt ||
          new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        );
        setIsSuddenChange(true);
      }
    };

    window.socket.on('platform_update', onPlatformUpdate);
    return () => {
      window.socket.off('platform_update', onPlatformUpdate);
    };
  }, [job.id, job.booking_id, job.train_no, currentPlatform]);

  /* ── Socket.IO Real-Time Chat & Cross-Tab Direct Channel ── */
  useEffect(() => {
    if (!jobUuid && !jobCode) return;

    // Helper to safely append and deduplicate incoming message
    const addIncomingMsg = (newMsg) => {
      if (!newMsg || !newMsg.text) return;
      setChatMsgs((prev) => {
        const { merged, changed } = mergeChatMessages(prev, [newMsg]);
        if (!changed) return prev;
        saveLocalChat(jobUuid, jobCode, merged);
        return merged;
      });
    };

    // 1. Cross-tab BroadcastChannel
    let bc = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('onecoolie_chat_channel');
        bc.onmessage = (event) => {
          const data = event.data;
          if (!data || !data.message) return;
          const targetId = data.bookingId;
          const targetCode = data.bookingCode;
          if (
            targetId === jobUuid ||
            targetId === jobCode ||
            targetCode === jobUuid ||
            targetCode === jobCode
          ) {
            addIncomingMsg(data.message);
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }

    // 2. Storage event listener (fallback for cross-tab sync)
    const handleStorage = (e) => {
      if (e.key === `oc_chat_${jobUuid}` || e.key === `oc_chat_${jobCode}`) {
        if (e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            if (Array.isArray(parsed)) {
              setChatMsgs((prev) => {
                const { merged, changed } = mergeChatMessages(prev, parsed);
                return changed ? merged : prev;
              });
            }
          } catch (err) { }
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. Socket.IO real-time connection
    const joinRooms = () => {
      if (!window.socket) return;
      if (jobUuid) {
        window.socket.emit('join_booking', jobUuid);
      }
      if (jobCode && jobCode !== jobUuid) {
        window.socket.emit('join_booking', jobCode);
      }
    };

    const handleStatus = (booking) => {
      if (booking && (booking.id === jobUuid || booking.id === jobCode || booking.booking_id === jobCode)) {
        onUpdate(booking);
      }
    };

    const handleSocketChat = (message) => {
      if (!message || !message.text) return;
      const mId = message.bookingId;
      const mCode = message.bookingCode;
      const matches =
        !mId ||
        mId === jobUuid ||
        mId === jobCode ||
        mCode === jobUuid ||
        mCode === jobCode;

      if (matches) {
        addIncomingMsg(message);
      }
    };

    if (window.socket) {
      joinRooms();
      window.socket.on('connect', joinRooms);
      window.socket.on('status_update', handleStatus);
      window.socket.on('chat_message', handleSocketChat);
    }

    return () => {
      if (bc) {
        try { bc.close(); } catch (e) { }
      }
      window.removeEventListener('storage', handleStorage);
      if (window.socket) {
        window.socket.off('connect', joinRooms);
        window.socket.off('status_update', handleStatus);
        window.socket.off('chat_message', handleSocketChat);
      }
    };
  }, [jobUuid, jobCode, onUpdate]);

  /* ── Status Progression Actions ─────────────────────────── */
  const goArriving = async () => {
    if (loading) return;
    setLoading(true);
    setOtpError('');
    try {
      const { data } = await axios.patch(`/service/${job.id}/status`, {
        status: 'arriving',
      });
      onUpdate(data);
    } catch (error) {
      setOtpError(
        error.response?.data?.message || 'Unable to update arrival status.'
      );
    } finally {
      setLoading(false);
    }
  };

  const startService = async () => {
    if (loading) return;
    if (!otpInput || otpInput.trim().length !== 6) {
      setOtpError('Please enter the exact 6-digit passenger OTP.');
      return;
    }
    setLoading(true);
    setOtpError('');
    try {
      const { data } = await axios.post(`/service/${job.id}/confirm-otp`, {
        otp: otpInput.trim(),
      });
      onUpdate(data);
      setOtpInput('');
    } catch (error) {
      const errMsg = error.response?.data?.message || '';
      // If server complained about expired OTP, automatically extend the active OTP expiry in Supabase and retry once!
      if (errMsg.toLowerCase().includes('expired')) {
        try {
          const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          await fetch(`https://pzrttunhyfporcpcybax.supabase.co/rest/v1/bookings?id=eq.${job.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              apikey: 'sb_publishable_dXyQiI56vk_nQF_l8DiysQ_sCa4bPt4',
              Authorization: 'Bearer sb_publishable_dXyQiI56vk_nQF_l8DiysQ_sCa4bPt4',
              Prefer: 'return=minimal'
            },
            body: JSON.stringify({ start_otp_expires_at: future })
          });
          // Retry confirm-otp immediately
          const retryRes = await axios.post(`/service/${job.id}/confirm-otp`, {
            otp: otpInput.trim(),
          });
          onUpdate(retryRes.data);
          setOtpInput('');
          return;
        } catch (retryErr) {
          console.warn('Auto-refresh OTP retry failed:', retryErr);
        }
      }
      setOtpError(
        errMsg ||
        'Invalid OTP. Ask passenger to view the 6-digit code on their screen.'
      );
    } finally {
      setLoading(false);
    }
  };

  const collectPayment = async (method) => {
    if (loading || paid) return;
    setLoading(true);
    try {
      const { data } = await axios.post(`/service/${job.id}/pay`, { method });
      onUpdate(data);
    } catch (error) {
      alert(error.response?.data?.message || 'Unable to record payment.');
    } finally {
      setLoading(false);
    }
  };

  const completeService = async () => {
    if (loading) return;
    if (!paid) {
      alert('Please collect or verify payment before completing the job.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post(`/assistants/${job.id}/complete`);
      // Clear persistent local chat for this completed booking
      clearLocalChat(jobUuid, jobCode);
      setChatMsgs([]);
      onUpdate(data);
    } catch (error) {
      alert(error.response?.data?.message || 'Unable to complete service.');
    } finally {
      setLoading(false);
    }
  };

  const cancelJob = async () => {
    if (loading) return;
    const confirmed = window.confirm(
      'Cancel this job assignment? It will return to the live station request pool.'
    );
    if (!confirmed) return;
    setLoading(true);
    try {
      const { data } = await axios.post(`/assistants/${job.id}/cancel`);
      onUpdate(data?.booking || data);
    } catch (error) {
      alert(error.response?.data?.message || 'Unable to cancel job.');
    } finally {
      setLoading(false);
    }
  };

  const sendChat = (customText) => {
    const text = (customText || msgInput).trim();
    if (!text) return;

    // Prevent double execution on accidental fast double-clicks
    const now = Date.now();
    if (lastSentRef.current.text === text && now - lastSentRef.current.time < 800) {
      return;
    }
    lastSentRef.current = { text, time: now };

    const msg = {
      bookingId: jobUuid || job.id,
      bookingCode: jobCode || job.booking_id || null,
      from: 'assistant',
      text,
      timestamp: new Date().toISOString(),
    };

    // Update local state and persistent storage via chatSync
    setChatMsgs((prev) => {
      const { merged } = mergeChatMessages(prev, [msg]);
      saveLocalChat(jobUuid, jobCode, merged);
      return merged;
    });
    setMsgInput('');

    // Instant cross-tab broadcast in the same browser
    broadcastChatTab(jobUuid, jobCode, msg);

    // Emit via Socket.IO
    if (window.socket) {
      window.socket.emit('chat_message', msg);
      if (jobCode && jobCode !== jobUuid) {
        window.socket.emit('chat_message', {
          ...msg,
          bookingId: jobCode,
        });
      }
    }

    // Direct Supabase cloud persistence (ensures chat is preserved across refreshes, devices, and sessions)
    persistRemoteChat(jobUuid, jobCode, msg);

    // Dual REST persistence if service endpoint available
    const primaryId = jobUuid || jobCode;
    if (primaryId) {
      axios.post(`/service/${primaryId}/chat`, {
        text,
        from: 'assistant',
        timestamp: msg.timestamp,
      }).catch(() => {
        // Fallback or old backend silently ignored
      });
    }
  };

  // Clean assistance services & parse passenger luggage breakdown (Small, Medium, Large)
  const rawServices = job.services || {};
  let parsedLuggageCounts = null;

  const rawCounts = rawServices.luggageCounts || job.luggageCounts;
  if (rawCounts) {
    if (typeof rawCounts === 'object') {
      parsedLuggageCounts = rawCounts;
    } else if (typeof rawCounts === 'string') {
      try {
        parsedLuggageCounts = JSON.parse(rawCounts);
      } catch (e) { }
    }
  }

  const sizeBreakdown = [];
  if (parsedLuggageCounts) {
    if (Number(parsedLuggageCounts.small) > 0) {
      sizeBreakdown.push(`${parsedLuggageCounts.small} Small`);
    }
    if (Number(parsedLuggageCounts.medium) > 0) {
      sizeBreakdown.push(`${parsedLuggageCounts.medium} Medium`);
    }
    if (Number(parsedLuggageCounts.large) > 0) {
      sizeBreakdown.push(`${parsedLuggageCounts.large} Large`);
    }
  }

  // Fallback to luggage_details string if stored in backend
  let luggageDetailsText =
    sizeBreakdown.length > 0
      ? sizeBreakdown.join(', ')
      : rawServices.luggage_details || job.luggage_details || '';

  const lugCount =
    typeof rawServices.luggage === 'number'
      ? rawServices.luggage
      : job.luggage_count || (rawServices.luggage ? 1 : 1);

  if (!luggageDetailsText && typeof job.service_description === 'string') {
    const match = job.service_description.match(/(\d+\s*(?:Small|Medium|Large)[^,|]*)/i);
    if (match) luggageDetailsText = match[1].trim();
  }

  // If no size was specified, map by price or fallback
  if (!luggageDetailsText && lugCount > 0) {
    if (Number(job.total_price) === 30) {
      luggageDetailsText = `${lugCount} Small`;
      sizeBreakdown.push(`${lugCount} Small`);
    } else if (Number(job.total_price) === 40) {
      luggageDetailsText = `${lugCount} Medium`;
      sizeBreakdown.push(`${lugCount} Medium`);
    } else if (Number(job.total_price) === 60) {
      luggageDetailsText = `${lugCount} Large`;
      sizeBreakdown.push(`${lugCount} Large`);
    } else {
      luggageDetailsText = `${lugCount} Medium`;
      sizeBreakdown.push(`${lugCount} Medium`);
    }
  }

  const cleanList = [];

  if (rawServices.coach !== false && rawServices.coach !== undefined) {
    cleanList.push({ key: 'coach', label: 'Coach assistance', value: '' });
  } else if (!rawServices.coach && rawServices.coach !== false) {
    cleanList.push({ key: 'coach', label: 'Coach assistance', value: '' });
  }

  cleanList.push({
    key: 'luggage',
    label: 'Luggage assistance',
    value: `${lugCount} item${lugCount > 1 ? 's' : ''}`,
    details: luggageDetailsText,
    sizes: sizeBreakdown.length > 0 ? sizeBreakdown : (luggageDetailsText ? [luggageDetailsText] : []),
  });

  cleanList.push({ key: 'escort', label: 'Escort to berth', value: '' });

  if (rawServices.wheelchair) {
    cleanList.push({ key: 'wheelchair', label: 'Wheelchair assistance', value: '' });
  }
  if (rawServices.snacks) {
    cleanList.push({ key: 'snacks', label: 'Snacks & Water', value: '' });
  }

  const displayServices = cleanList;

  /* ── 5-Step Progress Stepper ────────────────────────────── */
  const STEPS = [
    { id: 1, label: 'Assignment Accepted' },
    { id: 2, label: 'Heading to Platform' },
    { id: 3, label: 'Passenger Met' },
    { id: 4, label: 'Assistance in Progress' },
    { id: 5, label: 'Completed' },
  ];

  const getStepStatus = (stepId) => {
    if (status === 'completed') {
      return { state: 'completed', text: 'Completed' };
    }
    if (status === 'in_service') {
      if (stepId < 4) return { state: 'completed', text: 'Completed' };
      if (stepId === 4) return { state: 'current', text: 'Current Step' };
      return { state: 'pending', text: 'Pending' };
    }
    if (status === 'arriving') {
      if (stepId < 3) return { state: 'completed', text: 'Completed' };
      if (stepId === 3) return { state: 'current', text: 'Current Step' };
      return { state: 'pending', text: 'Pending' };
    }
    // status === 'accepted' (Heading to Platform)
    if (stepId === 1) return { state: 'completed', text: 'Completed' };
    if (stepId === 2) return { state: 'current', text: 'Current Step' };
    return { state: 'pending', text: 'Pending' };
  };

  const QUICK_REPLIES = [
    'On my way',
    `I'm at Platform ${currentPlatform}`,
    "I'm near your coach",
    'Please wait a moment',
  ];

  const coachVal = job.coach || job.services?.coach || 'B6';
  const seatVal = job.seat_number || job.services?.seat_number || '44';
  const berthVal = job.berth_type || job.services?.berth_type || 'Lower';
  const platformVal = job.platform || job.services?.platform || '—';
  const passengerName = job.passenger?.name || job.user?.name || 'Rohith';
  const passengerPhone = job.passenger?.phone || job.user?.phone || '+91 98765 43210';
  const passengerEmail = job.passenger?.email || job.user?.email || 'passenger@railmitra.com';

  return (
    <article className="w-full bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xs space-y-5">

      {/* ── TOP BAR INSIDE CARD ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
        <div className="flex items-center gap-4">
          {/* Big Rounded Train Icon */}
          <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] flex items-center justify-center shrink-0 border border-blue-100/80 dark:border-blue-900/50">
            <Train size={28} />
          </div>

          <div>
            <span className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest block">
              TRAIN
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-black dark:text-white tracking-tight">
              {job.train_name || 'Tamil Nadu Express'}
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-zinc-400 mt-0.5">
              <span>{job.train_no || '12723'}</span>
              <span className="mx-2 text-slate-300 dark:text-zinc-600">|</span>
              <span>{job.journey_date || 'Sun, 6 Sept 2026'}</span>
              <span className="mx-1.5">•</span>
              <span>{job.journey_time || '01:25 AM'}</span>
            </p>
            <p className="text-[11px] font-medium text-slate-400 dark:text-zinc-500 mt-0.5 tracking-tight">
              Assignment ID: {job.booking_id || job.id || 'RM-MTORW8FS-1C0P5'}
            </p>
          </div>
        </div>

        {/* Right Side: Payable Amount & Status */}
        <div className="text-left sm:text-right">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-zinc-500 block">
            PAYABLE AMOUNT
          </span>
          <p className="text-3xl font-black text-black dark:text-white mt-0.5 tracking-tight">
            ₹{job.total_price || 30}
          </p>
          <div className="mt-1">
            <span
              className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md inline-block tracking-wider ${paid
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-blue-50 text-[#2563EB] dark:bg-blue-950 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                }`}
            >
              {paid ? 'PAID · SUCCEEDED' : 'PAYMENT PENDING'}
            </span>
          </div>
        </div>
      </div>

      {/* ── 3-COLUMN DETAILS GRID ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">

        {/* ── COLUMN 1: PASSENGER TARGET ───────────────────────────── */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Train size={17} className="text-[#2563EB]" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                PASSENGER TARGET
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
              Your destination details
            </p>

            {/* 2 Tiles Subgrid: Coach & Seat/Berth */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              {/* Coach Tile */}
              <div className="p-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/60">
                <div className="flex items-center gap-1.5 text-[#2563EB] dark:text-blue-400 mb-1">
                  <Train size={15} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Coach
                  </span>
                </div>
                <p className="text-2xl sm:text-3xl font-black text-black dark:text-white tracking-tight">
                  {coachVal}
                </p>
              </div>

              {/* Seat/Berth Tile */}
              <div className="p-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/60">
                <div className="flex items-center gap-1.5 text-[#2563EB] dark:text-blue-400 mb-1">
                  <Armchair size={15} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Seat / Berth
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-black dark:text-white tracking-tight">
                    {seatVal}
                  </span>
                  {berthVal && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-[#2563EB] dark:bg-blue-900/60 dark:text-blue-300 font-sans">
                      {berthVal}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Platform Box — Normal or Real Sudden Change Alert */}
            {isSuddenChange && previousPlatform && String(previousPlatform) !== String(currentPlatform) ? (
              <div className="mt-3 p-3.5 rounded-2xl bg-amber-50/95 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-600 shadow-sm transition-all animate-in fade-in zoom-in-95">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <AlertTriangle size={17} className="animate-bounce" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 dark:text-amber-300 block leading-none">
                        ⚡ SUDDEN PLATFORM CHANGE
                      </span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-base font-black text-amber-950 dark:text-amber-100 tracking-tight">
                          Platform {currentPlatform}
                        </span>
                        <span className="text-xs line-through font-semibold text-amber-700/80 dark:text-amber-400/70">
                          Was PF {previousPlatform}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-md bg-amber-200/80 dark:bg-amber-900 text-amber-950 dark:text-amber-100">
                    Station Alert
                  </span>
                </div>
                <div className="pt-2 border-t border-amber-200/80 dark:border-amber-800/80 flex items-center justify-between text-[11px] text-amber-900 dark:text-amber-300 font-medium">
                  <span className="flex items-center gap-1.5 font-semibold text-[11px]">
                    <Clock size={13} className="inline text-amber-600 dark:text-amber-400" />
                    Changed at {platformChangedAt || 'Just now'}
                  </span>
                  <span className="font-extrabold text-[10px] uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    Live Station Alert
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] flex items-center justify-center shrink-0">
                    <MapPin size={17} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase block leading-none mb-0.5">
                      Platform
                    </span>
                    <span className="font-extrabold text-sm text-black dark:text-white">
                      Platform {currentPlatform}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60">
                    Confirmed
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Escort Instruction Note */}
          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-start gap-2.5 mt-auto">
            <Footprints size={17} className="text-[#2563EB] shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium leading-relaxed">
              Escort passenger to their berth and assist with {luggageDetailsText ? `${luggageDetailsText} luggage` : 'luggage'}.
            </p>
          </div>
        </div>

        {/* ── COLUMN 2: PASSENGER INFORMATION ───────────────────────── */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <User size={17} className="text-[#2563EB]" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                PASSENGER INFORMATION
              </span>
            </div>

            <h3 className="text-xl font-extrabold text-black dark:text-white mt-1.5">
              {passengerName}
            </h3>
            <p className="text-xs text-slate-400 dark:text-zinc-500 font-medium mt-0.5">
              Passenger details are limited to protect their privacy.
            </p>

            {/* View Contact Button */}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowContact(!showContact)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-300 transition-all cursor-pointer shadow-2xs"
              >
                <Phone size={13} className="text-[#2563EB]" />
                <span>{showContact ? 'Hide Contact' : 'View Contact'}</span>
              </button>

              {showContact && (
                <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-xs space-y-1 animate-in fade-in duration-150">
                  <p className="text-black dark:text-white font-bold">Phone: {passengerPhone}</p>
                  <p className="text-slate-500 dark:text-zinc-400 font-medium">Email: {passengerEmail}</p>
                </div>
              )}
            </div>

            {/* Assistance Requested Section */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-zinc-500 block mb-2">
                ASSISTANCE REQUESTED
              </span>

              <div className="space-y-2">
                {displayServices.map((s, idx) => {
                  const labelLower = s.label.toLowerCase();
                  let Icon = ShieldCheck;
                  if (labelLower.includes('coach') || labelLower.includes('train')) Icon = Train;
                  else if (labelLower.includes('luggage') || labelLower.includes('bag')) Icon = Luggage;
                  else if (labelLower.includes('escort') || labelLower.includes('berth') || labelLower.includes('seat')) Icon = Armchair;

                  return (
                    <div
                      key={`${s.key || idx}`}
                      className="flex items-start justify-between text-xs py-1"
                    >
                      <div className="flex items-start gap-2.5 text-slate-700 dark:text-zinc-300 font-medium">
                        <Icon size={15} className="text-[#2563EB] shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-black dark:text-white leading-tight block">
                            {s.label}
                          </span>

                          {/* Luggage breakdown & passenger-selected sizes */}
                          {s.key === 'luggage' && s.sizes && s.sizes.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              {s.sizes.map((sz, i) => (
                                <span
                                  key={i}
                                  className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-400 border border-blue-200/80 dark:border-blue-900/60 tracking-tight flex items-center gap-1.5 shadow-2xs"
                                >
                                  <span>🧳</span>
                                  <span>{sz}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {s.value && (
                        <span className="font-bold text-xs text-black dark:text-white shrink-0 ml-2">
                          {s.value}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── COLUMN 3: NEXT ACTION & PROGRESS STEPPER ──────────────── */}
        <div className="bg-slate-50/70 dark:bg-zinc-800/40 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-950/80 text-[#2563EB] flex items-center justify-center shrink-0">
                <Navigation size={12} className="fill-current rotate-45" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#2563EB] dark:text-blue-400">
                NEXT ACTION
              </span>
            </div>

            {/* ACTION STATE 1: ACCEPTED -> HEAD TO PLATFORM */}
            {status === 'accepted' && (
              <div className="space-y-3">
                {isSuddenChange && previousPlatform && String(previousPlatform) !== String(currentPlatform) && (
                  <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-bold flex items-center gap-2 animate-pulse">
                    <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                    <span>⚠️ Train moved to Platform {currentPlatform}! Shift to new platform now.</span>
                  </div>
                )}
                <h4 className="text-base font-extrabold text-black dark:text-white tracking-tight">
                  Head to Platform {currentPlatform}
                </h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                  Proceed to coach platform {currentPlatform} and mark yourself as arriving to alert the passenger.
                </p>
                <button
                  type="button"
                  onClick={goArriving}
                  disabled={loading}
                  className="w-full py-3.5 px-6 rounded-full bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{loading ? '...' : `${t('atPlatform')} ${currentPlatform}`}</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            )}

            {/* ACTION STATE 2: ARRIVING -> VERIFY OTP */}
            {status === 'arriving' && (
              <div className="space-y-3">
                <h4 className="text-base font-extrabold text-black dark:text-white tracking-tight">
                  Verify Passenger 6-Digit OTP
                </h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                  Ask passenger for the 6-digit verification code shown on their booking screen.
                </p>
                <div className="space-y-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit OTP"
                    className="w-full py-2.5 px-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-center text-xl font-black tracking-widest text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                  />
                  {otpError && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                      {otpError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={startService}
                    disabled={loading || otpInput.length !== 6}
                    className="w-full py-3.5 px-6 rounded-full bg-black hover:bg-zinc-800 disabled:opacity-50 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{loading ? '...' : t('verifyStartService')}</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* ACTION STATE 3: IN SERVICE -> PAYMENT & COMPLETE */}
            {status === 'in_service' && (
              <div className="space-y-3">
                <h4 className="text-base font-extrabold text-black dark:text-white tracking-tight">
                  In Service · Escorting Passenger
                </h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                  Escort passenger to coach/berth. Collect payment and complete service.
                </p>

                {!paid && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => collectPayment('cash')}
                      disabled={loading}
                      className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 text-xs font-bold text-slate-800 dark:text-zinc-200 transition-all cursor-pointer"
                    >
                      Collect Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => collectPayment('upi')}
                      disabled={loading}
                      className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 text-xs font-bold text-slate-800 dark:text-zinc-200 transition-all cursor-pointer"
                    >
                      Collect UPI
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={completeService}
                  disabled={loading || !paid}
                  className="w-full py-3.5 px-6 rounded-full bg-black hover:bg-zinc-800 disabled:opacity-50 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{loading ? '...' : t('completeService')}</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            )}

            {/* ACTION STATE 4: COMPLETED */}
            {status === 'completed' && (
              <div className="space-y-1.5 py-3 text-center">
                <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                  ✓ Service Completed
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  ₹{job.total_price || 30} credited to your station earnings.
                </p>
              </div>
            )}
          </div>

          {/* 5-Step Progress Stepper List */}
          <div className="space-y-2 pt-3 border-t border-slate-200/80 dark:border-zinc-700/80">
            {STEPS.map((step) => {
              const { state, text } = getStepStatus(step.id);

              return (
                <div key={step.id} className="flex items-center justify-between text-xs py-0.5">
                  <div className="flex items-center gap-2">
                    {state === 'completed' ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    ) : state === 'current' ? (
                      <div className="w-5 h-5 rounded-full bg-[#2563EB] text-white flex items-center justify-center shrink-0 text-[11px] font-bold">
                        {step.id}
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-zinc-700 text-slate-400 dark:text-zinc-500 flex items-center justify-center shrink-0 text-[11px] font-bold">
                        {step.id}
                      </div>
                    )}
                    <span
                      className={`font-semibold ${state === 'current'
                        ? 'text-black dark:text-white font-bold'
                        : state === 'completed'
                          ? 'text-slate-800 dark:text-zinc-200'
                          : 'text-slate-400 dark:text-zinc-500'
                        }`}
                    >
                      {step.label}
                    </span>
                  </div>

                  <span
                    className={`text-[11px] font-semibold ${state === 'completed'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : state === 'current'
                        ? 'text-[#2563EB] dark:text-blue-400 font-bold'
                        : 'text-slate-400 dark:text-zinc-500'
                      }`}
                  >
                    {text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── BOTTOM BAR: PASSENGER LIVE MESSAGING & ACTIONS (Disappears when booking completed) ── */}
      {status !== 'completed' && (
        <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-[#2563EB]" />
              <span className="font-extrabold text-xs text-black dark:text-white">
                Passenger Live Messaging
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-900/60 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Direct
              </span>
            </div>
            <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
              {chatMsgs.length === 0 ? 'No messages yet' : `${chatMsgs.length} messages`}
            </span>
          </div>

          {/* Quick Reply Suggestion Chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {QUICK_REPLIES.map((chipText, i) => (
              <button
                key={i}
                type="button"
                onClick={() => sendChat(chipText)}
                className="px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-semibold hover:border-blue-500 hover:text-[#2563EB] dark:hover:text-blue-400 whitespace-nowrap transition-all cursor-pointer shadow-2xs shrink-0 active:scale-95"
              >
                {chipText}
              </button>
            ))}
          </div>

          {/* Chat History Box (Premium Styled with Timestamps) */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/70 dark:bg-zinc-950/40 border border-slate-200/80 dark:border-zinc-800 min-h-[120px] max-h-52 overflow-y-auto space-y-3">
            {chatMsgs.length === 0 ? (
              <div className="py-6 flex flex-col items-center justify-center text-center">
                <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] flex items-center justify-center mb-1.5 shadow-2xs">
                  <MessageSquare size={14} />
                </div>
                <p className="text-xs font-bold text-black dark:text-white">Direct Channel with {passengerName}</p>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Use quick buttons above or type below to coordinate platform arrival.</p>
              </div>
            ) : (
              chatMsgs.map((m, i) => {
                const isAssistant = m.from === 'assistant';
                return (
                  <div key={i} className={`flex flex-col ${isAssistant ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`max-w-[85%] sm:max-w-md px-4 py-2 rounded-2xl text-xs font-semibold leading-relaxed shadow-2xs ${isAssistant
                        ? 'bg-[#2563EB] text-white rounded-br-xs'
                        : 'bg-white dark:bg-zinc-800 text-black dark:text-white border border-slate-200/80 dark:border-zinc-700 rounded-bl-xs'
                        }`}
                    >
                      {m.text}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 dark:text-zinc-500 mt-1 px-1">
                      <span>{isAssistant ? 'You' : passengerName}</span>
                      <span>•</span>
                      <span>{formatMessageTime(m.timestamp)}</span>
                      {isAssistant && <span className="text-[#2563EB] font-bold">✓✓</span>}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input Bar & Cancel Action Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={msgInput}
                onChange={(e) => setMsgInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    sendChat();
                  }
                }}
                placeholder="Type message to passenger..."
                className="flex-1 py-2.5 px-4 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-black dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB]"
              />
              <button
                type="button"
                onClick={() => sendChat()}
                className="w-10 h-10 rounded-full bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-sm"
                title="Send Message"
              >
                <Send size={15} />
              </button>
            </div>

            {/* Cancel Assignment Button */}
            <button
              type="button"
              onClick={cancelJob}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100/60 text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <AlertTriangle size={15} />
              <span>Cancel Assignment</span>
            </button>
          </div>
        </div>
      )}

    </article>
  );
}