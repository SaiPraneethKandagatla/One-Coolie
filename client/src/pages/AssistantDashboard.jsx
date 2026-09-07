import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard,
  Luggage,
  Briefcase,
  History,
  IndianRupee,
  User,
  LifeBuoy,
  Bell,
  ChevronDown,
  RotateCw,
  MapPin,
  Star,
  Users,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Train,
  Clock,
  Menu,
  X,
  Sparkles,
  Lock,
  Phone,
  PhoneCall,
  Copy,
  Check,
  Send,
  AlertTriangle,
  HelpCircle,
  FileText,
  ChevronUp,
  Radio,
  ExternalLink
} from 'lucide-react';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import ProfileMenu from '../context/ProfileMenu';
import AssistantNotifications from '../components/AssistantNotifications';
import { activeServices, SERVICE_LABELS } from '../utils/services';
import AssistantJobCard from '../components/AssistantJobCard';
import oneCoolieLogo from '../assets/onecoolie-logo.png';
import TrainLoader from '../components/TrainLoader';
import { useLanguage } from '../context/LanguageContext';
import { playOnDutySound, playNewBookingSound } from '../utils/audioAlerts';

/* ============================================================
   ONECOOLIE ASSISTANT DASHBOARD — Premium Uber-Style Ops Interface
   Swiss International Typographic System + Railway Tech
   ============================================================ */

const STATIONS = [
  { code: 'KZJ', name: 'Kazipet Junction' },
  { code: 'WL', name: 'Warangal' },
  { code: 'BZA', name: 'Vijayawada Junction' },
  { code: 'SC', name: 'Secunderabad Junction' },
];

