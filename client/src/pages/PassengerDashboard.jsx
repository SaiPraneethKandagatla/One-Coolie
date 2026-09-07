import React, { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import oneCoolieLogo from '../assets/onecoolie-logo.png';
import {
  Calendar,
  Briefcase,
  Bell,
  Check,
  CheckCircle2,
  X,
  AlertCircle,
  Train,
  Ticket,
  MapPin,
  Clock,
  Armchair,
  Luggage,
  ShieldCheck,
  Zap,
  Building2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Users,
  Heart,
  Plus,
  Minus,
  Sparkles,
  Info,
  LogOut,
  LogIn,
  PackageCheck,
  Navigation,
  Accessibility,
  Languages,
  Coffee,
  Car,
  CircleDot,
  IndianRupee,
  FileText,
  Compass,
  Search,
  CreditCard,
  LayoutGrid,
  Edit,
  Lock,
  MoreVertical,
  Headphones,
  Copy,
  Home,
} from 'lucide-react';
import TrainSearch from '../components/TrainSearch';
import PaymentModal from '../components/PaymentModal';
import ProfileMenu from '../context/ProfileMenu';
import PassengerNotifications from '../components/PassengerNotifications';
import ConfirmDialog from '../components/ConfirmDialog';
import Brand from '../components/Brand';
import { BookingSkeleton } from '../components/Skeleton';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import axios from '../api/axios';
import { STATIONS } from '../utils/services';
import { useAuth } from '../context/AuthContext';
import HelpCenter from '../components/support/HelpCenter';
import SupportAssistantChat from '../components/support/SupportAssistantChat';
import TicketTracking from '../components/support/TicketTracking';
import TicketDetailView from '../components/support/TicketDetailView';
import FaqView from '../components/support/FaqView';
import RaiseTicketView from '../components/support/RaiseTicketView';
import { FAQ_QUESTIONS, FAQ_CATEGORIES } from '../utils/supportFaqData';
import Footer from '../components/Footer';
import TrainLoader from '../components/TrainLoader';

/* ============================================================
   PASSENGER DASHBOARD — Swiss Minimal Product with Premium Icons
   Strictly Black (#000000), White (#FFFFFF), and OneCoolie Blue (#2563EB)
   ============================================================ */

const SERVICE_META = [
  {
    key: 'luggage',
    label: 'Luggage Assistance',
    price: 30,
    per: 'item',
    qty: true,
    desc: 'Dedicated porter handling from station gate directly to your berth.',
    icon: Luggage,
  },
  {
    key: 'escort',
    label: 'Seat & Coach Escort',
    price: 60,
    per: 'trip',
    desc: 'Personal guide navigating platform foot-bridges to your exact coach.',
    icon: Navigation,
  },
  {
    key: 'wheelchair',
    label: 'Wheelchair & Priority',
    price: 80,
    per: 'trip',
    desc: 'Wheelchair transit and dedicated escort for seniors & mobility needs.',
    icon: Accessibility,
  },
  {
    key: 'language',
    label: 'Multilingual Guide',
    price: 30,
    per: 'trip',
    desc: 'Local communication assistance in Telugu, Hindi, or English.',
    icon: Languages,
  },
  {
    key: 'snacks',
    label: 'Berth Refreshments',
    price: 50,
    per: 'trip',
    desc: 'Station water and packed snacks delivered right to your seat.',
    icon: Coffee,
  },
  {
    key: 'transport',
    label: 'Exit Gate & Cab Transfer',
    price: 40,
    per: 'trip',
    desc: 'Baggage escorting and navigation to pre-booked app cabs and autos.',
    icon: Car,
  },
];

const ACTIVE_STATUSES = ['pending', 'accepted', 'arriving', 'in_service'];

const DEFAULT_SAMPLE_TRIPS = [
  {
    id: 'RM-VT834-VB',
    booking_id: 'RM-VT834-VB',
    train_no: '20834',
    train_name: 'Vande Bharat Express',
    station_code: 'SC',
    station_name: 'Secunderabad',
    destination: 'Visakhapatnam',
    journey_date: '2026-09-06',
    journey_time: '15:00',
    coach: 'S4',
    seat_number: '42',
    berth_type: 'Lower',
    action_type: 'load_to_seat',
    booking_status: 'pending',
    total_price: 70,
    services: { luggage: 1 },
    created_at: '2026-09-06T14:28:00Z',
    accepted_at: null,
    arrived_at: null,
    completed_at: null,
  },
  {
    id: 'RM-MT0X8PRQ-I4VUB',
    booking_id: 'RM-MT0X8PRQ-I4VUB',
    train_no: '17013',
    train_name: 'Kazipet Express',
    station_code: 'HDP',
    station_name: 'Hadaspar (Pune)',
    destination: 'Kazipet',
    journey_date: '2026-09-12',
    journey_time: '08:10',
    coach: 'S3',
    seat_number: '23',
    berth_type: 'Lower',
    action_type: 'collect_from_seat',
    booking_status: 'completed',
    total_price: 30,
    services: { luggage: 1 },
    created_at: '2026-09-12T08:00:00Z',
    accepted_at: '2026-09-12T08:10:00Z',
    arrived_at: '2026-09-12T09:05:00Z',
    completed_at: '2026-09-12T09:45:00Z',
  },
  {
    id: 'RM-22692-BLR',
    booking_id: 'RM-22692-BLR',
    train_no: '22692',
    train_name: 'Bangalore Rajdhani',
    station_code: 'SBC',
    station_name: 'KSR Bengaluru',
    destination: 'Hazrat Nizamuddin',
    journey_date: '2026-09-08',
    journey_time: '20:00',
    coach: 'B2',
    seat_number: '18',
    berth_type: 'Lower',
    action_type: 'load_to_seat',
    booking_status: 'pending',
    total_price: 80,
    services: { luggage: 2 },
    created_at: '2026-09-05T19:40:00Z',
    accepted_at: '2026-09-05T20:00:00Z',
    arrived_at: null,
    completed_at: null,
  },
  {
    id: 'RM-12723-TEL',
    booking_id: 'RM-12723-TEL',
    train_no: '12723',
    train_name: 'Telangana Express',
    station_code: 'HYB',
    station_name: 'Hyderabad Deccan',
    destination: 'New Delhi',
    journey_date: '2026-09-01',
    journey_time: '06:00',
    coach: 'A1',
    seat_number: '31',
    berth_type: 'Side Lower',
    action_type: 'collect_from_seat',
    booking_status: 'completed',
    total_price: 60,
    services: { luggage: 1 },
    created_at: '2026-09-01T05:15:00Z',
    accepted_at: '2026-09-01T05:30:00Z',
    arrived_at: '2026-09-01T05:55:00Z',
    completed_at: '2026-09-01T06:15:00Z',
  },
];

function TrainLineArt({ className = "w-32 h-14" }) {
  return (
    <svg viewBox="0 0 220 70" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Aerodynamic train nose & roof */}
      <path
        d="M220 52H130C85 52 45 48 28 40C16 35 6 26 2 16C1 12 5 8 12 8H150C185 8 220 10 220 10"
        stroke="#94A3B8"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Window band */}
      <path
        d="M60 20H140C145 20 150 21 160 23L200 28C204 29 206 31 204 34C202 36 196 37 190 37H52C44 37 38 32 41 27C44 23 51 20 60 20Z"
        fill="#EFF6FF"
        stroke="#60A5FA"
        strokeWidth="1.2"
      />
      {/* Cab windshield */}
      <path
        d="M32 24C35 21 42 21 48 21H56V37H37C34 37 30 32 31 29L32 24Z"
        fill="#DBEAFE"
        stroke="#3B82F6"
        strokeWidth="1.2"
      />
      {/* Windows */}
      <rect x="68" y="23" width="14" height="11" rx="2" fill="#DBEAFE" stroke="#60A5FA" strokeWidth="0.8" />
      <rect x="88" y="23" width="14" height="11" rx="2" fill="#DBEAFE" stroke="#60A5FA" strokeWidth="0.8" />
      <rect x="108" y="23" width="14" height="11" rx="2" fill="#DBEAFE" stroke="#60A5FA" strokeWidth="0.8" />
      <rect x="128" y="23" width="14" height="11" rx="2" fill="#DBEAFE" stroke="#60A5FA" strokeWidth="0.8" />
      <rect x="148" y="23" width="14" height="11" rx="2" fill="#DBEAFE" stroke="#60A5FA" strokeWidth="0.8" />
      <rect x="168" y="23" width="14" height="11" rx="2" fill="#DBEAFE" stroke="#60A5FA" strokeWidth="0.8" />
      {/* Headlight */}
      <circle cx="15" cy="40" r="2.5" fill="#2563EB" />
      {/* Railway track lines */}
      <line x1="8" y1="52" x2="220" y2="52" stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="6 3" />
      <line x1="20" y1="58" x2="220" y2="58" stroke="#94A3B8" strokeWidth="1" />
      {/* Speed dash streaks */}
      <line x1="0" y1="58" x2="14" y2="58" stroke="#CBD5E1" strokeWidth="1" strokeLinecap="round" />
      <line x1="10" y1="63" x2="30" y2="63" stroke="#E2E8F0" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

export default function PassengerDashboard() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [tab, setTabState] = useState(() => {
    const tParam = searchParams.get('tab');
    return tParam === 'trips' ? 'trips' : tParam === 'support' ? 'support' : 'book';
  }); // 'book' | 'trips' | 'support'

  const setTab = (newTab) => {
    setTabState(newTab);
    navigate(`/dashboard?tab=${newTab}`, { replace: true });
  };

  useEffect(() => {
    const tParam = searchParams.get('tab');
    if (tParam && (tParam === 'trips' || tParam === 'book' || tParam === 'support')) {
      setTabState(tParam);
    }
  }, [searchParams]);

  // Help & Support Sub-View State inside Dashboard
  const [supportView, setSupportView] = useState('home'); // 'home' | 'chat' | 'tickets' | 'ticket_detail' | 'faq'
  const [supportParams, setSupportParams] = useState({});

  const handleSupportNavigate = (view, params = {}) => {
    if (view === 'back') {
      if (supportView === 'home') {
        setTab('book');
      } else {
        setSupportView('home');
      }
      return;
    }
    if (view === 'book') {
      setTab('book');
      return;
    }
    if (view === 'trips') {
      setTab('trips');
      return;
    }
    setSupportView(view);
    setSupportParams(params || {});
  };
  const [bookingMode, setBookingMode] = useState('pnr'); // 'pnr' | 'train'
  const [bookingStep, setBookingStep] = useState(1); // 1: Journey | 2: Seat & Luggage | 3: Services | 4: Review & Payment

  // PNR lookup state
  const [pnrInput, setPnrInput] = useState('');
  const [pnrLoading, setPnrLoading] = useState(false);
  const [pnrError, setPnrError] = useState('');
  const [pnrVerifiedData, setPnrVerifiedData] = useState(null);

  // Train & station details
  const [selectedTrain, setSelectedTrain] = useState(null);

  // ── Journey Date Booking Window (Real Calendar: Today to Next 7 Days) ──
  const formatDateToYYYYMMDD = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayDateObj = new Date();
  const todayStr = formatDateToYYYYMMDD(todayDateObj);

  const maxDateObj = new Date(todayDateObj);
  maxDateObj.setDate(maxDateObj.getDate() + 7);
  const maxDateStr = formatDateToYYYYMMDD(maxDateObj);

  const dateOptions = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(todayDateObj);
    d.setDate(d.getDate() + i);
    const value = formatDateToYYYYMMDD(d);
    const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' });
    const dateFormatted = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    return {
      value,
      label: dayName,
      subLabel: dateFormatted,
      isToday: i === 0,
    };
  });

  const dateScrollRef = useRef(null);

  const scrollDates = (offset) => {
    if (dateScrollRef.current) {
      dateScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const [journeyDate, setJourneyDate] = useState(() => todayStr);
  const [journeyTime, setJourneyTime] = useState('');
  const [station, setStation] = useState('KZJ');

  // Coach, seat, and mission type
  const [coach, setCoach] = useState('');
  const [seatNumber, setSeatNumber] = useState('');
  const [berthType, setBerthType] = useState('Lower');
  const [actionType, setActionType] = useState('load_to_seat'); // 'load_to_seat' | 'collect_from_seat'

  const [services, setServices] = useState({
    luggage: 0,
    escort: false,
    language: false,
    wheelchair: false,
    snacks: false,
    transport: false,
  });
  const [luggageCounts, setLuggageCounts] = useState({
    small: 0,
    medium: 0,
    large: 0,
  });
  const [payOpen, setPayOpen] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const [tripFilter, setTripFilter] = useState('all'); // 'all' | 'ongoing' | 'upcoming' | 'completed'
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'fare_high' | 'fare_low'
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmCancel, setConfirmCancel] = useState(null);

  // 3-dots action menu & Edit Booking state
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);
  const [editCoach, setEditCoach] = useState('');
  const [editSeat, setEditSeat] = useState('');
  const [editBerth, setEditBerth] = useState('Lower');
  const [editLoading, setEditLoading] = useState(false);

  // Restore active payment session if user returns from another tab/app after page reload
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('onecoolie_active_payment');
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && saved.active && saved.expireAt && saved.expireAt > Date.now()) {
          if (saved.bookingMode) setBookingMode(saved.bookingMode);
          if (saved.pnrInput) setPnrInput(saved.pnrInput);
          if (saved.pnrVerifiedData) setPnrVerifiedData(saved.pnrVerifiedData);
          if (saved.selectedTrain) setSelectedTrain(saved.selectedTrain);
          if (saved.journeyDate) setJourneyDate(saved.journeyDate);
          if (saved.journeyTime) setJourneyTime(saved.journeyTime);
          if (saved.station) setStation(saved.station);
          if (saved.coach) setCoach(saved.coach);
          if (saved.seatNumber) setSeatNumber(saved.seatNumber);
          if (saved.berthType) setBerthType(saved.berthType);
          if (saved.actionType) setActionType(saved.actionType);
          if (saved.services) setServices(saved.services);
          if (saved.luggageCounts) setLuggageCounts(saved.luggageCounts);
          setBookingStep(4);
          setPayOpen(true);
        } else {
          sessionStorage.removeItem('onecoolie_active_payment');
        }
      }
    } catch (e) {
      console.error('Failed to restore active payment session:', e);
    }
  }, []);

  const playConfirmationSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Tone 1: C5 (523.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
      gain1.gain.setValueAtTime(0.25, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.35);

      // Tone 2: G5 (783.99 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, ctx.currentTime + 0.12);
      gain2.gain.setValueAtTime(0.35, ctx.currentTime + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.6);
    } catch (e) {
      console.error('Audio chime error:', e);
    }
  };

  const getLuggageTotalCost = () =>
    (luggageCounts.small || 0) * 30 +
    (luggageCounts.medium || 0) * 40 +
    (luggageCounts.large || 0) * 60;

  const getLuggageTotalCount = () =>
    (luggageCounts.small || 0) +
    (luggageCounts.medium || 0) +
    (luggageCounts.large || 0);

  const getLuggageSummaryLabel = () => {
    const parts = [];
    if (luggageCounts.small > 0) parts.push(`${luggageCounts.small} Small`);
    if (luggageCounts.medium > 0) parts.push(`${luggageCounts.medium} Medium`);
    if (luggageCounts.large > 0) parts.push(`${luggageCounts.large} Large`);
    return parts.length > 0 ? parts.join(', ') : '0 items';
  };

  const calculateTotal = () =>
    SERVICE_META.reduce((sum, s) => {
      if (s.key === 'luggage') {
        return sum + getLuggageTotalCost();
      }
      return s.qty
        ? sum + (services[s.key] || 0) * s.price
        : sum + (services[s.key] ? s.price : 0);
    }, 0);

  const handleCardClick = (s, e) => {
    if (e.target.closest('button, select, input')) return;

    if (s.key === 'luggage') {
      if (getLuggageTotalCount() === 0) {
        setLuggageCounts({ small: 1, medium: 0, large: 0 });
      } else {
        setLuggageCounts({ small: 0, medium: 0, large: 0 });
      }
    } else if (s.qty) {
      setServices((prev) => ({
        ...prev,
        [s.key]: prev[s.key] > 0 ? 0 : 1,
      }));
    } else {
      setServices((prev) => ({
        ...prev,
        [s.key]: !prev[s.key],
      }));
    }
  };

  // Step Validation Helpers - Indian Railways Realistic Coach Validation
  const validateIndianRailwaysCoach = (val) => {
    if (!val || typeof val !== 'string') return { isValid: false, reason: 'Coach number is required.' };
    const clean = val.trim().toUpperCase();
    if (!clean) return { isValid: false, reason: 'Coach number is required.' };

    const staticCodes = ['GS', 'GEN', 'UR', 'SLR', 'SLRD', 'EOG', 'PWR', 'ENG'];
    if (staticCodes.includes(clean)) {
      return { isValid: true, reason: 'Unreserved / Operational Coach' };
    }

    if (/^[0-9]/.test(clean)) {
      return {
        isValid: false,
        reason: 'Invalid! Must start with coach letter prefix (e.g. S4, B2, A1, not 4S).'
      };
    }

    const match = clean.match(/^(HA|AB|HB|EC|EA|3E|S|B|A|H|C|D|E|M|G|J)([0-9]{1,2})$/);
    if (!match) {
      return {
        isValid: false,
        reason: 'Invalid coach prefix! Use standard IR prefixes like S, B, A, H, C, D, E, M, G, GS.'
      };
    }

    const prefix = match[1];
    const num = parseInt(match[2], 10);

    const maxLimits = {
      S: 15,   // Sleeper Class (S1 to S15 max)
      B: 20,   // AC 3-Tier (B1 to B20 max)
      A: 10,   // AC 2-Tier (A1 to A10 max)
      H: 5,    // AC 1st Class (H1 to H5 max)
      C: 20,   // AC Chair Car (C1 to C20 max)
      D: 15,   // Second Seating / Jan Shatabdi (D1 to D15 max)
      E: 5,    // Executive Class (E1 to E5 max)
      M: 10,   // AC 3-Tier Economy (M1 to M10 max)
      G: 20,   // Garib Rath 3-Tier (G1 to G20 max)
      J: 15,   // Garib Rath Chair (J1 to J15 max)
      HA: 3,   // AC 1st + 2nd composite (HA1 to HA3 max)
      AB: 3,   // AC 2nd + 3rd composite (AB1 to AB3 max)
      HB: 3,   // AC 1st + 3rd composite (HB1 to HB3 max)
      EC: 3,   // Executive Anubhuti (EC1 to EC3 max)
      EA: 3,   // Executive Anubhuti (EA1 to EA3 max)
      '3E': 10 // 3-Tier Economy (3E1 to 3E10 max)
    };

    if (num < 1) {
      return {
        isValid: false,
        reason: `Coach number cannot be 0 (use e.g. ${prefix}1, ${prefix}2).`
      };
    }

    const maxAllowed = maxLimits[prefix] || 15;
    if (num > maxAllowed) {
      return {
        isValid: false,
        reason: `Exceeds max coaches! Indian Railways allows max ${prefix}${maxAllowed} for ${prefix} coaches.`
      };
    }

    return { isValid: true, reason: '' };
  };

  // Indian Railways Realistic Seat / Berth Validation
  const validateIndianRailwaysSeat = (seatVal, coachVal) => {
    if (!seatVal || typeof seatVal !== 'string') return { isValid: false, reason: 'Seat / Berth number is required.' };
    const cleanSeat = seatVal.trim().toUpperCase();
    if (!cleanSeat) return { isValid: false, reason: 'Seat / Berth number is required.' };

    const match = cleanSeat.match(/^([0-9]{1,3})\s*[-_]?\s*(LB|MB|UB|SL|SU|SM|WS|W|WINDOW|MIDDLE|LOWER|UPPER|SIDE LOWER|SIDE UPPER)?$/i);
    if (!match) {
      if (/^[A-Z]+$/.test(cleanSeat)) {
        return {
          isValid: false,
          reason: 'Invalid format! Enter a numeric seat number first (e.g. 45, 12 LB, 64 SU).'
        };
      }
      return {
        isValid: false,
        reason: 'Invalid seat format! Must be a seat number between 1 and 108 (e.g. 45, 12 LB, 78 W).'
      };
    }

    const num = parseInt(match[1], 10);
    if (num < 1) {
      return {
        isValid: false,
        reason: 'Seat number must be at least 1 (e.g. 1, 12, 45).'
      };
    }

    const cleanCoach = (coachVal || '').trim().toUpperCase();
    const coachMatch = cleanCoach.match(/^(HA|AB|HB|EC|EA|3E|S|B|A|H|C|D|E|M|G|J)/);
    const prefix = coachMatch ? coachMatch[1] : null;

    let coachMax = 108;
    let coachName = 'Indian Railways coaches';

    if (prefix === 'S') { coachMax = 80; coachName = 'Sleeper (S) coaches'; }
    else if (prefix === 'B' || prefix === 'M' || prefix === '3E' || prefix === 'G') { coachMax = 83; coachName = 'AC 3-Tier / Economy (B/M) coaches'; }
    else if (prefix === 'A') { coachMax = 54; coachName = 'AC 2-Tier (A) coaches'; }
    else if (prefix === 'H') { coachMax = 24; coachName = 'AC 1st Class (H) coaches'; }
    else if (prefix === 'C' || prefix === 'J') { coachMax = 78; coachName = 'AC Chair Car (C) coaches'; }
    else if (prefix === 'E' || prefix === 'EC' || prefix === 'EA') { coachMax = 56; coachName = 'Executive Class (E) coaches'; }
    else if (prefix === 'D') { coachMax = 108; coachName = 'Second Seating (D) coaches'; }

    if (num > coachMax) {
      return {
        isValid: false,
        reason: `Exceeds capacity! Highest seat/berth for ${coachName} is ${coachMax}.`
      };
    }

    return { isValid: true, reason: '' };
  };

  const coachValidation = validateIndianRailwaysCoach(coach);
  const seatValidation = validateIndianRailwaysSeat(seatNumber, coach);

  const isCoachValid = coachValidation.isValid;
  const isSeatValid = seatValidation.isValid;
  const isStep1Valid = Boolean(selectedTrain && journeyDate);
  const isStep2Valid = Boolean(isCoachValid && isSeatValid);
  const isStep3Valid = calculateTotal() > 0;

  const handleNextStep = (targetStep) => {
    if (targetStep <= bookingStep) {
      setBookingStep(targetStep);
      return;
    }
    if (targetStep === 2) {
      if (!isStep1Valid) {
        toast.error('Please select your train and journey date to continue.');
        return;
      }
      setBookingStep(2);
      window.scrollTo({ top: 120, behavior: 'smooth' });
    } else if (targetStep === 3) {
      if (!isStep1Valid) {
        toast.error('Please select your train and journey date.');
        setBookingStep(1);
        return;
      }
      if (!coach.trim()) {
        toast.error('Please enter your Coach Number.');
        return;
      }
      if (!coachValidation.isValid) {
        toast.error(coachValidation.reason || 'Invalid Coach number!');
        return;
      }
      if (!seatNumber.trim()) {
        toast.error('Please enter your Seat/Berth number.');
        return;
      }
      if (!seatValidation.isValid) {
        toast.error(seatValidation.reason || 'Invalid Seat/Berth number!');
        return;
      }
      setBookingStep(3);
      window.scrollTo({ top: 120, behavior: 'smooth' });
    } else if (targetStep === 4) {
      if (!isStep1Valid) {
        toast.error('Please complete Step 1: Journey Details.');
        setBookingStep(1);
        return;
      }
      if (!isStep2Valid) {
        if (!isCoachValid) {
          toast.error(coachValidation.reason || 'Invalid Coach number!');
        } else if (!isSeatValid) {
          toast.error(seatValidation.reason || 'Invalid Seat/Berth number!');
        } else {
          toast.error('Please complete Step 2: Coach and Seat details.');
        }
        setBookingStep(2);
        return;
      }
      if (!isStep3Valid) {
        toast.error('Please select at least one assistance service to continue.');
        setBookingStep(3);
        return;
      }
      setBookingStep(4);
      window.scrollTo({ top: 120, behavior: 'smooth' });
    }
  };

  const fetchBookings = useCallback(async () => {
    try {
      const { data } = await axios.get('/bookings/my-bookings');
      setBookings(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
    const interval = setInterval(fetchBookings, 8000);
    return () => clearInterval(interval);
  }, [fetchBookings, tab]);

  const active = useMemo(() => {
    return bookings.filter((b) => ACTIVE_STATUSES.includes(b.booking_status));
  }, [bookings]);

  const history = useMemo(() => {
    return bookings.filter((b) => !ACTIVE_STATUSES.includes(b.booking_status));
  }, [bookings]);

  const allDisplayBookings = (() => {
    if (!bookings || bookings.length === 0) return DEFAULT_SAMPLE_TRIPS;
    const realIds = new Set(bookings.map((b) => b.id || b.booking_id));
    const supplemental = DEFAULT_SAMPLE_TRIPS.filter((s) => !realIds.has(s.id));
    if (bookings.length >= 4) return bookings;
    return [...bookings, ...supplemental.slice(0, Math.max(0, 4 - bookings.length))];
  })();

  const isOngoingTrip = (b) => {
    const status = b.booking_status?.toLowerCase();
    if (status === 'completed' || status === 'cancelled') return false;
    // Trip currently in progress: live status, or today's active journey
    if (['in_service', 'reached', 'arriving', 'accepted', 'assigned'].includes(status)) return true;
    const jDate = b.journey_date || '';
    if (jDate === '2026-09-06' || b.id === 'RM-VT834-VB') return true;
    return false;
  };

  const ongoingList = allDisplayBookings.filter((b) => isOngoingTrip(b));
  const upcomingList = allDisplayBookings.filter((b) => {
    const status = b.booking_status?.toLowerCase();
    if (status === 'completed' || status === 'cancelled') return false;
    return !isOngoingTrip(b);
  });
  const completedList = allDisplayBookings.filter((b) =>
    b.booking_status?.toLowerCase() === 'completed' || (!ACTIVE_STATUSES.includes(b.booking_status?.toLowerCase()) && !isOngoingTrip(b))
  );

  const activeTripData = useMemo(() => {
    if (!bookings || bookings.length === 0) {
      return null;
    }
    // Prioritize active/ongoing trip, or most recent booking
    const trip = active[0] || bookings.find((b) => !['completed', 'cancelled'].includes(b.booking_status?.toLowerCase())) || bookings[0];
    if (!trip) return null;

    const jDate = trip.journey_date || trip.created_at || new Date().toISOString();
    const dObj = new Date(jDate);
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    let serviceLabel = 'Luggage Assistance';
    if (trip.action_type === 'collect_from_seat') {
      serviceLabel = 'De-boarding Assist';
    } else if (trip.services?.escort) {
      serviceLabel = 'Coach Escort';
    } else if (trip.services?.wheelchair) {
      serviceLabel = 'Wheelchair Escort';
    }

    const trainNo = trip.train_no || trip.train_number || 'Train';
    const trainName = trip.train_name || 'Express';
    const source = trip.source || trip.from_station || trip.station_name || 'Origin';
    const destination = trip.destination || trip.to_station || 'Destination';

    return {
      id: trip.id || trip.booking_id,
      trainNo,
      trainName,
      source,
      destination,
      route: `${source} → ${destination}`,
      coach: trip.coach ? `Coach ${trip.coach}` : 'Coach S4',
      seat: trip.seat_number ? `Seat ${trip.seat_number}${trip.berth_type ? ` (${trip.berth_type})` : ''}` : 'Seat Pending',
      service: serviceLabel,
      status: (trip.booking_status || 'CONFIRMED').toUpperCase(),
      dateMonth: monthNames[dObj.getMonth()] || 'SEP',
      dateDay: String(dObj.getDate()).padStart(2, '0'),
      dateYear: String(dObj.getFullYear()),
      dateDayName: dayNames[dObj.getDay()] || 'SUN',
      platform: trip.platform || '1',
      isReal: true,
    };
  }, [active, bookings]);

  // Auto-fill from URL query params (e.g. from Live Station Board or Home service cards)
  useEffect(() => {
    const tNo = searchParams.get('trainNo');
    const tName = searchParams.get('trainName');
    const stCode = searchParams.get('station');
    if (tNo) {
      setSelectedTrain({
        train_no: tNo,
        train_name: tName || 'Express',
        stops: [{ code: stCode || 'KZJ' }]
      });
      if (stCode) setStation(stCode);
      setBookingMode('train');
      setTab('book');
    }

    const serviceParam = searchParams.get('service');
    if (serviceParam) {
      if (serviceParam === 'luggage' || serviceParam === 'luggage-porter') {
        setServices((prev) => ({ ...prev, luggage: 1 }));
        setLuggageCounts({ small: 1, medium: 0, large: 0 });
      } else if (serviceParam === 'escort' || serviceParam === 'seat-escort') {
        setServices((prev) => ({ ...prev, escort: true }));
      } else if (serviceParam === 'wheelchair' || serviceParam === 'wheelchair-care') {
        setServices((prev) => ({ ...prev, wheelchair: true }));
      } else if (serviceParam === 'transport' || serviceParam === 'exit-transfer') {
        setServices((prev) => ({ ...prev, transport: true }));
      } else if (serviceParam === 'snacks') {
        setServices((prev) => ({ ...prev, snacks: true }));
      } else if (serviceParam === 'language') {
        setServices((prev) => ({ ...prev, language: true }));
      }
    }
  }, [searchParams]);

  const handleFetchPnr = async (e) => {
    e?.preventDefault();
    const pnr = pnrInput.trim();
    if (!/^\d{10}$/.test(pnr)) {
      setPnrError('Please enter a valid 10-digit Indian Railway PNR number.');
      return;
    }

    setPnrLoading(true);
    setPnrError('');
    try {
      const res = await axios.get('/trains/pnr-status', {
        params: { pnrNumber: pnr }
      });

      if (res.data?.success && res.data?.data) {
        const d = res.data.data;
        setPnrVerifiedData(d);
        setSelectedTrain({
          train_no: d.trainNumber,
          train_name: d.trainName,
          from: { name: d.boardingStation },
          to: { name: d.destinationStation },
          stops: [{ code: d.boardingStation }]
        });
        if (d.boardingStation && STATIONS.some((s) => s.code === d.boardingStation)) {
          setStation(d.boardingStation);
        }
        if (d.journeyDate) {
          try {
            const parsed = new Date(d.journeyDate);
            if (!isNaN(parsed.getTime())) {
              setJourneyDate(parsed.toISOString().split('T')[0]);
            }
          } catch { }
        }
        if (d.coach) setCoach(d.coach);
        if (d.berthNumber) setSeatNumber(d.berthNumber);
        if (d.berthType) setBerthType(d.berthType);
        toast.success(`PNR verified: Train ${d.trainNumber} · Coach ${d.coach || 'TBD'} · Berth ${d.berthNumber || 'TBD'}`);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Unable to fetch PNR automatically. You can enter your train & coach details manually below.';
      setPnrError(msg);
    } finally {
      setPnrLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!selectedTrain || !journeyDate) {
      return toast.error('Please select your train and journey date.');
    }
    if (!coach.trim() || !seatNumber.trim()) {
      return toast.error('Please enter your Coach and Seat/Berth number so the assistant knows where to meet you.');
    }
    if (calculateTotal() === 0) {
      return toast.error('Please select at least one assistance service.');
    }
    setPayOpen(true);
  };

  const handlePaid = async (method, preConfirmedBooking = null) => {
    try {
      sessionStorage.removeItem('onecoolie_active_payment');
    } catch (e) { }
    try {
      let data = preConfirmedBooking;
      if (!data) {
        const res = await axios.post('/bookings', {
          train_no: selectedTrain.train_no,
          train_name: selectedTrain.train_name,
          station_code: station,
          journey_date: journeyDate,
          journey_time: journeyTime,
          services: {
            ...services,
            platform: selectedTrain?.platform || '2',
            luggage: getLuggageTotalCount(),
            luggageCounts,
            luggage_details: getLuggageSummaryLabel(),
          },
          total_price: calculateTotal(),
          payment_method: method,
          coach: coach.trim(),
          seat_number: seatNumber.trim(),
          berth_type: berthType,
          action_type: actionType,
          pnr: pnrInput.trim(),
          platform: selectedTrain?.platform || '2',
        });
        data = res.data;
      }
      setPayOpen(false);
      playConfirmationSound();
      setConfirmedBooking(data);
      try {
        if (data.id) sessionStorage.setItem(`booking_${data.id}`, JSON.stringify(data));
        if (data.booking_id) sessionStorage.setItem(`booking_${data.booking_id}`, JSON.stringify(data));

        // 0ms instant cross-tab notification for assistant portal
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel('onecoolie_dispatch_channel');
          bc.postMessage({ type: 'new_booking', booking: data });
          bc.close();
        }
        localStorage.setItem('onecoolie_latest_booking', JSON.stringify({ id: data.id, time: Date.now() }));
      } catch (e) { }
      toast.success('Assistance booking confirmed!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking submission failed');
    }
  };

  const doCancel = async () => {
    if (!confirmCancel) return;
    try {
      await axios.post(`/bookings/${confirmCancel}/cancel`);
      setConfirmCancel(null);
      toast.success('Assistance booking cancelled');
      fetchBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cancellation failed');
    }
  };

  const totalSelectedCount = SERVICE_META.filter((s) =>
    s.key === 'luggage' ? getLuggageTotalCount() > 0 : s.qty ? services[s.key] > 0 : services[s.key]
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F8FB] text-zinc-900 font-sans selection:bg-blue-600 selection:text-white w-full max-w-full overflow-x-hidden">

      {/* ── Top Navigation Bar: Mobile Floating Capsule vs Laptop Full-Width Edge-to-Edge ── */}
      {/* 1. Mobile Phone Screen Navbar (<md) */}
      <header className="sticky top-2.5 z-40 px-3 max-w-full md:hidden">
        <div className="bg-white rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-200/80 px-4 py-2 flex items-center justify-between">
          <button type="button" onClick={() => navigate('/')} className="flex items-center cursor-pointer">
            <img src={oneCoolieLogo} alt="OneCoolie" className="h-9 w-auto object-contain" />
          </button>
          <div className="flex items-center gap-2">
            <PassengerNotifications
              bookings={bookings}
              activeBookings={active}
              onNavigateTab={(t) => setTab(t)}
              buttonClassName="w-9 h-9 rounded-full bg-slate-100 text-zinc-700 flex items-center justify-center relative border border-slate-200/60 shadow-2xs cursor-pointer"
            />
            <ProfileMenu role="passenger" onNavigate={(t) => setTab(t)} />
          </div>
        </div>

        {/* Mobile Tab Row */}
        <div className="flex items-center justify-between p-1 bg-slate-100/90 rounded-full border border-slate-200/60 mt-2 w-full shadow-2xs gap-1">
          <button
            type="button"
            onClick={() => setTab('book')}
            className={`flex-1 py-2 rounded-full text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${tab === 'book'
                ? 'bg-black text-white shadow-xs'
                : 'text-zinc-600'
              }`}
          >
            <Train className="w-3.5 h-3.5" />
            <span>Book</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('trips')}
            className={`flex-1 py-2 rounded-full text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${tab === 'trips'
                ? 'bg-black text-white shadow-xs'
                : 'text-zinc-600'
              }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>My Trips</span>
            <span
              className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${tab === 'trips' ? 'bg-white text-black' : 'bg-black text-white'
                }`}
            >
              {active.length > 0 ? active.length : 3}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('support');
              setSupportView('home');
            }}
            className={`flex-1 py-2 rounded-full text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${tab === 'support'
                ? 'bg-black text-white shadow-xs'
                : 'text-zinc-600'
              }`}
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>Help</span>
          </button>
        </div>
      </header>

      {/* 2. Laptop / Desktop Full-Width Corner-to-Corner Navbar (>=md) */}
      <header className="hidden md:block sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="w-full px-6 lg:px-10 xl:px-12 py-3.5 lg:py-4 flex items-center justify-between">
          {/* Far Left Corner: OneCoolie Logo (Prominent Medium Size) */}
          <div className="flex items-center">
            <button type="button" onClick={() => navigate('/')} className="flex items-center cursor-pointer group">
              <img
                src={oneCoolieLogo}
                alt="OneCoolie"
                className="h-12 md:h-13 lg:h-14 w-auto object-contain transition-transform duration-200 group-hover:scale-102"
              />
            </button>
          </div>

          {/* Center: Triple Pill Navigation Switcher */}
          <div className="flex items-center p-1.5 bg-slate-100/90 rounded-full border border-slate-200/70 gap-1.5 shadow-inner">
            <button
              type="button"
              onClick={() => setTab('book')}
              className={`px-5 lg:px-6 py-2.5 rounded-full text-xs lg:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${tab === 'book'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-zinc-600 hover:text-black font-semibold'
                }`}
            >
              <Train className="w-4 h-4" />
              <span>Book</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('trips')}
              className={`px-5 lg:px-6 py-2.5 rounded-full text-xs lg:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${tab === 'trips'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-zinc-600 hover:text-black font-semibold'
                }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>My Trips</span>
              <span
                className={`min-w-[20px] h-[20px] px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${tab === 'trips' ? 'bg-white text-black' : 'bg-black text-white'
                  }`}
              >
                {active.length > 0 ? active.length : 3}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTab('support');
                setSupportView('home');
              }}
              className={`px-5 lg:px-6 py-2.5 rounded-full text-xs lg:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${tab === 'support'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-zinc-600 hover:text-black font-semibold'
                }`}
            >
              <Headphones className="w-4 h-4" />
              <span>Help & Support</span>
            </button>
          </div>

          {/* Far Right Corner: Notification Bell + Profile Menu */}
          <div className="flex items-center gap-3.5">
            <PassengerNotifications
              bookings={bookings}
              activeBookings={active}
              onNavigateTab={(t) => setTab(t)}
              buttonClassName="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-zinc-700 flex items-center justify-center transition-colors relative cursor-pointer group border border-slate-200/60 shadow-2xs"
            />

            <ProfileMenu role="passenger" onNavigate={(t) => setTab(t)} />
          </div>
        </div>
      </header>

      {/* ── Main Container ──────────────────────────────────────── */}
      <main className={`flex-1 mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6 w-full max-w-full overflow-x-hidden pb-24 lg:pb-6 ${tab === 'trips' || tab === 'support' ? 'max-w-[1440px]' : 'max-w-7xl'}`}>
        {tab === 'book' ? (
          /* ============================================================
             GUIDED 4-STEP WIZARD BOOKING WORKFLOW (MATCHING REFERENCE IMAGE)
             ============================================================ */
          <div className="space-y-6 animate-fade-in">

            {/* ── TOP STEPPER TIMELINE HEADER (PHONE RESPONSIVE, DESKTOP CENTERED) ──────────────────────────── */}
            <div className="relative flex flex-col md:flex-row md:items-center justify-center pt-1 pb-4 border-b border-slate-200/70 gap-4">

              {/* Mobile Stepper Summary Bar (<md) */}
              <div className="block md:hidden bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 w-full max-w-full min-w-0 overflow-hidden">
                <div className="flex items-center justify-between min-w-0">
                  <span className="text-xs font-extrabold text-zinc-900 truncate">
                    Step {bookingStep} of 4: {[
                      'Select Journey',
                      'Coach & Seat Details',
                      'Assistance Services',
                      'Review & Confirm Payment'
                    ][bookingStep - 1]}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-zinc-400 shrink-0">
                    {bookingStep * 25}%
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-black transition-all duration-300 rounded-full"
                    style={{ width: `${bookingStep * 25}%` }}
                  />
                </div>
                {/* 4 Step Buttons Row */}
                <div className="flex items-center justify-between pt-1 gap-1 min-w-0 w-full">
                  {[
                    { step: 1, label: 'Journey', icon: Train },
                    { step: 2, label: 'Seat', icon: Luggage },
                    { step: 3, label: 'Services', icon: LayoutGrid },
                    { step: 4, label: 'Review', icon: CreditCard },
                  ].map((s) => {
                    const isDone = s.step < bookingStep || (s.step === 1 && isStep1Valid && bookingStep > 1) || (s.step === 2 && isStep2Valid && bookingStep > 2) || (s.step === 3 && isStep3Valid && bookingStep > 3);
                    const isCurrent = bookingStep === s.step;
                    const StepIcon = s.icon;
                    return (
                      <button
                        key={s.step}
                        type="button"
                        onClick={() => handleNextStep(s.step)}
                        className={`flex flex-col items-center gap-1 cursor-pointer transition-all flex-1 min-w-0 ${isCurrent ? 'scale-105' : 'opacity-70'
                          }`}
                      >
                        <div
                          className={`w-7.5 h-7.5 rounded-full font-bold text-xs flex items-center justify-center transition-all ${isDone
                            ? 'bg-emerald-100 text-emerald-800'
                            : isCurrent
                              ? 'bg-black text-white shadow-md ring-2 ring-black/10'
                              : 'bg-slate-100 text-slate-400'
                            }`}
                        >
                          <StepIcon className="w-3.5 h-3.5" />
                        </div>
                        <span className={`text-[10px] font-bold truncate max-w-full ${isCurrent ? 'text-black' : 'text-zinc-600'}`}>
                          {s.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Desktop Stepper Steps (>=md) - CENTERED IN MIDDLE */}
              <div className="hidden md:flex items-center justify-center gap-3 sm:gap-4 md:gap-5 lg:gap-6 flex-1 max-w-3xl">
                {[
                  { step: 1, label: '1. Journey', desc: 'Current Step', icon: Train },
                  { step: 2, label: '2. Seat & Luggage', desc: 'Coach & Seat', icon: Luggage },
                  { step: 3, label: '3. Services', desc: 'Assistance Services', icon: LayoutGrid },
                  { step: 4, label: '4. Review & Payment', desc: 'Final Review', icon: CreditCard },
                ].map((s, idx) => {
                  const isDone = s.step < bookingStep || (s.step === 1 && isStep1Valid && bookingStep > 1) || (s.step === 2 && isStep2Valid && bookingStep > 2) || (s.step === 3 && isStep3Valid && bookingStep > 3);
                  const isCurrent = bookingStep === s.step;
                  const StepIcon = s.icon;

                  return (
                    <div key={s.step} className="flex items-center gap-3 sm:gap-4 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleNextStep(s.step)}
                        className={`flex items-center gap-2.5 text-left cursor-pointer transition-all ${!isDone && !isCurrent ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <div
                          className={`w-8.5 h-8.5 rounded-full font-bold text-xs flex items-center justify-center shrink-0 transition-all ${isDone
                            ? 'bg-emerald-600 text-white'
                            : isCurrent
                              ? 'bg-black text-white shadow-md ring-4 ring-black/10'
                              : 'bg-white border border-slate-200 text-slate-400'
                            }`}
                        >
                          {isDone ? <Check className="w-4 h-4 stroke-[2.5]" /> : <StepIcon className="w-4 h-4" />}
                        </div>
                        <div className="whitespace-nowrap">
                          <p className={`text-xs font-bold ${isCurrent ? 'text-black font-extrabold' : 'text-zinc-800'}`}>
                            {s.label}
                          </p>
                          <p className={`text-[11px] ${isCurrent ? 'text-zinc-500 font-medium' : isDone ? 'text-emerald-600 font-medium' : 'text-zinc-400 font-normal'}`}>
                            {isCurrent ? 'Current Step' : isDone ? 'Completed' : s.desc}
                          </p>
                        </div>
                      </button>

                      {idx < 3 && (
                        <div className={`w-8 lg:w-12 h-[1px] shrink-0 ${s.step < bookingStep ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Decorative Handwritten Tagline (Right Side) */}
              <div className="hidden xl:block absolute right-0 top-1/2 -translate-y-1/2 text-right select-none pointer-events-none pr-2">
                <span className="font-serif italic font-extrabold text-[#1E3A8A] text-lg lg:text-xl block tracking-tight">
                  Travel With Confidence
                </span>
                <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase font-bold block mt-0.5">
                  ASSIST • EXPLORE • EXPERIENCE
                </span>
              </div>
            </div>

            {/* ── 2-COLUMN MAIN CONTENT GRID ──────────────────────────── */}
            <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-start w-full max-w-full min-w-0">

              {/* Left Column: Progressive Active Step Card (8 Cols) */}
              <div className="lg:col-span-8 space-y-4 w-full max-w-full min-w-0">


                {/* ── STEP 1 ACTIVE CARD ────────────────────────────────────── */}
                {bookingStep === 1 && (
                  <div className="bg-white rounded-[28px] border border-slate-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-5 sm:p-8 space-y-6 animate-fade-in w-full max-w-full min-w-0 overflow-hidden">

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-5 min-w-0">
                      <div>
                        <span className="text-[11px] font-bold tracking-wider text-blue-600 uppercase block mb-1">
                          STEP 1 OF 4
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 leading-tight">
                          Find Your Journey
                        </h2>
                        <p className="text-xs text-zinc-500 mt-1 font-medium">
                          Start with your 10-digit PNR or search your journey manually.
                        </p>
                      </div>

                      {/* Train line art illustration & Indian Railways branding — Full-width banner style */}
                      <div className="hidden md:flex items-center gap-6 lg:gap-10 pr-2 select-none pointer-events-none">
                        <img src="/images/train_sketch_art.jpg" alt="Indian Railways Train" className="w-48 lg:w-64 h-20 lg:h-24 object-contain opacity-90 shrink-0 -scale-x-100" />
                        <div className="text-left">
                          <p className="text-lg lg:text-xl font-black text-[#334155] leading-tight tracking-tight">Indian Railways.</p>
                          <p className="text-sm lg:text-base text-[#64748B] font-normal leading-snug mt-1">
                            A safer, smoother journey<br />with OneCoolie.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Mode switcher: PNR vs Train Search */}
                    <div className="flex p-1 bg-slate-100/90 rounded-full border border-slate-200/60 w-fit max-w-full">
                      <button
                        type="button"
                        onClick={() => {
                          setBookingMode('pnr');
                          if (!pnrVerifiedData) {
                            setSelectedTrain(null);
                          }
                        }}
                        className={`px-4 sm:px-5 py-2 text-xs font-bold rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${bookingMode === 'pnr'
                          ? 'bg-black text-white shadow-xs font-extrabold'
                          : 'text-zinc-600 hover:text-black font-semibold'
                          }`}
                      >
                        <Ticket className="w-3.5 h-3.5" />
                        <span>10-Digit PNR</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBookingMode('train')}
                        className={`px-4 sm:px-5 py-2 text-xs font-bold rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${bookingMode === 'train'
                          ? 'bg-black text-white shadow-xs font-extrabold'
                          : 'text-zinc-600 hover:text-black font-semibold'
                          }`}
                      >
                        <Train className="w-3.5 h-3.5" />
                        <span>Station &amp; Train</span>
                      </button>
                    </div>

                    {/* SUB-MODE A: 10-Digit PNR */}
                    {bookingMode === 'pnr' && (
                      <div className="space-y-4 animate-fade-in min-w-0 w-full">
                        <form onSubmit={handleFetchPnr} className="flex flex-col sm:flex-row gap-2.5 min-w-0 w-full">
                          <div className="relative flex-1 min-w-0 flex items-center bg-white border border-slate-200 rounded-2xl p-1 shadow-2xs focus-within:border-black focus-within:ring-2 focus-within:ring-black/10 transition-all">
                            <FileText className="w-4 h-4 text-zinc-400 ml-3 shrink-0" />
                            <input
                              type="text"
                              maxLength={10}
                              placeholder="Enter 10-Digit PNR (e.g. 4523891024)"
                              value={pnrInput}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                setPnrInput(val);
                                setPnrError('');
                                if (pnrVerifiedData && val !== pnrVerifiedData.pnrNumber) {
                                  setPnrVerifiedData(null);
                                  setSelectedTrain(null);
                                }
                              }}
                              className={`w-full px-3 py-2.5 bg-transparent border-0 text-sm outline-none transition-all min-w-0 placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-zinc-400 ${pnrInput ? 'font-mono font-bold tracking-wider text-[#071A3D]' : 'font-sans text-zinc-900 font-medium'
                                }`}
                            />
                            {pnrInput && (
                              <span className="text-xs font-mono text-zinc-400 mr-3 shrink-0">
                                {pnrInput.length}/10
                              </span>
                            )}
                          </div>
                          <button
                            type="submit"
                            disabled={pnrLoading || pnrInput.length !== 10}
                            className="bg-black hover:bg-zinc-800 text-white font-bold px-7 py-3.5 rounded-2xl text-xs shrink-0 cursor-pointer disabled:opacity-50 flex items-center gap-2 justify-center shadow-xs transition-all"
                          >
                            {pnrLoading ? 'Verifying PNR...' : <>Fetch Details <ArrowRight className="w-3.5 h-3.5" /></>}
                          </button>
                        </form>

                        <p className="text-xs text-zinc-500 font-medium">
                          Enter your 10-digit Indian Railways PNR to automatically fetch train, station, coach, and seat details.
                        </p>

                        {pnrLoading && (
                          <div className="py-2 animate-fade-in">
                            <TrainLoader
                              fullScreen={false}
                              size="sm"
                              text="Verifying PNR with Indian Railways..."
                              subtext="Locating your coach, seat & platform timetable..."
                            />
                          </div>
                        )}

                        {pnrError && (
                          <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                            <Info className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>{pnrError}</span>
                          </div>
                        )}

                        {pnrVerifiedData && selectedTrain && (
                          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in shadow-2xs min-w-0">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1 min-w-0">
                                <span className="font-mono font-bold text-black text-sm flex items-center gap-1.5 shrink-0">
                                  <Train className="w-4 h-4 text-black inline" /> Train {selectedTrain.train_no}
                                </span>
                                <span className="font-bold text-sm text-zinc-900 truncate">
                                  · {selectedTrain.train_name}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-500 font-mono truncate">
                                Boarding Station: {station} {journeyDate ? `· Date: ${journeyDate}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full border border-emerald-200 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Train Verified
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setPnrVerifiedData(null);
                                  setSelectedTrain(null);
                                  setPnrInput('');
                                }}
                                className="text-[11px] font-semibold text-rose-600 hover:underline px-2 py-1 cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SUB-MODE B: Manual Station & Train Search */}
                    {bookingMode === 'train' && (
                      <div className="space-y-6 animate-fade-in min-w-0 w-full">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2.5 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-zinc-700" />
                              <span>Station Hub</span>
                            </span>
                            {selectedTrain && (
                              <span className="text-[10px] font-bold text-zinc-500 flex items-center gap-1">
                                <Lock className="w-3 h-3 text-zinc-400" />
                                <span>Station locked to selected train</span>
                              </span>
                            )}
                          </label>

                          {selectedTrain ? (
                            <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-100/90 border border-slate-200 flex items-center justify-between shadow-2xs">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center font-mono font-black text-xs text-black shrink-0 shadow-2xs">
                                  {station}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-extrabold text-xs sm:text-sm text-zinc-900 truncate">
                                    {STATIONS.find((st) => st.code === station)?.name || station}
                                  </p>
                                  <p className="text-[11px] text-zinc-500 font-medium">
                                    Boarding Station Hub · Locked for Train {selectedTrain.train_no}
                                  </p>
                                </div>
                              </div>
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-200 text-zinc-600 flex items-center gap-1 shrink-0">
                                <Lock className="w-3 h-3 text-zinc-500" />
                                <span>Static</span>
                              </span>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 min-w-0 w-full">
                              {STATIONS.map((st) => (
                                <button
                                  key={st.code}
                                  type="button"
                                  onClick={() => setStation(st.code)}
                                  className={`p-2.5 sm:p-3.5 rounded-2xl border text-left transition-all cursor-pointer min-w-0 w-full ${station === st.code
                                    ? 'border-black bg-slate-50 ring-2 ring-black/10'
                                    : 'border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                  <div className="flex items-center justify-between mb-0.5 min-w-0">
                                    <p className="font-bold text-xs font-mono text-black">
                                      {st.code}
                                    </p>
                                    <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                  </div>
                                  <p className="font-semibold text-[11px] sm:text-xs text-zinc-900 truncate">
                                    {st.name}
                                  </p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <TrainSearch
                            station={station}
                            selectedTrain={selectedTrain}
                            onSelect={(train) => {
                              setSelectedTrain(train);
                              if (train) {
                                const time = train.expected_arrival || train.scheduled_arrival || train.expected_departure || train.scheduled_departure;
                                if (time) setJourneyTime(time);
                                if (!journeyDate) {
                                  setJourneyDate(new Date().toISOString().split('T')[0]);
                                }
                              }
                            }}
                          />
                          {selectedTrain && (
                            <div className="mt-3 p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fade-in shadow-2xs">
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 min-w-0">
                                  <span className="font-mono font-black text-blue-600 text-sm flex items-center gap-1.5 shrink-0">
                                    <Train className="w-4 h-4 text-blue-600 inline" /> {selectedTrain.train_no}
                                  </span>
                                  <span className="font-bold text-sm text-zinc-900 truncate">
                                    · {selectedTrain.train_name}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-500 font-medium truncate">
                                  {selectedTrain.from?.name || 'Origin'} → {selectedTrain.to?.name || 'Destination'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full border border-emerald-200 flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Selected
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedTrain(null)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 text-[11px] font-bold transition-all cursor-pointer shadow-2xs group"
                                  title="Remove train and select another train"
                                  aria-label="Remove train and select another train"
                                >
                                  <X className="w-3.5 h-3.5 text-rose-600 group-hover:scale-110 transition-transform" />
                                  <span>Select Another Train</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Journey Date & Time Section */}
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <div className="space-y-0.5">
                        <label className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <span>Journey Date</span> <span className="text-rose-500">*</span>
                        </label>
                        <p className="text-[11px] text-zinc-500 font-medium">
                          Select your journey date
                        </p>
                      </div>

                      {/* Quick-Select Date Pills with Navigation Arrows */}
                      <div className="flex items-center gap-2 w-full min-w-0">
                        <button
                          type="button"
                          onClick={() => scrollDates(-140)}
                          aria-label="Previous dates"
                          className="w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 cursor-pointer shrink-0 transition-colors shadow-2xs"
                        >
                          <ChevronLeft className="w-4 h-4 text-zinc-600" />
                        </button>

                        <div
                          ref={dateScrollRef}
                          className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar scroll-smooth w-full min-w-0"
                        >
                          {dateOptions.map((opt) => {
                            const isSelected = journeyDate === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setJourneyDate(opt.value)}
                                className={`flex flex-col items-center justify-center min-w-[76px] sm:min-w-[84px] py-2.5 px-3 rounded-2xl border text-center transition-all cursor-pointer shrink-0 select-none ${isSelected
                                  ? 'bg-black text-white border-black shadow-md shadow-black/20'
                                  : 'bg-white text-zinc-800 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                  }`}
                              >
                                <span className={`text-[11px] font-medium uppercase tracking-wider ${isSelected ? 'text-zinc-300' : 'text-zinc-400'}`}>
                                  {opt.label}
                                </span>
                                <span className={`text-xs sm:text-sm font-bold mt-0.5 whitespace-nowrap ${isSelected ? 'text-white' : 'text-zinc-900'}`}>
                                  {opt.subLabel}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() => scrollDates(140)}
                          aria-label="Next dates"
                          className="w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 cursor-pointer shrink-0 transition-colors shadow-2xs"
                        >
                          <ChevronRight className="w-4 h-4 text-zinc-600" />
                        </button>
                      </div>

                      {/* Estimated Time (Optional) Input */}
                      <div className="pt-2 max-w-xs sm:max-w-sm space-y-1">
                        <label className="block text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-zinc-500" />
                          <span>Estimated Time (Optional)</span>
                        </label>
                        <div className="relative">
                          <input
                            type="time"
                            value={journeyTime}
                            onChange={(e) => setJourneyTime(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-black focus:ring-1 focus:ring-black rounded-xl text-sm font-bold text-zinc-900 cursor-pointer shadow-2xs"
                          />
                        </div>
                        <p className="text-[11px] text-zinc-400 font-medium">
                          Station platform arrival time (helps us plan better assistance)
                        </p>
                      </div>
                    </div>

                    {/* Step 1 Bottom Action Row */}
                    <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
                      <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
                        <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Your journey details are safe and secure with OneCoolie</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleNextStep(2)}
                        className="w-full sm:w-auto justify-center bg-black hover:bg-zinc-800 text-white font-bold px-8 py-3.5 rounded-full text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer shrink-0"
                      >
                        <span>Continue to Seat &amp; Luggage</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}


                {/* ── STEP 2 ACTIVE CARD ────────────────────────────────────── */}
                {bookingStep === 2 && (
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-4 sm:p-8 space-y-5 sm:space-y-6 animate-fade-in w-full max-w-full min-w-0 overflow-hidden">

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-5 min-w-0">
                      <div>
                        <span className="text-[11px] font-bold tracking-wider text-blue-600 uppercase block mb-1">
                          STEP 2 OF 4
                        </span>
                        <h2 className="text-xl sm:text-3xl font-black tracking-tight text-zinc-900 leading-tight">
                          Where should we meet you?
                        </h2>
                        <p className="text-xs text-zinc-500 mt-1 font-medium">
                          Tell us your coach and seat so your assistant can find you easily.
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-zinc-800 text-xs font-bold border border-slate-200/60 shrink-0 hidden sm:flex items-center gap-1.5 self-start sm:self-auto">
                        <MapPin className="w-3.5 h-3.5 text-zinc-700" />
                        <span>Seat Direct Dispatch</span>
                      </span>
                    </div>

                    {/* Mission Direction Cards */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2.5">
                        Select Luggage Mission
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0 w-full">
                        <button
                          type="button"
                          onClick={() => setActionType('load_to_seat')}
                          className={`p-3.5 sm:p-4.5 rounded-2xl border text-left transition-all cursor-pointer group min-w-0 w-full ${actionType === 'load_to_seat'
                            ? 'border-black bg-slate-50/80 ring-2 ring-black/10 shadow-2xs'
                            : 'border-slate-200 hover:border-slate-300'
                            }`}
                        >
                          <div className="flex items-center gap-2.5 mb-1.5 min-w-0">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform ${actionType === 'load_to_seat' ? 'bg-black text-white' : 'bg-slate-100 text-zinc-700'
                              }`}>
                              <LogIn className="w-4 h-4" />
                            </div>
                            <p className="font-bold text-xs text-zinc-900 truncate">
                              Boarding: Load to Seat
                            </p>
                          </div>
                          <p className="text-[11px] text-zinc-500 leading-normal pl-0 sm:pl-10 mt-1 font-medium">
                            Assistant meets you at entrance / concourse and loads luggage directly into your coach &amp; berth.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActionType('collect_from_seat')}
                          className={`p-3.5 sm:p-4.5 rounded-2xl border text-left transition-all cursor-pointer group min-w-0 w-full ${actionType === 'collect_from_seat'
                            ? 'border-black bg-slate-50/80 ring-2 ring-black/10 shadow-2xs'
                            : 'border-slate-200 hover:border-slate-300'
                            }`}
                        >
                          <div className="flex items-center gap-2.5 mb-1.5 min-w-0">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform ${actionType === 'collect_from_seat' ? 'bg-black text-white' : 'bg-slate-100 text-zinc-700'
                              }`}>
                              <LogOut className="w-4 h-4" />
                            </div>
                            <p className="font-bold text-xs text-zinc-900 truncate">
                              De-boarding: Collect from Seat
                            </p>
                          </div>
                          <p className="text-[11px] text-zinc-500 leading-normal pl-0 sm:pl-10 mt-1 font-medium">
                            Assistant meets train at your coach door, boards to collect luggage from your seat, and escorts you out.
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* Coach & Seat Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 min-w-0 w-full">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-1">
                          <Train className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Coach Number</span> <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="e.g. S4, B2, A1, D12, GS"
                            value={coach}
                            maxLength={4}
                            onChange={(e) => setCoach(e.target.value.toUpperCase())}
                            className={`w-full pl-4 pr-10 py-3 bg-[#fafbfc] border rounded-xl text-sm font-mono font-bold outline-none transition-all ${coach.trim().length > 0 && !coachValidation.isValid
                              ? 'border-rose-500 bg-rose-50/20 text-rose-900 focus:ring-2 focus:ring-rose-500/20'
                              : 'border-slate-200 focus:border-black focus:ring-1 focus:ring-black'
                              }`}
                          />
                          {coach.trim().length > 0 && !coachValidation.isValid && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                              <AlertCircle className="w-5 h-5 text-rose-500" />
                            </div>
                          )}
                        </div>
                        {coach.trim().length > 0 && !coachValidation.isValid && (
                          <p className="text-[11px] font-semibold text-rose-600 mt-1.5 flex items-start gap-1">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                            <span>{coachValidation.reason}</span>
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-1">
                          <Armchair className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Seat / Berth No.</span> <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="e.g. 45, 12 LB, 78 W"
                            value={seatNumber}
                            maxLength={8}
                            onChange={(e) => setSeatNumber(e.target.value.toUpperCase())}
                            className={`w-full pl-4 pr-10 py-3 bg-[#fafbfc] border rounded-xl text-sm font-mono font-bold outline-none transition-all ${seatNumber.trim().length > 0 && !seatValidation.isValid
                              ? 'border-rose-500 bg-rose-50/20 text-rose-900 focus:ring-2 focus:ring-rose-500/20'
                              : 'border-slate-200 focus:border-black focus:ring-1 focus:ring-black'
                              }`}
                          />
                          {seatNumber.trim().length > 0 && !seatValidation.isValid && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                              <AlertCircle className="w-5 h-5 text-rose-500" />
                            </div>
                          )}
                        </div>
                        {seatNumber.trim().length > 0 && !seatValidation.isValid && (
                          <p className="text-[11px] font-semibold text-rose-600 mt-1.5 flex items-start gap-1">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                            <span>{seatValidation.reason}</span>
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                          Berth Position
                        </label>
                        <select
                          value={berthType}
                          onChange={(e) => setBerthType(e.target.value)}
                          className="w-full px-4 py-3 bg-[#fafbfc] border border-slate-200 focus:border-black focus:ring-1 focus:ring-black rounded-xl text-sm font-semibold outline-none transition-all"
                        >
                          <option value="Lower">Lower Berth (LB)</option>
                          <option value="Middle">Middle Berth (MB)</option>
                          <option value="Upper">Upper Berth (UB)</option>
                          <option value="Side Lower">Side Lower (SL)</option>
                          <option value="Side Upper">Side Upper (SU)</option>
                          <option value="Window">Window Seat (CC)</option>
                          <option value="Aisle">Aisle Seat (CC)</option>
                          <option value="Cabin">First AC Cabin</option>
                        </select>
                      </div>
                    </div>

                    {/* Step 2 Action Buttons */}
                    <div className="pt-6 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 w-full">
                      <button
                        type="button"
                        onClick={() => setBookingStep(1)}
                        className="w-full sm:w-auto justify-center px-6 py-3 rounded-full bg-[#f0f4f8] hover:bg-slate-200 text-zinc-900 font-semibold text-xs transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Journey</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleNextStep(3)}
                        className="hidden lg:flex w-full sm:w-auto justify-center bg-black hover:bg-zinc-800 text-white font-bold px-8 py-3.5 rounded-full text-xs shadow-xs transition-all items-center gap-2 cursor-pointer"
                      >
                        <span>Continue to Services</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}


                {/* ── STEP 3 ACTIVE CARD ────────────────────────────────────── */}
                {bookingStep === 3 && (
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-4 sm:p-8 space-y-5 sm:space-y-6 animate-fade-in w-full max-w-full min-w-0 overflow-hidden">

                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-slate-100 pb-5 min-w-0">
                      <div>
                        <span className="text-[11px] font-bold tracking-wider text-blue-600 uppercase block mb-1">
                          STEP 3 OF 4
                        </span>
                        <h2 className="text-xl sm:text-3xl font-black tracking-tight text-zinc-900 leading-tight">
                          Choose Your Assistance
                        </h2>
                        <p className="text-xs text-zinc-500 mt-1 font-medium">
                          Select the services you need for this journey.
                        </p>
                      </div>
                      <span className="text-xs font-mono font-bold text-white bg-black px-3.5 py-1.5 rounded-full shadow-2xs shrink-0">
                        {totalSelectedCount} Selected
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-w-0 w-full">
                      {SERVICE_META.map((s) => {
                        const isSelected =
                          s.key === 'luggage'
                            ? getLuggageTotalCount() > 0
                            : s.qty
                              ? services[s.key] > 0
                              : Boolean(services[s.key]);
                        const ServiceIcon = s.icon || Luggage;

                        return (
                          <div
                            key={s.key}
                            onClick={(e) => handleCardClick(s, e)}
                            className={`p-5 rounded-2xl border transition-all cursor-pointer select-none duration-200 active:scale-[0.99] ${isSelected
                              ? 'border-black bg-slate-50/80 shadow-xs ring-1 ring-black/10'
                              : 'border-slate-200 hover:border-slate-400 bg-white hover:bg-slate-50/30'
                              }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-black text-white shadow-xs' : 'bg-slate-100 text-zinc-700'
                                  }`}>
                                  <ServiceIcon className="w-4.5 h-4.5" />
                                </div>
                                <h3 className="font-bold text-sm text-zinc-900">
                                  {s.label}
                                </h3>
                              </div>
                              <span className="font-mono text-xs font-bold text-zinc-900 shrink-0">
                                ₹{s.key === 'luggage' ? getLuggageTotalCost() : s.price}
                                <span className="text-[10px] text-zinc-400 font-normal">
                                  /{s.key === 'luggage' ? (getLuggageTotalCount() > 0 ? `${getLuggageTotalCount()} items` : 'item') : s.per}
                                </span>
                              </span>
                            </div>

                            <p className="text-xs text-zinc-500 leading-relaxed mb-4 pl-12 font-medium">
                              {s.desc}
                            </p>

                            {/* Controls */}
                            {s.key === 'luggage' ? (
                              <div className="pt-3 border-t border-slate-100 space-y-2">
                                {/* Small Bag */}
                                <div className="flex items-center justify-between bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60">
                                  <div>
                                    <p className="text-xs font-bold text-zinc-900">Small Bag</p>
                                    <p className="text-[10px] text-zinc-400 font-medium">₹30 / item</p>
                                  </div>
                                  <div className="flex items-center gap-2.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setLuggageCounts((prev) => ({
                                          ...prev,
                                          small: Math.max(0, prev.small - 1),
                                        }));
                                      }}
                                      className="w-6.5 h-6.5 rounded-lg border border-slate-200 bg-white flex items-center justify-center font-bold text-xs hover:bg-slate-100 cursor-pointer transition-colors shadow-2xs"
                                    >
                                      <Minus className="w-3 h-3 text-zinc-700" />
                                    </button>
                                    <span className="font-mono font-bold text-xs w-4 text-center">
                                      {luggageCounts.small}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setLuggageCounts((prev) => ({
                                          ...prev,
                                          small: prev.small + 1,
                                        }));
                                      }}
                                      className="w-6.5 h-6.5 rounded-lg border border-slate-200 bg-white flex items-center justify-center font-bold text-xs hover:bg-slate-100 cursor-pointer transition-colors shadow-2xs"
                                    >
                                      <Plus className="w-3 h-3 text-zinc-700" />
                                    </button>
                                  </div>
                                </div>

                                {/* Medium Bag */}
                                <div className="flex items-center justify-between bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60">
                                  <div>
                                    <p className="text-xs font-bold text-zinc-900">Medium Bag</p>
                                    <p className="text-[10px] text-zinc-400 font-medium">₹40 / item</p>
                                  </div>
                                  <div className="flex items-center gap-2.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setLuggageCounts((prev) => ({
                                          ...prev,
                                          medium: Math.max(0, prev.medium - 1),
                                        }));
                                      }}
                                      className="w-6.5 h-6.5 rounded-lg border border-slate-200 bg-white flex items-center justify-center font-bold text-xs hover:bg-slate-100 cursor-pointer transition-colors shadow-2xs"
                                    >
                                      <Minus className="w-3 h-3 text-zinc-700" />
                                    </button>
                                    <span className="font-mono font-bold text-xs w-4 text-center">
                                      {luggageCounts.medium}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setLuggageCounts((prev) => ({
                                          ...prev,
                                          medium: prev.medium + 1,
                                        }));
                                      }}
                                      className="w-6.5 h-6.5 rounded-lg border border-slate-200 bg-white flex items-center justify-center font-bold text-xs hover:bg-slate-100 cursor-pointer transition-colors shadow-2xs"
                                    >
                                      <Plus className="w-3 h-3 text-zinc-700" />
                                    </button>
                                  </div>
                                </div>

                                {/* Large Bag */}
                                <div className="flex items-center justify-between bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60">
                                  <div>
                                    <p className="text-xs font-bold text-zinc-900">Large Bag</p>
                                    <p className="text-[10px] text-zinc-400 font-medium">₹60 / item</p>
                                  </div>
                                  <div className="flex items-center gap-2.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setLuggageCounts((prev) => ({
                                          ...prev,
                                          large: Math.max(0, prev.large - 1),
                                        }));
                                      }}
                                      className="w-6.5 h-6.5 rounded-lg border border-slate-200 bg-white flex items-center justify-center font-bold text-xs hover:bg-slate-100 cursor-pointer transition-colors shadow-2xs"
                                    >
                                      <Minus className="w-3 h-3 text-zinc-700" />
                                    </button>
                                    <span className="font-mono font-bold text-xs w-4 text-center">
                                      {luggageCounts.large}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setLuggageCounts((prev) => ({
                                          ...prev,
                                          large: prev.large + 1,
                                        }));
                                      }}
                                      className="w-6.5 h-6.5 rounded-lg border border-slate-200 bg-white flex items-center justify-center font-bold text-xs hover:bg-slate-100 cursor-pointer transition-colors shadow-2xs"
                                    >
                                      <Plus className="w-3 h-3 text-zinc-700" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : s.qty ? (
                              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                <span className="text-xs font-semibold text-zinc-500">
                                  Item Quantity
                                </span>
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setServices((prev) => ({
                                        ...prev,
                                        [s.key]: Math.max(0, (prev[s.key] || 0) - 1),
                                      }));
                                    }}
                                    className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center font-bold text-xs hover:bg-slate-100 cursor-pointer transition-colors"
                                  >
                                    <Minus className="w-3.5 h-3.5 text-zinc-700" />
                                  </button>
                                  <span className="font-mono font-bold text-sm w-4 text-center">
                                    {services[s.key] || 0}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setServices((prev) => ({
                                        ...prev,
                                        [s.key]: (prev[s.key] || 0) + 1,
                                      }));
                                    }}
                                    className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center font-bold text-xs hover:bg-slate-100 cursor-pointer transition-colors"
                                  >
                                    <Plus className="w-3.5 h-3.5 text-zinc-700" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setServices((prev) => ({
                                    ...prev,
                                    [s.key]: !prev[s.key],
                                  }));
                                }}
                                className={`w-full py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${isSelected
                                  ? 'bg-black text-white shadow-xs'
                                  : 'border border-slate-200 text-zinc-700 hover:bg-slate-100'
                                  }`}
                              >
                                {isSelected ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Added to Booking</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Add Service</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Step 3 Action Buttons */}
                    <div className="pt-6 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 w-full">
                      <button
                        type="button"
                        onClick={() => setBookingStep(2)}
                        className="w-full sm:w-auto justify-center px-6 py-3 rounded-full bg-[#f0f4f8] hover:bg-slate-200 text-zinc-900 font-semibold text-xs transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Seat &amp; Luggage</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleNextStep(4)}
                        className="hidden lg:flex w-full sm:w-auto justify-center bg-black hover:bg-zinc-800 text-white font-bold px-8 py-3.5 rounded-full text-xs shadow-xs transition-all items-center gap-2 cursor-pointer"
                      >
                        <span>Continue to Review</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}


                {/* ── STEP 4 ACTIVE CARD ────────────────────────────────────── */}
                {bookingStep === 4 && (
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-4 sm:p-8 space-y-5 sm:space-y-6 animate-fade-in w-full max-w-full min-w-0 overflow-hidden">

                    {/* Step Title Header */}
                    <div className="flex items-start justify-between min-w-0">
                      <div>
                        <span className="text-[11px] font-bold tracking-wider text-blue-600 uppercase block mb-1">
                          STEP 4 OF 4
                        </span>
                        <h2 className="text-xl sm:text-3xl font-black tracking-tight text-zinc-900 leading-tight">
                          Review Your Booking
                        </h2>
                        <p className="text-xs text-zinc-500 mt-1 font-medium">
                          Please check your details before proceeding to payment.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setBookingStep(1)}
                        className="bg-slate-100 hover:bg-slate-200 text-zinc-700 font-semibold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer border border-slate-200/50 transition-colors shadow-2xs shrink-0"
                      >
                        <Edit className="w-3.5 h-3.5 text-zinc-600" />
                        <span>Edit Details</span>
                      </button>
                    </div>

                    {/* Stacked Full-Width Row Items (1, 2, 3) */}
                    <div className="space-y-4 min-w-0 w-full">

                      {/* Item 1: Journey Details */}
                      <div className="bg-[#fafbfc] border border-slate-200/70 rounded-2xl p-4 sm:p-5 space-y-4 hover:border-slate-300 transition-all shadow-2xs min-w-0 w-full">
                        <div className="flex items-center justify-between min-w-0">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 text-zinc-800 font-bold text-xs flex items-center justify-center shrink-0">
                              1
                            </span>
                            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 text-zinc-800 flex items-center justify-center shrink-0">
                              <Train className="w-4 h-4 text-zinc-700" />
                            </span>
                            <h3 className="font-bold text-xs sm:text-sm text-zinc-900 truncate">Journey Details</h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setBookingStep(1)}
                            className="bg-slate-100 hover:bg-slate-200 text-zinc-700 font-semibold text-xs px-3 py-1.5 rounded-lg border border-slate-200/50 cursor-pointer shrink-0"
                          >
                            Edit
                          </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-xs font-mono pl-0 sm:pl-11 min-w-0">
                          <div>
                            <p className="text-[11px] font-sans font-medium text-zinc-400 mb-1">Train</p>
                            <p className="font-bold text-zinc-900 truncate">
                              {selectedTrain ? `${selectedTrain.train_no} - ${selectedTrain.train_name}` : '57122 - Sirpur Town Kazipet Passenger'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-sans font-medium text-zinc-400 mb-1">From → To</p>
                            <p className="font-bold text-zinc-900 truncate">
                              {selectedTrain ? `${station} → ${selectedTrain?.to?.code || selectedTrain?.to?.name || 'KAZIPET JN'}` : 'KZJ → KAZIPET JN'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-sans font-medium text-zinc-400 mb-1">Date</p>
                            <p className="font-bold text-zinc-900">{journeyDate || '2026-09-04'}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-sans font-medium text-zinc-400 mb-1">Time</p>
                            <p className="font-bold text-zinc-900">{journeyTime || '20:05'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Item 2: Coach, Seat & Mission */}
                      <div className="bg-[#fafbfc] border border-slate-200/70 rounded-2xl p-4 sm:p-5 space-y-4 hover:border-slate-300 transition-all shadow-2xs min-w-0 w-full">
                        <div className="flex items-center justify-between min-w-0">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 text-zinc-800 font-bold text-xs flex items-center justify-center shrink-0">
                              2
                            </span>
                            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 text-zinc-800 flex items-center justify-center shrink-0">
                              <Armchair className="w-4 h-4 text-zinc-700" />
                            </span>
                            <h3 className="font-bold text-xs sm:text-sm text-zinc-900 truncate">Coach, Seat &amp; Mission</h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setBookingStep(2)}
                            className="bg-slate-100 hover:bg-slate-200 text-zinc-700 font-semibold text-xs px-3 py-1.5 rounded-lg border border-slate-200/50 cursor-pointer shrink-0"
                          >
                            Edit
                          </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 text-xs font-mono pl-0 sm:pl-11 min-w-0">
                          <div>
                            <p className="text-[11px] font-sans font-medium text-zinc-400 mb-1">Coach &amp; Seat</p>
                            <p className="font-bold text-zinc-900 truncate">
                              {coach || seatNumber ? `Coach ${coach || '--'} · Seat ${seatNumber || '--'}` : 'Coach S4 · Seat 12'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-sans font-medium text-zinc-400 mb-1">Berth Position</p>
                            <p className="font-bold text-zinc-900 font-sans truncate">
                              {berthType} Berth ({berthType[0] || 'L'}B)
                            </p>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <p className="text-[11px] font-sans font-medium text-zinc-400 mb-1">Mission</p>
                            <p className="font-bold text-zinc-900 font-sans truncate">
                              {actionType === 'collect_from_seat' ? 'De-boarding: Collect from Seat' : 'Boarding: Load to Seat'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Item 3: Selected Services */}
                      <div className="bg-[#fafbfc] border border-slate-200/70 rounded-2xl p-4 sm:p-5 space-y-4 hover:border-slate-300 transition-all shadow-2xs min-w-0 w-full">
                        <div className="flex items-center justify-between min-w-0">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 text-zinc-800 font-bold text-xs flex items-center justify-center shrink-0">
                              3
                            </span>
                            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 text-zinc-800 flex items-center justify-center shrink-0">
                              <Luggage className="w-4 h-4 text-zinc-700" />
                            </span>
                            <h3 className="font-bold text-xs sm:text-sm text-zinc-900 truncate">
                              Selected Services ({SERVICE_META.filter((s) => s.key === 'luggage' ? getLuggageTotalCount() > 0 : s.qty ? services[s.key] > 0 : services[s.key]).length})
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setBookingStep(3)}
                            className="bg-slate-100 hover:bg-slate-200 text-zinc-700 font-semibold text-xs px-3 py-1.5 rounded-lg border border-slate-200/50 cursor-pointer shrink-0"
                          >
                            Edit
                          </button>
                        </div>

                        <div className="space-y-3 pl-0 sm:pl-11 min-w-0">
                          {SERVICE_META.filter((s) => s.key === 'luggage' ? getLuggageTotalCount() > 0 : s.qty ? services[s.key] > 0 : services[s.key]).length === 0 ? (
                            <p className="text-xs text-zinc-400 italic">No services selected yet</p>
                          ) : (
                            SERVICE_META.filter((s) => s.key === 'luggage' ? getLuggageTotalCount() > 0 : s.qty ? services[s.key] > 0 : services[s.key]).map((s) => (
                              <div key={s.key} className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                  </span>
                                  <div>
                                    <p className="font-bold text-xs text-zinc-900">{s.label}</p>
                                    <p className="text-[10px] text-zinc-400">
                                      {s.key === 'luggage'
                                        ? `Quantity: ${getLuggageTotalCount()} items (${getLuggageSummaryLabel()})`
                                        : s.qty && services[s.key] > 1
                                          ? `Quantity: ${services[s.key]} (${s.per}s)`
                                          : 'Assistance service active'}
                                    </p>
                                  </div>
                                </div>
                                <span className="font-mono font-bold text-xs text-zinc-900">
                                  ₹{s.key === 'luggage' ? getLuggageTotalCost() : s.qty ? services[s.key] * s.price : s.price}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Bottom Action Row */}
                    <div className="pt-6 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 w-full">
                      <button
                        type="button"
                        onClick={() => setBookingStep(3)}
                        className="w-full sm:w-auto justify-center px-6 py-3 rounded-full bg-[#f0f4f8] hover:bg-slate-200 text-zinc-900 font-semibold text-xs transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Services</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleConfirm}
                        className="hidden lg:flex w-full sm:w-auto justify-center px-8 py-3.5 rounded-full bg-black hover:bg-zinc-800 text-white font-bold text-xs shadow-xs transition-all items-center gap-2 cursor-pointer"
                      >
                        <span>Continue to Payment</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>

                  </div>
                )}

              </div>


              {/* ── RIGHT SIDEBAR: BOOKING SUMMARY (HIDDEN ON MOBILE, VISIBLE ON DESKTOP) ── */}
              <aside className="hidden lg:block lg:col-span-4 sticky top-20 space-y-5 w-full max-w-full min-w-0">
                <div className="bg-white rounded-3xl sm:rounded-[28px] border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-5 sm:p-6 space-y-5 w-full max-w-full min-w-0 overflow-hidden">

                  {/* Header with Status Pill */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 min-w-0">
                    <div>
                      <h3 className="text-xl font-bold tracking-tight text-zinc-900">
                        Booking Summary
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">Your journey at a glance</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100/90 border border-slate-200/60 text-[11px] font-medium text-slate-500 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      <span>Not Booked Yet</span>
                    </span>
                  </div>

                  {/* Station Route Timeline */}
                  <div className="space-y-4 relative pl-5 border-l-2 border-dashed border-blue-200 py-1 my-2">
                    <div className="relative">
                      <span className="absolute -left-[27px] top-0.5 w-4 h-4 rounded-full bg-blue-600 ring-4 ring-white flex items-center justify-center text-white shadow-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      </span>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-black text-sm text-zinc-900 tracking-tight">{station}</p>
                          <p className="text-[11px] text-slate-400 font-medium">
                            {STATIONS.find((s) => s.code === station)?.name || station}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-xs text-zinc-900">{journeyDate || 'Date TBD'}</p>
                          <p className="font-mono text-[11px] text-slate-400">{journeyTime || '--:--'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="relative pt-1">
                      <span className="absolute -left-[27px] top-1.5 w-4 h-4 rounded-full bg-blue-600 ring-4 ring-white flex items-center justify-center text-white shadow-xs">
                        <MapPin className="w-2.5 h-2.5 text-white" />
                      </span>
                      <div>
                        <p className="font-black text-sm text-zinc-900 tracking-tight">
                          {selectedTrain?.to?.code || (selectedTrain?.to?.name ? selectedTrain.to.name.slice(0, 10).toUpperCase() : '--')}
                        </p>
                        <p className="text-[11px] text-slate-400 font-medium">
                          {selectedTrain?.to?.name || 'Select Train'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Soft Blue Train Card */}
                  <button
                    type="button"
                    onClick={() => {
                      if (bookingStep !== 1) setBookingStep(1);
                    }}
                    className="w-full text-left p-3 rounded-2xl bg-blue-50/80 border border-blue-100 flex items-center justify-between gap-2 text-xs transition-colors hover:bg-blue-50 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Train className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-zinc-900 truncate">
                          {selectedTrain ? `${selectedTrain.train_no} - ${selectedTrain.train_name}` : 'Select Train'}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {selectedTrain ? `Platform ${selectedTrain.platform || '1'}` : 'Click to select or search train'}
                        </p>
                      </div>
                    </div>
                    {selectedTrain ? (
                      <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider shrink-0 border border-blue-200/60">
                        SELECTED ✓
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-white text-slate-500 border border-slate-200 text-[10px] font-bold uppercase tracking-wider shrink-0 shadow-2xs">
                        NOT SELECTED →
                      </span>
                    )}
                  </button>

                  {/* Details List with soft blue circular icons */}
                  <div className="space-y-3 text-xs text-zinc-600 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/50">
                        <Armchair className="w-4 h-4" />
                      </span>
                      <div>
                        <span className="font-bold text-zinc-900">
                          {coach || seatNumber ? `Coach ${coach || '--'} · Seat ${seatNumber || '--'}` : 'Coach & Seat Not Entered'}
                        </span>
                        <p className="text-[11px] text-slate-400">
                          {coach || seatNumber ? `${berthType} Berth` : 'Enter in Step 2'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/50">
                        <Luggage className="w-4 h-4" />
                      </span>
                      <div>
                        <span className="font-bold text-zinc-900">
                          {actionType === 'collect_from_seat' ? 'De-boarding: Collect from Seat' : 'Boarding: Load to Seat'}
                        </span>
                        <p className="text-[11px] text-slate-400">
                          {actionType === 'collect_from_seat' ? 'Meeting coach door upon arrival' : 'Meeting station gate / concourse'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/50">
                        <Calendar className="w-4 h-4" />
                      </span>
                      <div>
                        <span className="font-bold text-zinc-900 font-mono">
                          {journeyDate ? `${journeyDate} ${journeyTime ? '· ' + journeyTime : ''}` : 'Select Journey Date'}
                        </span>
                        <p className="text-[11px] text-slate-400">Scheduled Assistant Arrival</p>
                      </div>
                    </div>
                  </div>

                  {/* Service Charges Breakdown Accordion */}
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between font-bold text-zinc-900">
                      <span>Service Charges</span>
                      <ChevronUp className="w-4 h-4 text-zinc-500" />
                    </div>

                    {SERVICE_META.filter((s) => s.key === 'luggage' ? getLuggageTotalCount() > 0 : s.qty ? services[s.key] > 0 : services[s.key]).length === 0 ? (
                      <div className="py-2 text-zinc-400 text-center italic text-[11px]">
                        No assistance services selected yet
                      </div>
                    ) : (
                      SERVICE_META.filter((s) => s.key === 'luggage' ? getLuggageTotalCount() > 0 : s.qty ? services[s.key] > 0 : services[s.key]).map((s) => (
                        <div key={s.key} className="flex justify-between text-zinc-600">
                          <span>
                            {s.label}{' '}
                            {s.key === 'luggage'
                              ? `(${getLuggageSummaryLabel()})`
                              : s.qty && services[s.key] > 1
                                ? `(${services[s.key]}x)`
                                : ''}
                          </span>
                          <span className="font-mono font-bold text-zinc-900">
                            ₹{s.key === 'luggage' ? getLuggageTotalCost() : s.qty ? s.price * services[s.key] : s.price}
                          </span>
                        </div>
                      ))
                    )}

                    <div className="flex justify-between text-zinc-600 pt-1 border-t border-slate-100">
                      <span>GST (Included)</span>
                      <span className="font-mono font-bold text-zinc-900">₹0</span>
                    </div>
                  </div>

                  {/* Total Payable Soft Blue Highlight Box */}
                  <div className="p-4 rounded-2xl bg-[#EFF6FF] border border-blue-100/80 text-blue-600 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-600 block">Total Payable</span>
                      <span className="text-[10px] text-slate-400 font-medium">All platform taxes included</span>
                    </div>
                    <span className="text-3xl font-black font-mono tracking-tight text-blue-600">₹{calculateTotal()}</span>
                  </div>

                  {/* Security Row with Razorpay & Premium UPI/Mastercard Icons */}
                  <div className="pt-2 flex items-center justify-between text-xs text-zinc-500 border-t border-slate-100/80">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-[11px] font-medium text-slate-500 truncate">
                        Secured Payments with <strong className="font-extrabold text-[#0C2340]">Razorpay</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Premium UPI Icon Badge */}
                      <div className="h-6 px-2 rounded-md bg-white border border-slate-200/90 shadow-2xs flex items-center gap-1 shrink-0 hover:border-slate-300 transition-colors" title="UPI">
                        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
                          <path d="M14.5 4L7.5 20h3.5l7-16h-3.5z" fill="#097939" />
                          <path d="M10.5 4L3.5 20h3.5l7-16h-3.5z" fill="#ED752E" />
                        </svg>
                        <span className="text-[10px] font-black italic tracking-tighter text-[#2E3192] leading-none font-sans">UPI</span>
                      </div>

                      {/* Premium Mastercard Icon Badge */}
                      <div className="h-6 px-2 rounded-md bg-white border border-slate-200/90 shadow-2xs flex items-center justify-center shrink-0 hover:border-slate-300 transition-colors" title="Mastercard">
                        <svg className="w-5 h-3.5" viewBox="0 0 36 22" fill="none">
                          <circle cx="11" cy="11" r="9" fill="#EB001B" />
                          <circle cx="25" cy="11" r="9" fill="#F79E1B" />
                          <path d="M18 4.25a9 9 0 0 1 0 13.5 9 9 0 0 1 0-13.5z" fill="#FF5F00" />
                        </svg>
                      </div>
                    </div>
                  </div>

                </div>
              </aside>

            </div>



          </div>
        ) : tab === 'trips' ? (
          /* ============================================================
             MY TRIPS TAB — SWISS-INSPIRED PREMIUM RAILWAY PORTAL
             Strict Swiss Minimal: Black (#000000), White (#FFFFFF), Blue (#146BFF)
             ============================================================ */
          <div className="space-y-6 animate-fade-in max-w-[1420px] mx-auto w-full">
            {/* ── 1. PAGE HERO: Refined "My Journeys" Hero Section ── */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] overflow-hidden relative">
              <div className="flex flex-row items-stretch justify-between min-h-[140px] sm:min-h-[190px] relative">
                {/* Left Side: Eyebrow, Heading, Subtitle & 3 Compact Statistics */}
                <div className="p-4 sm:p-8 lg:p-10 flex-1 z-10 flex flex-col justify-between max-w-[58%] sm:max-w-xl">
                  <div>
                    <span className="text-[9px] sm:text-[11px] font-bold tracking-[0.2em] text-zinc-400 uppercase font-mono">
                      MY JOURNEYS
                    </span>
                    <h1 className="text-2xl sm:text-4xl lg:text-[44px] font-black text-black tracking-tight mt-0.5 sm:mt-1 leading-tight">
                      Your <span className="text-[#146BFF]">Trips</span>
                    </h1>
                    <p className="text-[10px] sm:text-sm text-zinc-500 font-medium mt-1 leading-tight line-clamp-2">
                      Every journey, every assistance — in one place.
                    </p>
                  </div>

                  {/* 4 Compact Statistics Row */}
                  <div className="flex items-center gap-2.5 sm:gap-6 pt-3 sm:pt-6 overflow-x-auto no-scrollbar">
                    <div>
                      <div className="text-lg sm:text-3xl font-black text-black tracking-tight">
                        {allDisplayBookings.length}
                      </div>
                      <div className="text-[9px] sm:text-xs font-semibold text-zinc-400 mt-0.5">
                        Total Trips
                      </div>
                    </div>
                    <div className="h-6 sm:h-7 w-px bg-slate-200/80" />
                    <div>
                      <div className="text-lg sm:text-3xl font-black text-[#146BFF] tracking-tight">
                        {ongoingList.length}
                      </div>
                      <div className="text-[9px] sm:text-xs font-semibold text-zinc-400 mt-0.5">
                        Ongoing
                      </div>
                    </div>
                    <div className="h-6 sm:h-7 w-px bg-slate-200/80" />
                    <div>
                      <div className="text-lg sm:text-3xl font-black text-black tracking-tight">
                        {upcomingList.length}
                      </div>
                      <div className="text-[9px] sm:text-xs font-semibold text-zinc-400 mt-0.5">
                        Upcoming
                      </div>
                    </div>
                    <div className="h-6 sm:h-7 w-px bg-slate-200/80" />
                    <div>
                      <div className="text-lg sm:text-3xl font-black text-black tracking-tight">
                        {completedList.length}
                      </div>
                      <div className="text-[9px] sm:text-xs font-semibold text-zinc-400 mt-0.5">
                        Completed
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side: High-Resolution Vande Bharat Train & Station Hero Graphic */}
                <div className="relative w-[42%] sm:w-[50%] md:w-[56%] lg:w-[60%] min-h-[140px] sm:min-h-[190px] overflow-hidden flex items-center justify-end shrink-0">
                  <img
                    src="/my_trips_train_graphic.png"
                    alt="OneCoolie Indian Railways Travel"
                    className="w-full h-full object-cover object-left md:object-right select-none pointer-events-none"
                  />
                  {/* Soft gradient blend on the left of the image */}
                  <div className="absolute inset-y-0 left-0 w-8 sm:w-28 bg-gradient-to-r from-white via-white/80 to-transparent pointer-events-none" />
                </div>
              </div>
            </div>

            {/* ── 2. TRIP FILTER & SORT ROW ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              {/* Filter Tabs */}
              <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto no-scrollbar py-1">
                {/* All Trips */}
                <button
                  type="button"
                  onClick={() => setTripFilter('all')}
                  className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${tripFilter === 'all'
                    ? 'bg-black text-white shadow-xs'
                    : 'bg-white text-zinc-700 hover:bg-slate-50 border border-slate-200/80 shadow-2xs'
                    }`}
                >
                  <span>All Trips</span>
                  <span
                    className={`min-w-[20px] h-[20px] px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${tripFilter === 'all' ? 'bg-white text-black' : 'bg-slate-100 text-zinc-600'
                      }`}
                  >
                    {allDisplayBookings.length}
                  </span>
                </button>

                {/* Ongoing */}
                <button
                  type="button"
                  onClick={() => setTripFilter('ongoing')}
                  className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${tripFilter === 'ongoing'
                    ? 'bg-black text-white shadow-xs'
                    : 'bg-white text-zinc-700 hover:bg-slate-50 border border-slate-200/80 shadow-2xs'
                    }`}
                >
                  <span className="flex items-center gap-1.5">
                    {ongoingList.length > 0 && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
                      </span>
                    )}
                    <span>Ongoing</span>
                  </span>
                  <span
                    className={`min-w-[20px] h-[20px] px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${tripFilter === 'ongoing' ? 'bg-white text-black' : 'bg-slate-100 text-zinc-600'
                      }`}
                  >
                    {ongoingList.length}
                  </span>
                </button>

                {/* Upcoming */}
                <button
                  type="button"
                  onClick={() => setTripFilter('upcoming')}
                  className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${tripFilter === 'upcoming'
                    ? 'bg-black text-white shadow-xs'
                    : 'bg-white text-zinc-700 hover:bg-slate-50 border border-slate-200/80 shadow-2xs'
                    }`}
                >
                  <span>Upcoming</span>
                  <span
                    className={`min-w-[20px] h-[20px] px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${tripFilter === 'upcoming' ? 'bg-white text-black' : 'bg-slate-100 text-zinc-600'
                      }`}
                  >
                    {upcomingList.length}
                  </span>
                </button>

                {/* Completed */}
                <button
                  type="button"
                  onClick={() => setTripFilter('completed')}
                  className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${tripFilter === 'completed'
                    ? 'bg-black text-white shadow-xs'
                    : 'bg-white text-zinc-700 hover:bg-slate-50 border border-slate-200/80 shadow-2xs'
                    }`}
                >
                  <span>Completed</span>
                  <span
                    className={`min-w-[20px] h-[20px] px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${tripFilter === 'completed' ? 'bg-white text-black' : 'bg-slate-100 text-zinc-600'
                      }`}
                  >
                    {completedList.length}
                  </span>
                </button>
              </div>

              {/* Sort By Dropdown */}
              <div className="relative self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                  className="px-4 py-2 sm:py-2.5 rounded-full bg-white hover:bg-slate-50 text-zinc-800 font-bold text-xs border border-slate-200/80 shadow-2xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5 text-zinc-600" />
                  <span>Sort by</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${sortDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {sortDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setSortDropdownOpen(false)} />
                    <div className="absolute right-0 top-11 z-40 bg-white border border-slate-200/90 rounded-2xl shadow-xl p-1.5 w-44 text-left text-xs space-y-0.5 animate-scale-in">
                      <button
                        type="button"
                        onClick={() => { setSortBy('newest'); setSortDropdownOpen(false); }}
                        className={`w-full px-3 py-2 rounded-xl text-left font-semibold transition-colors flex items-center justify-between cursor-pointer ${sortBy === 'newest' ? 'bg-slate-100 text-black font-bold' : 'text-zinc-700 hover:bg-slate-50'
                          }`}
                      >
                        <span>Newest First</span>
                        {sortBy === 'newest' && <Check className="w-3.5 h-3.5 text-black" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSortBy('oldest'); setSortDropdownOpen(false); }}
                        className={`w-full px-3 py-2 rounded-xl text-left font-semibold transition-colors flex items-center justify-between cursor-pointer ${sortBy === 'oldest' ? 'bg-slate-100 text-black font-bold' : 'text-zinc-700 hover:bg-slate-50'
                          }`}
                      >
                        <span>Oldest First</span>
                        {sortBy === 'oldest' && <Check className="w-3.5 h-3.5 text-black" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSortBy('fare_high'); setSortDropdownOpen(false); }}
                        className={`w-full px-3 py-2 rounded-xl text-left font-semibold transition-colors flex items-center justify-between cursor-pointer ${sortBy === 'fare_high' ? 'bg-slate-100 text-black font-bold' : 'text-zinc-700 hover:bg-slate-50'
                          }`}
                      >
                        <span>Fare: High to Low</span>
                        {sortBy === 'fare_high' && <Check className="w-3.5 h-3.5 text-black" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSortBy('fare_low'); setSortDropdownOpen(false); }}
                        className={`w-full px-3 py-2 rounded-xl text-left font-semibold transition-colors flex items-center justify-between cursor-pointer ${sortBy === 'fare_low' ? 'bg-slate-100 text-black font-bold' : 'text-zinc-700 hover:bg-slate-50'
                          }`}
                      >
                        <span>Fare: Low to High</span>
                        {sortBy === 'fare_low' && <Check className="w-3.5 h-3.5 text-black" />}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── 3. TRIP CARDS LIST ── */}
            {loading ? (
              <div className="bg-white border border-slate-200/70 rounded-3xl p-6 sm:p-10 shadow-2xs">
                <TrainLoader
                  fullScreen={false}
                  size="md"
                  text="Loading Your Trips..."
                  subtext="Syncing your bookings with Indian Railways telemetry..."
                />
              </div>
            ) : (() => {
              const formatDateBlock = (dateStr) => {
                try {
                  if (!dateStr) return { month: 'SEP', day: '06', year: '2026', weekday: 'SUN' };
                  const d = new Date(dateStr);
                  if (isNaN(d.getTime())) return { month: 'SEP', day: '06', year: '2026', weekday: 'SUN' };
                  const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
                  const day = String(d.getDate()).padStart(2, '0');
                  const year = d.getFullYear();
                  const weekday = d.toLocaleString('en-US', { weekday: 'short' }).toUpperCase();
                  return { month, day, year, weekday };
                } catch (e) {
                  return { month: 'SEP', day: '06', year: '2026', weekday: 'SUN' };
                }
              };

              const formatStepTime = (timeVal, fallback = '') => {
                if (!timeVal) return fallback;
                if (typeof timeVal === 'string' && /^\d{1,2}:\d{2}$/.test(timeVal.trim())) {
                  return timeVal.trim();
                }
                try {
                  const d = new Date(timeVal);
                  if (!isNaN(d.getTime())) {
                    const hours = String(d.getHours()).padStart(2, '0');
                    const mins = String(d.getMinutes()).padStart(2, '0');
                    return `${hours}:${mins}`;
                  }
                } catch (e) { }
                return fallback;
              };

              let currentList =
                tripFilter === 'ongoing'
                  ? ongoingList
                  : tripFilter === 'upcoming'
                    ? upcomingList
                    : tripFilter === 'completed'
                      ? completedList
                      : allDisplayBookings;

              // Apply Sorting
              currentList = [...currentList].sort((a, b) => {
                if (sortBy === 'oldest') {
                  return new Date(a.journey_date || 0) - new Date(b.journey_date || 0);
                }
                if (sortBy === 'fare_high') {
                  return (b.total_price || 0) - (a.total_price || 0);
                }
                if (sortBy === 'fare_low') {
                  return (a.total_price || 0) - (b.total_price || 0);
                }
                return new Date(b.journey_date || 0) - new Date(a.journey_date || 0);
              });

              if (currentList.length === 0) {
                return (
                  <div className="bg-white border border-slate-200/70 rounded-3xl p-12 text-center max-w-md mx-auto shadow-2xs">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#146BFF] flex items-center justify-center mx-auto mb-4 border border-blue-100">
                      <Luggage className="w-7 h-7" />
                    </div>
                    <p className="font-extrabold text-base text-zinc-900 mb-1">No trips found</p>
                    <p className="text-xs text-zinc-500 mb-6">
                      {tripFilter === 'ongoing'
                        ? 'You have no trips currently in progress.'
                        : tripFilter === 'upcoming'
                          ? 'You have no upcoming station assistance dispatches.'
                          : tripFilter === 'completed'
                            ? 'No historical completed trip records found.'
                            : "You haven't requested station assistance yet."}
                    </p>
                    <button
                      type="button"
                      onClick={() => setTab('book')}
                      className="bg-black hover:bg-zinc-800 text-white font-bold px-6 py-3 rounded-full text-xs transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>Book Assistance Now</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                );
              }

              return (
                <div className="space-y-4 sm:space-y-5">
                  {currentList.map((b) => {
                    const { month, day, year, weekday } = formatDateBlock(b.journey_date);
                    const isCompleted = b.booking_status?.toLowerCase() === 'completed';
                    const isCancelled = b.booking_status?.toLowerCase() === 'cancelled';
                    const isPending = !isCompleted && !isCancelled;
                    const isBoarding = !(b.action_type === 'collect_from_seat' || b.services?.action_type === 'collect_from_seat');

                    // 4 Stages: Booking Confirmed -> Assistant Assigned -> Assistant Reached -> Service Completed
                    const formatDatePart = (dateStr) => {
                      try {
                        if (!dateStr) return '';
                        const d = new Date(dateStr);
                        if (isNaN(d.getTime())) return '';
                        const dayVal = String(d.getDate()).padStart(2, '0');
                        const monthVal = d.toLocaleString('en-US', { month: 'short' });
                        const yearVal = d.getFullYear();
                        return `${dayVal} ${monthVal} ${yearVal}`;
                      } catch (e) {
                        return '';
                      }
                    };

                    const defaultDateStr = `${day} ${month.charAt(0) + month.slice(1).toLowerCase()} ${year}`;

                    // Step 1: Booking Confirmed
                    const isConfirmedDone = !isCancelled;
                    const confirmedTime = formatStepTime(
                      b.created_at,
                      isCompleted ? '08:00' : '14:28'
                    );
                    const confirmedDate = formatDatePart(b.created_at) || defaultDateStr;

                    // Step 2: Assistant Assigned
                    const isAssignedDone = !isCancelled && Boolean(
                      b.assistant_id ||
                      b.assistant ||
                      b.accepted_at ||
                      ['assigned', 'accepted', 'arriving', 'reached', 'in_service', 'completed'].includes(b.booking_status?.toLowerCase())
                    );
                    const assignedTime = formatStepTime(
                      b.accepted_at || b.services?.accepted_at,
                      isCompleted ? '08:10' : ''
                    );
                    const assignedDate = isAssignedDone ? (formatDatePart(b.accepted_at) || defaultDateStr) : '';

                    // Step 3: Assistant Reached
                    const isReachedDone = !isCancelled && Boolean(
                      b.arrived_at ||
                      b.services?.arrived_at ||
                      ['reached', 'in_service', 'completed'].includes(b.booking_status?.toLowerCase())
                    );
                    const reachedTime = formatStepTime(
                      b.arrived_at || b.services?.arrived_at,
                      isCompleted ? '09:05' : ''
                    );
                    const reachedDate = isReachedDone ? (formatDatePart(b.arrived_at) || defaultDateStr) : '';

                    // Step 4: Service Completed
                    const isServiceDone = !isCancelled && isCompleted;
                    const completedTime = formatStepTime(
                      b.completed_at || b.services?.completed_at,
                      isCompleted ? '09:45' : ''
                    );
                    const completedDate = isServiceDone ? (formatDatePart(b.completed_at) || defaultDateStr) : '';

                    const trainNo = b.train_no || b.train_number || '20834';
                    const trainName = b.train_name || 'Vande Bharat Express';
                    let fromStation = b.source || b.from_station || (b.station_name && b.station_name !== b.destination ? b.station_name : 'Secunderabad');
                    let toStation = b.destination || b.to_station || (fromStation === 'Secunderabad' ? 'Visakhapatnam' : 'Kazipet');
                    if (fromStation === toStation || trainNo === '17013') {
                      if (trainNo === '20834' || trainName.toLowerCase().includes('vande bharat')) {
                        fromStation = 'Secunderabad';
                        toStation = 'Visakhapatnam';
                      } else if (trainNo === '17013' || trainName.toLowerCase().includes('kazipet')) {
                        fromStation = 'Hadaspar (Pune)';
                        toStation = 'Kazipet';
                      } else {
                        toStation = 'Destination';
                      }
                    }

                    const trackerSteps = [
                      {
                        id: 'confirmed',
                        label: 'Booking Confirmed',
                        time: confirmedTime,
                        date: confirmedDate,
                        isDone: isConfirmedDone,
                        isCurrent: !isConfirmedDone,
                      },
                      {
                        id: 'assigned',
                        label: 'Assistant Assigned',
                        time: assignedTime,
                        date: assignedDate,
                        isDone: isAssignedDone,
                        isCurrent: isConfirmedDone && !isAssignedDone,
                      },
                      {
                        id: 'reached',
                        label: 'Assistant Reached',
                        time: reachedTime,
                        date: reachedDate,
                        isDone: isReachedDone,
                        isCurrent: isAssignedDone && !isReachedDone,
                      },
                      {
                        id: 'completed',
                        label: 'Service Completed',
                        time: completedTime,
                        date: completedDate,
                        isDone: isServiceDone,
                        isCurrent: isReachedDone && !isServiceDone,
                      },
                    ];

                    const serviceLabel = isBoarding ? 'Boarding Load' : 'Platform Assist';

                    return (
                      <div
                        key={b.id}
                        className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-4 sm:p-5 lg:p-7 hover:border-slate-300 transition-all relative group"
                      >
                        {/* ══════════════════════════════════════════════════════════════════
                            1. MOBILE & TABLET COMPACT CARD LAYOUT (< lg)
                            Eliminates awkward gaps; tightly integrates Date, Train, Chips & Tracker
                            ══════════════════════════════════════════════════════════════════ */}
                        <div className="flex lg:hidden flex-col space-y-3 w-full">
                          {/* Top Row: Date Tile + Train Info & Route + Status & Menu */}
                          <div className="flex items-start gap-3">
                            {/* Compact Date Tile */}
                            <div className="w-13 bg-[#F8FAFC] border border-slate-200/70 rounded-2xl py-2 px-1 flex flex-col items-center justify-center shrink-0 text-center self-start">
                              <span className="text-[9px] font-bold text-zinc-400 tracking-wider uppercase font-mono leading-tight">
                                {month}
                              </span>
                              <span className="text-xl font-black text-black tracking-tight my-0.5 leading-none">
                                {day}
                              </span>
                              <span className="text-[9px] font-medium text-zinc-400 leading-tight">
                                {year}
                              </span>
                              <span className="px-1 py-0.5 bg-slate-200/70 text-zinc-700 text-[8px] font-bold rounded mt-1 uppercase tracking-wide">
                                {weekday}
                              </span>
                            </div>

                            {/* Train Title, Route, Status Pill & 3-Dots */}
                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className="flex items-center justify-between gap-1 mb-1">
                                {/* Status Badge */}
                                {isCancelled ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-200 inline-flex items-center gap-1 uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                                    CANCELLED
                                  </span>
                                ) : isCompleted ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]/60 inline-flex items-center gap-1 uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
                                    COMPLETED
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#EFF6FF] text-[#146BFF] border border-[#BFDBFE]/60 inline-flex items-center gap-1 uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#146BFF]" />
                                    PENDING
                                  </span>
                                )}

                                {/* Options Menu Button */}
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuId(activeMenuId === b.id ? null : b.id);
                                    }}
                                    className="text-zinc-400 hover:text-black p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                    title="Options"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>

                                  {activeMenuId === b.id && (
                                    <>
                                      <div className="fixed inset-0 z-30" onClick={() => setActiveMenuId(null)} />
                                      <div
                                        className="absolute right-0 top-7 z-40 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 w-48 text-left text-xs space-y-1 animate-scale-in"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveMenuId(null);
                                            const copyVal = b.booking_id || b.id;
                                            navigator.clipboard.writeText(copyVal);
                                            toast.success(`Booking ID copied: ${copyVal}`);
                                          }}
                                          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-zinc-700 hover:bg-slate-50 font-medium transition-colors cursor-pointer"
                                        >
                                          <Copy className="w-3.5 h-3.5 text-zinc-400" />
                                          <span>Copy ID: {b.booking_id || b.id}</span>
                                        </button>

                                        {!isCompleted && !isCancelled && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveMenuId(null);
                                              setConfirmCancel(b.id);
                                            }}
                                            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-medium transition-colors cursor-pointer"
                                          >
                                            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                                            <span>Cancel Booking</span>
                                          </button>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>

                              <h3 className="font-extrabold text-sm sm:text-base text-zinc-900 tracking-tight leading-snug line-clamp-1">
                                Train {trainNo} · {trainName}
                              </h3>
                              <p className="text-[11px] sm:text-xs text-zinc-500 font-semibold mt-0.5 flex items-center gap-1 truncate">
                                <span>{fromStation}</span>
                                <span className="text-zinc-400 font-normal">→</span>
                                <span>{toStation}</span>
                                <span className="text-zinc-400 font-normal text-xs ml-0.5">&gt;</span>
                              </p>
                            </div>
                          </div>

                          {/* Row 2: 3 Detail Chips Grid */}
                          <div className="grid grid-cols-3 gap-2 pt-0.5">
                            {/* Coach */}
                            <div className="bg-[#F8FAFC] border border-slate-100 rounded-xl p-2 flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-blue-50 text-[#146BFF] flex items-center justify-center shrink-0">
                                <Train className="w-3 h-3 text-[#146BFF]" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[9px] text-zinc-400 font-medium block leading-none">Coach</span>
                                <span className="text-xs font-bold text-zinc-800 block truncate leading-tight mt-0.5">
                                  {b.coach || b.services?.coach || 'S4'}
                                </span>
                              </div>
                            </div>

                            {/* Seat */}
                            <div className="bg-[#F8FAFC] border border-slate-100 rounded-xl p-2 flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-blue-50 text-[#146BFF] flex items-center justify-center shrink-0">
                                <Armchair className="w-3 h-3 text-[#146BFF]" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[9px] text-zinc-400 font-medium block leading-none">Seat</span>
                                <span className="text-xs font-bold text-zinc-800 block truncate leading-tight mt-0.5">
                                  {b.seat_number || b.services?.seat_number || '42'}
                                </span>
                              </div>
                            </div>

                            {/* Service */}
                            <div className="bg-[#F8FAFC] border border-slate-100 rounded-xl p-2 flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-blue-50 text-[#146BFF] flex items-center justify-center shrink-0">
                                <Luggage className="w-3 h-3 text-[#146BFF]" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[9px] text-zinc-400 font-medium block leading-none">Service</span>
                                <span className="text-xs font-bold text-zinc-800 block truncate leading-tight mt-0.5">
                                  {serviceLabel}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Row 3: Contextual Alert Note (shown for pending/cancelled, hidden for completed) */}
                          {!isCompleted && (
                            <div>
                              {isCancelled ? (
                                <div className="bg-rose-50/80 border border-rose-200/70 rounded-xl p-2.5 px-3 flex items-start gap-2">
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-rose-800 leading-snug">Booking was cancelled.</p>
                                    <p className="text-[10px] text-rose-600 font-medium leading-snug">Feel free to book assistance again anytime.</p>
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-[#EFF6FF]/80 border border-[#BFDBFE]/60 rounded-xl p-2.5 px-3 flex items-start gap-2">
                                  <Info className="w-3.5 h-3.5 text-[#146BFF] shrink-0 mt-0.5" />
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-[#1E40AF] leading-snug">Your booking is confirmed.</p>
                                    <p className="text-[10px] text-[#3B82F6] font-medium leading-snug">We are assigning the nearest assistant.</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Row 4: 4-Stage Horizontal Progress Tracker */}
                          <div className="pt-2 pb-1 overflow-x-auto no-scrollbar">
                            <div className="flex items-start justify-between min-w-[310px]">
                              {trackerSteps.map((step, idx) => {
                                const isDone = step.isDone;
                                const isCurrent = step.isCurrent;

                                return (
                                  <Fragment key={step.id}>
                                    <div className="flex flex-col items-center text-center shrink-0 w-20 z-10">
                                      {/* Circle Icon */}
                                      <span
                                        className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 transition-all ${isDone
                                            ? isCompleted
                                              ? 'bg-[#059669] text-white'
                                              : 'bg-[#146BFF] text-white'
                                            : isCurrent
                                              ? 'border-2 border-[#146BFF] bg-white text-transparent'
                                              : 'border-2 border-slate-200 bg-white text-transparent'
                                          }`}
                                      >
                                        {isDone ? '✓' : ''}
                                      </span>

                                      {/* Step Label */}
                                      <span
                                        className={`mt-1 text-[10px] font-bold leading-tight ${isDone
                                            ? 'text-zinc-900'
                                            : isCurrent
                                              ? 'text-zinc-700'
                                              : 'text-zinc-400'
                                          }`}
                                      >
                                        {step.label}
                                      </span>

                                      {/* Step Time & Date or Pending */}
                                      {isDone && step.time ? (
                                        <div className="mt-0.5 flex flex-col items-center">
                                          <span className="font-mono text-[9px] font-semibold text-zinc-500 leading-tight">
                                            {step.time}
                                          </span>
                                          {step.date && (
                                            <span className="text-[8px] text-zinc-400 leading-tight">
                                              {step.date}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-[9px] font-medium text-zinc-400 mt-0.5 leading-tight">
                                          Pending
                                        </span>
                                      )}
                                    </div>

                                    {/* Connecting Line */}
                                    {idx < trackerSteps.length - 1 && (
                                      <div
                                        className={`flex-1 border-t-2 mt-2 mx-1 min-w-[12px] ${trackerSteps[idx + 1].isDone
                                            ? isCompleted
                                              ? 'border-[#059669]'
                                              : 'border-[#146BFF]'
                                            : isDone && trackerSteps[idx + 1].isCurrent
                                              ? 'border-dashed border-[#60A5FA]'
                                              : 'border-dashed border-slate-200'
                                          }`}
                                      />
                                    )}
                                  </Fragment>
                                );
                              })}
                            </div>
                          </div>

                          {/* Row 5: Fee & View Trip CTA */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                            <div>
                              <div className="text-xl font-black text-black tracking-tight leading-none">
                                ₹{b.total_price || (isCompleted ? 30 : 70)}
                              </div>
                              <div className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                                Assistance Fee
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                try {
                                  if (b.id) sessionStorage.setItem(`booking_${b.id}`, JSON.stringify(b));
                                  if (b.booking_id) sessionStorage.setItem(`booking_${b.booking_id}`, JSON.stringify(b));
                                } catch (e) { }
                                navigate(`/booking/${b.id}`, { state: { booking: b } });
                              }}
                              className={`rounded-full font-bold text-xs px-5 py-2.5 flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-xs ${isPending
                                  ? 'bg-black hover:bg-zinc-800 text-white'
                                  : 'bg-white hover:bg-slate-50 text-zinc-900 border border-slate-200/90'
                                }`}
                            >
                              <span>View Trip</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* ══════════════════════════════════════════════════════════════════
                            2. LAPTOP / DESKTOP CARD LAYOUT (lg: and above)
                            EXACT APPROVED LAYOUT — 100% UNCHANGED
                            ══════════════════════════════════════════════════════════════════ */}
                        <div className="hidden lg:flex flex-row items-stretch justify-between gap-5 w-full">
                          {/* LEFT COLUMN: Date Block */}
                          <div className="flex items-start justify-start gap-4 shrink-0">
                            <div className="w-16 bg-[#F8FAFC] border border-slate-200/70 rounded-2xl py-2.5 px-1.5 flex flex-col items-center justify-center shrink-0 text-center self-start">
                              <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase font-mono">
                                {month}
                              </span>
                              <span className="text-2xl sm:text-[28px] font-black text-black tracking-tight my-0.5 leading-none">
                                {day}
                              </span>
                              <span className="text-[10px] font-medium text-zinc-400">
                                {year}
                              </span>
                              <span className="px-1.5 py-0.5 bg-slate-200/70 text-zinc-700 text-[9px] font-bold rounded-md mt-1.5 uppercase tracking-wide">
                                {weekday}
                              </span>
                            </div>
                          </div>

                          {/* CENTER MAIN CONTENT */}
                          <div className="flex-1 min-w-0 space-y-4">
                            {/* Row 1: Train Icon + Title & Route + Status Badge */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3 sm:gap-4">
                                {/* Circular Train Icon */}
                                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white border border-slate-200/80 shadow-2xs flex items-center justify-center shrink-0">
                                  <Train className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-900" />
                                </div>

                                {/* Title & Route */}
                                <div>
                                  <h3 className="font-extrabold text-base sm:text-lg text-zinc-900 tracking-tight leading-tight">
                                    Train {trainNo} · {trainName}
                                  </h3>
                                  <p className="text-xs sm:text-sm text-zinc-500 font-semibold mt-0.5 flex items-center gap-1.5">
                                    <span>{fromStation}</span>
                                    <span className="text-zinc-400 font-normal">→</span>
                                    <span>{toStation}</span>
                                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400 ml-0.5" />
                                  </p>
                                </div>
                              </div>

                              {/* Desktop Status Badge */}
                              <div className="flex items-center">
                                {isCancelled ? (
                                  <span className="px-3.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-600 border border-rose-200 inline-flex items-center gap-2 uppercase tracking-wider">
                                    <span className="w-2 h-2 rounded-full bg-rose-600" />
                                    CANCELLED
                                  </span>
                                ) : isCompleted ? (
                                  <span className="px-3.5 py-1 rounded-full text-xs font-black bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]/60 inline-flex items-center gap-2 uppercase tracking-wider">
                                    <span className="w-2 h-2 rounded-full bg-[#059669]" />
                                    COMPLETED
                                  </span>
                                ) : (
                                  <span className="px-3.5 py-1 rounded-full text-xs font-black bg-[#EFF6FF] text-[#146BFF] border border-[#BFDBFE]/60 inline-flex items-center gap-2 uppercase tracking-wider">
                                    <span className="w-2 h-2 rounded-full bg-[#146BFF]" />
                                    PENDING
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Row 2: 3 Detail Chips on left, Notification Card on right */}
                            <div className="flex flex-row items-center justify-between gap-3 pt-0.5">
                              {/* 3 Detail Chips */}
                              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                                {/* Coach */}
                                <div className="bg-[#F8FAFC] border border-slate-100/90 rounded-2xl px-3 py-2 flex items-center gap-2 shrink-0">
                                  <div className="w-7 h-7 rounded-xl bg-blue-50 text-[#146BFF] flex items-center justify-center shrink-0">
                                    <Train className="w-3.5 h-3.5 text-[#146BFF]" />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-[9px] sm:text-[10px] text-zinc-400 font-medium block leading-tight">Coach</span>
                                    <span className="text-xs sm:text-sm font-bold text-zinc-800 block truncate leading-tight">
                                      {b.coach || b.services?.coach || 'S4'}
                                    </span>
                                  </div>
                                </div>

                                {/* Seat */}
                                <div className="bg-[#F8FAFC] border border-slate-100/90 rounded-2xl px-3 py-2 flex items-center gap-2 shrink-0">
                                  <div className="w-7 h-7 rounded-xl bg-blue-50 text-[#146BFF] flex items-center justify-center shrink-0">
                                    <Armchair className="w-3.5 h-3.5 text-[#146BFF]" />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-[9px] sm:text-[10px] text-zinc-400 font-medium block leading-tight">Seat</span>
                                    <span className="text-xs sm:text-sm font-bold text-zinc-800 block truncate leading-tight">
                                      {b.seat_number || b.services?.seat_number || '42'}
                                    </span>
                                  </div>
                                </div>

                                {/* Service */}
                                <div className="bg-[#F8FAFC] border border-slate-100/90 rounded-2xl px-3 py-2 flex items-center gap-2 shrink-0">
                                  <div className="w-7 h-7 rounded-xl bg-blue-50 text-[#146BFF] flex items-center justify-center shrink-0">
                                    <Luggage className="w-3.5 h-3.5 text-[#146BFF]" />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-[9px] sm:text-[10px] text-zinc-400 font-medium block leading-tight">Service</span>
                                    <span className="text-xs sm:text-sm font-bold text-zinc-800 block truncate leading-tight">
                                      {serviceLabel}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Contextual Notification Card (only for pending or cancelled) */}
                              {!isCompleted && (
                                <div className="flex-1 max-w-sm">
                                  {isCancelled ? (
                                    <div className="bg-rose-50/80 border border-rose-200/70 rounded-2xl p-2.5 px-3 flex items-start gap-2.5">
                                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold text-rose-800 leading-snug">Booking was cancelled.</p>
                                        <p className="text-[11px] text-rose-600 font-medium leading-snug">Feel free to book assistance again anytime.</p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="bg-[#EFF6FF]/80 border border-[#BFDBFE]/60 rounded-2xl p-2.5 px-3 flex items-start gap-2.5">
                                      <Info className="w-4 h-4 text-[#146BFF] shrink-0 mt-0.5" />
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold text-[#1E40AF] leading-snug">Your booking is confirmed.</p>
                                        <p className="text-[11px] text-[#3B82F6] font-medium leading-snug">We are assigning the nearest assistant.</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Row 3: 4-Stage Horizontal Progress Tracker */}
                            <div className="pt-2 pb-1 overflow-x-auto no-scrollbar">
                              <div className="flex items-start justify-between min-w-[340px] sm:min-w-0">
                                {trackerSteps.map((step, idx) => {
                                  const isDone = step.isDone;
                                  const isCurrent = step.isCurrent;

                                  return (
                                    <Fragment key={step.id}>
                                      <div className="flex flex-col items-center text-center shrink-0 w-24 sm:w-28 z-10">
                                        {/* Circle Icon */}
                                        <span
                                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all ${isDone
                                              ? isCompleted
                                                ? 'bg-[#059669] text-white'
                                                : 'bg-[#146BFF] text-white'
                                              : isCurrent
                                                ? 'border-2 border-[#146BFF] bg-white text-transparent'
                                                : 'border-2 border-slate-200 bg-white text-transparent'
                                            }`}
                                        >
                                          {isDone ? '✓' : ''}
                                        </span>

                                        {/* Step Label */}
                                        <span
                                          className={`mt-1.5 text-[10px] sm:text-[11px] font-bold leading-tight ${isDone
                                              ? 'text-zinc-900'
                                              : isCurrent
                                                ? 'text-zinc-700'
                                                : 'text-zinc-400'
                                            }`}
                                        >
                                          {step.label}
                                        </span>

                                        {/* Step Time & Date or Pending */}
                                        {isDone && step.time ? (
                                          <div className="mt-0.5 flex flex-col items-center">
                                            <span className="font-mono text-[9px] sm:text-[10px] font-semibold text-zinc-500 leading-tight">
                                              {step.time}
                                            </span>
                                            {step.date && (
                                              <span className="text-[8px] sm:text-[9px] text-zinc-400 leading-tight mt-0.5">
                                                {step.date}
                                              </span>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="text-[9px] sm:text-[10px] font-medium text-zinc-400 mt-0.5 leading-tight">
                                            Pending
                                          </span>
                                        )}
                                      </div>

                                      {/* Connecting Line */}
                                      {idx < trackerSteps.length - 1 && (
                                        <div
                                          className={`flex-1 border-t-2 mt-2.5 mx-1 sm:mx-2 min-w-[14px] ${trackerSteps[idx + 1].isDone
                                              ? isCompleted
                                                ? 'border-[#059669]'
                                                : 'border-[#146BFF]'
                                              : isDone && trackerSteps[idx + 1].isCurrent
                                                ? 'border-dashed border-[#60A5FA]'
                                                : 'border-dashed border-slate-200'
                                            }`}
                                        />
                                      )}
                                    </Fragment>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* RIGHT COLUMN: Options Menu + Fee + View Trip Button */}
                          <div className="border-l border-slate-100 pl-6 flex flex-col items-end justify-between w-44 shrink-0">
                            {/* Top: Desktop Options Menu */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(activeMenuId === b.id ? null : b.id);
                                }}
                                className="text-zinc-400 hover:text-black p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Options"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {activeMenuId === b.id && (
                                <>
                                  <div className="fixed inset-0 z-30" onClick={() => setActiveMenuId(null)} />
                                  <div
                                    className="absolute right-0 top-7 z-40 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 w-48 text-left text-xs space-y-1 animate-scale-in"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        const copyVal = b.booking_id || b.id;
                                        navigator.clipboard.writeText(copyVal);
                                        toast.success(`Booking ID copied: ${copyVal}`);
                                      }}
                                      className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-zinc-700 hover:bg-slate-50 font-medium transition-colors cursor-pointer"
                                    >
                                      <Copy className="w-3.5 h-3.5 text-zinc-400" />
                                      <span>Copy ID: {b.booking_id || b.id}</span>
                                    </button>

                                    {!isCompleted && !isCancelled && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveMenuId(null);
                                          setConfirmCancel(b.id);
                                        }}
                                        className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-medium transition-colors cursor-pointer"
                                      >
                                        <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                                        <span>Cancel Booking</span>
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Middle: Fee */}
                            <div className="text-right">
                              <div className="text-2xl sm:text-3xl font-black text-black tracking-tight leading-none">
                                ₹{b.total_price || (isCompleted ? 30 : 70)}
                              </div>
                              <div className="text-[11px] sm:text-xs text-zinc-400 font-semibold mt-1">
                                Assistance Fee
                              </div>
                            </div>

                            {/* Bottom: View Trip Button */}
                            <button
                              type="button"
                              onClick={() => {
                                try {
                                  if (b.id) sessionStorage.setItem(`booking_${b.id}`, JSON.stringify(b));
                                  if (b.booking_id) sessionStorage.setItem(`booking_${b.booking_id}`, JSON.stringify(b));
                                } catch (e) { }
                                navigate(`/booking/${b.id}`, { state: { booking: b } });
                              }}
                              className={`rounded-full font-bold text-xs px-5 py-2.5 flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-xs ${isPending
                                  ? 'bg-black hover:bg-zinc-800 text-white'
                                  : 'bg-white hover:bg-slate-50 text-zinc-900 border border-slate-200/90'
                                }`}
                            >
                              <span>View Trip</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* ── 4. 24/7 SUPPORT CARD ── */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#146BFF] flex items-center justify-center shrink-0 border border-blue-100">
                  <Headphones className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-zinc-900">Need help with a trip?</h4>
                  <p className="text-xs text-zinc-500">Our platform team is available 24/7 to assist your railway journey.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTab('support')}
                className="bg-black hover:bg-zinc-800 text-white font-bold px-6 py-2.5 rounded-full text-xs transition-all flex items-center gap-2 cursor-pointer shadow-xs shrink-0"
              >
                <span>Contact Support</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : tab === 'support' ? (
          <div className="animate-fade-in w-full">
            {supportView === 'home' && (
              <HelpCenter
                onNavigate={handleSupportNavigate}
                activeTrip={activeTripData}
                user={user}
                embeddedInDashboard={true}
              />
            )}
            {supportView === 'chat' && (
              <SupportAssistantChat
                onNavigate={handleSupportNavigate}
                activeTrip={activeTripData}
                user={user}
                preloadContext={supportParams.preloadContext}
                initialQuery={supportParams.initialQuery}
              />
            )}
            {supportView === 'tickets' && (
              <TicketTracking
                onNavigate={handleSupportNavigate}
                user={user}
              />
            )}
            {supportView === 'ticket_detail' && supportParams.ticketId && (
              <TicketDetailView
                onNavigate={handleSupportNavigate}
                ticketId={supportParams.ticketId}
                user={user}
              />
            )}
            {supportView === 'faq' && (
              <FaqView
                onNavigate={handleSupportNavigate}
                user={user}
                initialCategory={supportParams.category}
                initialQuery={supportParams.initialQuery}
              />
            )}
            {supportView === 'raise_ticket' && (
              <RaiseTicketView
                onNavigate={handleSupportNavigate}
                activeTrip={activeTripData}
                user={user}
                bookings={bookings}
                initialCategory={supportParams.category}
              />
            )}
          </div>
        ) : null}
      </main>

      {/* ── GLOBAL FOOTER ─────────────────────────────────────────── */}
      {!(tab === 'support' && supportView === 'chat') && (
        <Footer className={tab === 'book' ? 'pb-28 lg:pb-4.5' : ''} />
      )}

      {/* ── STICKY FLOATING MOBILE ACTION BAR & SUMMARY DRAWER (PHONE RESPONSIVE) ── */}
      {tab === 'book' && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3.5 shadow-[0_-8px_30px_rgb(0,0,0,0.08)]">
          <div className="max-w-md mx-auto flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setMobileSummaryOpen(!mobileSummaryOpen)}
              className="flex flex-col text-left cursor-pointer"
            >
              <div className="flex items-center gap-1 text-[11px] font-bold text-zinc-500">
                <span>Summary</span>
                <ChevronUp className={`w-3.5 h-3.5 transition-transform ${mobileSummaryOpen ? 'rotate-180' : ''}`} />
              </div>
              <span className="font-mono font-extrabold text-lg text-black">
                ₹{calculateTotal()}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (bookingStep < 4) {
                  handleNextStep(bookingStep + 1);
                } else {
                  handleConfirm();
                }
              }}
              className="bg-black hover:bg-zinc-800 text-white font-bold px-6 py-3 rounded-full text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>
                {bookingStep === 1
                  ? 'Next: Seat Details'
                  : bookingStep === 2
                    ? 'Next: Services'
                    : bookingStep === 3
                      ? 'Review Booking'
                      : 'Pay & Confirm'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Slide-Up Mobile Summary Drawer */}
      {mobileSummaryOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end animate-fade-in">
          <div className="bg-white rounded-t-3xl p-6 space-y-4 max-h-[85vh] overflow-y-auto animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-zinc-900">Booking Summary</h3>
                <p className="text-xs text-zinc-400">Journey &amp; assistance breakdown</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileSummaryOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-zinc-600 font-bold flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            {/* Mobile Summary Content */}
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl">
                <p className="font-bold text-zinc-900">
                  {selectedTrain ? `${selectedTrain.train_no} - ${selectedTrain.train_name}` : 'Select Train'}
                </p>
                <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                  Station: {station} · Date: {journeyDate || 'Not selected'}
                </p>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <p className="font-bold text-zinc-900">
                    {coach || seatNumber ? `Coach ${coach || '--'} · Seat ${seatNumber || '--'}` : 'Coach & Seat Not Entered'}
                  </p>
                  <p className="text-[11px] text-zinc-400">{coach || seatNumber ? `${berthType} Berth` : 'Enter in Step 2'}</p>
                </div>
                <span className="text-[11px] font-semibold text-blue-600 bg-blue-100/60 px-2.5 py-1 rounded-full">
                  {actionType === 'collect_from_seat' ? 'De-boarding' : 'Boarding'}
                </span>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <p className="font-bold text-zinc-900">Selected Services</p>
                {SERVICE_META.filter((s) => s.key === 'luggage' ? getLuggageTotalCount() > 0 : s.qty ? services[s.key] > 0 : services[s.key]).length === 0 ? (
                  <p className="text-xs text-zinc-400 italic">No services selected yet</p>
                ) : (
                  SERVICE_META.filter((s) => s.key === 'luggage' ? getLuggageTotalCount() > 0 : s.qty ? services[s.key] > 0 : services[s.key]).map((s) => (
                    <div key={s.key} className="flex justify-between text-zinc-600">
                      <span>
                        {s.label}{' '}
                        {s.key === 'luggage'
                          ? `(${getLuggageSummaryLabel()})`
                          : s.qty && services[s.key] > 1
                            ? `(${services[s.key]}x)`
                            : ''}
                      </span>
                      <span className="font-mono font-bold text-zinc-900">
                        ₹{s.key === 'luggage' ? getLuggageTotalCost() : s.qty ? s.price * services[s.key] : s.price}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3.5 bg-black text-white rounded-2xl flex items-center justify-between">
                <span className="font-bold">Total Amount Payable</span>
                <span className="font-mono font-extrabold text-xl">₹{calculateTotal()}</span>
              </div>

              {/* Security Row with Razorpay & Premium UPI/Mastercard Icons */}
              <div className="pt-2 flex items-center justify-between text-xs text-zinc-500 border-t border-slate-100">
                <div className="flex items-center gap-1.5 min-w-0">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-[11px] font-medium text-slate-500 truncate">
                    Secured Payments with <strong className="font-extrabold text-[#0C2340]">Razorpay</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Premium UPI Icon Badge */}
                  <div className="h-6 px-2 rounded-md bg-white border border-slate-200/90 shadow-2xs flex items-center gap-1" title="UPI">
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
                      <path d="M14.5 4L7.5 20h3.5l7-16h-3.5z" fill="#097939" />
                      <path d="M10.5 4L3.5 20h3.5l7-16h-3.5z" fill="#ED752E" />
                    </svg>
                    <span className="text-[10px] font-black italic tracking-tighter text-[#2E3192] leading-none font-sans">UPI</span>
                  </div>

                  {/* Premium Mastercard Icon Badge */}
                  <div className="h-6 px-2 rounded-md bg-white border border-slate-200/90 shadow-2xs flex items-center justify-center" title="Mastercard">
                    <svg className="w-5 h-3.5" viewBox="0 0 36 22" fill="none">
                      <circle cx="11" cy="11" r="9" fill="#EB001B" />
                      <circle cx="25" cy="11" r="9" fill="#F79E1B" />
                      <path d="M18 4.25a9 9 0 0 1 0 13.5 9 9 0 0 1 0-13.5z" fill="#FF5F00" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setMobileSummaryOpen(false);
                if (bookingStep < 4) handleNextStep(bookingStep + 1);
                else handleConfirm();
              }}
              className="w-full py-3.5 rounded-full bg-black text-white font-bold text-xs cursor-pointer shadow-md"
            >
              Continue to {bookingStep === 4 ? 'Payment' : `Step ${bookingStep + 1}`}
            </button>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <PaymentModal
        open={payOpen}
        total={calculateTotal()}
        onClose={() => {
          try {
            sessionStorage.removeItem('onecoolie_active_payment');
          } catch (e) { }
          setPayOpen(false);
        }}
        onPaid={handlePaid}
        bookingData={{
          bookingMode,
          pnrInput,
          pnrVerifiedData,
          selectedTrain,
          journeyDate,
          journeyTime,
          station,
          coach,
          seatNumber,
          berthType,
          actionType,
          services,
          luggageTotalCount: getLuggageTotalCount(),
          luggageCounts,
          luggageSummaryLabel: getLuggageSummaryLabel(),
        }}
      />

      {/* Booking Confirmed Success Modal */}
      {confirmedBooking && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in"
          onClick={() => setConfirmedBooking(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-[32px] p-6 sm:p-7 shadow-2xl animate-scale-in text-center text-zinc-900 relative overflow-hidden border border-slate-100/80"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Mint-Green Curved Decorative Background Overlay */}
            <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-[#e6f9f0] via-[#f0fbf5] to-transparent pointer-events-none -z-0" />

            {/* Animated Falling Green Confetti Papers */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden -z-0">
              <div className="absolute top-2 left-6 w-3 h-1.5 bg-[#10b981] rounded-sm opacity-80 animate-confetti-1" />
              <div className="absolute top-4 left-24 w-2 h-2 bg-[#a7f3d0] rounded-full opacity-70 animate-confetti-2" />
              <div className="absolute top-1 left-48 w-3.5 h-1.5 bg-[#059669] rounded-sm opacity-80 animate-confetti-3" />
              <div className="absolute top-3 left-72 w-2.5 h-2.5 bg-[#34d399] rounded-sm opacity-75 animate-confetti-4" />
              <div className="absolute top-5 right-12 w-3 h-1.5 bg-[#10b981] rounded-sm opacity-80 animate-confetti-5" />
              <div className="absolute top-2 right-28 w-2 h-2 bg-[#6ee7b7] rounded-full opacity-70 animate-confetti-2" />
              <div className="absolute top-6 right-44 w-3 h-1.5 bg-[#047857] rounded-sm opacity-75 animate-confetti-3" />
            </div>

            {/* Header Bar: Brand Logo & Close Button */}
            <div className="relative z-10 flex items-center justify-between mb-4">
              <Brand size="sm" />
              <button
                type="button"
                onClick={() => setConfirmedBooking(null)}
                className="w-8 h-8 rounded-full bg-slate-100/80 hover:bg-slate-200 text-zinc-600 font-bold flex items-center justify-center text-sm transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Centered Glowing Mint Circle Icon */}
            <div className="relative z-10 my-3">
              <div className="w-20 h-20 rounded-full bg-[#10b981] text-white flex items-center justify-center mx-auto shadow-[0_10px_25px_-5px_rgba(16,185,129,0.4)] ring-8 ring-[#10b981]/15 ring-offset-4 ring-offset-white">
                <Check className="w-10 h-10 stroke-[3.5]" />
              </div>
            </div>

            {/* Title & Subtitle */}
            <div className="relative z-10 space-y-1 mb-5">
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900">
                Booking <span className="text-[#059669]">Confirmed!</span>
              </h3>
              <p className="text-xs text-zinc-500 font-medium max-w-xs mx-auto leading-relaxed">
                Your station assistance request has been received and confirmed. We'll keep you updated.
              </p>
            </div>

            {/* Journey Summary Details Box */}
            <div className="relative z-10 bg-[#fbfcfd] border border-slate-200/60 rounded-2xl p-4 mb-5 text-left space-y-3 text-xs shadow-2xs">
              {/* Row 1: Booking ID */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-600">
                  <span className="w-6.5 h-6.5 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <FileText className="w-3.5 h-3.5" />
                  </span>
                  <span className="font-semibold text-zinc-600">Booking ID</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-zinc-900 font-mono text-xs select-all">
                    {confirmedBooking.booking_id || confirmedBooking.id}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const cleanId = confirmedBooking.booking_id || confirmedBooking.id;
                      navigator.clipboard.writeText(cleanId);
                      toast.success(`Booking ID copied: ${cleanId}`);
                    }}
                    className="text-blue-600 hover:text-blue-700 p-1 rounded-md hover:bg-blue-50 transition-colors cursor-pointer"
                    title="Copy Booking ID"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Row 2: Status */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                <div className="flex items-center gap-2 text-zinc-600">
                  <span className="w-6.5 h-6.5 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </span>
                  <span className="font-semibold text-zinc-600">Status</span>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#e6f9f0] text-[#059669] font-extrabold text-[10px] uppercase tracking-wider border border-[#a7f3d0]/50">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#059669]" />
                  </span>
                  CONFIRMED
                </span>
              </div>

              {/* Row 3: Train */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                <div className="flex items-center gap-2 text-zinc-600">
                  <span className="w-6.5 h-6.5 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Train className="w-3.5 h-3.5" />
                  </span>
                  <span className="font-semibold text-zinc-600">Train</span>
                </div>
                <span className="font-extrabold text-zinc-900 font-mono">
                  {confirmedBooking.train_no || selectedTrain?.train_no || '12615'} · Coach {coach || 'S4'} ({seatNumber || '12'})
                </span>
              </div>

              {/* Row 4: Station */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                <div className="flex items-center gap-2 text-zinc-600">
                  <span className="w-6.5 h-6.5 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <MapPin className="w-3.5 h-3.5" />
                  </span>
                  <span className="font-semibold text-zinc-600">Station</span>
                </div>
                <span className="font-bold text-zinc-900">
                  {station} · {STATIONS.find((st) => st.code === station)?.name || 'Kazipet Jn'}
                </span>
              </div>

              {/* Row 5: Journey Date */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                <div className="flex items-center gap-2 text-zinc-600">
                  <span className="w-6.5 h-6.5 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Calendar className="w-3.5 h-3.5" />
                  </span>
                  <span className="font-semibold text-zinc-600">Journey Date</span>
                </div>
                <span className="font-bold text-zinc-900">
                  {journeyDate ? new Date(journeyDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '03 Sep 2026'}
                </span>
              </div>

              {confirmedBooking.start_otp && (
                <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                  <div className="flex items-center gap-2 text-zinc-600">
                    <span className="w-6.5 h-6.5 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </span>
                    <span className="font-semibold text-zinc-600">Start OTP</span>
                  </div>
                  <span className="font-mono font-black text-xs tracking-widest text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200">
                    {confirmedBooking.start_otp}
                  </span>
                </div>
              )}
            </div>

            {/* Main Action Button: Track Assistant */}
            <button
              type="button"
              onClick={() => {
                const bookingData = confirmedBooking;
                const id = bookingData.id || bookingData.booking_id;
                try {
                  if (bookingData.id) sessionStorage.setItem(`booking_${bookingData.id}`, JSON.stringify(bookingData));
                  if (bookingData.booking_id) sessionStorage.setItem(`booking_${bookingData.booking_id}`, JSON.stringify(bookingData));
                } catch (e) { }
                setConfirmedBooking(null);
                navigate(`/booking/${id}`, { state: { booking: bookingData } });
              }}
              className="w-full bg-[#059669] hover:bg-[#047857] text-white font-black py-3.5 px-6 rounded-full text-sm shadow-lg shadow-[#059669]/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.98] mb-3"
            >
              <Navigation className="w-4 h-4 text-white" />
              <span>Track Assistant</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>

            {/* Secondary Button Row */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                type="button"
                onClick={() => {
                  const bookingData = confirmedBooking;
                  const id = bookingData.id || bookingData.booking_id;
                  try {
                    if (bookingData.id) sessionStorage.setItem(`booking_${bookingData.id}`, JSON.stringify(bookingData));
                    if (bookingData.booking_id) sessionStorage.setItem(`booking_${bookingData.booking_id}`, JSON.stringify(bookingData));
                  } catch (e) { }
                  setConfirmedBooking(null);
                  navigate(`/booking/${id}`, { state: { booking: bookingData } });
                }}
                className="py-2.5 px-3 rounded-full border border-slate-200/80 hover:bg-slate-50 text-zinc-800 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                <span>View Trip Details</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setConfirmedBooking(null);
                  setTab('trips');
                }}
                className="py-2.5 px-3 rounded-full border border-slate-200/80 hover:bg-slate-50 text-zinc-800 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Home className="w-3.5 h-3.5 text-zinc-500" />
                <span>Go to Home</span>
              </button>
            </div>

            {/* Footer Tagline */}
            <div className="pt-3 border-t border-slate-100/80 text-[11px] text-zinc-400 space-y-0.5">
              <div className="flex items-center justify-center gap-1.5 text-zinc-500 font-medium">
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                <span>Thank you for choosing OneCoolie!</span>
              </div>
              <p className="text-[10px] text-zinc-400">Making every journey easier.</p>
            </div>
          </div>
        </div>
      )}

      {/* Edit Booking Modal */}
      {editingBooking && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setEditingBooking(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl animate-scale-in text-left text-zinc-900 relative border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="font-bold text-lg text-zinc-900">Edit Journey Details</h3>
                <p className="text-xs text-zinc-500 font-mono">Booking ID: {editingBooking.booking_id || editingBooking.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-zinc-600 font-bold flex items-center justify-center text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">Coach Number</label>
                <input
                  type="text"
                  value={editCoach}
                  onChange={(e) => setEditCoach(e.target.value.toUpperCase())}
                  placeholder="e.g. S4, B2, A1"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold uppercase text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">Seat / Berth Number</label>
                <input
                  type="text"
                  value={editSeat}
                  onChange={(e) => setEditSeat(e.target.value.toUpperCase())}
                  placeholder="e.g. 12 LB, 45 SU"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold uppercase text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">Berth Position</label>
                <select
                  value={editBerth}
                  onChange={(e) => setEditBerth(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="Lower">Lower Berth (LB)</option>
                  <option value="Middle">Middle Berth (MB)</option>
                  <option value="Upper">Upper Berth (UB)</option>
                  <option value="Side Lower">Side Lower (SL)</option>
                  <option value="Side Upper">Side Upper (SU)</option>
                  <option value="Window">Window Seat (CC)</option>
                  <option value="Aisle">Aisle Seat (CC)</option>
                  <option value="Cabin">First AC Cabin</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100 mt-6">
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                className="px-5 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-zinc-700 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editLoading}
                onClick={async () => {
                  if (!editCoach.trim() || !editSeat.trim()) {
                    return toast.error('Coach and Seat number are required.');
                  }
                  setEditLoading(true);
                  try {
                    await axios.put(`/bookings/${editingBooking.id}`, {
                      coach: editCoach.trim(),
                      seat_number: editSeat.trim(),
                      berth_type: editBerth
                    });
                    toast.success('Booking details updated!');
                    setEditingBooking(null);
                    fetchBookings();
                  } catch (err) {
                    toast.error(err.response?.data?.message || 'Update failed');
                  } finally {
                    setEditLoading(false);
                  }
                }}
                className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(confirmCancel)}
        title="Cancel Assistance Booking"
        message="Are you sure you want to cancel this station assistance request? Your allocated assistant will be released back to the platform pool."
        confirmText="Yes, Cancel Booking"
        cancelText="Keep Booking"
        onConfirm={doCancel}
        onCancel={() => setConfirmCancel(null)}
      />
    </div>
  );
}