export default function AssistantDashboard() {
  const { lang, t } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [station, setStation] = useState('KZJ');
  const [requests, setRequests] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [tab, setTab] = useState('dashboard'); // 'dashboard' | 'jobs' | 'history' | 'earnings' | 'profile' | 'support'
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  /* ── Sound Alert Tracking Refs ───────────────────────────── */
  const prevRequestIdsRef = useRef(new Set());
  const initialLoadDoneRef = useRef(false);

  /* ── Duty State & Popover Controls ───────────────────────── */
  const [dutyDropdownOpen, setDutyDropdownOpen] = useState(false);
  const [offDutyConfirmOpen, setOffDutyConfirmOpen] = useState(false);
  const [activeJobWarningOpen, setActiveJobWarningOpen] = useState(false);
  const [activatingDuty, setActivatingDuty] = useState(false);

  /* ── Support & Emergency Hotline State ───────────────────── */
  const [supportModal, setSupportModal] = useState(null);
  const [copiedNumber, setCopiedNumber] = useState(null);
  const [ticketCategory, setTicketCategory] = useState('passenger_absent');
  const [ticketPnr, setTicketPnr] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');
  const [ticketPriority, setTicketPriority] = useState('normal');
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState('');
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [supportTickets, setSupportTickets] = useState(() => {
    try {
      const saved = localStorage.getItem('assistant_support_tickets');
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.error(err);
    }
    return [
      {
        id: 'KZJ-SUP-9102',
        category: 'Luggage Assistance Dispute',
        pnr: '2489012431',
        desc: 'Passenger luggage exceeded 45kg; guidance provided for excess baggage tariff.',
        priority: 'normal',
        status: 'Resolved by Station Master',
        station: 'KZJ',
        createdAt: '03:15 AM',
      },
    ];
  });

  /* ── Auto-dismiss Success Banner ────────────────────────── */
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  /* ── User Auth Session ──────────────────────────────────── */
  const { user } = useAuth();

  /* ── Live Ticking Clock ──────────────────────────────────── */
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  /* ── Load Profile ───────────────────────────────────────── */
  const loadProfile = useCallback(async () => {
    try {
      const response = await axios.get('/assistants/me');
      setProfile(response.data);
      if (response.data?.station_code) setStation(response.data.station_code);
      setError('');
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Session expired. Please sign in again.');
      } else {
        setError('Unable to retrieve assistant profile.');
      }
    }
  }, []);

  /* ── Load Dashboard Data ─────────────────────────────────── */
  const loadDashboard = useCallback(async () => {
    try {
      const [availableResponse, jobsResponse, ticketsResponse] = await Promise.all([
        axios.get('/assistants/available'),
        axios.get('/assistants/my-jobs'),
        axios.get('/assistants/support-tickets').catch(() => ({ data: [] })),
      ]);
      const jobs = Array.isArray(jobsResponse.data) ? jobsResponse.data : [];
      const hasActive = jobs.some(
        (j) => j.booking_status !== 'completed' && j.booking_status !== 'cancelled'
      );
      const rawAvailable = Array.isArray(availableResponse.data) ? availableResponse.data : [];
      const newRequests = hasActive ? [] : rawAvailable;

      // Synchronize support tickets from backend if available
      if (Array.isArray(ticketsResponse.data) && ticketsResponse.data.length > 0) {
        setSupportTickets(ticketsResponse.data);
      }

      // Sound alert: When fresh assistance request arrives while on-duty
      if (initialLoadDoneRef.current && !hasActive && newRequests.length > 0) {
        const hasFreshRequest = newRequests.some(
          (req) => !prevRequestIdsRef.current.has(req.id || req.booking_id)
        );
        if (hasFreshRequest) {
          playNewBookingSound();
        }
      }

      initialLoadDoneRef.current = true;
      prevRequestIdsRef.current = new Set(newRequests.map((r) => r.id || r.booking_id));

      setRequests(newRequests);
      setMyJobs(jobs);
      setError('');
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Session expired. Please sign in again.');
      } else {
        setError('Unable to sync live dispatch board.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── Initial Load & Auto Refresh ────────────────────────── */
  useEffect(() => {
    loadProfile();
    loadDashboard();
  }, [loadProfile, loadDashboard]);

  useEffect(() => {
    const interval = setInterval(() => loadDashboard(), 8000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  /* ── Real-Time Rating & Review Sync (BroadcastChannel, Storage, WebSocket) ── */
  useEffect(() => {
    // 1. BroadcastChannel for instant 0ms cross-tab sync in same browser
    let channel;
    let dispatchChannel;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel('onecoolie_rating_channel');
        channel.onmessage = (event) => {
          const data = event.data;
          if (data?.rating) {
            const bId = data.bookingId || data.booking_id || data.id || data.bookingCode;
            setMyJobs((prev) =>
              prev.map((job) =>
                job.id === bId || job.booking_id === bId
                  ? { ...job, rating: Number(data.rating), review: data.review || job.review }
                  : job
              )
            );
            loadDashboard();
            loadProfile();
          }
        };

        dispatchChannel = new BroadcastChannel('onecoolie_dispatch_channel');
        dispatchChannel.onmessage = (event) => {
          if (event.data?.type === 'new_booking') {
            playNewBookingSound();
            loadDashboard();
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel init:', e);
    }

    // 2. Storage event listener (redundant fallback across browser tabs)
    const handleStorage = (e) => {
      if (e.key === 'onecoolie_latest_rating' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.rating) {
            const bId = parsed.bookingId || parsed.booking_id || parsed.id || parsed.bookingCode;
            setMyJobs((prev) =>
              prev.map((job) =>
                job.id === bId || job.booking_id === bId
                  ? { ...job, rating: Number(parsed.rating), review: parsed.review || job.review }
                  : job
              )
            );
            loadDashboard();
            loadProfile();
          }
        } catch (err) { }
      }
      if (e.key === 'onecoolie_latest_booking' && e.newValue) {
        try {
          playNewBookingSound();
          loadDashboard();
        } catch (err) { }
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. Socket.IO real-time event listener
    const handleSocketRating = (data) => {
      if (data?.rating) {
        const bId = data.bookingId || data.booking_id || data.id || data.bookingCode;
        if (bId) {
          setMyJobs((prev) =>
            prev.map((job) =>
              job.id === bId || job.booking_id === bId
                ? { ...job, rating: Number(data.rating), review: data.review || job.review }
                : job
            )
          );
        }
        loadDashboard();
        loadProfile();
      }
    };

    const handleSocketStatus = (update) => {
      if (update?.rating !== undefined || update?.booking_status === 'completed') {
        loadDashboard();
        loadProfile();
      }
    };

    const handleSocketNewBooking = () => {
      playNewBookingSound();
      loadDashboard();
    };

    if (window.socket) {
      window.socket.on('new_booking', handleSocketNewBooking);
      window.socket.on('rating_submitted', handleSocketRating);
      window.socket.on('status_update', handleSocketStatus);
    }

    return () => {
      if (channel) channel.close();
      if (dispatchChannel) dispatchChannel.close();
      window.removeEventListener('storage', handleStorage);
      if (window.socket) {
        window.socket.off('new_booking', handleSocketNewBooking);
        window.socket.off('rating_submitted', handleSocketRating);
        window.socket.off('status_update', handleSocketStatus);
      }
    };
  }, [loadDashboard, loadProfile]);

  /* ── Online Status & Active Job Tracking ─────────────────── */
  const activeJobs = myJobs.filter(
    (j) =>
      j.booking_status !== 'completed' && j.booking_status !== 'cancelled'
  );
  const hasActiveJob = activeJobs.length > 0;
  const online = hasActiveJob || Boolean(profile?.is_online);

  // Automatically sync online status with backend whenever an active job is assigned
  useEffect(() => {
    if (hasActiveJob && profile && !profile.is_online) {
      axios
        .post('/assistants/availability', {
          is_online: true,
          station_code: station,
        })
        .then((res) => {
          if (res.data) setProfile(res.data);
        })
        .catch((e) => console.warn('Syncing online availability with backend:', e));
    }
  }, [hasActiveJob, profile?.is_online, station]);

  const toggleDuty = async () => {
    if (!profile || actionLoading || hasActiveJob) return;
    const nextStatus = !online;
    setActionLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await axios.post('/assistants/availability', {
        is_online: nextStatus,
        station_code: station,
      });
      setProfile(response.data);
      if (nextStatus) {
        playOnDutySound();
      }
      setMessage(
        nextStatus
          ? `${t('dutyActiveMsg')} ${station}. ${t('waitingForRequests')}`
          : t('dutyInactiveMsg')
      );
      await loadDashboard();
    } catch (err) {
      setError(
        err.response?.data?.message || 'Unable to update availability.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Smart Duty Request Flow (Confirmation & Safety Check) ─ */
  const handleDutyRequest = async (targetState) => {
    setDutyDropdownOpen(false);
    if (!targetState) {
      // Attempting to go OFF DUTY -> Check active jobs
      const inProgressJobs = myJobs.filter(
        (j) => j.booking_status !== 'completed' && j.booking_status !== 'cancelled'
      );
      if (inProgressJobs.length > 0) {
        setActiveJobWarningOpen(true);
        return;
      }
      setOffDutyConfirmOpen(true);
      return;
    }

    // Attempting to go ON DUTY -> Short transition
    setActivatingDuty(true);
    try {
      await toggleDuty();
    } finally {
      setTimeout(() => setActivatingDuty(false), 300);
    }
  };

  const confirmOffDuty = async () => {
    setOffDutyConfirmOpen(false);
    await toggleDuty();
  };

  /* ── Accept Request ─────────────────────────────────────── */
  const acceptJob = async (requestId) => {
    if (actionLoading) return;
    if (hasActiveJob) {
      setError('You already have an active job in progress. Complete or cancel it before accepting another.');
      return;
    }
    setActionLoading(true);
    setError('');
    setMessage('');
    try {
      await axios.post(`/assistants/${requestId}/accept`);

      // Ensure backend availability is updated to online with the station
      try {
        const availRes = await axios.post('/assistants/availability', {
          is_online: true,
          station_code: station,
        });
        if (availRes.data) setProfile(availRes.data);
      } catch (e) {
        console.warn('Syncing availability on accept:', e);
      }

      // Guarantee start_otp has generous 7-day validity in Supabase
      try {
        const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        fetch(`https://pzrttunhyfporcpcybax.supabase.co/rest/v1/bookings?id=eq.${requestId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: 'sb_publishable_dXyQiI56vk_nQF_l8DiysQ_sCa4bPt4',
            Authorization: 'Bearer sb_publishable_dXyQiI56vk_nQF_l8DiysQ_sCa4bPt4',
            Prefer: 'return=minimal'
          },
          body: JSON.stringify({ start_otp_expires_at: future })
        }).catch(() => { });
      } catch (e) { }

      setMessage('Request accepted successfully. Proceed to platform.');
      await loadDashboard();
      setTab('jobs');
    } catch (err) {
      setError(
        err.response?.data?.message || 'Request is no longer available.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Job Update Callback ────────────────────────────────── */
  const handleJobUpdate = useCallback(
    async (updatedJob) => {
      if (!updatedJob) {
        await loadDashboard();
        return;
      }
      const normalizedJob = updatedJob.booking || updatedJob;
      setMyJobs((prevJobs) =>
        prevJobs.map((job) =>
          job.id === normalizedJob.id ? { ...job, ...normalizedJob } : job
        )
      );
      await loadDashboard();
    },
    [loadDashboard]
  );

  /* ── Service Label Helpers for History & Requests ───────── */
  const getLocalizedServiceLabel = (key, rawLabel) => {
    const serviceTranslations = {
      te: {
        luggage: '🧳 లగేజీ సహాయం',
        escort: '🚶 సీట్ ఎస్కార్ట్',
        wheelchair: '♿ వీల్చైర్ సహాయం',
        language: '🗣️ భాషా సహాయం',
        snacks: '🍱 స్నాక్స్ & నీరు',
        transport: '🛺 ఎగ్జిట్ రవాణా',
      },
      hi: {
        luggage: '🧳 सामान सहायता',
        escort: '🚶 सीट एस्कॉर्ट',
        wheelchair: '♿ व्हीलचेयर सहायता',
        language: '🗣️ भाषा सहायता',
        snacks: '🍱 नाश्ता और पानी',
        transport: '🛺 निकास परिवहन',
      },
      en: {
        luggage: '🧳 Luggage Assistance',
        escort: '🚶 Seat Escort',
        wheelchair: '♿ Wheelchair',
        language: '🗣️ Language Help',
        snacks: '🍱 Snacks & Water',
        transport: '🛺 Exit Transport',
      }
    };

    const map = serviceTranslations[lang] || serviceTranslations.en;
    if (map[key]) return map[key];
    if (rawLabel) {
      if (lang === 'te') {
        return rawLabel
          .replace(/Luggage Assistance/gi, 'లగేజీ సహాయం')
          .replace(/Seat Escorting|Seat Escort/gi, 'సీట్ ఎస్కార్ట్')
          .replace(/Wheelchair & Elderly|Wheelchair/gi, 'వీల్చైర్ సహాయం')
          .replace(/Language Help/gi, 'భాషా సహాయం')
          .replace(/Snacks & Water/gi, 'స్నాక్స్ & నీరు')
          .replace(/Exit Transport/gi, 'ఎగ్జిట్ రవాణా');
      }
      if (lang === 'hi') {
        return rawLabel
          .replace(/Luggage Assistance/gi, 'सामान सहायता')
          .replace(/Seat Escorting|Seat Escort/gi, 'सीट एस्कॉर्ट')
          .replace(/Wheelchair & Elderly|Wheelchair/gi, 'व्हीलचेयर सहायता')
          .replace(/Language Help/gi, 'भाषा सहायता')
          .replace(/Snacks & Water/gi, 'नाश्ता और पानी')
          .replace(/Exit Transport/gi, 'निकास परिवहन');
      }
      return rawLabel;
    }
    return SERVICE_LABELS[key] || key;
  };

  const getCompletedJobServices = (job) => {
    if (!job) return [];

    // 1. Try activeServices on job.services object
    if (job.services && typeof job.services === 'object' && !Array.isArray(job.services)) {
      const list = activeServices(job.services);
      // Strictly keep only valid passenger services (no chat_messages, no pricing_breakdown)
      const validServices = list.filter((s) => Boolean(SERVICE_LABELS[s.key]));
      if (validServices.length > 0) {
        return validServices.map((s) => ({
          key: s.key,
          label: getLocalizedServiceLabel(s.key, s.label),
          value: s.value,
        }));
      }
    }

    // 2. Try parsing string from job.service or job.service_description
    const rawString =
      (typeof job.services === 'string' ? job.services : '') ||
      job.service ||
      job.service_description ||
      '';

    if (rawString) {
      const parts = rawString.split(/[,+•|]/).map((p) => p.trim()).filter(Boolean);
      // Strip metadata like chat_messages, pricing_breakdown, etc.
      const validParts = parts.filter((part) => {
        const l = part.toLowerCase();
        return (
          !l.includes('chat') &&
          !l.includes('message') &&
          !l.includes('pricing') &&
          !l.includes('breakdown') &&
          !l.includes('pnr') &&
          !l.includes('coach') &&
          !l.includes('otp')
        );
      });

      if (validParts.length > 0) {
        return validParts.map((part, idx) => {
          const lower = part.toLowerCase();
          let key = 'general';
          let icon = '🚆';
          if (lower.includes('luggage')) { key = 'luggage'; icon = '🧳'; }
          else if (lower.includes('escort')) { key = 'escort'; icon = '🚶'; }
          else if (lower.includes('wheelchair') || lower.includes('elderly')) { key = 'wheelchair'; icon = '♿'; }
          else if (lower.includes('language')) { key = 'language'; icon = '🗣️'; }
          else if (lower.includes('snack') || lower.includes('food') || lower.includes('water')) { key = 'snacks'; icon = '🍱'; }
          else if (lower.includes('transport') || lower.includes('exit') || lower.includes('auto')) { key = 'transport'; icon = '🛺'; }

          const localized = getLocalizedServiceLabel(key, part);
          const displayLabel = (localized.startsWith('🧳') || localized.startsWith('🚶') || localized.startsWith('♿') || localized.startsWith('🗣️') || localized.startsWith('🍱') || localized.startsWith('🛺'))
            ? localized
            : `${icon} ${localized}`;

          return {
            key: `${key}-${idx}`,
            label: displayLabel,
            value: '',
          };
        });
      }
    }

    // 3. Fallback default
    return [
      {
        key: 'std',
        label: lang === 'te' ? '🧳 పోర్టర్ సహాయం' : lang === 'hi' ? '🧳 कुली सहायता' : '🧳 Concourse Porter Assist',
        value: '',
      }
    ];
  };

  /* ── Computed Metrics ───────────────────────────────────── */
  const completedJobs = myJobs.filter((j) => j.booking_status === 'completed');
  const totalEarnings = completedJobs.reduce(
    (t, j) => t + Number(j.total_price || 0),
    0
  );
  const ratedJobs = completedJobs.filter((j) => j.rating && Number(j.rating) > 0);
  const averageRating =
    ratedJobs.length > 0
      ? (
        ratedJobs.reduce((t, j) => t + Number(j.rating), 0) /
        ratedJobs.length
      ).toFixed(1)
      : '—';

  const currentStationObj = STATIONS.find((s) => s.code === station) || STATIONS[0];
  const assistantName = profile?.name || 'Sai Coolie';
  const firstName = assistantName.split(' ')[0] || 'Assistant';

  const formattedTimeWithSeconds = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const fullFormattedDate = currentTime.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const getGreetingPrefix = () => {
    const hour = currentTime.getHours();
    if (hour >= 12 && hour < 17) return t('goodAfternoon');
    if (hour >= 17) return t('goodEvening');
    return t('goodMorning');
  };

  /* ── Support & Hotline Action Handlers ─────────────────── */
  const copyToClipboard = (text, label) => {
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
    } catch (err) {
      console.warn('Clipboard copy error:', err);
    }
    setCopiedNumber(label || text);
    setTimeout(() => setCopiedNumber(null), 2500);
  };

  const openHotlineModal = (num) => {
    if (num === '139') {
      setSupportModal({
        number: '139',
        badge: '24/7 TOLL-FREE • ALL STATIONS',
        title: '139 - RailMadad & Station Control',
        sub: `${currentStationObj.name} Control Room & Concourse Desk`,
        type: 'control',
        accent: 'blue',
        desc: 'Official 24/7 Indian Railways passenger care helpline. Connects directly to division railway managers, station master concourse desk, platform radars, and medical units.',
        services: [
          'Station Master & Concourse Supervisor Desk',
          'Medical Assistance & Stretcher Dispatch',
          'Platform Alterations & Radar Verification',
          'Passenger Grievance & Service Escalation',
          'Official Porter Tariff & Fare Reconciliation',
        ],
        hubNote: `Direct link to ${currentStationObj.name} (${station}) Division Operational Hub.`,
      });
    } else {
      setSupportModal({
        number: '112',
        badge: 'NATIONAL EMERGENCY SOS • IMMEDIATE DISPATCH',
        title: '112 - National Emergency & Police SOS',
        sub: 'Railway Protection Force (RPF) & GRP Station Post',
        type: 'emergency',
        accent: 'rose',
        desc: 'Unified emergency response helpline connecting to Railway Protection Force (RPF), Government Railway Police (GRP) station outposts, fire response, and immediate concourse ambulances.',
        services: [
          'RPF Platform Security & Escort Teams',
          'GRP Police Thana (Platform 1 Concourse)',
          'Emergency Medical Casualty & Concourse Stretcher',
          'Passenger Safety, Harassment or Theft Alert',
          'Immediate Station SOS Broadcast Protocol',
        ],
        hubNote: `Dispatches immediate security response to ${currentStationObj.name} (${station}) Platforms.`,
      });
    }
  };

  const handleDirectCall = (e, num) => {
    if (e && e.stopPropagation) e.stopPropagation();
    window.location.href = `tel:${num}`;
    openHotlineModal(num);
  };

  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    if (!ticketDesc.trim()) return;
    setTicketSubmitting(true);

    const categoryLabels = {
      passenger_absent: t('passengerNoShow'),
      luggage_dispute: t('luggageDispute'),
      platform_change: t('platformChangeNotice'),
      payment_issue: t('paymentDispute'),
      medical_sos: t('medicalEmergency'),
      other: t('otherQuery'),
    };

    const resolvedCategory = categoryLabels[ticketCategory] || ticketCategory;

    try {
      // POST directly to backend
      const res = await axios.post('/assistants/support-tickets', {
        category: resolvedCategory,
        pnr: ticketPnr.trim() || 'N/A',
        description: ticketDesc.trim(),
        priority: ticketPriority,
        station: station,
      });

      const serverTicket = res.data;
      const updated = [serverTicket, ...supportTickets.filter((t) => t.id !== serverTicket.id)];
      setSupportTickets(updated);
      try {
        localStorage.setItem('assistant_support_tickets', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }

      setTicketDesc('');
      setTicketPnr('');
      setTicketSuccess(`Ticket #${serverTicket.id} dispatched to ${currentStationObj.name} Station Supervisor Desk.`);
    } catch (err) {
      console.warn('Backend ticket dispatch failed, saving locally:', err);
      const fallbackId = `${station}-SUP-${Math.floor(1000 + Math.random() * 9000)}`;
      const fallbackTicket = {
        id: fallbackId,
        category: resolvedCategory,
        pnr: ticketPnr.trim() || 'N/A',
        desc: ticketDesc.trim(),
        priority: ticketPriority,
        status: 'Dispatched to Station Supervisor',
        station: station,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      const updated = [fallbackTicket, ...supportTickets];
      setSupportTickets(updated);
      setTicketDesc('');
      setTicketPnr('');
      setTicketSuccess(`Ticket #${fallbackId} recorded & queued for Station Supervisor.`);
    } finally {
      setTicketSubmitting(false);
      setTimeout(() => setTicketSuccess(''), 6000);
    }
  };

  const SECTION_TITLES = {
    dashboard: {
      title: assistantName,
      prefix: getGreetingPrefix(),
      sub: t('readyNextPassenger'),
      hasWave: true,
    },
    jobs: {
      title: activeJobs.length <= 1 ? t('myAssignedJob') : t('myJobs'),
      prefix: t('activeAssignment'),
      sub: t('manageJobSub'),
      hasWave: false,
    },
    history: {
      title: t('tripHistory'),
      prefix: t('completedTripsRecord'),
      sub: t('tripHistorySub'),
      hasWave: false,
    },
    earnings: {
      title: t('earningsReviews'),
      prefix: t('payoutsFeedback'),
      sub: t('earningsSub'),
      hasWave: false,
    },
    profile: {
      title: t('assistantProfile'),
      prefix: t('dutyIdentity'),
      sub: t('profileSub'),
      hasWave: false,
    },
    support: {
      title: t('support'),
      prefix: t('helpDesk'),
      sub: t('supportSub'),
      hasWave: false,
    },
  };

  const currentHeader = SECTION_TITLES[tab] || SECTION_TITLES.dashboard;

  if (loading) {
    return (
      <TrainLoader
        mode="fullscreen"
        text="Loading Dispatch Console..."
        subtext="Synchronizing live platform assignments & assistant fleet..."
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-black text-[#111111] dark:text-white flex flex-col font-sans select-none">
      {/* ── TOP HEADER ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-black/95 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800">
        <div className="w-full px-4 sm:px-6 py-3 flex items-center justify-between">

          {/* Left Brand & Duty Controls */}
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Official Brand Logo */}
            <div className="flex items-center gap-3">
              <img
                src={oneCoolieLogo || '/onecoolie-logo.png'}
                alt="OneCoolie - Making Every Journey Easier."
                className="h-9 w-auto object-contain"
              />
              <div className="hidden sm:block text-left">
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest block leading-none">
                  {t('assistantDuty')}
                </span>
                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 tracking-tight">
                  {t('makingJourneyEasier')}
                </span>
              </div>
            </div>

            <div className="hidden md:block h-5 w-[1px] bg-slate-200 dark:bg-zinc-800" />

            {/* Uber/Rapido-Style Operational Duty Status Control & Popover */}
            <div className="relative">
              {hasActiveJob ? (
                <div
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-black dark:border-white bg-black text-white dark:bg-white dark:text-black text-xs font-bold shadow-2xs select-none cursor-default"
                  title="Duty locked to ON DUTY while an assigned passenger job is in progress."
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] animate-pulse" />
                  <span>● {t('onDuty')} • {station}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 dark:bg-black/15 text-emerald-300 dark:text-emerald-700 flex items-center gap-1">
                    <Lock size={10} />
                    <span>{t('activeAssignment')}</span>
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setDutyDropdownOpen(!dutyDropdownOpen)}
                  disabled={actionLoading || activatingDuty}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold transition-all shadow-2xs cursor-pointer ${online
                    ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white hover:bg-zinc-800 dark:hover:bg-zinc-200'
                    : 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:bg-slate-200'
                    }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-[#16A34A] animate-pulse' : 'bg-slate-400 dark:bg-zinc-500'
                      }`}
                  />
                  <span>{online ? `● ${t('onDuty')} • ${station}` : `○ ${t('offDuty')}`}</span>
                  <ChevronDown size={14} className="opacity-70" />
                </button>
              )}

              {/* Duty Dropdown / Popover Menu (Only available when NOT on an active job) */}
              {!hasActiveJob && dutyDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
                  <span className="text-[10px] font-extrabold tracking-widest text-slate-400 dark:text-zinc-500 uppercase block mb-2">
                    {t('stationDutyStatus')}
                  </span>

                  {online ? (
                    <div>
                      <div className="flex items-center gap-2 text-black dark:text-white font-extrabold text-sm mb-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] animate-pulse" />
                        <span>● {t('onDuty')}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4 leading-relaxed">
                        {t('liveDispatchDutyDesc')}: <br />
                        <strong className="text-black dark:text-white font-bold">{currentStationObj.name} ({station})</strong>
                      </p>
                      <button
                        type="button"
                        onClick={() => handleDutyRequest(false)}
                        disabled={actionLoading}
                        className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold transition-all cursor-pointer"
                      >
                        {t('goOffDuty')}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-300 font-extrabold text-sm mb-1">
                        <span className="w-2.5 h-2.5 rounded-full border-2 border-slate-400" />
                        <span>○ {t('offDuty')}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4 leading-relaxed">
                        {t('offDutyDesc')}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleDutyRequest(true)}
                        disabled={actionLoading || activatingDuty}
                        className="w-full py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>{activatingDuty ? t('activatingDuty') : t('goOnDuty')}</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Notification Bell & Dropdown */}
            <AssistantNotifications
              requests={requests}
              activeJobs={activeJobs}
              ratedJobs={ratedJobs}
              online={online}
              station={station}
              stationName={currentStationObj?.name || 'Kazipet Junction'}
              onNavigate={(t) => setTab(t)}
            />

            {/* Profile Menu Dropdown */}
            <ProfileMenu role="assistant" onNavigate={(t) => setTab(t)} />
          </div>
        </div>
      </header>

      {/* ── BODY LAYOUT (Sidebar + Main Content) ─────────────────────── */}
      <div className="flex-1 flex w-full relative">

        {/* ── LEFT SIDEBAR (Desktop Fixed + Mobile Drawer) ───────────── */}
        <aside
          className={`fixed lg:sticky top-[61px] left-0 z-30 h-[calc(100vh-61px)] w-64 bg-white dark:bg-black border-r border-slate-200/80 dark:border-zinc-800 p-4 flex flex-col justify-between transition-transform duration-300 ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
            }`}
        >
          {/* Navigation Links */}
          <div className="space-y-1">
            {[
              { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard, badge: hasActiveJob ? null : (requests.length > 0 ? requests.length : null) },
              { id: 'jobs', label: activeJobs.length <= 1 ? t('myAssignedJob') : t('myJobs'), icon: Briefcase, badge: activeJobs.length },
              { id: 'history', label: t('tripHistory'), icon: History, badge: completedJobs.length },
              { id: 'earnings', label: t('earningsReviews'), icon: IndianRupee, badge: ratedJobs.length > 0 ? ratedJobs.length : null },
              { id: 'profile', label: t('profile'), icon: User, badge: null },
              { id: 'support', label: t('support'), icon: LifeBuoy, badge: null },
            ].map((item, idx) => {
              const IconComp = item.icon;
              const isActive = tab === item.id;

              return (
                <button
                  key={`${item.id}-${idx}`}
                  type="button"
                  onClick={() => {
                    setTab(item.id);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${isActive
                    ? 'bg-blue-50 text-[#2563EB] dark:bg-blue-950/40 dark:text-blue-400 font-bold'
                    : 'text-slate-600 hover:text-black hover:bg-slate-50 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-900'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <IconComp size={18} className={isActive ? 'text-[#2563EB] dark:text-blue-400' : 'opacity-70'} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== null && item.badge > 0 && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive
                        ? 'bg-[#2563EB] text-white'
                        : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom Brand Card Box */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800 relative overflow-hidden">
            <div className="relative z-10 space-y-1">
              <span className="text-[11px] font-black text-black dark:text-white block tracking-tight">
                People Travel. <br />
                <span className="text-[#2563EB]">We Assist.</span>
              </span>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                Making Every Journey Easier
              </p>
              <div className="w-8 h-[2px] bg-slate-200 dark:bg-zinc-700 mt-2" />
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT AREA ────────────────────────────────────────── */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 w-full min-w-0 overflow-x-hidden">

          {/* Status Alert Banners */}
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 text-xs font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldAlert size={18} className="text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
              <button type="button" onClick={() => setError('')} className="text-xs underline">Dismiss</button>
            </div>
          )}

          {message && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <span>{message}</span>
              </div>
              <button type="button" onClick={() => setMessage('')} className="text-xs underline">Dismiss</button>
            </div>
          )}

          {/* ── TOP HEADER & LIVE STATION CLOCK / HUB SELECTOR ───────────── */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-extrabold tracking-widest text-slate-400 dark:text-zinc-500 uppercase block">
                {currentHeader.prefix}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-black dark:text-white tracking-tight flex items-center gap-2 mt-0.5">
                <span>{currentHeader.title}</span>
                {currentHeader.hasWave && <span className="text-2xl">👋</span>}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 font-medium mt-0.5">
                {currentHeader.sub}
              </p>
            </div>

            {/* Right Side Widgets: Live Station Clock & Hub Selector */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">

              {/* Live Station Clock & Calendar Widget */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-3.5 sm:px-4.5 flex items-center gap-3 shadow-2xs">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] flex items-center justify-center shrink-0">
                  <Clock size={20} className="animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest block">
                      STATION PRESENT TIME
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  </div>
                  <div className="font-extrabold text-sm sm:text-base text-black dark:text-white flex items-center gap-2 tracking-tight">
                    <span>{formattedTimeWithSeconds}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                      IST
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium block">
                    {fullFormattedDate}
                  </span>
                </div>
              </div>

              {/* Hub Location Box */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-3.5 sm:px-4.5 flex items-center gap-3 shadow-2xs">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
                  <MapPin size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                      YOUR CURRENT HUB
                    </span>
                    {online && (
                      <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500">
                        (LOCKED)
                      </span>
                    )}
                  </div>

                  {online ? (
                    /* Locked station view when ON DUTY - no option to change station */
                    <div className="font-extrabold text-xs sm:text-sm text-black dark:text-white mt-0.5" title="Station locked while on duty. Go off duty to change station.">
                      {currentStationObj.name} ({station})
                    </div>
                  ) : (
                    /* Editable station selector when OFF DUTY */
                    <div className="relative inline-block mt-0.5">
                      <select
                        value={station}
                        onChange={(e) => setStation(e.target.value)}
                        className="bg-transparent font-extrabold text-xs sm:text-sm text-black dark:text-white focus:outline-none cursor-pointer pr-5 appearance-none"
                        title="Select station hub"
                      >
                        {STATIONS.map((st) => (
                          <option key={st.code} value={st.code} className="bg-white dark:bg-zinc-900 text-black dark:text-white">
                            {st.name} ({st.code})
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* ── METRICS GRID & SEGMENTED TABS (Show on Dashboard & Live overview) ── */}
          {tab === 'dashboard' && (
            <>
              {/* ── METRICS GRID (4 Metric Cards) ──────────────────────────── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    id: 'requests',
                    label: t('stationRequests'),
                    value: hasActiveJob ? 0 : requests.length,
                    sub: hasActiveJob
                      ? (lang === 'te' ? 'యాక్టివ్ జాబ్ సమయంలో పాజ్ చేయబడింది' : lang === 'hi' ? 'सक्रिय काम के दौरान रुका हुआ' : 'Paused during active job')
                      : `${t('waitingForPickup')} (${station})`,
                    icon: Users,
                    color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400',
                    onClick: () => {
                      setTab('dashboard');
                      document.getElementById('available-requests-section')?.scrollIntoView({ behavior: 'smooth' });
                    },
                  },
                  {
                    id: 'jobs',
                    label: t('activeJobsCount'),
                    value: activeJobs.length,
                    sub: t('inProgress'),
                    icon: Briefcase,
                    color: 'text-slate-700 bg-slate-100 dark:bg-zinc-800 dark:text-zinc-300',
                    onClick: () => setTab('jobs'),
                  },
                  {
                    id: 'earnings',
                    label: t('totalEarnings'),
                    value: `₹${totalEarnings}`,
                    sub: `${completedJobs.length} ${t('completed')}`,
                    icon: IndianRupee,
                    color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400',
                    onClick: () => setTab('earnings'),
                  },
                  {
                    id: 'rating',
                    label: t('averageRating'),
                    value: averageRating !== '—' ? `${averageRating} ★` : '—',
                    sub: ratedJobs.length > 0 ? `${ratedJobs.length} ${t('passengerReviews')}` : t('noReviewsYet'),
                    icon: Star,
                    color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400',
                    onClick: () => setTab('earnings'),
                  },
                ].map((m) => {
                  const IconComp = m.icon;
                  return (
                    <div
                      key={m.id}
                      onClick={m.onClick}
                      role="button"
                      tabIndex={0}
                      className={`bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between transition-all cursor-pointer hover:border-slate-400 dark:hover:border-zinc-600 hover:shadow-sm hover:scale-[1.01] active:scale-[0.99] ${m.id === 'rating' ? 'hover:border-amber-400 dark:hover:border-amber-500/50' : ''
                        }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                          {m.label}
                        </span>
                        <div className={`w-7 h-7 rounded-lg ${m.color} flex items-center justify-center shrink-0`}>
                          <IconComp size={15} />
                        </div>
                      </div>
                      <div>
                        <p className="text-2xl sm:text-3xl font-black text-black dark:text-white tracking-tight">
                          {m.value}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium mt-1">
                          {m.sub}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── DISPATCH SECTION HEADER & STATION RADAR ─────────────────── */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200/80 dark:border-zinc-800 gap-3 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB] animate-pulse shrink-0" />
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-black dark:text-white tracking-tight">
                      {t('availableRequests')}
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      {t('realTimeRequestsAt')} {currentStationObj.name} ({station})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  {requests.length > 0 && !hasActiveJob && (
                    <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-blue-50 text-[#2563EB] dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800">
                      {requests.length} {requests.length === 1 ? (lang === 'te' ? 'అభ్యర్థన వేచి ఉంది' : lang === 'hi' ? 'अनुरोध प्रतीक्षारत' : 'Request Waiting') : (lang === 'te' ? 'అభ్యర్థనలు వేచి ఉన్నాయి' : lang === 'hi' ? 'अनुरोध प्रतीक्षारत' : 'Requests Waiting')}
                    </span>
                  )}
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                    <span className="font-semibold text-slate-400 text-xs">Hub:</span>
                    <span className="font-bold text-black dark:text-white">{currentStationObj.name} ({station})</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── TAB CONTENT PANELS ──────────────────────────────────────── */}

          {/* TAB 1: DASHBOARD DISPATCH REQUESTS (Unified into Dashboard) */}
          {tab === 'dashboard' && (
            <div id="available-requests-section" className="space-y-4">
              {!online ? (
                /* DEDICATED OFF DUTY AVAILABILITY CARD */
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-10 sm:p-14 text-center max-w-lg mx-auto shadow-2xs space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 flex items-center justify-center mx-auto">
                    <Clock size={28} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-xl sm:text-2xl text-black dark:text-white tracking-tight">{t('offDuty')}</h3>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-2 max-w-md mx-auto leading-relaxed">
                      {t('offDutyDesc')} <strong className="text-black dark:text-white font-bold">{currentStationObj.name} ({station})</strong>.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleDutyRequest(true)}
                      disabled={actionLoading || activatingDuty}
                      className="btn-primary py-3.5 px-8 text-xs font-bold rounded-full bg-[#2563EB] hover:bg-blue-700 text-white shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
                    >
                      <span>{activatingDuty ? t('activatingDuty') : t('goOnDuty')}</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              ) : hasActiveJob ? (
                /* DEDICATED ACTIVE JOB IN PROGRESS CARD */
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-2xs space-y-5">
                  <div className="w-16 h-16 rounded-2xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center mx-auto shadow-sm">
                    <Briefcase size={28} />
                  </div>

                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[11px] font-extrabold tracking-wide uppercase mb-3">
                      <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
                      <span>In Service • {activeJobs[0]?.train_number ? `Train ${activeJobs[0].train_number}` : 'Active Trip'}</span>
                    </div>
                    <h3 className="font-extrabold text-xl sm:text-2xl text-black dark:text-white tracking-tight">
                      {t('activeAssignment')}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-2 max-w-lg mx-auto leading-relaxed">
                      {t('manageJobSub')}
                    </p>
                  </div>

                  {/* Mini Assignment Pill */}
                  <div className="inline-flex flex-wrap items-center justify-center gap-2.5 p-3 px-4 bg-slate-50 dark:bg-zinc-800/80 rounded-2xl border border-slate-200 dark:border-zinc-700/80 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    <span className="flex items-center gap-1.5 text-black dark:text-white font-bold">
                      <Train size={15} className="text-[#2563EB]" />
                      <span>{activeJobs[0]?.train_name || 'Train'} ({activeJobs[0]?.train_number || '—'})</span>
                    </span>
                    <span className="text-slate-300 dark:text-zinc-600">•</span>
                    <span>{t('coach')} {activeJobs[0]?.coach || '—'} / Berth {activeJobs[0]?.seat_berth || '—'}</span>
                    <span className="text-slate-300 dark:text-zinc-600">•</span>
                    <span className="px-2 py-0.5 rounded-md bg-white dark:bg-black text-slate-900 dark:text-zinc-100 font-bold text-[11px] shadow-2xs">
                      {t('platform')} {activeJobs[0]?.platform || '1'}
                    </span>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setTab('jobs')}
                      className="py-3.5 px-8 text-xs font-bold rounded-full bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
                    >
                      <span>{t('myAssignedJob')}</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              ) : requests.length === 0 ? (
                /* ON DUTY EMPTY STATE */
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-12 sm:p-16 text-center max-w-2xl mx-auto shadow-2xs">
                  {/* Station Platform Illustration Box */}
                  <div className="w-32 h-24 mx-auto mb-6 flex items-center justify-center relative">
                    <div className="absolute inset-0 bg-blue-50/50 dark:bg-blue-950/20 rounded-full blur-xl" />
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-700 dark:text-zinc-200 shadow-sm">
                        <Train size={32} />
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black text-white dark:bg-white dark:text-black mt-2">
                        {station}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-extrabold text-black dark:text-white tracking-tight mb-2">
                    {t('noRequestsAtStation')}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 max-w-md mx-auto mb-6 leading-relaxed">
                    {t('requestsAppearHere')}
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={loadDashboard}
                      disabled={actionLoading}
                      className="py-3 px-7 rounded-full bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
                    >
                      <RotateCw size={14} className={actionLoading ? 'animate-spin' : ''} />
                      <span>Refresh Now</span>
                    </button>
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-emerald-50 text-[#16A34A] dark:bg-emerald-950/40 dark:text-emerald-400 text-xs font-bold border border-emerald-200/60 dark:border-emerald-900/60">
                      <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
                      <span>Auto refresh on</span>
                    </span>
                  </div>
                </div>
              ) : (
                /* Incoming Requests Grid */
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {requests.map((req) => (
                    <div
                      key={req.id}
                      className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-6 shadow-2xs flex flex-col justify-between hover:border-blue-500/40 transition-all group"
                    >
                      <div>
                        {/* Request Header */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-400 text-[11px] font-extrabold tracking-wider uppercase">
                            {t('newDispatch')}
                          </span>
                          <span className="text-xl font-black text-black dark:text-white tracking-tight">
                            ₹{req.total_price}
                          </span>
                        </div>

                        {/* Passenger & Train Details */}
                        <h3 className="text-base font-extrabold text-black dark:text-white mb-1 group-hover:text-[#2563EB] transition-colors">
                          {req.passenger?.name || t('passenger')}
                        </h3>
                        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-4">
                          {t('train')} {req.train_no} · {req.train_name || 'Station Assistance'}
                        </p>

                        {/* Journey Metadata */}
                        <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800/80 text-xs mb-4">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 block uppercase">{t('platform')}</span>
                            <span className="font-bold text-black dark:text-white">P2</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 block uppercase">{t('date')}</span>
                            <span className="font-bold text-black dark:text-white">{req.journey_date}</span>
                          </div>
                        </div>

                        {/* Services List */}
                        <div className="space-y-2 pb-4 mb-4 border-b border-slate-100 dark:border-zinc-800">
                          {activeServices(req.services || []).map((s) => (
                            <div key={s.key} className="flex justify-between text-xs text-slate-600 dark:text-zinc-400">
                              <span>{s.label}</span>
                              <span className="font-bold text-black dark:text-white">{s.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Primary CTA */}
                      <button
                        type="button"
                        onClick={() => acceptJob(req.id)}
                        disabled={actionLoading}
                        className="w-full py-3 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>{t('acceptRequest')}</span>
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MY ASSIGNED JOBS */}
          {tab === 'jobs' && (
            <div className="space-y-4">
              {activeJobs.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-12 text-center max-w-md mx-auto shadow-2xs">
                  <Briefcase size={32} className="mx-auto text-slate-400 mb-3" />
                  <h3 className="font-bold text-base text-black dark:text-white mb-1">{t('noActiveJob')}</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mb-6">
                    {t('acceptToStart')}
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab('dashboard')}
                    className="py-2.5 px-6 rounded-full bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    {t('viewRequestsBtn')} →
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeJobs.map((job) => (
                    <AssistantJobCard
                      key={job.id}
                      job={job}
                      onUpdate={handleJobUpdate}
                      onRedirectDashboard={() => setTab('dashboard')}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TRIP HISTORY */}
          {tab === 'history' && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl divide-y divide-slate-100 dark:divide-zinc-800 overflow-hidden shadow-2xs">
              {completedJobs.length === 0 ? (
                <div className="p-12 text-center text-xs font-medium text-slate-400">
                  {t('noCompletedJobs') || 'No completed jobs recorded yet.'}
                </div>
              ) : (
                completedJobs.map((job) => {
                  const jobServices = getCompletedJobServices(job);
                  return (
                    <div key={job.id} className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-extrabold text-sm sm:text-base text-black dark:text-white">
                            Train {job.train_no} · {job.train_name}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-extrabold uppercase tracking-wide border border-emerald-200/60 dark:border-emerald-800/50">
                            {t('completed') || 'Completed'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400 dark:text-zinc-500">
                          <span>{job.journey_date || 'Completed'}</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                            <CheckCircle2 size={11} />
                            <span>Verified Passenger</span>
                          </span>
                          <span>·</span>
                          <span className="font-mono text-[11px]">ID: {job.booking_id || job.id}</span>
                          {(job.coach || job.seat_number) && (
                            <>
                              <span>·</span>
                              <span className="text-slate-600 dark:text-zinc-300 font-semibold">
                                Coach {job.coach || '—'}{job.seat_number ? ` / Berth ${job.seat_number}` : ''}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Selected Services Badges */}
                        <div className="pt-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mr-1 flex items-center gap-1">
                            <Luggage size={11} className="text-[#2563EB]" />
                            <span>{t('servicesSelected') || 'Services Selected'}:</span>
                          </span>
                          {jobServices.map((s) => (
                            <span
                              key={s.key}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50/90 dark:bg-blue-950/50 text-[#2563EB] dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/50 text-xs font-bold shadow-2xs"
                            >
                              <span>{s.label}</span>
                              {s.value && s.value !== 'Yes' && s.value !== 'Selected' && (
                                <span className="px-1.5 py-0.5 rounded bg-white dark:bg-black text-[11px] font-semibold text-slate-700 dark:text-zinc-300 shadow-2xs">
                                  {s.value}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>

                        {job.review && (
                          <div className="mt-2 text-xs bg-slate-50 dark:bg-zinc-800/60 p-2.5 px-3 rounded-xl border border-slate-200/60 dark:border-zinc-700/60 text-slate-700 dark:text-zinc-300 italic flex items-start gap-1.5 max-w-xl">
                            <span className="text-amber-500 font-serif text-base leading-none">“</span>
                            <span className="font-medium">{job.review}</span>
                            <span className="text-amber-500 font-serif text-base leading-none">”</span>
                          </div>
                        )}
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-zinc-800 shrink-0">
                        <span className="font-extrabold text-base sm:text-lg text-[#2563EB] dark:text-blue-400 tracking-tight">
                          ₹{job.total_price}
                        </span>
                        {job.rating && (
                          <span className="text-xs font-bold text-amber-500 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-900/40">
                            <Star size={13} fill="currentColor" />
                            <span>{job.rating}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 4: EARNINGS & PASSENGER REVIEWS */}
          {tab === 'earnings' && (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-6 shadow-2xs">
                  <span className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest block mb-1">TODAY'S EARNINGS</span>
                  <p className="text-3xl font-black text-black dark:text-white tracking-tight">₹{totalEarnings}</p>
                  <p className="text-xs text-slate-500 mt-1">{completedJobs.length} jobs completed today</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-6 shadow-2xs">
                  <span className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest block mb-1">THIS WEEK</span>
                  <p className="text-3xl font-black text-black dark:text-white tracking-tight">₹{totalEarnings}</p>
                  <p className="text-xs text-slate-500 mt-1">Weekly dispatch payout</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-6 shadow-2xs">
                  <span className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest block mb-1">RATING SCORE</span>
                  <p className="text-3xl font-black text-amber-500 tracking-tight">{averageRating !== '—' ? `${averageRating} ★` : '—'}</p>
                  <p className="text-xs text-slate-500 mt-1">Based on {ratedJobs.length} passenger reviews</p>
                </div>
              </div>

              {/* Passenger Feedback & Reviews Section */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-zinc-800">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg sm:text-xl font-extrabold text-black dark:text-white tracking-tight">
                        Passenger Feedback &amp; Reviews
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                        Live Feedback
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                      Ratings and service reviews submitted by verified passengers. Identities are kept strictly confidential.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800/80 px-3 py-1.5 rounded-full border border-slate-200/70 dark:border-zinc-700 w-fit">
                    <ShieldAlert size={14} className="text-emerald-500" />
                    <span>Anonymous Ratings</span>
                  </div>
                </div>

                {ratedJobs.length === 0 ? (
                  <div className="p-12 text-center text-xs font-medium text-slate-400 dark:text-zinc-500">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3 text-slate-400 dark:text-zinc-500">
                      <Star size={24} />
                    </div>
                    <p className="text-sm font-bold text-slate-700 dark:text-zinc-300 mb-1">No passenger feedback recorded yet</p>
                    <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-sm mx-auto">
                      When passengers rate your assistance and leave feedback, their ratings and reviews will appear here anonymously.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Performance Summary Banner */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/60 dark:border-zinc-700/60">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-500 flex items-center justify-center font-black text-lg">
                          ★
                        </div>
                        <div>
                          <span className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest block">AVG RATING</span>
                          <span className="text-base font-black text-black dark:text-white">{averageRating} / 5.0</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-sm">
                          {ratedJobs.length}
                        </div>
                        <div>
                          <span className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest block">TOTAL REVIEWS</span>
                          <span className="text-base font-black text-black dark:text-white">{ratedJobs.length} Verified</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                          <CheckCircle2 size={18} />
                        </div>
                        <div>
                          <span className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest block">SATISFACTION</span>
                          <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                            {((ratedJobs.filter((j) => Number(j.rating) >= 4).length / ratedJobs.length) * 100).toFixed(0)}% Positive
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Review Cards List */}
                    <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {ratedJobs.map((job) => (
                        <div key={job.id} className="py-4.5 first:pt-2 last:pb-2 space-y-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Star rendering */}
                              <div className="flex items-center gap-0.5 text-amber-500">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    size={14}
                                    className={s <= Number(job.rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-zinc-700'}
                                  />
                                ))}
                              </div>
                              <span className="text-xs font-black text-black dark:text-white">
                                {Number(job.rating).toFixed(1)}
                              </span>
                              <span className="text-slate-300 dark:text-zinc-700">•</span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full">
                                <CheckCircle2 size={11} />
                                <span>Verified Passenger</span>
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-zinc-500">
                              <span>Train {job.train_no} · {job.train_name}</span>
                              <span>•</span>
                              <span>{job.journey_date || 'Recent'}</span>
                            </div>
                          </div>

                          {/* Review Text */}
                          {job.review ? (
                            <p className="text-xs text-slate-800 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-800/70 p-3.5 rounded-xl border border-slate-200/60 dark:border-zinc-700/60 font-medium leading-relaxed italic">
                              “{job.review}”
                            </p>
                          ) : (
                            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium italic">
                              Rated {job.rating} / 5 stars for transit assistance.
                            </p>
                          )}

                          <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                            <span>Coach {job.coach || '—'} / Berth {job.seat_berth || '—'}</span>
                            <span>•</span>
                            <span>Platform {job.platform || '1'}</span>
                            <span>•</span>
                            <span className="italic text-slate-400/80 dark:text-zinc-500/80">Passenger identity hidden for privacy</span>
                          </div>

                          {/* Services in Passenger Feedback */}
                          <div className="flex flex-wrap items-center gap-1 pt-1">
                            {getCompletedJobServices(job).map((s) => (
                              <span
                                key={s.key}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-[10px] font-bold text-slate-600 dark:text-zinc-400"
                              >
                                <span>{s.label}</span>
                                {s.value && s.value !== 'Yes' && s.value !== 'Selected' && (
                                  <span className="text-[9px] text-slate-500 dark:text-zinc-400 font-semibold">• {s.value}</span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: PROFILE VIEW */}
          {tab === 'profile' && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-2xl space-y-6 shadow-2xs">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-black text-white dark:bg-white dark:text-black font-extrabold text-2xl flex items-center justify-center">
                  {assistantName.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-black dark:text-white">{assistantName}</h3>
                  <p className="text-xs font-medium text-slate-400">{profile?.email}</p>
                  <span className="inline-block px-2.5 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 text-[10px] font-bold uppercase mt-1">
                    {t('verifiedBadge')} Railway Assistant
                  </span>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('assignedStation')}</span>
                  <p className="font-bold text-sm text-black dark:text-white">{currentStationObj.name} ({station})</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('kycStatus')}</span>
                  <p className="font-bold text-sm text-emerald-600">{t('verifiedBadge')} & APPROVED</p>
                </div>
              </div>

              {/* Registered Phone Number Card (Confidential & KYC Locked) */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-400 uppercase tracking-wider">
                      Registered Mobile Number
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40 flex items-center gap-1 select-none">
                      <Lock size={9} />
                      <span>Confidential & KYC Locked</span>
                    </span>
                  </div>
                  <p className="font-bold text-sm text-black dark:text-white flex items-center gap-1.5 mt-1">
                    <Phone className="w-4 h-4 text-slate-600 dark:text-zinc-300 shrink-0" />
                    <span>
                      {profile?.phone || user?.phone ? (
                        (profile?.phone || user?.phone)?.startsWith('+91')
                          ? (profile?.phone || user?.phone)
                          : `+91 ${profile?.phone || user?.phone}`
                      ) : (
                        <span className="text-slate-400 italic">No phone added</span>
                      )}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                    Verified contact number for dispatch security. To update, contact your Station Master or Platform Administrator.
                  </p>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[11px] font-bold text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 self-start sm:self-center shrink-0 select-none">
                  <Lock size={12} />
                  <span>Admin Locked</span>
                </div>
              </div>

              {/* Help & Support Section inside Profile */}
              <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-3">
                <span className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                  {t('helpEmergencySupport')}
                </span>

                <button
                  type="button"
                  onClick={() => setTab('support')}
                  className="w-full p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800/70 dark:hover:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 flex items-center justify-between transition-all cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-400 flex items-center justify-center shrink-0">
                      <LifeBuoy size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-black dark:text-white group-hover:text-[#2563EB] dark:group-hover:text-blue-400 transition-colors">
                        {t('helpDesk')}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                        {t('supportSub')}
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-slate-400 group-hover:text-[#2563EB] group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>

                {/* Direct Hotlines */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={(e) => handleDirectCall(e, '139')}
                    className="p-3 rounded-xl bg-blue-50/70 hover:bg-blue-100/70 dark:bg-blue-950/40 dark:hover:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/60 text-xs font-bold text-[#2563EB] dark:text-blue-400 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <LifeBuoy size={14} />
                    <span>Control Room (139)</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDirectCall(e, '112')}
                    className="p-3 rounded-xl bg-rose-50/70 hover:bg-rose-100/70 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 border border-rose-200/60 dark:border-rose-900/60 text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ShieldAlert size={14} />
                    <span>Emergency (112)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SUPPORT & EMERGENCY OPS CONSOLE */}
          {tab === 'support' && (
            <div className="space-y-6 w-full max-w-7xl">

              {/* 1. HOTLINE CARDS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 139 RailMadad & Control Room Card */}
                <div
                  onClick={() => openHotlineModal('139')}
                  role="button"
                  tabIndex={0}
                  className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-2xs space-y-4 hover:border-blue-400 dark:hover:border-blue-600 transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] flex items-center justify-center group-hover:scale-105 transition-transform">
                        <LifeBuoy size={24} />
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-[#2563EB] dark:bg-blue-950/50 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
                        24/7 TOLL-FREE
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block">
                        {t('helpDesk')}
                      </span>
                      <h4 className="font-extrabold text-xl text-black dark:text-white mt-0.5 group-hover:text-[#2563EB] dark:group-hover:text-blue-400 transition-colors">
                        139 Control Room
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                        {t('supportSub')}
                      </p>
                    </div>

                    {/* Station Location Tag */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800 text-[11px] text-slate-600 dark:text-zinc-300 flex items-center gap-2">
                      <MapPin size={13} className="text-[#2563EB] shrink-0" />
                      <span className="font-medium truncate">{currentStationObj.name} Concourse Control Desk</span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleDirectCall(e, '139')}
                      className="flex-1 min-w-[120px] py-2.5 px-3 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Phone size={13} />
                      <span>{t('callNow')} (139)</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard('139', '139');
                      }}
                      className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Copy phone number"
                    >
                      {copiedNumber === '139' ? (
                        <>
                          <Check size={13} className="text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400">{t('copied')}</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>{t('copyNumber')}</span>
                        </>
                      )}
                    </button>

                    <div className="w-full text-right pt-1">
                      <span className="text-[11px] font-bold text-[#2563EB] dark:text-blue-400 group-hover:underline inline-flex items-center gap-1">
                        <span>139 Control Room Details</span>
                        <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </div>
                </div>

                {/* 112 National Emergency SOS Card */}
                <div
                  onClick={() => openHotlineModal('112')}
                  role="button"
                  tabIndex={0}
                  className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-2xs space-y-4 hover:border-rose-400 dark:hover:border-rose-600 transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <ShieldAlert size={24} />
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40">
                        EMERGENCY SOS
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block">
                        {t('policeHelpline112')}
                      </span>
                      <h4 className="font-extrabold text-xl text-black dark:text-white mt-0.5 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                        112 Emergency Hotline
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                        {t('emergencySos')} • RPF &amp; Police Support
                      </p>
                    </div>

                    {/* Station Police Tag */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800 text-[11px] text-slate-600 dark:text-zinc-300 flex items-center gap-2">
                      <Radio size={13} className="text-rose-600 shrink-0 animate-pulse" />
                      <span className="font-medium truncate">RPF &amp; GRP Station Police ({currentStationObj.name})</span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleDirectCall(e, '112')}
                      className="flex-1 min-w-[120px] py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <PhoneCall size={13} />
                      <span>{t('callNow')} (112 SOS)</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard('112', '112');
                      }}
                      className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Copy phone number"
                    >
                      {copiedNumber === '112' ? (
                        <>
                          <Check size={13} className="text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400">{t('copied')}</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>{t('copyNumber')}</span>
                        </>
                      )}
                    </button>

                    <div className="w-full text-right pt-1">
                      <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 group-hover:underline inline-flex items-center gap-1">
                        <span>112 Emergency Hotline Details</span>
                        <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. MAIN 2-COLUMN DESK: TICKET DISPATCH (LEFT) & SAFETY PROTOCOLS / FAQS (RIGHT ON LAPTOP) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                {/* Left Column: Report Operational Issue to Station Desk & Recent Tickets (7 cols on lg, full width on mobile) */}
                <div className="lg:col-span-7 space-y-6">
                  {/* REPORT OPERATIONAL ISSUE TO STATION SUPERVISOR FORM */}
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-2xs space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-zinc-800">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg sm:text-xl font-extrabold text-black dark:text-white tracking-tight">
                            {t('reportIssueTitle')}
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                            Station Desk
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                          {t('reportIssueSub')}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800/80 px-3 py-1.5 rounded-full border border-slate-200/70 dark:border-zinc-700 w-fit shrink-0">
                        <MapPin size={13} className="text-[#2563EB]" />
                        <span>{currentStationObj.name} ({station})</span>
                      </div>
                    </div>

                    {ticketSuccess && (
                      <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                          <span>{ticketSuccess}</span>
                        </div>
                        <button type="button" onClick={() => setTicketSuccess('')} className="text-xs underline">✕</button>
                      </div>
                    )}

                    <form onSubmit={handleTicketSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Category Selector */}
                        <div>
                          <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                            {t('category')} *
                          </label>
                          <select
                            value={ticketCategory}
                            onChange={(e) => setTicketCategory(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-black dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                          >
                            <option value="passenger_absent">{t('passengerNoShow')}</option>
                            <option value="luggage_dispute">{t('luggageDispute')}</option>
                            <option value="platform_change">{t('platformChangeNotice')}</option>
                            <option value="payment_issue">{t('paymentDispute')}</option>
                            <option value="medical_sos">{t('medicalEmergency')}</option>
                            <option value="other">{t('otherQuery')}</option>
                          </select>
                        </div>

                        {/* Priority Selector */}
                        <div>
                          <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                            Urgency Level
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setTicketPriority('normal')}
                              className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                ticketPriority === 'normal'
                                  ? 'bg-blue-50 border-[#2563EB] text-[#2563EB] dark:bg-blue-950/40 dark:text-blue-400'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400'
                              }`}
                            >
                              Standard Notice
                            </button>
                            <button
                              type="button"
                              onClick={() => setTicketPriority('urgent')}
                              className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                ticketPriority === 'urgent'
                                  ? 'bg-rose-50 border-rose-600 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400'
                              }`}
                            >
                              Urgent Concourse
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Optional PNR Field */}
                      <div>
                        <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                          {t('pnrOptional')}
                        </label>
                        <input
                          type="text"
                          value={ticketPnr}
                          onChange={(e) => setTicketPnr(e.target.value)}
                          placeholder="e.g. 2489012431 (10-digit railway PNR)"
                          maxLength={10}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-black dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                        />
                      </div>

                      {/* Description Textarea */}
                      <div>
                        <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                          {t('describeIssue')} *
                        </label>
                        <textarea
                          rows={3}
                          value={ticketDesc}
                          onChange={(e) => setTicketDesc(e.target.value)}
                          placeholder="Briefly explain what happened at the coach/platform (e.g. Passenger unreachable at Coach B4, luggage exceeded standard limit, or train platform altered to PF 4)..."
                          required
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-black dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                        />
                      </div>

                      {/* Submit Button */}
                      <div className="flex justify-end pt-1">
                        <button
                          type="submit"
                          disabled={ticketSubmitting || !ticketDesc.trim()}
                          className="py-3 px-6 rounded-xl bg-black text-white dark:bg-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-extrabold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Send size={14} />
                          <span>{ticketSubmitting ? 'Dispatching...' : t('submitTicket')}</span>
                        </button>
                      </div>
                    </form>

                    {/* 3. RECENT TICKETS LOG */}
                    <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                          {t('recentTickets')} ({supportTickets.length})
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                          Synced with Station Supervisor Desk
                        </span>
                      </div>

                      {supportTickets.length === 0 ? (
                        <p className="text-xs text-slate-400 py-3 text-center">{t('noRecentTickets')}</p>
                      ) : (
                        <div className="space-y-2.5">
                          {supportTickets.map((tk) => (
                            <div
                              key={tk.id}
                              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/70 dark:border-zinc-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-black dark:text-white">
                                    #{tk.id}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      tk.priority === 'urgent'
                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                                        : 'bg-blue-50 text-[#2563EB] dark:bg-blue-950/60 dark:text-blue-400'
                                    }`}
                                  >
                                    {tk.category}
                                  </span>
                                  {tk.pnr && tk.pnr !== 'N/A' && (
                                    <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400">
                                      PNR: {tk.pnr}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-600 dark:text-zinc-300">
                                  {tk.desc}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40 flex items-center gap-1">
                                  <CheckCircle2 size={11} />
                                  <span>{tk.status}</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(tk.id, tk.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-black dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                                  title="Copy ticket ID"
                                >
                                  {copiedNumber === tk.id ? (
                                    <Check size={13} className="text-emerald-500" />
                                  ) : (
                                    <Copy size={13} />
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Platform Assistant Safety Protocols & FAQs (5 cols on lg, full width on mobile) */}
                <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-6">
                  {/* 4. PLATFORM ASSISTANT GUIDELINES & FAQS */}
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <HelpCircle size={18} className="text-[#2563EB]" />
                        <h3 className="text-base sm:text-lg font-extrabold text-black dark:text-white tracking-tight">
                          {t('protocolsTitle')}
                        </h3>
                      </div>
                      <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                        {lang === 'te' ? 'మార్గదర్శకాలు' : lang === 'hi' ? 'दिशानिर्देश' : 'Guidelines'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium leading-relaxed">
                      {lang === 'te'
                        ? 'ప్లాట్ఫారమ్పై సాధారణ సమస్యల పరిష్కారానికి తక్షణ మార్గదర్శకాలు మరియు నిబంధనలు.'
                        : lang === 'hi'
                        ? 'प्लेटफॉर्म पर सामान्य समस्याओं के त्वरित समाधान के लिए मानक संचालन प्रक्रियाएं।'
                        : 'Standard operating procedures for immediate resolution of common on-platform transit situations.'}
                    </p>

                    <div className="space-y-2.5 pt-1">
                      {(lang === 'te'
                        ? [
                            {
                              q: 'కోచ్ వద్ద ప్రయాణీకుడు కనిపించకపోతే నేను ఏమి చేయాలి?',
                              a: 'రైలు చేరిన తర్వాత కనీసం 10 నిమిషాల పాటు కేటాయించిన కోచ్ వద్ద వేచి ఉండండి. యాప్లోని "ప్రయాణీకుడికి కాల్ చేయండి" బటన్ను ఉపయోగించండి. వారు అందుబాటులో లేకుంటే, పక్కన ఉన్న ఆపరేషనల్ టిక్కెట్ను సబ్మిట్ చేయండి, తద్వారా మీ డ్యూటీ రేటింగ్కు ఎటువంటి ప్రభావం పడకుండా సూపర్ వైజర్ వెరిఫై చేస్తారు.'
                            },
                            {
                              q: 'లగేజీ ప్రామాణిక బుకింగ్ పరిమితి కంటే ఎక్కువగా ఉంటే ఏమి చేయాలి?',
                              a: 'ప్రామాణిక పోర్టర్ సహాయం 40 కిలోల వరకు లగేజీని కవర్ చేస్తుంది. లగేజీ పరిమితి మించితే, అదనపు లగేజీ వోచర్ లేదా రెండవ అసిస్టెంట్ బుకింగ్ అవసరమని ప్రయాణీకుడికి మర్యాదగా వివరించండి. ప్లాట్ఫారమ్పై ఎప్పుడూ వాదించవద్దు; వివాదం ఉంటే టిక్కెట్ రైజ్ చేయండి.'
                            },
                            {
                              q: 'చివరి నిమిషంలో ప్లాట్ఫారమ్ మార్పులను ఎలా నిర్వహించాలి?',
                              a: 'వన్ కూలీ రాడార్ స్టేషన్ ప్రకటనల వ్యవస్థతో రియల్ టైమ్లో సమన్వయం చేసుకుంటుంది. రైలు వేరే ప్లాట్ఫారమ్కు మారితే, మీ యాక్టివ్ జాబ్ కార్డ్లో అది కనిపిస్తుంది. ఎల్లప్పుడూ ర్యాంప్లు లేదా లిఫ్ట్లను ఉపయోగించి ప్రయాణీకులకు సహాయం చేయండి.'
                            },
                            {
                              q: 'ప్లాట్ఫారమ్పై అత్యవసర వైద్య పరిస్థితి ఏర్పడితే తక్షణ ప్రొటోకాల్ ఏమిటి?',
                              a: 'వెంటనే పైన ఉన్న హాట్లైన్ల నుండి 139 లేదా 112 కు డయల్ చేయండి. అదే సమయంలో డ్యూటీలో ఉన్న RPF లేదా ప్లాట్ఫారమ్ మాస్టర్ను అప్రమత్తం చేయండి. ప్లాట్ఫారమ్ 1 వద్ద అత్యవసర వీల్ చైర్లు మరియు ప్రథమ చికిత్స కిట్లు అందుబాటులో ఉంటాయి.'
                            }
                          ]
                        : lang === 'hi'
                        ? [
                            {
                              q: 'यदि कोई यात्री अपने कोच पर नहीं मिलता है तो मुझे क्या करना चाहिए?',
                              a: 'ट्रेन आगमन के निर्धारित समय से कम से कम 10 मिनट तक निर्दिष्ट कोच पर प्रतीक्षा करें। ऐप में "यात्री को कॉल करें" बटन का उपयोग करें। यदि वे संपर्क से बाहर रहते हैं, तो ऊपर या बगल में एक परिचालन टिकट दर्ज करें ताकि आपकी ड्यूटी रेटिंग प्रभावित न हो।'
                            },
                            {
                              q: 'यदि सामान मानक बुकिंग सीमा से अधिक हो तो क्या करें?',
                              a: 'मानक कुली सहायता 40 किलोग्राम तक के सामान को कवर करती है। यदि सामान इससे अधिक है, तो यात्री को विनम्रतापूर्वक बताएं कि अतिरिक्त सामान के लिए अतिरिक्त सामान वाउचर या दूसरे सहायक की बुकिंग आवश्यक है। कभी भी विवाद न करें; टिकट दर्ज करें।'
                            },
                            {
                              q: 'अंतिम समय में प्लेटफॉर्म परिवर्तन को कैसे संभाला जाता है?',
                              a: 'वनकुली रडार वास्तविक समय में स्टेशन घोषणा प्रणाली के साथ सिंक होता है। यदि ट्रेन दूसरे प्लेटफॉर्म पर डायवर्ट की जाती है, तो आपका सक्रिय जॉब कार्ड परिवर्तन दिखाएगा। अधिकृत रैंप या फुट-ओवरब्रिज लिफ्ट का उपयोग करके यात्री की सहायता करें।'
                            },
                            {
                              q: 'प्लेटफॉर्म पर चिकित्सीय आपात स्थिति में तत्काल प्रोटोकॉल क्या है?',
                              a: 'तुरंत ऊपर दिए गए हॉटलाइन से 139 या 112 डायल करें। साथ ही ड्यूटी पर तैनात आरपीएफ या प्लेटफॉर्म मास्टर को सतर्क करें। प्लेटफॉर्म 1 पर आपातकालीन व्हीलचेयर और प्राथमिक चिकित्सा किट उपलब्ध हैं।'
                            }
                          ]
                        : [
                            {
                              q: 'What should I do if a passenger does not show up at their coach?',
                              a: 'Wait at the designated coach for at least 10 minutes past the scheduled train arrival. Use the in-app "Call Passenger" button. If they remain unreachable, submit an operational ticket beside so our concourse supervisor can verify without penalizing your duty acceptance rating.'
                            },
                            {
                              q: 'What if luggage exceeds the standard booking allowance?',
                              a: 'Standard porter assistance covers luggage up to 40kg. If luggage exceeds this, politely guide the passenger that additional luggage requires an excess baggage voucher or a second assistant booking. Never argue on the platform; raise an operational ticket if disputed.'
                            },
                            {
                              q: 'How are last-minute platform changes handled?',
                              a: 'OneCoolie radar synchronizes with the station announcement system in real time. If a train is diverted to a different platform, your active job card will reflect the change. Always assist the passenger using authorized ramps or foot-overbridge lifts.'
                            },
                            {
                              q: 'Immediate protocol in case of medical emergency on the platform',
                              a: 'Instantly dial 139 or 112 from the hotlines above. Simultaneously alert the on-duty RPF constable or the Platform Master. Emergency wheelchairs and first-aid kits are located at the Platform 1 Station Director Concourse.'
                            }
                          ]
                      ).map((faq, idx) => {
                        const isExpanded = expandedFaq === idx;
                        return (
                          <div
                            key={idx}
                            className="rounded-2xl border border-slate-200/70 dark:border-zinc-800 overflow-hidden bg-slate-50/40 dark:bg-zinc-800/30 transition-all"
                          >
                            <button
                              type="button"
                              onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                              className="w-full p-4 text-left flex items-center justify-between gap-3 hover:bg-slate-100/60 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
                            >
                              <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-zinc-200 leading-snug">
                                {faq.q}
                              </span>
                              <ChevronDown
                                size={16}
                                className={`text-slate-400 shrink-0 transition-transform duration-200 ${
                                  isExpanded ? 'rotate-180 text-[#2563EB]' : ''
                                }`}
                              />
                            </button>
                            {isExpanded && (
                              <div className="px-4 pb-4 text-xs text-slate-600 dark:text-zinc-300 leading-relaxed border-t border-slate-200/60 dark:border-zinc-700/60 pt-3 bg-white/80 dark:bg-zinc-900/80">
                                {faq.a}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ── FOOTER BAR ─────────────────────────────────────────────── */}
          <footer className="pt-8 border-t border-slate-200/80 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 dark:text-zinc-500 gap-2">
            <span>OneCoolie • Making Every Journey Easier</span>
            <span className="font-semibold text-slate-600 dark:text-zinc-400">Stay Ready. More Journeys Ahead. →</span>
          </footer>
        </main>
      </div>

      {/* ── MOBILE BOTTOM NAVIGATION BAR ──────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-black/95 backdrop-blur-md border-t border-slate-200 dark:border-zinc-800 px-2 py-2 flex items-center justify-around">
        {[
          { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
          { id: 'jobs', label: activeJobs.length <= 1 ? t('myAssignedJob') : t('myJobs'), icon: Briefcase },
          { id: 'history', label: t('tripHistory'), icon: History },
          { id: 'earnings', label: t('earningsReviews'), icon: IndianRupee },
          { id: 'profile', label: t('profile'), icon: User },
        ].map((item, i) => {
          const IconComp = item.icon;
          const isActive = tab === item.id;
          return (
            <button
              key={`${item.id}-${i}`}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex flex-col items-center gap-1 p-1.5 rounded-xl text-[10px] font-bold transition-all ${isActive ? 'text-[#2563EB] dark:text-blue-400' : 'text-slate-400 dark:text-zinc-500'
                }`}
            >
              <IconComp size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── LIGHTWEIGHT OFF DUTY CONFIRMATION DIALOG ──────────────────── */}
      {offDutyConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
              <Clock size={24} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-black dark:text-white tracking-tight">{t('confirmOffDuty')}</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                {t('confirmOffDutyDesc')}
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOffDutyConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all cursor-pointer"
              >
                {t('stayOnDuty')}
              </button>
              <button
                type="button"
                onClick={confirmOffDuty}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-black text-white dark:bg-white dark:text-black text-xs font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all cursor-pointer"
              >
                {t('confirmGoOffDuty')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVE JOB SAFETY WARNING DIALOG ──────────────────────────── */}
      {activeJobWarningOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-black dark:text-white tracking-tight">{t('activeJobWarning')}</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                {t('activeJobWarningDesc')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveJobWarningOpen(false);
                setTab('jobs');
              }}
              className="w-full py-3 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              {activeJobs.length <= 1 ? t('myAssignedJob') : t('myJobs')}
            </button>
          </div>
        </div>
      )}

      {/* ── EMERGENCY HOTLINE & STATION HUB MODAL DIALOG ────────────── */}
      {supportModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSupportModal(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    supportModal.type === 'emergency'
                      ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                      : 'bg-blue-50 text-[#2563EB] dark:bg-blue-950/60 dark:text-blue-400'
                  }`}
                >
                  {supportModal.type === 'emergency' ? <ShieldAlert size={26} /> : <LifeBuoy size={26} />}
                </div>
                <div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider block w-fit mb-1 ${
                      supportModal.type === 'emergency'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400'
                        : 'bg-blue-100 text-[#2563EB] dark:bg-blue-950/70 dark:text-blue-400'
                    }`}
                  >
                    {supportModal.badge}
                  </span>
                  <h3 className="text-lg font-black text-black dark:text-white tracking-tight">
                    {supportModal.title}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSupportModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Prominent Hotline Display */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/70 dark:border-zinc-700 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block">
                  HOTLINE NUMBER
                </span>
                <span className="text-3xl font-black text-black dark:text-white tracking-tight">
                  {supportModal.number}
                </span>
              </div>

              <button
                type="button"
                onClick={() => copyToClipboard(supportModal.number, supportModal.number)}
                className="py-2 px-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {copiedNumber === supportModal.number ? (
                  <>
                    <Check size={14} className="text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">{t('copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>{t('copyNumber')}</span>
                  </>
                )}
              </button>
            </div>

            {/* Description & Hub Note */}
            <div className="space-y-2 text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
              <p>{supportModal.desc}</p>
              <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-[11px] font-medium text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                <MapPin size={14} className="text-[#2563EB] shrink-0" />
                <span>{supportModal.hubNote}</span>
              </div>
            </div>

            {/* Primary Functions Checklist */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-zinc-500 block">
                COVERED CONCOURSE SERVICES
              </span>
              <div className="space-y-1">
                {supportModal.services.map((srv, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-slate-700 dark:text-zinc-300">
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                    <span>{srv}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Call Action Bar */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSupportModal(null)}
                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all cursor-pointer"
              >
                Close
              </button>

              <a
                href={`tel:${supportModal.number}`}
                className={`flex-1 py-3 rounded-xl text-white text-xs font-extrabold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  supportModal.type === 'emergency'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#2563EB] hover:bg-blue-700'
                }`}
              >
                {supportModal.type === 'emergency' ? <PhoneCall size={14} /> : <Phone size={14} />}
                <span>{t('callNow')} ({supportModal.number})</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}