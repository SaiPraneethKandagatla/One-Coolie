import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Brand from '../components/Brand';
import LaunchCenter from '../components/LaunchCenter';
import SupportInbox from '../components/support/SupportInbox';
import { getTickets, subscribeToSupportUpdates } from '../utils/supportStore';
import axios from '../api/axios';
import toast, { Toaster } from 'react-hot-toast';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Shield, Train, User, Clock, AlertTriangle, CheckCircle, XCircle, Search, Filter,
  Download, RefreshCw, Eye, Phone, Mail, MapPin, CreditCard, ChevronRight, TrendingUp,
  Users, Check, X, ExternalLink, Printer, Key, Briefcase, Calendar, Info, Layers,
  Compass, ArrowUpRight, CheckSquare, Power, ToggleLeft, ToggleRight,
  ShieldCheck, FileText, Activity, DollarSign, ShieldAlert, AlertOctagon, RotateCcw,
  Headphones, LifeBuoy
} from 'lucide-react';

/* ============================================================
   ONECOOLIE ENTERPRISE ADMIN OPERATIONS COMMAND CENTER
   Swiss Minimal Typography: Black (#000000), White (#FFFFFF), Blue (#2563EB)
   ============================================================ */

const STATIONS = [
  { code: 'SC', name: 'Secunderabad Jn' },
  { code: 'BZA', name: 'Vijayawada Jn' },
  { code: 'KZJ', name: 'Kazipet Jn' },
  { code: 'WL', name: 'Warangal' },
];

const STATUS_COLORS = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
  accepted: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
  arriving: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800',
  in_service: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
};

const PAYMENT_COLORS = {
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  refunded: 'bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300',
  failed: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
};

// ----------------------------------------------------------------------
// SUBCOMPONENT: BOOKING DETAIL MODAL (FULL VISIBILITY & CONTROL)
// ----------------------------------------------------------------------
function BookingDetailModal({ booking, onClose, onUpdate, assistants = [] }) {
  // Local state to reflect live changes instantly
  const [currentBooking, setCurrentBooking] = useState(booking);
  const [selectedAssistant, setSelectedAssistant] = useState(booking?.assistant_id || '');
  const [actionLoading, setActionLoading] = useState(false);

  // Synchronize when the booking prop updates
  useEffect(() => {
    setCurrentBooking(booking);
    setSelectedAssistant(booking?.assistant_id || '');
  }, [booking]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!currentBooking) return null;

  const handleStatusChange = async (newStatus) => {
    try {
      setActionLoading(true);
      const updated = await onUpdate(currentBooking.id, { booking_status: newStatus });
      if (updated) {
        setCurrentBooking(updated);
      } else {
        setCurrentBooking(prev => ({ ...prev, booking_status: newStatus }));
      }
      toast.success(`Booking status updated to ${newStatus.toUpperCase()}`);
    } catch (err) {
      console.error('Status update error:', err);
      toast.error('Failed to update booking status');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePaymentChange = async (newPaymentStatus) => {
    try {
      setActionLoading(true);
      const updated = await onUpdate(currentBooking.id, { payment_status: newPaymentStatus });
      if (updated) {
        setCurrentBooking(updated);
      } else {
        setCurrentBooking(prev => ({ ...prev, payment_status: newPaymentStatus }));
      }
      toast.success(`Payment marked as ${newPaymentStatus.toUpperCase()}`);
    } catch (err) {
      console.error('Payment update error:', err);
      toast.error('Failed to update payment status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssistantReassign = async () => {
    try {
      setActionLoading(true);
      const assistantIdToAssign = selectedAssistant || null;
      const updated = await onUpdate(currentBooking.id, { assistant_id: assistantIdToAssign });
      if (updated) {
        setCurrentBooking(updated);
      }
      toast.success(assistantIdToAssign ? 'Sahayak assigned successfully' : 'Sahayak assignment removed');
    } catch (err) {
      console.error('Assistant assignment error:', err);
      toast.error('Failed to reassign assistant');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveSOS = async () => {
    try {
      setActionLoading(true);
      const updated = await onUpdate(currentBooking.id, { sos_triggered: false });
      if (updated) {
        setCurrentBooking(updated);
      } else {
        setCurrentBooking(prev => ({ ...prev, sos_triggered: false }));
      }
      toast.success('Emergency alert marked as resolved');
    } catch (err) {
      console.error('SOS resolve error:', err);
      toast.error('Failed to resolve SOS');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrintSlip = () => {
    window.print();
  };

  const services = currentBooking.services || {};
  const luggageCount = typeof services.luggage === 'number' ? services.luggage : (services.luggage ? 1 : 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in cursor-pointer"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto cursor-default"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs font-mono">
              RM
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-mono font-bold text-base text-black dark:text-white">
                  Booking #{currentBooking.booking_id || currentBooking.id?.slice(-8).toUpperCase()}
                </h3>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[currentBooking.booking_status] || 'border-zinc-300'}`}>
                  {currentBooking.booking_status}
                </span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${PAYMENT_COLORS[currentBooking.payment_status] || 'bg-zinc-100'}`}>
                  {currentBooking.payment_status}
                </span>
                {currentBooking.sos_triggered && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-red-600 text-white animate-pulse flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> SOS ACTIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">
                Created: {new Date(currentBooking.created_at).toLocaleString()} · Station: <strong className="text-black dark:text-white">{currentBooking.station_code}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintSlip}
              title="Print Dispatch Slip"
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              title="Close modal"
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-6 overflow-y-auto space-y-6 flex-1 text-xs">

          {/* Grid of 3 Dossier Cards */}
          <div className="grid md:grid-cols-3 gap-4">

            {/* 1. Passenger Dossier */}
            <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-zinc-400 font-bold uppercase tracking-wider font-mono text-[10px]">
                <User className="w-3.5 h-3.5 text-blue-600" /> Passenger Dossier
              </div>
              <div>
                <p className="font-bold text-sm text-black dark:text-white">
                  {currentBooking.passenger?.name || 'Guest Passenger'}
                </p>
                <p className="text-zinc-500 font-mono mt-0.5">{currentBooking.passenger?.email || '—'}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Phone className="w-3 h-3 text-emerald-600" />
                  {currentBooking.passenger?.phone ? (
                    <a href={`tel:${currentBooking.passenger.phone}`} className="font-mono text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                      {currentBooking.passenger.phone}
                    </a>
                  ) : (
                    <span className="text-zinc-400 italic">No phone logged</span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-400 font-mono mt-2 truncate">
                  User ID: {currentBooking.passenger_id}
                </p>
              </div>
            </div>

            {/* 2. Sahayak (Assistant) Dossier */}
            <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-zinc-400 font-bold uppercase tracking-wider font-mono text-[10px]">
                <Briefcase className="w-3.5 h-3.5 text-blue-600" /> Assigned Sahayak
              </div>
              {currentBooking.assistant ? (
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm text-black dark:text-white">
                      {currentBooking.assistant.name}
                    </p>
                    <span className={`w-2 h-2 rounded-full ${currentBooking.assistant.is_online ? 'bg-emerald-500 ring-2 ring-emerald-300' : 'bg-zinc-400'}`} />
                  </div>
                  <p className="text-zinc-500 font-mono mt-0.5">{currentBooking.assistant.email || '—'}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Phone className="w-3 h-3 text-emerald-600" />
                    {currentBooking.assistant.phone ? (
                      <a href={`tel:${currentBooking.assistant.phone}`} className="font-mono text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                        {currentBooking.assistant.phone}
                      </a>
                    ) : (
                      <span className="text-zinc-400 italic">No phone logged</span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-500 font-mono mt-1">
                    Hub: <strong>{currentBooking.assistant.station_code || currentBooking.station_code}</strong> · Assistant ID: #{currentBooking.assistant_id?.slice(-6).toUpperCase()}
                  </p>
                </div>
              ) : (
                <div className="text-zinc-400 py-2 italic font-mono text-[11px]">
                  No assistant currently assigned to this mission.
                </div>
              )}

              {/* Reassignment Dropdown */}
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
                <select
                  value={selectedAssistant}
                  onChange={(e) => setSelectedAssistant(e.target.value)}
                  className="input-base text-[11px] py-1 px-2 flex-1 h-8 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                >
                  <option value="">-- Unassign Sahayak --</option>
                  {assistants.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.station_code}) {a.is_online ? '• Online' : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAssistantReassign}
                  disabled={actionLoading}
                  className="btn-primary text-[11px] py-1 px-3 h-8 cursor-pointer disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>

            {/* 3. Security & OTP Dossier */}
            <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-zinc-400 font-bold uppercase tracking-wider font-mono text-[10px]">
                <Key className="w-3.5 h-3.5 text-blue-600" /> Handshake Security & OTP
              </div>
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-black text-white dark:bg-white dark:text-black flex items-center justify-between shadow-xs">
                  <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-400 dark:text-zinc-600">Secret Start OTP</span>
                  <span className="text-lg font-mono font-black tracking-widest text-blue-400 dark:text-blue-600">
                    {currentBooking.start_otp || '------'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">Verification Status:</span>
                  <span className={`font-bold font-mono ${currentBooking.start_otp_verified ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {currentBooking.start_otp_verified ? '✓ Verified by Sahayak' : '⏳ Awaiting Handshake'}
                  </span>
                </div>
                {currentBooking.service_started_at && (
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                    <span>Started:</span>
                    <span>{new Date(currentBooking.service_started_at).toLocaleTimeString()}</span>
                  </div>
                )}
                {currentBooking.completed_at && (
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                    <span>Completed:</span>
                    <span>{new Date(currentBooking.completed_at).toLocaleTimeString()}</span>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Train & Journey Telemetry Section */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Train className="w-4 h-4 text-blue-600" />
                <h4 className="font-bold text-sm text-black dark:text-white">
                  Train Transit & Coach Telemetry Specifications
                </h4>
              </div>
              <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2.5 py-1 rounded-md">
                PNR: {currentBooking.pnr || currentBooking.services?.pnr || 'NOT LOGGED'}
              </span>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 font-mono">
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg">
                <span className="text-[10px] text-zinc-400 uppercase block">Train Number & Name</span>
                <span className="font-bold text-black dark:text-white text-xs">
                  {currentBooking.train_no || currentBooking.train_number}
                </span>
                <p className="text-[11px] text-zinc-500 truncate">{currentBooking.train_name}</p>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg">
                <span className="text-[10px] text-zinc-400 uppercase block">Station & Platform</span>
                <span className="font-bold text-black dark:text-white text-xs">
                  {currentBooking.station_code} {currentBooking.platform ? `· Platform ${currentBooking.platform}` : ''}
                </span>
                <p className="text-[11px] text-zinc-500 truncate">
                  {currentBooking.source ? `${currentBooking.source} ➔ ${currentBooking.destination || currentBooking.station_code}` : 'Direct Station Assistance'}
                </p>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg">
                <span className="text-[10px] text-zinc-400 uppercase block">Coach & Seat Location</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 text-xs">
                  Coach {currentBooking.coach || 'TBD'} · Seat {currentBooking.seat_number || 'TBD'}
                </span>
                <p className="text-[11px] text-zinc-500 truncate">{currentBooking.berth_type || 'General Berth'}</p>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg">
                <span className="text-[10px] text-zinc-400 uppercase block">Mission Action Type</span>
                <span className="font-bold text-black dark:text-white text-xs">
                  {currentBooking.action_type === 'collect_from_seat' ? 'De-boarding (Coach Door)' : 'Boarding (Load into Seat)'}
                </span>
                <p className="text-[11px] text-zinc-500">
                  {currentBooking.journey_date} {currentBooking.journey_time ? `· ${currentBooking.journey_time}` : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Itemized Services & Financial Audit */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Services Breakdown */}
            <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-blue-600" /> Itemized Luggage & Services
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1.5 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-600 dark:text-zinc-300">🧳 Luggage Item Assistance</span>
                  <span className="font-mono font-bold text-black dark:text-white">
                    {luggageCount} item(s) {luggageCount > 0 ? `(₹${luggageCount * 30})` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-600 dark:text-zinc-300">🚶 Seat Escort & Navigation</span>
                  <span className="font-mono font-bold text-black dark:text-white">
                    {services.escort ? 'Yes (₹60)' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-600 dark:text-zinc-300">♿ Wheelchair & Senior Transit</span>
                  <span className="font-mono font-bold text-black dark:text-white">
                    {services.wheelchair ? 'Yes (₹80)' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-600 dark:text-zinc-300">🍱 Snacks & Bottled Water Delivery</span>
                  <span className="font-mono font-bold text-black dark:text-white">
                    {services.snacks ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-600 dark:text-zinc-300">🛺 Exit Transport / Taxi Escort</span>
                  <span className="font-mono font-bold text-black dark:text-white">
                    {services.transport ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-zinc-600 dark:text-zinc-300">🗣️ Language Translation Support</span>
                  <span className="font-mono font-bold text-black dark:text-white">
                    {services.language ? 'Yes' : 'No'}
                  </span>
                </div>
                {currentBooking.service_description && (
                  <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-lg text-[11px] text-zinc-500 font-mono mt-2 border border-zinc-200 dark:border-zinc-800">
                    Note: {currentBooking.service_description}
                  </div>
                )}
              </div>
            </div>

            {/* Financial & Payment Audit */}
            <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
              <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5 text-blue-600" /> Financial Audit & Settlement
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Gross Tariff:</span>
                  <span className="text-2xl font-black font-mono text-black dark:text-white">
                    ₹{currentBooking.total_price}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Payment Method:</span>
                  <span className="font-bold uppercase font-mono text-black dark:text-white">
                    {currentBooking.payment_method || 'UPI / QR'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-zinc-500">Txn / Payment ID:</span>
                  <span className="text-zinc-400 truncate max-w-[200px]">
                    {currentBooking.payment_id || 'PENDING-AUTH'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Payment Status:</span>
                  <span className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] ${PAYMENT_COLORS[currentBooking.payment_status]}`}>
                    {currentBooking.payment_status}
                  </span>
                </div>

                {/* Admin Quick Payment Override */}
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase block">Admin Payment Override:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handlePaymentChange('paid')}
                      disabled={actionLoading || currentBooking.payment_status === 'paid'}
                      className="btn-secondary text-[10px] py-1.5 px-2.5 flex-1 bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 cursor-pointer disabled:opacity-50"
                    >
                      Mark Paid
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePaymentChange('refunded')}
                      disabled={actionLoading || currentBooking.payment_status === 'refunded'}
                      className="btn-secondary text-[10px] py-1.5 px-2.5 flex-1 bg-zinc-100 text-zinc-700 border-zinc-300 hover:bg-zinc-200 cursor-pointer disabled:opacity-50"
                    >
                      Mark Refunded
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePaymentChange('pending')}
                      disabled={actionLoading || currentBooking.payment_status === 'pending'}
                      className="btn-secondary text-[10px] py-1.5 px-2.5 flex-1 bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 cursor-pointer disabled:opacity-50"
                    >
                      Mark Pending
                    </button>
                  </div>
                </div>

                {currentBooking.rating && (
                  <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg text-xs border border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] text-zinc-400 uppercase font-mono block">Passenger Rating:</span>
                    <p className="font-bold text-amber-500">★ {currentBooking.rating} / 5</p>
                    {currentBooking.review && <p className="text-zinc-500 italic mt-1 font-sans">"{currentBooking.review}"</p>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SOS Resolution Banner if triggered */}
          {currentBooking.sos_triggered && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 animate-bounce" />
                <div>
                  <h5 className="font-bold text-red-800 dark:text-red-300 text-xs uppercase font-mono">
                    Emergency Alert Active on this Booking
                  </h5>
                  <p className="text-red-600 dark:text-red-400 text-[11px]">
                    Triggered at: {currentBooking.sos_triggered_at ? new Date(currentBooking.sos_triggered_at).toLocaleTimeString() : 'Recent'} · Station: {currentBooking.station_code}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleResolveSOS}
                disabled={actionLoading}
                className="btn-primary bg-red-600 hover:bg-red-700 text-white text-xs py-1.5 px-4 cursor-pointer disabled:opacity-50"
              >
                Mark Emergency Resolved
              </button>
            </div>
          )}

          {/* Status Intervention Control */}
          <div className="p-4 bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h5 className="font-bold text-xs uppercase font-mono text-black dark:text-white">
                Admin Lifecycle State Intervention
              </h5>
              <p className="text-[11px] text-zinc-500">
                Current status: <strong className="text-blue-600 uppercase">{currentBooking.booking_status}</strong>. Click any button below to update:
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {['pending', 'accepted', 'arriving', 'in_service', 'completed', 'cancelled'].map((st) => {
                const isCurrent = currentBooking.booking_status === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleStatusChange(st)}
                    disabled={actionLoading || isCurrent}
                    className={`text-[10px] font-bold uppercase font-mono px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${isCurrent
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs cursor-default'
                        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700 hover:border-black dark:hover:border-white hover:bg-zinc-50'
                      }`}
                  >
                    {isCurrent ? `✓ ${st}` : st}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex justify-between items-center text-xs">
          <span className="font-mono text-[10px] text-zinc-400">
            Audit ID: {currentBooking.id}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="btn-secondary text-xs py-1.5 px-4 cursor-pointer font-bold"
          >
            Close Inspector
          </button>
        </div>

      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// SUBCOMPONENT: KYC QUEUE CARD
// ----------------------------------------------------------------------
function KycQueueCard({ applicant, onDecide, actionLoading }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
          {applicant.name?.charAt(0).toUpperCase()}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-sm text-black dark:text-white">
              {applicant.name}
            </h4>
            <span className="badge-blue text-[10px]">
              KYC Awaiting Review
            </span>
          </div>

          <p className="text-xs text-zinc-500 font-mono mt-0.5">
            {applicant.email} · Phone: <strong className="text-black dark:text-white">{applicant.phone || 'N/A'}</strong> · Hub:{' '}
            <strong className="text-blue-600 dark:text-blue-400">
              {applicant.station_code}
            </strong>
          </p>
          <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
            Applied: {new Date(applicant.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        <button
          type="button"
          disabled={actionLoading}
          onClick={() => onDecide(applicant.id, 'approve')}
          className="btn-primary flex-1 sm:flex-none py-2 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
        >
          Approve Assistant
        </button>
        <button
          type="button"
          disabled={actionLoading}
          onClick={() => onDecide(applicant.id, 'reject')}
          className="btn-secondary flex-1 sm:flex-none py-2 px-4 text-xs text-rose-600 hover:bg-rose-50 cursor-pointer disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// SUBCOMPONENT: SETTLEMENT CONFIRMATION MODAL (PHASE 4 MANUAL SETTLEMENT)
// ----------------------------------------------------------------------
function SettlementConfirmModal({ payout, onClose, onConfirm, actionLoading }) {
  const [method, setMethod] = useState(payout?.payout_method || 'bank_transfer');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (payout) {
      setMethod(payout.payout_method || 'bank_transfer');
      setReference(`IMPS-${Date.now().toString().slice(-8)}`);
      setDate(new Date().toISOString().slice(0, 10));
      setNotes('');
      setFormError('');
    }
  }, [payout]);

  if (!payout) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reference || reference.trim().length < 3) {
      setFormError('Settlement reference must be at least 3 characters.');
      return;
    }
    setFormError('');
    onConfirm({
      payout_reference: reference.trim(),
      payout_method: method,
      settlement_date: date,
      settlement_notes: notes.trim() || undefined
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in cursor-pointer"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 my-auto cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs font-mono">
              ₹
            </span>
            <div>
              <h3 className="font-bold text-sm text-black dark:text-white font-mono">
                Confirm Manual Payout Settlement
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono">
                Payout ID #{payout.id?.slice(0, 8)} · Sahayak: {payout.assistant?.name || 'Partner'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-black dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 flex justify-between items-center font-mono">
          <span className="text-xs text-zinc-500">Total Disbursement:</span>
          <span className="text-lg font-bold text-emerald-600">₹{payout.amount}</span>
        </div>

        {formError && (
          <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200 text-xs font-mono">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs font-mono">
          <div>
            <label className="block text-zinc-500 mb-1">Disbursement Channel / Method *</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full py-2 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-black dark:text-white font-mono"
            >
              <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
              <option value="imps">IMPS Instant Transfer</option>
              <option value="upi">UPI Instant Payout</option>
              <option value="neft">NEFT Standard Settlement</option>
              <option value="cash">Direct Cash Disbursement</option>
              <option value="other">Other Manual Settlement</option>
            </select>
          </div>

          <div>
            <label className="block text-zinc-500 mb-1">Bank / UTR / Reference Number *</label>
            <input
              type="text"
              required
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. UTR4928172901 or UPI-129381"
              className="w-full py-2 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-black dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-zinc-500 mb-1">Settlement Date *</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full py-2 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-black dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-zinc-500 mb-1">Audit / Settlement Notes (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for internal ledger audit..."
              className="w-full py-2 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-black dark:text-white font-mono resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={actionLoading}
              className="btn-secondary py-2 px-4 text-xs font-mono"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="btn-primary py-2 px-4 text-xs font-mono bg-emerald-600 hover:bg-emerald-700"
            >
              {actionLoading ? 'Recording Settlement...' : 'Confirm & Finalize Paid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// SUBCOMPONENT: FINANCIAL INCIDENT DETAIL & RESOLUTION MODAL (PHASE 5)
// ----------------------------------------------------------------------
function IncidentDetailModal({ incident, onClose, onInvestigate, onResolve, onIgnore, actionLoading }) {
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [ignoreReason, setIgnoreReason] = useState('');
  const [activeAction, setActiveAction] = useState('view'); // 'view' | 'resolve' | 'ignore'
  const [errorMsg, setErrorMsg] = useState('');

  if (!incident) return null;

  const handleResolveSubmit = (e) => {
    e.preventDefault();
    if (!resolutionNotes || resolutionNotes.trim().length < 5) {
      setErrorMsg('Resolution notes must be at least 5 characters long.');
      return;
    }
    setErrorMsg('');
    onResolve(incident.id, resolutionNotes.trim());
  };

  const handleIgnoreSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    onIgnore(incident.id, ignoreReason.trim() || undefined);
  };

  const severityBadgeClass =
    incident.severity === 'critical'
      ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
      : incident.severity === 'warning'
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-300 dark:border-blue-800';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in cursor-pointer"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 my-auto cursor-default font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-xs">
              <ShieldAlert className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-sm text-black dark:text-white">
                Financial Incident #{incident.id?.slice(0, 8)}
              </h3>
              <p className="text-[11px] text-zinc-400">
                Rule: {incident.incident_type}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-black dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Severity and Status Pills */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${severityBadgeClass}`}>
              {incident.severity}
            </span>
            <span className="px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              Status: {incident.status}
            </span>
          </div>
          <span className="text-[11px] text-zinc-400">
            Occurrences: <strong className="text-black dark:text-white">{incident.occurrence_count || 1}</strong>
          </span>
        </div>

        {/* Details Card */}
        <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-zinc-500">Entity:</span>
            <span className="font-bold text-black dark:text-white">
              {incident.entity_type} {incident.entity_id ? `(#${incident.entity_id.slice(0, 8)})` : ''}
            </span>
          </div>
          {incident.user_id && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Target User:</span>
              <span className="text-black dark:text-white">#{incident.user_id.slice(0, 8)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-zinc-500">Detected At:</span>
            <span className="text-zinc-400">{new Date(incident.detected_at).toLocaleString()}</span>
          </div>
          {incident.resolved_at && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Resolved At:</span>
              <span className="text-emerald-600 font-bold">{new Date(incident.resolved_at).toLocaleString()}</span>
            </div>
          )}
          {incident.resolution_notes && (
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <span className="text-zinc-500 block mb-0.5">Resolution Notes:</span>
              <p className="text-zinc-700 dark:text-zinc-300 italic">{incident.resolution_notes}</p>
            </div>
          )}
        </div>

        {/* Metadata JSON */}
        {incident.metadata && Object.keys(incident.metadata).length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-zinc-400">Forensic Metadata</span>
            <pre className="p-2.5 bg-zinc-900 text-zinc-300 text-[11px] rounded-lg overflow-x-auto max-h-36">
              {JSON.stringify(incident.metadata, null, 2)}
            </pre>
          </div>
        )}

        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Action Views */}
        {activeAction === 'view' && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            {incident.status === 'open' && (
              <button
                type="button"
                onClick={() => onInvestigate(incident.id)}
                disabled={actionLoading}
                className="btn-secondary py-1.5 px-3 text-xs flex-1 cursor-pointer"
              >
                Mark Investigating
              </button>
            )}
            {(incident.status === 'open' || incident.status === 'investigating') && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveAction('resolve')}
                  disabled={actionLoading}
                  className="btn-primary py-1.5 px-3 text-xs flex-1 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  Resolve...
                </button>
                <button
                  type="button"
                  onClick={() => setActiveAction('ignore')}
                  disabled={actionLoading}
                  className="btn-secondary py-1.5 px-3 text-xs text-zinc-400 hover:text-rose-500 cursor-pointer"
                >
                  Ignore...
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary py-1.5 px-3 text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        )}

        {activeAction === 'resolve' && (
          <form onSubmit={handleResolveSubmit} className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
            <div>
              <label className="block text-zinc-500 mb-1">Resolution Audit Notes (Min 5 chars) *</label>
              <textarea
                required
                rows={3}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Explain the investigative findings and operational remediation taken..."
                className="w-full py-2 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-black dark:text-white resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveAction('view')}
                disabled={actionLoading}
                className="btn-secondary py-1.5 px-3 text-xs cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="btn-primary py-1.5 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                {actionLoading ? 'Saving...' : 'Confirm Resolution'}
              </button>
            </div>
          </form>
        )}

        {activeAction === 'ignore' && (
          <form onSubmit={handleIgnoreSubmit} className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
            <div>
              <label className="block text-zinc-500 mb-1">Reason for Ignoring (Optional)</label>
              <input
                type="text"
                value={ignoreReason}
                onChange={(e) => setIgnoreReason(e.target.value)}
                placeholder="e.g. Expected test load or customer confirmed transaction..."
                className="w-full py-2 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-black dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveAction('view')}
                disabled={actionLoading}
                className="btn-secondary py-1.5 px-3 text-xs cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="btn-secondary py-1.5 px-3 text-xs text-rose-600 border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
              >
                {actionLoading ? 'Saving...' : 'Confirm Ignore'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// MAIN EXPORT: ADMIN DASHBOARD
// ----------------------------------------------------------------------
export default function AdminDashboard() {
  const { user, logout } = useAuth();

  // Navigation tabs: 'bookings' | 'overview' | 'finance' | 'payouts' | 'assistants' | 'passengers' | 'sos'
  const [activeTab, setActiveTab] = useState('bookings');

  // Finance & Reconciliation States (Phase 4)
  const [reconReport, setReconReport] = useState(null);
  const [reconLoading, setReconLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditFilter, setAuditFilter] = useState('ALL');
  const [settlementModalPayout, setSettlementModalPayout] = useState(null);

  // Financial Incidents & Production Hardening States (Phase 5)
  const [incidentsList, setIncidentsList] = useState([]);
  const [incidentStats, setIncidentStats] = useState({ total: 0, open: 0, investigating: 0, critical: 0, warning: 0 });
  const [incidentsFilter, setIncidentsFilter] = useState('ALL');
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [financialHealth, setFinancialHealth] = useState(null);
  const [paymentRecoveryList, setPaymentRecoveryList] = useState([]);

  // Support Tickets Integration
  const [supportTicketCount, setSupportTicketCount] = useState(0);

  // Station Desk & Support Tickets State
  const [supportTickets, setSupportTickets] = useState([]);
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStationFilter, setTicketStationFilter] = useState('ALL');
  const [ticketStatusFilter, setTicketStatusFilter] = useState('ALL');
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState('ALL');
  const [ticketUpdatingId, setTicketUpdatingId] = useState(null);

  useEffect(() => {
    const updateCount = () => {
      try {
        const all = getTickets();
        const open = all.filter(t => ['open', 'in_progress', 'bot_escalated'].includes(t.status)).length;
        setSupportTicketCount(open);
      } catch (e) {}
    };
    updateCount();
    const unsub = subscribeToSupportUpdates(updateCount);
    return () => unsub?.();
  }, []);

  // Core Data States
  const [stats, setStats] = useState({
    totalBookings: 0,
    pendingAssistants: 0,
    totalAssistants: 0,
    onlineAssistants: 0,
    totalPassengers: 0,
    revenue: 0,
    todayRevenue: 0,
    todayBookings: 0,
    activeSOS: 0,
    statusBreakdown: {},
    stationStats: [],
    paymentMap: {},
  });
  const [bookings, setBookings] = useState([]);
  const [kycQueue, setKycQueue] = useState([]);
  const [assistantsList, setAssistantsList] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [sosAlerts, setSosAlerts] = useState([]);
  const [payoutsList, setPayoutsList] = useState([]);
  const [payoutsFilter, setPayoutsFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState(new Date());

  // Filter States for Master Ledger
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedStation, setSelectedStation] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('ALL');
  const [selectedDateRange, setSelectedDateRange] = useState('ALL');

  // Selected Booking for Detail Inspector
  const [inspectingBooking, setInspectingBooking] = useState(null);
  const inspectingBookingRef = useRef(null);
  inspectingBookingRef.current = inspectingBooking;

  const handleCloseInspector = useCallback(() => {
    inspectingBookingRef.current = null;
    setInspectingBooking(null);
  }, []);

  const [actionLoading, setActionLoading] = useState(false);

  // Pagination for Master Ledger
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;

  // --------------------------------------------------
  // DATA FETCHING
  // --------------------------------------------------
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [sRes, pRes, bRes, aRes, uRes, sosRes, payRes, incRes, incStatRes, healthRes, recovRes, tRes] = await Promise.all([
        axios.get('/admin/stats').catch(() => ({ data: {} })),
        axios.get('/admin/pending-assistants').catch(() => ({ data: [] })),
        axios.get('/admin/bookings').catch(() => ({ data: [] })),
        axios.get('/admin/assistants').catch(() => ({ data: [] })),
        axios.get('/admin/users').catch(() => ({ data: [] })),
        axios.get('/admin/sos-alerts').catch(() => ({ data: [] })),
        axios.get('/admin/payouts').catch(() => ({ data: { payouts: [] } })),
        axios.get('/admin/incidents').catch(() => ({ data: { incidents: [] } })),
        axios.get('/admin/incidents/stats').catch(() => ({ data: {} })),
        axios.get('/admin/finance/health').catch(() => ({ data: { health: null } })),
        axios.get('/admin/finance/payment-recovery').catch(() => ({ data: { stuck_payments: [] } })),
        axios.get('/admin/support-tickets').catch(() => ({ data: [] })),
      ]);

      setStats(sRes.data || {});
      setKycQueue(pRes.data || []);
      setBookings(bRes.data || []);
      setAssistantsList(aRes.data || []);
      setUsersList(uRes.data || []);
      setSosAlerts(sosRes.data || []);
      setPayoutsList(payRes.data?.payouts || payRes.data || []);
      setIncidentsList(incRes.data?.incidents || []);
      setIncidentStats(incStatRes.data || { total: 0, open: 0, investigating: 0, critical: 0, warning: 0 });
      setFinancialHealth(healthRes.data?.health || null);
      setPaymentRecoveryList(recovRes.data?.stuck_payments || []);
      setSupportTickets(tRes.data || []);
      setLastSynced(new Date());

      // If inspecting a booking, sync it with newest data
      if (inspectingBookingRef.current) {
        const updated = (bRes.data || []).find((b) => b.id === inspectingBookingRef.current?.id);
        if (updated && inspectingBookingRef.current) {
          setInspectingBooking(updated);
        }
      }
    } catch (err) {
      console.error('ADMIN REFRESH ERROR:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Polling and Socket Integration (Rapid 3-Second Live Telemetry Sync)
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 3000);

    if (window.socket) {
      window.socket.emit('join_admin');
      const handleLiveEvent = () => fetchAll();
      window.socket.on('sos_alert', handleLiveEvent);
      window.socket.on('status_update', handleLiveEvent);
      window.socket.on('new_booking', handleLiveEvent);
      window.socket.on('financial_incident_created', handleLiveEvent);
      window.socket.on('financial_incident_updated', handleLiveEvent);

      return () => {
        clearInterval(interval);
        window.socket.off('sos_alert', handleLiveEvent);
        window.socket.off('status_update', handleLiveEvent);
        window.socket.off('new_booking', handleLiveEvent);
        window.socket.off('financial_incident_created', handleLiveEvent);
        window.socket.off('financial_incident_updated', handleLiveEvent);
      };
    }

    return () => clearInterval(interval);
  }, [fetchAll]);

  // --------------------------------------------------
  // ADMIN INTERVENTIONS
  // --------------------------------------------------
  const handleDecideAssistant = async (id, action, reason) => {
    try {
      setActionLoading(true);
      if (action === 'approve') {
        await axios.post(`/admin/assistants/${id}/approve`);
        toast.success('Assistant approved successfully!');
      } else {
        await axios.post(`/admin/assistants/${id}/reject`, { reason });
        toast.success('Assistant application rejected');
      }
      await fetchAll();
    } catch (err) {
      console.error('DECIDE ERROR:', err);
      toast.error('Action failed. Please check permissions.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAssistantOnline = async (assistant) => {
    try {
      const nextOnline = !assistant.is_online;
      await axios.patch(`/admin/users/${assistant.id}`, { is_online: nextOnline });
      toast.success(`${assistant.name} marked ${nextOnline ? 'ONLINE (On-Duty)' : 'OFFLINE'}`);
      await fetchAll();
    } catch (err) {
      console.error('Toggle online error:', err);
      toast.error('Failed to update duty status');
    }
  };

  const handleToggleAssistantApproval = async (assistant) => {
    try {
      const nextApproval = !assistant.is_approved;
      await axios.patch(`/admin/users/${assistant.id}`, { is_approved: nextApproval });
      toast.success(`${assistant.name} ${nextApproval ? 'Approved' : 'Suspended'}`);
      await fetchAll();
    } catch (err) {
      console.error('Toggle approval error:', err);
      toast.error('Failed to update assistant approval');
    }
  };

  // ── Payout Management Handlers (Phase 3B) ────────
  const handleApprovePayout = async (payoutId) => {
    try {
      setActionLoading(true);
      await axios.post(`/admin/payouts/${payoutId}/approve`);
      toast.success('Payout request approved.');
      await fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve payout.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectPayout = async (payoutId) => {
    const reason = window.prompt('Enter reason for rejecting this payout:', 'Insufficient account details or administrative review');
    if (reason === null) return;
    try {
      setActionLoading(true);
      await axios.post(`/admin/payouts/${payoutId}/reject`, { reason });
      toast.success('Payout rejected. Earnings returned to available balance.');
      await fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject payout.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleProcessingPayout = async (payoutId) => {
    try {
      setActionLoading(true);
      await axios.post(`/admin/payouts/${payoutId}/processing`);
      toast.success('Payout moved to processing.');
      await fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update payout.');
    } finally {
      setActionLoading(false);
    }
  };

  const fetchReconciliation = useCallback(async () => {
    try {
      setReconLoading(true);
      const [rRes, aRes] = await Promise.all([
        axios.get('/admin/finance/reconciliation').catch(() => ({ data: { report: null } })),
        axios.get('/admin/finance/audit-logs').catch(() => ({ data: { logs: [] } }))
      ]);
      if (rRes.data?.report) setReconReport(rRes.data.report);
      if (aRes.data?.logs) setAuditLogs(aRes.data.logs);
    } catch (err) {
      console.error('FETCH RECON ERROR:', err);
    } finally {
      setReconLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'finance') {
      fetchReconciliation();
    }
  }, [activeTab, fetchReconciliation]);

  const handlePaidPayout = (payoutOrId) => {
    const p = typeof payoutOrId === 'object' ? payoutOrId : payoutsList.find(item => item.id === payoutOrId);
    if (p) {
      setSettlementModalPayout(p);
    }
  };

  const handleConfirmSettlement = async (settlementData) => {
    if (!settlementModalPayout) return;
    try {
      setActionLoading(true);
      await axios.post(`/admin/payouts/${settlementModalPayout.id}/paid`, settlementData);
      toast.success('Payout marked as PAID. Earnings permanently finalized.');
      setSettlementModalPayout(null);
      await fetchAll();
      if (activeTab === 'finance') {
        await fetchReconciliation();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to finalize payout settlement.';
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFailedPayout = async (payoutId) => {
    const reason = window.prompt('Enter failure reason:', 'Bank network transaction timeout');
    if (reason === null) return;
    try {
      setActionLoading(true);
      await axios.post(`/admin/payouts/${payoutId}/failed`, { failure_reason: reason });
      toast.success('Payout marked as failed. Unreversed earnings returned to available.');
      await fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark payout failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleInvestigateIncident = async (incidentId) => {
    try {
      setActionLoading(true);
      await axios.post(`/admin/incidents/${incidentId}/investigate`);
      toast.success('Incident status updated to investigating.');
      await fetchAll();
      if (selectedIncident?.id === incidentId) {
        setSelectedIncident((prev) => (prev ? { ...prev, status: 'investigating' } : null));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update incident status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveIncident = async (incidentId, notes) => {
    try {
      setActionLoading(true);
      await axios.post(`/admin/incidents/${incidentId}/resolve`, { resolution_notes: notes });
      toast.success('Incident resolved successfully.');
      setSelectedIncident(null);
      await fetchAll();
      if (activeTab === 'finance') await fetchReconciliation();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resolve incident.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleIgnoreIncident = async (incidentId, reason) => {
    try {
      setActionLoading(true);
      await axios.post(`/admin/incidents/${incidentId}/ignore`, { reason });
      toast.success('Incident status updated to ignored.');
      setSelectedIncident(null);
      await fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to ignore incident.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateBooking = async (bookingId, payload) => {
    const { data } = await axios.patch(`/admin/bookings/${bookingId}`, payload);
    // Optimistically update inspecting modal
    setInspectingBooking(data);
    // Optimistically update bookings list
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? data : b)));
    // Refresh background data
    fetchAll();
    return data;
  };

  const handleResolveEmergency = async (bookingId) => {
    try {
      await axios.post(`/admin/sos-alerts/${bookingId}/resolve`);
      toast.success('Emergency alert resolved and cleared');
      await fetchAll();
    } catch (err) {
      console.error('RESOLVE SOS ERROR:', err);
      toast.error('Failed to resolve SOS alert');
    }
  };

  // Update Support Ticket Status
  const handleUpdateTicketStatus = async (ticketId, newStatus, resolutionNotes = '') => {
    try {
      setTicketUpdatingId(ticketId);
      const { data } = await axios.patch(`/admin/support-tickets/${ticketId}`, {
        status: newStatus,
        resolution_notes: resolutionNotes,
      });
      setSupportTickets((prev) => prev.map((t) => (t.id === ticketId ? data : t)));
      toast.success(`Ticket #${ticketId} status updated to ${newStatus}`);
    } catch (err) {
      console.error('Update ticket error:', err);
      toast.error('Failed to update ticket status');
    } finally {
      setTicketUpdatingId(null);
    }
  };

  const handleFilterToAssistant = (assistantName) => {
    setActiveTab('bookings');
    setFilterQuery(assistantName);
    setSelectedStation('ALL');
    setSelectedStatus('ALL');
    setSelectedPaymentStatus('ALL');
  };

  const handleFilterToPassenger = (passengerQuery) => {
    setActiveTab('bookings');
    setFilterQuery(passengerQuery);
    setSelectedStation('ALL');
    setSelectedStatus('ALL');
    setSelectedPaymentStatus('ALL');
  };

  // --------------------------------------------------
  // CSV EXPORTER (FULL LEDGER WITH ALL SPECIFICATIONS)
  // --------------------------------------------------
  const exportFullLedgerCSV = () => {
    try {
      const headers = [
        'Booking ID',
        'Created At',
        'Passenger Name',
        'Passenger Email',
        'Passenger Phone',
        'Train Number',
        'Train Name',
        'Station Code',
        'Platform',
        'Coach',
        'Seat Number',
        'Berth Type',
        'Action Type',
        'PNR',
        'Luggage Count',
        'Total Amount (INR)',
        'Payment Status',
        'Payment Method',
        'Payment ID',
        'Booking Status',
        'Start OTP',
        'OTP Verified',
        'Assigned Assistant',
        'Assistant Phone',
        'Rating',
      ];

      const rows = bookings.map((b) => [
        `"${b.booking_id || b.id}"`,
        `"${b.created_at || ''}"`,
        `"${b.passenger?.name || ''}"`,
        `"${b.passenger?.email || ''}"`,
        `"${b.passenger?.phone || ''}"`,
        `"${b.train_no || b.train_number || ''}"`,
        `"${b.train_name || ''}"`,
        `"${b.station_code || ''}"`,
        `"${b.platform || b.services?.platform || ''}"`,
        `"${b.coach || b.services?.coach || ''}"`,
        `"${b.seat_number || b.services?.seat_number || ''}"`,
        `"${b.berth_type || b.services?.berth_type || ''}"`,
        `"${b.action_type || b.services?.action_type || ''}"`,
        `"${b.pnr || b.services?.pnr || ''}"`,
        `"${b.services?.luggage || 0}"`,
        `"${b.total_price || 0}"`,
        `"${b.payment_status || ''}"`,
        `"${b.payment_method || ''}"`,
        `"${b.payment_id || ''}"`,
        `"${b.booking_status || ''}"`,
        `"${b.start_otp || ''}"`,
        `"${b.start_otp_verified ? 'YES' : 'NO'}"`,
        `"${b.assistant?.name || 'Unassigned'}"`,
        `"${b.assistant?.phone || ''}"`,
        `"${b.rating || ''}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `OneCoolie-MasterLedger-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      toast.success('Master booking ledger exported to CSV!');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export CSV');
    }
  };

  // --------------------------------------------------
  // STRICT CHRONOLOGICAL SORTING (Newest Bookings Always First)
  // --------------------------------------------------
  const sortedBookings = useMemo(() => {
    return [...bookings].sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA; // Descending: latest booking at index 0
    });
  }, [bookings]);

  // --------------------------------------------------
  // ENHANCED MULTI-FORMAT SEARCH & FILTERING LOGIC
  // --------------------------------------------------
  const filteredBookings = useMemo(() => {
    return sortedBookings.filter((b) => {
      // 1. Universal Search Query
      if (filterQuery && filterQuery.trim()) {
        const rawQ = filterQuery.trim().toLowerCase();
        const cleanQ = rawQ.replace(/^#/, '');

        const fullId = String(b.id || '').toLowerCase();
        const bookingId = String(b.booking_id || '').toLowerCase();
        const shortId6 = fullId.slice(-6);
        const shortId8 = fullId.slice(-8);
        const startId8 = fullId.slice(0, 8);
        const pName = String(b.passenger?.name || '').toLowerCase();
        const pEmail = String(b.passenger?.email || '').toLowerCase();
        const pPhone = String(b.passenger?.phone || '').toLowerCase();
        const pId = String(b.passenger_id || '').toLowerCase();
        const tNo = String(b.train_no || b.train_number || '').toLowerCase();
        const tName = String(b.train_name || '').toLowerCase();
        const pnr = String(b.pnr || b.services?.pnr || '').toLowerCase();
        const aName = String(b.assistant?.name || '').toLowerCase();
        const coach = String(b.coach || b.services?.coach || '').toLowerCase();
        const seat = String(b.seat_number || b.services?.seat_number || '').toLowerCase();

        const matchesQuery = (
          fullId.includes(cleanQ) ||
          bookingId.includes(cleanQ) ||
          shortId6.includes(cleanQ) ||
          shortId8.includes(cleanQ) ||
          startId8.includes(cleanQ) ||
          pName.includes(rawQ) ||
          pEmail.includes(rawQ) ||
          pPhone.includes(rawQ) ||
          pId.includes(cleanQ) ||
          tNo.includes(cleanQ) ||
          tName.includes(rawQ) ||
          pnr.includes(cleanQ) ||
          aName.includes(rawQ) ||
          coach.includes(cleanQ) ||
          seat.includes(cleanQ)
        );

        if (!matchesQuery) return false;

        // If explicitly searching for an ID, PNR, or phone, bypass other dropdowns so the target is never filtered out:
        const isTargetIdentifier = cleanQ.length >= 3 && (
          fullId.includes(cleanQ) ||
          bookingId.includes(cleanQ) ||
          shortId6.includes(cleanQ) ||
          shortId8.includes(cleanQ) ||
          pnr.includes(cleanQ) ||
          pPhone.includes(rawQ)
        );

        if (isTargetIdentifier) {
          return true;
        }
      }

      // 2. Station Filter
      if (selectedStation !== 'ALL' && b.station_code !== selectedStation) return false;

      // 3. Booking Status Filter
      if (selectedStatus !== 'ALL' && b.booking_status !== selectedStatus) return false;

      // 4. Payment Status Filter
      if (selectedPaymentStatus !== 'ALL' && b.payment_status !== selectedPaymentStatus) return false;

      // 5. Date Range Filter
      if (selectedDateRange === 'TODAY') {
        const todayStr = new Date().toISOString().slice(0, 10);
        if (!b.created_at?.startsWith(todayStr)) return false;
      } else if (selectedDateRange === 'WEEK') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        if (new Date(b.created_at) < sevenDaysAgo) return false;
      }

      return true;
    });
  }, [sortedBookings, selectedStation, selectedStatus, selectedPaymentStatus, selectedDateRange, filterQuery]);

  // Paginated bookings
  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredBookings.slice(start, start + rowsPerPage);
  }, [filteredBookings, currentPage]);

  const totalPages = Math.ceil(filteredBookings.length / rowsPerPage) || 1;

  // Chart Data Preparation
  const stationChartData = useMemo(() => {
    return (stats.stationStats || []).map((s) => ({
      name: s.station,
      Bookings: s.bookings,
      Revenue: s.revenue,
    }));
  }, [stats.stationStats]);

  const statusChartData = useMemo(() => {
    const sb = stats.statusBreakdown || {};
    return Object.entries(sb).map(([k, v]) => ({
      name: k.toUpperCase(),
      count: v,
    }));
  }, [stats.statusBreakdown]);

  // Support Tickets Filtered
  const filteredSupportTickets = useMemo(() => {
    return supportTickets.filter((t) => {
      if (ticketStationFilter !== 'ALL' && t.station !== ticketStationFilter) return false;
      if (ticketStatusFilter !== 'ALL' && t.status !== ticketStatusFilter) return false;
      if (ticketPriorityFilter !== 'ALL' && t.priority !== ticketPriorityFilter) return false;
      if (ticketSearch) {
        const q = ticketSearch.toLowerCase();
        const matches =
          (t.id && t.id.toLowerCase().includes(q)) ||
          (t.pnr && t.pnr.toLowerCase().includes(q)) ||
          (t.assistant_name && t.assistant_name.toLowerCase().includes(q)) ||
          (t.desc && t.desc.toLowerCase().includes(q)) ||
          (t.category && t.category.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [supportTickets, ticketStationFilter, ticketStatusFilter, ticketPriorityFilter, ticketSearch]);

  const pendingTicketsCount = useMemo(() => {
    return supportTickets.filter((t) => t.status === 'Dispatched to Station Supervisor').length;
  }, [supportTickets]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-black dark:text-white font-sans flex flex-col">
      {/* Toast feedback provider */}
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />

      {/* ── COMMAND TOPBAR ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-black text-white border-b border-zinc-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <Brand dark sub="Operations Hub" />
            <div className="hidden md:flex items-center gap-2 pl-3 border-l border-zinc-800 text-xs font-mono text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>SCR Telemetry Active</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Sync Timestamp */}
            <span className="text-[11px] font-mono text-zinc-400 hidden lg:inline-block">
              Synced: {lastSynced.toLocaleTimeString()}
            </span>

            {/* Manual Refresh */}
            <button
              type="button"
              onClick={() => {
                fetchAll();
                toast.success('Live data synchronized');
              }}
              title="Force Refresh Data"
              className="p-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Full CSV Export */}
            <button
              type="button"
              onClick={exportFullLedgerCSV}
              className="btn-secondary text-xs py-1.5 px-3 bg-zinc-900 text-white border-zinc-700 hover:bg-zinc-800 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Ledger</span>
            </button>

            {/* Admin Profile & Sign Out */}
            <div className="flex items-center gap-3 pl-3 border-l border-zinc-800">
              <span className="text-xs font-mono text-zinc-300 font-semibold hidden sm:inline-block">
                {user?.name || 'Administrator'}
              </span>
              <button
                type="button"
                onClick={logout}
                className="text-xs font-bold text-rose-400 hover:text-white transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex overflow-x-auto gap-2 border-t border-zinc-900 text-xs font-mono">
          {[
            { id: 'bookings', label: 'Master Bookings Ledger', icon: Layers, count: bookings.length },
            { id: 'overview', label: 'Operations & Analytics', icon: TrendingUp },
            { id: 'finance', label: 'Finance & Reconciliation', icon: ShieldCheck, alert: reconReport?.health?.critical_issues > 0 ? reconReport.health.critical_issues : undefined },
            { id: 'incidents', label: 'Financial Incidents', icon: ShieldAlert, alert: incidentStats.critical > 0 ? incidentStats.critical : undefined, badge: incidentStats.open > 0 ? incidentStats.open : undefined },
            { id: 'support_tickets', label: 'Station Desk & Support', icon: LifeBuoy, count: supportTickets.length, badge: pendingTicketsCount > 0 ? pendingTicketsCount : (supportTicketCount > 0 ? supportTicketCount : undefined) },
            { id: 'launch', label: 'Launch Center', icon: Activity },
            { id: 'payouts', label: 'Sahayak Payouts', icon: CreditCard, badge: payoutsList.filter(p => p.status === 'requested').length },
            { id: 'assistants', label: 'Sahayak Force & KYC', icon: Briefcase, badge: kycQueue.length },
            { id: 'passengers', label: 'Passengers Directory', icon: Users, count: usersList.length },
            { id: 'sos', label: 'Emergency Incident SOS', icon: AlertTriangle, alert: sosAlerts.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-4 border-b-2 font-semibold flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${isActive
                    ? 'border-blue-500 text-white bg-zinc-900/50'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
              >
                <Icon className={`w-3.5 h-3.5 ${tab.alert ? 'text-red-500 animate-pulse' : ''}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-[10px] text-zinc-300 font-mono">
                    {tab.count}
                  </span>
                )}
                {tab.badge > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-[10px] text-white font-mono">
                    {tab.badge}
                  </span>
                )}
                {tab.alert > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-[10px] text-white font-mono animate-pulse">
                    {tab.alert} SOS
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER ─────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">

        {/* ── ACTIVE EMERGENCY SOS TICKER ─────────────────────── */}
        {sosAlerts.length > 0 && (
          <div className="bg-red-600 text-white rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-scale-in">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-white animate-ping" />
              <div>
                <h4 className="font-bold text-sm uppercase font-mono tracking-wider">
                  Urgent SOS Emergencies Active ({sosAlerts.length})
                </h4>
                <p className="text-xs text-red-100 font-mono">
                  Immediate passenger assistance required across platform transit nodes.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('sos')}
              className="btn-secondary py-1.5 px-4 text-xs bg-white text-red-700 border-white hover:bg-red-50 font-bold cursor-pointer"
            >
              Open Emergency Center ➔
            </button>
          </div>
        )}

        {/* ========================================================
            TAB 1: MASTER BOOKINGS LEDGER
            ======================================================== */}
        {activeTab === 'bookings' && (
          <div className="space-y-4 animate-fade-in">

            {/* Filter and Search Panel */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-black dark:text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-blue-600" />
                    All Bookings Master Ledger
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Access 100% of telemetry, coach, seat, PNR, secret start OTP, and passenger/assistant details.
                  </p>
                </div>

                {/* Universal Search Input */}
                <div className="w-full md:w-80 relative">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by ID, passenger, phone, train, PNR..."
                    value={filterQuery}
                    onChange={(e) => {
                      setFilterQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="input-base text-xs pl-9 pr-3 py-2.5 w-full bg-zinc-50 dark:bg-zinc-950 border-zinc-300 dark:border-zinc-700"
                  />
                  {filterQuery && (
                    <button
                      type="button"
                      onClick={() => setFilterQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black dark:hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Multi-Filter Controls */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs">

                {/* Station Filter */}
                <div>
                  <label className="text-[10px] uppercase font-mono text-zinc-400 font-bold block mb-1">
                    Station Hub
                  </label>
                  <select
                    value={selectedStation}
                    onChange={(e) => {
                      setSelectedStation(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="input-base text-xs py-1.5 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                  >
                    <option value="ALL">All Hubs (SC, BZA, KZJ, WL)</option>
                    {STATIONS.map((st) => (
                      <option key={st.code} value={st.code}>
                        {st.code} - {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Booking Status Filter */}
                <div>
                  <label className="text-[10px] uppercase font-mono text-zinc-400 font-bold block mb-1">
                    Booking Status
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => {
                      setSelectedStatus(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="input-base text-xs py-1.5 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="pending">Pending Handshake</option>
                    <option value="accepted">Accepted by Sahayak</option>
                    <option value="arriving">Assistant Arriving</option>
                    <option value="in_service">In Service (OTP Verified)</option>
                    <option value="completed">Mission Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {/* Payment Status Filter */}
                <div>
                  <label className="text-[10px] uppercase font-mono text-zinc-400 font-bold block mb-1">
                    Settlement Status
                  </label>
                  <select
                    value={selectedPaymentStatus}
                    onChange={(e) => {
                      setSelectedPaymentStatus(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="input-base text-xs py-1.5 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                  >
                    <option value="ALL">All Settlements</option>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="refunded">Refunded</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                {/* Date Filter */}
                <div>
                  <label className="text-[10px] uppercase font-mono text-zinc-400 font-bold block mb-1">
                    Date Window
                  </label>
                  <select
                    value={selectedDateRange}
                    onChange={(e) => {
                      setSelectedDateRange(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="input-base text-xs py-1.5 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                  >
                    <option value="ALL">All Time</option>
                    <option value="TODAY">Today Only</option>
                    <option value="WEEK">Last 7 Days</option>
                  </select>
                </div>

              </div>

              {/* Status Bar */}
              <div className="flex items-center justify-between text-xs text-zinc-500 font-mono pt-1">
                <span>
                  Showing {filteredBookings.length} matching missions · Total Value: ₹
                  {filteredBookings.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0)}
                </span>
                {(selectedStation !== 'ALL' || selectedStatus !== 'ALL' || selectedPaymentStatus !== 'ALL' || selectedDateRange !== 'ALL' || filterQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStation('ALL');
                      setSelectedStatus('ALL');
                      setSelectedPaymentStatus('ALL');
                      setSelectedDateRange('ALL');
                      setFilterQuery('');
                      toast.success('Filters cleared');
                    }}
                    className="text-blue-600 dark:text-blue-400 hover:underline text-[11px] font-bold cursor-pointer"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            </div>

            {/* Master Table */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-400 font-mono">
                      <th className="py-3 px-4 font-bold">Booking / ID</th>
                      <th className="py-3 px-4 font-bold">Passenger Details</th>
                      <th className="py-3 px-4 font-bold">Train & PNR</th>
                      <th className="py-3 px-4 font-bold">Hub & Location</th>
                      <th className="py-3 px-4 font-bold">Coach / Seat</th>
                      <th className="py-3 px-4 font-bold">Tariff & Pay</th>
                      <th className="py-3 px-4 font-bold">Status</th>
                      <th className="py-3 px-4 font-bold">Sahayak</th>
                      <th className="py-3 px-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {paginatedBookings.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-zinc-400 font-mono">
                          No matching records found for the selected criteria.
                        </td>
                      </tr>
                    ) : (
                      paginatedBookings.map((b) => (
                        <tr
                          key={b.id}
                          className="hover:bg-blue-50/40 dark:hover:bg-zinc-800/40 transition-colors group cursor-pointer"
                          onClick={() => setInspectingBooking(b)}
                        >
                          {/* 1. ID */}
                          <td className="py-3 px-4 font-mono font-semibold">
                            <span className="text-blue-600 dark:text-blue-400 font-bold block">
                              #{b.booking_id || b.id?.slice(-8).toUpperCase()}
                            </span>
                            {b.booking_id && b.id && (
                              <span className="block text-[9px] text-zinc-400 font-mono">
                                Ref: #{b.id.slice(-8).toUpperCase()}
                              </span>
                            )}
                            <span className="block text-[10px] text-zinc-400 font-normal">
                              {b.created_at ? new Date(b.created_at).toLocaleDateString() : ''} {b.created_at ? new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </td>

                          {/* 2. Passenger */}
                          <td className="py-3 px-4">
                            <p className="font-bold text-black dark:text-white">
                              {b.passenger?.name || 'Guest'}
                            </p>
                            <p className="text-[11px] text-zinc-500 font-mono">
                              {b.passenger?.phone || b.passenger?.email || '—'}
                            </p>
                          </td>

                          {/* 3. Train & PNR */}
                          <td className="py-3 px-4 font-mono">
                            <span className="font-bold text-black dark:text-white">
                              {b.train_no || b.train_number}
                            </span>
                            <span className="block text-[10px] text-zinc-500 truncate max-w-[140px]">
                              {b.train_name}
                            </span>
                            {b.pnr && (
                              <span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-1 py-0.2 rounded font-bold">
                                PNR: {b.pnr}
                              </span>
                            )}
                          </td>

                          {/* 4. Station & Platform */}
                          <td className="py-3 px-4 font-mono">
                            <span className="font-bold text-blue-600 dark:text-blue-400">
                              {b.station_code}
                            </span>
                            {b.platform && (
                              <span className="block text-[10px] text-zinc-500">
                                Pf {b.platform}
                              </span>
                            )}
                          </td>

                          {/* 5. Coach & Seat */}
                          <td className="py-3 px-4 font-mono">
                            <span className="font-bold text-black dark:text-white">
                              {b.coach || 'TBD'} - {b.seat_number || 'TBD'}
                            </span>
                            <span className="block text-[10px] text-zinc-500">
                              {b.action_type === 'collect_from_seat' ? 'De-board' : 'Board'}
                            </span>
                          </td>

                          {/* 6. Tariff & Payment */}
                          <td className="py-3 px-4 font-mono">
                            <span className="font-bold text-black dark:text-white">
                              ₹{b.total_price}
                            </span>
                            <span className={`block text-[9px] font-bold uppercase mt-0.5 px-1.5 py-0.2 rounded w-fit ${PAYMENT_COLORS[b.payment_status]}`}>
                              {b.payment_status}
                            </span>
                          </td>

                          {/* 7. Status */}
                          <td className="py-3 px-4">
                            <span className={`text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded-full border ${STATUS_COLORS[b.booking_status] || 'border-zinc-300'}`}>
                              {b.booking_status}
                            </span>
                            {b.sos_triggered && (
                              <span className="block text-[9px] font-bold text-red-600 animate-pulse mt-0.5">
                                ⚠ SOS ALERT
                              </span>
                            )}
                          </td>

                          {/* 8. Assistant */}
                          <td className="py-3 px-4">
                            {b.assistant?.name ? (
                              <div>
                                <p className="font-bold text-black dark:text-white truncate max-w-[120px]">
                                  {b.assistant.name}
                                </p>
                                <span className="text-[10px] text-zinc-500 font-mono">
                                  {b.assistant.phone || 'Assigned'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-zinc-400 italic font-mono">
                                Unassigned
                              </span>
                            )}
                          </td>

                          {/* 9. Action Button */}
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setInspectingBooking(b)}
                              className="btn-secondary py-1 px-2.5 text-[11px] flex items-center gap-1 ml-auto group-hover:border-blue-500 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-600" />
                              <span>Inspect</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="px-6 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-500">
                    Page {currentPage} of {totalPages} ({filteredBookings.length} total)
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="btn-secondary py-1 px-3 text-xs disabled:opacity-40 cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="btn-secondary py-1 px-3 text-xs disabled:opacity-40 cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ========================================================
            TAB 2: OPERATIONS & ANALYTICS
            ======================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">

            {/* 6 Top Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Total Bookings', value: stats.totalBookings, sub: 'All recorded jobs', action: () => { setActiveTab('bookings'); setSelectedStatus('ALL'); } },
                { label: 'Gross Revenue', value: `₹${stats.revenue || 0}`, sub: 'Settled payments', action: () => { setActiveTab('bookings'); setSelectedPaymentStatus('paid'); } },
                { label: "Today's Volume", value: stats.todayBookings || 0, sub: `₹${stats.todayRevenue || 0} today`, action: () => { setActiveTab('bookings'); setSelectedDateRange('TODAY'); } },
                { label: 'Active in Field', value: (stats.statusBreakdown?.in_service || 0) + (stats.statusBreakdown?.arriving || 0), sub: 'Live transit', action: () => { setActiveTab('bookings'); setSelectedStatus('in_service'); } },
                { label: 'Sahayaks Force', value: `${stats.onlineAssistants || 0} / ${stats.totalAssistants || 0}`, sub: 'Online / Total', action: () => setActiveTab('assistants') },
                { label: 'KYC Queue', value: stats.pendingAssistants || 0, sub: 'Awaiting ID review', action: () => setActiveTab('assistants') },
              ].map((m) => (
                <div
                  key={m.label}
                  onClick={m.action}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs hover:border-blue-500 cursor-pointer transition-colors group"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono block mb-1 group-hover:text-blue-600">
                    {m.label}
                  </span>
                  <p className="text-2xl font-black font-mono text-black dark:text-white">
                    {m.value}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
                    {m.sub}
                  </p>
                </div>
              ))}
            </div>

            {/* Recharts Analytics Grid */}
            <div className="grid md:grid-cols-2 gap-6">

              {/* Station Traffic & Revenue */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-3">
                <h4 className="font-bold text-sm text-black dark:text-white font-mono flex items-center justify-between">
                  <span>Station Demand & Volume</span>
                  <span className="text-xs text-zinc-400 font-normal">Click a bar to filter</span>
                </h4>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stationChartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} />
                      <YAxis stroke="#888888" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#000000',
                          borderColor: '#333333',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '12px',
                        }}
                      />
                      <Bar
                        dataKey="Bookings"
                        fill="#2563EB"
                        radius={[4, 4, 0, 0]}
                        onClick={(entry) => {
                          if (entry?.name) {
                            setSelectedStation(entry.name);
                            setActiveTab('bookings');
                            toast.success(`Filtered to Station ${entry.name}`);
                          }
                        }}
                        className="cursor-pointer"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Status Breakdown Bar */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-3">
                <h4 className="font-bold text-sm text-black dark:text-white font-mono flex items-center justify-between">
                  <span>Mission Status Distribution</span>
                  <span className="text-xs text-zinc-400 font-normal">Live platform states</span>
                </h4>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis type="number" stroke="#888888" fontSize={11} tickLine={false} />
                      <YAxis dataKey="name" type="category" stroke="#888888" fontSize={10} tickLine={false} width={80} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#000000',
                          borderColor: '#333333',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '12px',
                        }}
                      />
                      <Bar
                        dataKey="count"
                        fill="#10B981"
                        radius={[0, 4, 4, 0]}
                        onClick={(entry) => {
                          if (entry?.name) {
                            setSelectedStatus(entry.name.toLowerCase());
                            setActiveTab('bookings');
                            toast.success(`Filtered to status ${entry.name}`);
                          }
                        }}
                        className="cursor-pointer"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ========================================================
            TAB 3: ASSISTANT FORCE & KYC
            ======================================================== */}
        {activeTab === 'assistants' && (
          <div className="space-y-6 animate-fade-in">

            {/* KYC Applications Queue */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-black dark:text-white flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-blue-600" />
                    Sahayak KYC Verification Queue
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Review and verify incoming railway porter applicants before platform activation.
                  </p>
                </div>
                <span className="badge-blue text-xs">
                  {kycQueue.length} Pending
                </span>
              </div>

              {kycQueue.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center text-xs text-zinc-400 font-mono">
                  KYC queue is clear. No pending applicant registrations.
                </div>
              ) : (
                <div className="space-y-3">
                  {kycQueue.map((app) => (
                    <KycQueueCard
                      key={app.id}
                      applicant={app}
                      onDecide={handleDecideAssistant}
                      actionLoading={actionLoading}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Active Assistants Roster with Action Controls */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-black dark:text-white">
                    Registered Sahayak Fleet ({assistantsList.length})
                  </h4>
                  <p className="text-xs text-zinc-500">
                    Manage active assistants across Secunderabad, Vijayawada, Kazipet, and Warangal hubs.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-400 font-mono">
                      <th className="pb-3">Sahayak Name</th>
                      <th className="pb-3">Station Hub</th>
                      <th className="pb-3">Contact</th>
                      <th className="pb-3">Approval Status</th>
                      <th className="pb-3">Duty State</th>
                      <th className="pb-3">Missions</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-mono">
                    {assistantsList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-zinc-400 font-mono">
                          No registered assistants found.
                        </td>
                      </tr>
                    ) : (
                      assistantsList.map((ast) => (
                        <tr key={ast.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                          <td className="py-3 font-bold text-black dark:text-white font-sans">
                            {ast.name}
                          </td>
                          <td className="py-3 font-bold text-blue-600 dark:text-blue-400">
                            {ast.station_code}
                          </td>
                          <td className="py-3 text-zinc-500">
                            {ast.phone || ast.email}
                          </td>
                          <td className="py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ast.is_approved ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800'}`}>
                              {ast.is_approved ? 'Approved' : 'Pending'}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className="flex items-center gap-1.5 text-[11px]">
                              <span className={`w-2 h-2 rounded-full ${ast.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
                              {ast.is_online ? 'Online (On-Duty)' : 'Offline'}
                            </span>
                          </td>
                          <td className="py-3 font-bold">
                            {ast.completed_missions || 0} trips
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Toggle duty status button */}
                              <button
                                type="button"
                                onClick={() => handleToggleAssistantOnline(ast)}
                                title={ast.is_online ? 'Set Offline' : 'Set Online'}
                                className={`p-1.5 rounded-md border text-[11px] font-bold cursor-pointer transition-colors ${ast.is_online
                                    ? 'bg-zinc-100 text-zinc-700 border-zinc-300 hover:bg-zinc-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                  }`}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>

                              {/* Toggle approval status button */}
                              <button
                                type="button"
                                onClick={() => handleToggleAssistantApproval(ast)}
                                title={ast.is_approved ? 'Suspend Assistant' : 'Approve Assistant'}
                                className={`p-1.5 rounded-md border text-[11px] font-bold cursor-pointer transition-colors ${ast.is_approved
                                    ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                                    : 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
                                  }`}
                              >
                                {ast.is_approved ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                              </button>

                              {/* Filter to assistant missions */}
                              <button
                                type="button"
                                onClick={() => handleFilterToAssistant(ast.name)}
                                title="View All Missions for this Assistant"
                                className="btn-secondary py-1 px-2 text-[10px] cursor-pointer"
                              >
                                View Trips
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================
            TAB 4: PASSENGERS DIRECTORY
            ======================================================== */}
        {activeTab === 'passengers' && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-black dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  Registered Passengers Directory ({usersList.length})
                </h3>
                <p className="text-xs text-zinc-500">
                  Comprehensive register of all platform travelers, booking frequencies, and contact profiles.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-400 font-mono">
                    <th className="pb-3">Passenger</th>
                    <th className="pb-3">Email Address</th>
                    <th className="pb-3">Phone</th>
                    <th className="pb-3">Role</th>
                    <th className="pb-3">Joined Date</th>
                    <th className="pb-3">Total Bookings</th>
                    <th className="pb-3">Lifetime Spend</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-mono">
                  {usersList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-zinc-400 font-mono">
                        No registered users found.
                      </td>
                    </tr>
                  ) : (
                    usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                        <td className="py-3 font-bold font-sans text-black dark:text-white">
                          {u.name}
                        </td>
                        <td className="py-3 text-zinc-500">
                          {u.email}
                        </td>
                        <td className="py-3 text-zinc-500">
                          {u.phone ? (
                            <a href={`tel:${u.phone}`} className="hover:underline text-blue-600">
                              {u.phone}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 uppercase text-[10px] font-bold">
                          <span className={`px-2 py-0.5 rounded-md ${u.role === 'admin' ? 'bg-black text-white' : 'bg-blue-50 text-blue-700'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 text-zinc-400 text-[11px]">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 font-bold text-black dark:text-white">
                          {u.bookings_count || 0}
                        </td>
                        <td className="py-3 font-bold text-emerald-600">
                          ₹{u.total_spent || 0}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleFilterToPassenger(u.name || u.email)}
                              className="btn-secondary py-1 px-2.5 text-[10px] cursor-pointer"
                            >
                              View Trips
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB: FINANCE & FINANCIAL RECONCILIATION (Phase 4)
            ======================================================== */}
        {activeTab === 'finance' && (
          <div className="space-y-6 animate-fade-in font-mono">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-black dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  Financial Reconciliation, Invariants & Audit Trail
                </h3>
                <p className="text-xs text-zinc-500">
                  Mathematical validation of revenue splits (20/80), refund ceilings, wallet solvency, and tamper-evident audit logs.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchReconciliation}
                  disabled={reconLoading}
                  className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${reconLoading ? 'animate-spin' : ''}`} />
                  <span>Re-run Invariants Engine</span>
                </button>
              </div>
            </div>

            {/* System Health Banner */}
            {reconReport?.health && (
              <div
                className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  reconReport.health.status === 'healthy'
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : reconReport.health.status === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                    : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      reconReport.health.status === 'healthy'
                        ? 'bg-emerald-500 animate-pulse'
                        : reconReport.health.status === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-rose-600 animate-ping'
                    }`}
                  />
                  <div>
                    <h4 className="font-bold text-sm uppercase tracking-wider">
                      System Status: {reconReport.health.status.toUpperCase()}
                    </h4>
                    <p className="text-xs opacity-90">
                      {reconReport.health.status === 'healthy'
                        ? 'All 11 core financial & operational invariants are 100% satisfied. No ledger anomalies detected.'
                        : `${reconReport.health.critical_issues} critical issue(s) and ${reconReport.health.warnings} warning(s) detected across system ledgers.`}
                    </p>
                  </div>
                </div>
                <div className="text-[11px] opacity-75 font-mono">
                  Reconciled at: {new Date(reconReport.reconciled_at).toLocaleTimeString()}
                </div>
              </div>
            )}

            {/* Financial Ledger Balance Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Gross Collections</span>
                <p className="text-xl font-bold text-black dark:text-white">
                  ₹{reconReport?.metrics?.gross_payments || 0}
                </p>
                <span className="text-[10px] text-zinc-500">Paid payments</span>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Total Refunds</span>
                <p className="text-xl font-bold text-rose-600">
                  ₹{reconReport?.metrics?.total_refunded || 0}
                </p>
                <span className="text-[10px] text-zinc-500">Completed returns</span>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-emerald-600 block mb-1">Net Collected</span>
                <p className="text-xl font-bold text-emerald-600">
                  ₹{reconReport?.metrics?.net_collected || 0}
                </p>
                <span className="text-[10px] text-zinc-500">Gross minus refunds</span>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-blue-500 block mb-1">Platform 20%</span>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  ₹{reconReport?.metrics?.platform_commission || 0}
                </p>
                <span className="text-[10px] text-zinc-500">Completed bookings</span>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-purple-500 block mb-1">Sahayak Paid Out</span>
                <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                  ₹{reconReport?.metrics?.total_payouts_paid || 0}
                </p>
                <span className="text-[10px] text-zinc-500">Finalized disbursements</span>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-800/80 rounded-2xl p-4 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-amber-600 block mb-1">Pending Liability</span>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                  ₹{reconReport?.metrics?.pending_liability || 0}
                </p>
                <span className="text-[10px] text-zinc-500">Pending + Avail + Held</span>
              </div>
            </div>

            {/* Invariant Findings / Issues Section */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-black dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-500" />
                  Invariant Discrepancies & Ledger Diagnostic Results ({reconReport?.issues?.length || 0})
                </h4>
              </div>

              {(!reconReport?.issues || reconReport.issues.length === 0) ? (
                <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 space-y-1">
                  <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                  <p className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                    All Financial Invariants Satisfied
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    No fare split mismatches, over-refunds, duplicate payout claims, or radar isolation breaches found.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50">
                        <th className="py-2.5 px-3">Issue ID</th>
                        <th className="py-2.5 px-3">Code</th>
                        <th className="py-2.5 px-3">Severity</th>
                        <th className="py-2.5 px-3">Entity</th>
                        <th className="py-2.5 px-3">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                      {reconReport.issues.map((iss) => (
                        <tr key={iss.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                          <td className="py-2.5 px-3 font-bold text-zinc-500">{iss.id}</td>
                          <td className="py-2.5 px-3 font-bold text-black dark:text-white">{iss.code}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                iss.severity === 'critical'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                              }`}
                            >
                              {iss.severity}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-zinc-400">
                            {iss.entity_type} #{iss.entity_id?.slice(0, 8)}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-300">{iss.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Tamper-Evident Financial Audit Trail */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-sm text-black dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-500" />
                    Append-Only Financial Audit Trail
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    Immutable event ledger tracking every state transition, disbursement, settlement, and earning finalization.
                  </p>
                </div>

                {/* Audit Action Filters */}
                <div className="flex flex-wrap items-center gap-1 text-[10px]">
                  {['ALL', 'payout_settlement_recorded', 'payout_paid', 'earning_paid_out', 'payout_requested', 'payout_approved', 'payout_rejected'].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setAuditFilter(f)}
                      className={`px-2 py-1 rounded-md transition-all ${
                        auditFilter === f
                          ? 'bg-black text-white dark:bg-white dark:text-black font-bold'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-black dark:hover:text-white'
                      }`}
                    >
                      {f === 'ALL' ? 'All Events' : f.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {auditLogs.length === 0 ? (
                <p className="text-xs text-zinc-400 py-8 text-center">
                  No financial audit events recorded yet. Payout settlements and state transitions will be permanently recorded here.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50">
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">Action</th>
                        <th className="py-2.5 px-3">Actor</th>
                        <th className="py-2.5 px-3">Entity</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">State Transition</th>
                        <th className="py-2.5 px-3">Details / Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                      {auditLogs
                        .filter((log) => auditFilter === 'ALL' || log.action === auditFilter)
                        .slice(0, 50)
                        .map((log) => (
                          <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                            <td className="py-2.5 px-3 text-zinc-400 text-[11px] whitespace-nowrap">
                              {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-black dark:text-white">
                              <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px]">
                                {log.action}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-zinc-400 text-[11px]">
                              {log.actor_role} ({log.actor_id ? log.actor_id.slice(0, 6) : 'system'})
                            </td>
                            <td className="py-2.5 px-3 text-zinc-500 text-[11px]">
                              {log.entity_type} #{log.entity_id?.slice(0, 6)}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-emerald-600">
                              {log.amount ? `₹${log.amount}` : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-zinc-400">
                              {log.previous_state?.status || 'none'} ➔ <span className="font-bold text-black dark:text-white">{log.new_state?.status || 'N/A'}</span>
                            </td>
                            <td className="py-2.5 px-3 text-zinc-500 text-[11px]">
                              {log.new_state?.payout_reference ? `Ref: ${log.new_state.payout_reference}` : log.metadata?.reference ? `Ref: ${log.metadata.reference}` : '—'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Financial Health Diagnostics Breakdown (Phase 5) */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-black dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-500" />
                    Financial Health Diagnostics Breakdown
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    Real-time operational readiness across database connection, gateway secrets isolation, and invariant status.
                  </p>
                </div>
                {financialHealth && (
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                      financialHealth.status === 'HEALTHY'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : financialHealth.status === 'WARNING'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                    }`}
                  >
                    System {financialHealth.status}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-500 block text-[10px] uppercase font-bold">Database Ledger</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        financialHealth?.checks?.database?.status === 'UP' ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    />
                    <strong className="text-black dark:text-white font-mono">
                      {financialHealth?.checks?.database?.status || 'UNKNOWN'}
                    </strong>
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1 block">
                    Latency: {financialHealth?.checks?.database?.latency_ms || 0}ms
                  </span>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-500 block text-[10px] uppercase font-bold">Razorpay Gateway</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        financialHealth?.checks?.razorpay_gateway?.configured ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    <strong className="text-black dark:text-white font-mono">
                      {financialHealth?.checks?.razorpay_gateway?.configured ? 'CONFIGURED' : 'NOT SET'}
                    </strong>
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1 block">Zero secret leakage</span>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-500 block text-[10px] uppercase font-bold">Webhook Security</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        financialHealth?.checks?.razorpay_webhook?.configured ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    />
                    <strong className="text-black dark:text-white font-mono">
                      {financialHealth?.checks?.razorpay_webhook?.configured ? 'AUTHENTICATED' : 'MISSING'}
                    </strong>
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1 block">HMAC verified</span>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-500 block text-[10px] uppercase font-bold">Invariants Audit</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        financialHealth?.checks?.reconciliation?.status === 'PASS' ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    />
                    <strong className="text-black dark:text-white font-mono">
                      {financialHealth?.checks?.reconciliation?.status || 'PENDING'}
                    </strong>
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1 block">
                    {financialHealth?.checks?.reconciliation?.critical_issues || 0} critical violations
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Recovery Center (Phase 5) */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-sm text-black dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-amber-500" />
                    Payment Recovery Center ({paymentRecoveryList.length})
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    Online payments pending &gt; 15 minutes requiring gateway telemetry sync.
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
                  <strong>Option C Enforced:</strong> Online payments cannot be manually marked paid by admins.
                </div>
              </div>

              {paymentRecoveryList.length === 0 ? (
                <div className="p-6 text-center bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 space-y-1">
                  <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                  <p className="font-bold text-black dark:text-white">Zero Stuck Online Payments</p>
                  <p className="text-[11px] text-zinc-400">
                    All online checkout transactions have cleanly finalized or settled.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50">
                        <th className="py-2 px-3">Payment ID</th>
                        <th className="py-2 px-3">Booking ID</th>
                        <th className="py-2 px-3">Amount</th>
                        <th className="py-2 px-3">Order ID</th>
                        <th className="py-2 px-3">Age (Min)</th>
                        <th className="py-2 px-3">Gateway Status</th>
                        <th className="py-2 px-3">Recovery Policy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                      {paymentRecoveryList.map((p) => (
                        <tr key={p.payment_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                          <td className="py-2 px-3 font-bold text-zinc-500">#{p.payment_id.slice(0, 8)}</td>
                          <td className="py-2 px-3 text-black dark:text-white">#{p.booking_id.slice(0, 8)}</td>
                          <td className="py-2 px-3 font-bold text-emerald-600">₹{p.amount}</td>
                          <td className="py-2 px-3 text-zinc-400 text-[11px]">{p.razorpay_order_id || '—'}</td>
                          <td className="py-2 px-3 text-amber-600 font-bold">{p.age_minutes}m</td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                              {p.payment_status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[11px] text-zinc-400">
                            {p.recovery_action}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB: FINANCIAL INCIDENTS & FRAUD PROTECTION (Phase 5)
            ======================================================== */}
        {activeTab === 'incidents' && (
          <div className="space-y-6 animate-fade-in font-mono">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-black dark:text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-500" />
                  Financial Incidents, Fraud Detection & Operations
                </h3>
                <p className="text-xs text-zinc-500">
                  Automated surveillance engine detecting rapid payment failures, refund spikes, payout anomalies, and ledger corruption.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchAll}
                  disabled={actionLoading}
                  className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh Surveillance</span>
                </button>
              </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Total Incidents</span>
                <p className="text-2xl font-bold text-black dark:text-white">
                  {incidentStats.total || 0}
                </p>
                <span className="text-[10px] text-zinc-500">Recorded events</span>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-800/80 rounded-2xl p-4 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-amber-600 block mb-1">Open Cases</span>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {incidentStats.open || 0}
                </p>
                <span className="text-[10px] text-zinc-500">Requires triage</span>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-blue-300 dark:border-blue-800/80 rounded-2xl p-4 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-blue-500 block mb-1">Investigating</span>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {incidentStats.investigating || 0}
                </p>
                <span className="text-[10px] text-zinc-500">Under admin review</span>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-rose-300 dark:border-rose-800/80 rounded-2xl p-4 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-rose-600 block mb-1">Critical Priority</span>
                <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                  {incidentStats.critical || 0}
                </p>
                <span className="text-[10px] text-zinc-500">High severity</span>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-amber-500 block mb-1">Warnings</span>
                <p className="text-2xl font-bold text-amber-500">
                  {incidentStats.warning || 0}
                </p>
                <span className="text-[10px] text-zinc-500">Advisory alerts</span>
              </div>
            </div>

            {/* Incidents Master Table */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h4 className="font-bold text-sm text-black dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-rose-500" />
                  Financial Incident Log ({incidentsList.length})
                </h4>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-1 text-[10px]">
                  {['ALL', 'open', 'investigating', 'resolved', 'ignored', 'critical', 'warning'].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setIncidentsFilter(f)}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                        incidentsFilter === f
                          ? 'bg-black text-white dark:bg-white dark:text-black font-bold'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-black dark:hover:text-white'
                      }`}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {incidentsList.length === 0 ? (
                <div className="p-12 text-center bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 space-y-2">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                    No Financial Incidents Detected
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Automated surveillance engine is active. Zero anomalies or fraud triggers found across all railway nodes.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50">
                        <th className="py-2.5 px-3">Severity</th>
                        <th className="py-2.5 px-3">Incident Rule</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Entity</th>
                        <th className="py-2.5 px-3">Hits</th>
                        <th className="py-2.5 px-3">Detected</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                      {incidentsList
                        .filter((inc) => {
                          if (incidentsFilter === 'ALL') return true;
                          if (incidentsFilter === 'critical' || incidentsFilter === 'warning') return inc.severity === incidentsFilter;
                          return inc.status === incidentsFilter;
                        })
                        .map((inc) => (
                          <tr key={inc.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  inc.severity === 'critical'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                                    : inc.severity === 'warning'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                                }`}
                              >
                                {inc.severity}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-bold text-black dark:text-white">
                              {inc.incident_type}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                                  inc.status === 'open'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                    : inc.status === 'investigating'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                                    : inc.status === 'resolved'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                                }`}
                              >
                                {inc.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-zinc-500 text-[11px]">
                              {inc.entity_type} #{inc.entity_id?.slice(0, 8)}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-black dark:text-white">
                              {inc.occurrence_count || 1}
                            </td>
                            <td className="py-2.5 px-3 text-zinc-400 text-[11px] whitespace-nowrap">
                              {new Date(inc.detected_at).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedIncident(inc)}
                                className="btn-secondary py-1 px-2.5 text-[11px] cursor-pointer"
                              >
                                Inspect &amp; Action
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB: SAHAYAK PAYOUTS & SETTLEMENT TREASURY (Phase 3B)
            ======================================================== */}
        {activeTab === 'payouts' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-black dark:text-white flex items-center gap-2 font-mono">
                  <CreditCard className="w-5 h-5 text-blue-500" />
                  Sahayak Payout Requests & Settlement Treasury
                </h3>
                <p className="text-xs text-zinc-500 font-mono">
                  Authoritative review, verification, and disbursement of 80% assistant commission shares.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchAll}
                disabled={actionLoading}
                className="btn-secondary py-1.5 px-3 text-xs font-mono flex items-center gap-1 self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                <span>Refresh Ledger</span>
              </button>
            </div>

            {/* Treasury KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-800/80 rounded-2xl p-4 shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 font-mono block mb-1">
                  Pending Review
                </span>
                <p className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400">
                  {payoutsList.filter((p) => p.status === 'requested').length}
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5 font-mono">
                  Awaiting administrative sign-off
                </p>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-widest text-blue-500 font-mono block mb-1">
                  In Processing
                </span>
                <p className="text-2xl font-bold font-mono text-black dark:text-white">
                  {payoutsList.filter((p) => ['approved', 'processing'].includes(p.status)).length}
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5 font-mono">
                  Treasury transfer underway
                </p>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-800/80 rounded-2xl p-4 shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-mono block mb-1">
                  Total Disbursed
                </span>
                <p className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                  ₹{stats.totalPayoutsPaid || 0}
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5 font-mono">
                  Cumulative paid out to sahayaks
                </p>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 font-mono block mb-1">
                  Pending Fleet Settlements
                </span>
                <p className="text-2xl font-bold font-mono text-black dark:text-white">
                  ₹{stats.assistantEarningsPending || 0}
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5 font-mono">
                  Maturing earnings across all stations
                </p>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-mono">
              {['ALL', 'requested', 'approved', 'processing', 'paid', 'failed', 'rejected'].map((f) => {
                const count = f === 'ALL' ? payoutsList.length : payoutsList.filter((p) => p.status === f).length;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setPayoutsFilter(f)}
                    className={`px-3 py-1.5 rounded-lg font-bold capitalize transition-all ${
                      payoutsFilter === f
                        ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs'
                        : 'text-zinc-500 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    <span>{f}</span>
                    <span className="ml-1 text-[10px] opacity-75">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Master Payouts Table */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
              {payoutsList.length === 0 ? (
                <div className="p-12 text-center text-xs text-zinc-400 font-mono">
                  No payout withdrawal requests found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 font-mono bg-zinc-50 dark:bg-zinc-900/50">
                        <th className="py-3 px-4">Request ID</th>
                        <th className="py-3 px-4">Sahayak</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4">Method</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Requested At</th>
                        <th className="py-3 px-4 text-right">Treasury Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                      {payoutsList
                        .filter((p) => payoutsFilter === 'ALL' || p.status === payoutsFilter)
                        .map((p) => {
                          const statusColors = {
                            requested: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
                            approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
                            processing: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
                            paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
                            rejected: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
                            failed: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
                            cancelled: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400',
                          };

                          return (
                            <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                              <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                                {p.id.slice(0, 8)}...
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-bold text-black dark:text-white">
                                  {p.assistant?.name || 'Sahayak'}
                                </div>
                                <div className="text-[11px] text-zinc-400 font-normal">
                                  {p.assistant?.phone || p.assistant_id?.slice(0, 8)} · {p.assistant?.station_code || 'SCR'}
                                </div>
                              </td>
                              <td className="py-3 px-4 font-bold text-sm text-black dark:text-white">
                                ₹{p.amount}
                              </td>
                              <td className="py-3 px-4 capitalize text-zinc-400">
                                {p.payout_method?.replace('_', ' ') || 'Bank Transfer'}
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColors[p.status] || 'bg-zinc-100'}`}>
                                  {p.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-zinc-400 text-[11px]">
                                {new Date(p.requested_at || p.created_at).toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {p.status === 'requested' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleApprovePayout(p.id)}
                                        disabled={actionLoading}
                                        className="btn-primary py-1 px-2.5 text-[11px] font-bold bg-blue-600 hover:bg-blue-700"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRejectPayout(p.id)}
                                        disabled={actionLoading}
                                        className="btn-secondary py-1 px-2 text-[11px] text-rose-600 hover:text-rose-700 border-rose-300 dark:border-rose-800"
                                      >
                                        Reject
                                      </button>
                                    </>
                                  )}

                                  {p.status === 'approved' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleProcessingPayout(p.id)}
                                        disabled={actionLoading}
                                        className="btn-secondary py-1 px-2.5 text-[11px] font-bold text-purple-600 border-purple-300 dark:border-purple-800"
                                      >
                                        Start Processing
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handlePaidPayout(p.id)}
                                        disabled={actionLoading}
                                        className="btn-primary py-1 px-2.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700"
                                      >
                                        Mark Paid
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRejectPayout(p.id)}
                                        disabled={actionLoading}
                                        className="btn-secondary py-1 px-2 text-[11px] text-rose-600 hover:text-rose-700 border-rose-300 dark:border-rose-800"
                                      >
                                        Reject
                                      </button>
                                    </>
                                  )}

                                  {p.status === 'processing' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handlePaidPayout(p.id)}
                                        disabled={actionLoading}
                                        className="btn-primary py-1 px-2.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700"
                                      >
                                        Mark Paid (Disbursed)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleFailedPayout(p.id)}
                                        disabled={actionLoading}
                                        className="btn-secondary py-1 px-2 text-[11px] text-rose-600 hover:text-rose-700 border-rose-300 dark:border-rose-800"
                                      >
                                        Mark Failed
                                      </button>
                                    </>
                                  )}

                                  {p.status === 'paid' && (
                                    <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                      ✓ Ref: {p.payout_reference || 'CONFIRMED'}
                                    </span>
                                  )}

                                  {p.status === 'failed' && (
                                    <span className="text-[11px] font-mono text-rose-500">
                                      Failed ({p.failure_reason || 'Network error'})
                                    </span>
                                  )}

                                  {p.status === 'rejected' && (
                                    <span className="text-[11px] font-mono text-zinc-400">
                                      Rejected ({p.failure_reason || 'Admin review'})
                                    </span>
                                  )}

                                  {p.status === 'cancelled' && (
                                    <span className="text-[11px] font-mono text-zinc-400">
                                      Cancelled by Assistant
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 5: EMERGENCY SOS CENTER
            ======================================================== */}
        {activeTab === 'sos' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-black dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" />
                  Emergency Incident Command Center
                </h3>
                <p className="text-xs text-zinc-500">
                  Live dispatch monitoring for emergency alerts triggered by passengers or sahayaks.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-red-600 bg-red-50 dark:bg-red-950/60 px-3 py-1 rounded-full border border-red-200 dark:border-red-800">
                {sosAlerts.length} Active Emergencies
              </span>
            </div>

            {sosAlerts.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center space-y-2">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
                <h4 className="font-bold text-sm text-black dark:text-white">
                  Station Network Secure
                </h4>
                <p className="text-xs text-zinc-500 font-mono">
                  No active SOS incidents or distress signals across all South Central Railway nodes.
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {sosAlerts.map((sos) => (
                  <div
                    key={sos.id}
                    className="bg-red-50/70 dark:bg-red-950/40 border-2 border-red-500 rounded-2xl p-5 shadow-lg space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                        <h4 className="font-bold text-sm text-red-800 dark:text-red-300 font-mono uppercase">
                          Distress Signal · Station {sos.station_code}
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-red-600 text-white px-2 py-0.5 rounded">
                        #{sos.booking_id?.slice(-6).toUpperCase()}
                      </span>
                    </div>

                    <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl space-y-2 text-xs font-mono">
                      <p className="text-zinc-600 dark:text-zinc-300">
                        Passenger: <strong className="text-black dark:text-white">{sos.passenger?.name || 'Guest'}</strong>
                      </p>
                      <p className="text-zinc-600 dark:text-zinc-300">
                        Train: <strong>{sos.train_no || sos.train_number}</strong> ({sos.train_name})
                      </p>
                      <p className="text-zinc-600 dark:text-zinc-300">
                        Location: <strong>Coach {sos.coach || 'TBD'} · Seat {sos.seat_number || 'TBD'}</strong>
                      </p>
                      {sos.passenger?.phone && (
                        <p className="text-blue-600 dark:text-blue-400 font-bold">
                          Contact: <a href={`tel:${sos.passenger.phone}`}>{sos.passenger.phone}</a>
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setInspectingBooking(sos)}
                        className="btn-secondary flex-1 py-2 text-xs cursor-pointer"
                      >
                        Inspect Full Mission
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolveEmergency(sos.id)}
                        className="btn-primary flex-1 py-2 text-xs bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                      >
                        Resolve & Clear Alert
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: LAUNCH CENTER (PHASE 9) ────────────────────────── */}
        {activeTab === 'launch' && (
          <LaunchCenter />
        )}

        {/* ── TAB: STATION DESK & SUPPORT TICKETS ───────────────── */}
        {(activeTab === 'support' || activeTab === 'support_tickets') && (
          <div className="space-y-6 animate-fade-in">
            {/* Header & Metric Cards */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold font-mono uppercase tracking-wider text-black dark:text-white flex items-center gap-2">
                  <LifeBuoy className="w-5 h-5 text-blue-600" />
                  <span>Station Desk & Support Inbox</span>
                </h3>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">
                  Real-time ticket management, station supervisor dispatch, and passenger assistance support.
                </p>
              </div>
            </div>

            {/* Operational Tickets Management Panel from Assistants */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                  <h4 className="font-bold text-sm text-black dark:text-white font-mono uppercase">
                    Platform Assistant Operational Tickets ({filteredSupportTickets.length})
                  </h4>
                </div>
                {pendingTicketsCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400">
                    {pendingTicketsCount} Awaiting Station Supervisor
                  </span>
                )}
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search tickets, PNR, assistant..."
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                    className="input-base text-xs pl-8 py-1.5 w-full bg-zinc-50 dark:bg-zinc-950 border-zinc-300 dark:border-zinc-700"
                  />
                </div>

                <select
                  value={ticketStationFilter}
                  onChange={(e) => setTicketStationFilter(e.target.value)}
                  className="input-base text-xs py-1.5 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                >
                  <option value="ALL">All Station Hubs</option>
                  {STATIONS.map((st) => (
                    <option key={st.code} value={st.code}>
                      {st.code} - {st.name}
                    </option>
                  ))}
                </select>

                <select
                  value={ticketStatusFilter}
                  onChange={(e) => setTicketStatusFilter(e.target.value)}
                  className="input-base text-xs py-1.5 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Dispatched to Station Supervisor">Dispatched</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved by Station Master">Resolved</option>
                </select>

                <select
                  value={ticketPriorityFilter}
                  onChange={(e) => setTicketPriorityFilter(e.target.value)}
                  className="input-base text-xs py-1.5 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              {/* Table of Operational Tickets */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-400 font-mono">
                      <th className="pb-2">Ticket ID</th>
                      <th className="pb-2">Station</th>
                      <th className="pb-2">Category</th>
                      <th className="pb-2">PNR</th>
                      <th className="pb-2">Description</th>
                      <th className="pb-2">Priority</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-mono">
                    {filteredSupportTickets.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-zinc-400 font-mono">
                          No operational tickets match filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredSupportTickets.map((t) => (
                        <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                          <td className="py-2.5 font-bold text-blue-600 dark:text-blue-400 font-mono">
                            #{t.id}
                          </td>
                          <td className="py-2.5 font-bold">
                            {t.station}
                          </td>
                          <td className="py-2.5 font-sans">
                            {t.category}
                          </td>
                          <td className="py-2.5 text-zinc-500 font-mono">
                            {t.pnr || '—'}
                          </td>
                          <td className="py-2.5 text-zinc-600 dark:text-zinc-300 max-w-xs truncate font-sans">
                            {t.desc}
                          </td>
                          <td className="py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                t.priority === 'urgent'
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                                  : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                              }`}
                            >
                              {t.priority}
                            </span>
                          </td>
                          <td className="py-2.5">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                              {t.status}
                            </span>
                          </td>
                          <td className="py-2.5 text-right font-sans">
                            {t.status !== 'Resolved by Station Master' ? (
                              <button
                                type="button"
                                onClick={() => handleUpdateTicketStatus(t.id, 'Resolved by Station Master', 'Resolved via Admin Console')}
                                disabled={ticketUpdatingId === t.id}
                                className="py-1 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50"
                              >
                                {ticketUpdatingId === t.id ? 'Updating...' : 'Resolve'}
                              </button>
                            ) : (
                              <span className="text-emerald-600 text-[10px] font-bold">✓ Resolved</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Passenger Live Support Chat Inbox */}
            <div className="pt-2">
              <SupportInbox />
            </div>
          </div>
        )}

      </main>

      {/* ── DETAIL INSPECTOR MODAL ─────────────────────────────── */}
      {inspectingBooking && (
        <BookingDetailModal
          booking={inspectingBooking}
          onClose={handleCloseInspector}
          onUpdate={handleUpdateBooking}
          assistants={assistantsList}
        />
      )}

      {/* ── SETTLEMENT CONFIRMATION MODAL (PHASE 4) ──────────────── */}
      {settlementModalPayout && (
        <SettlementConfirmModal
          payout={settlementModalPayout}
          onClose={() => setSettlementModalPayout(null)}
          onConfirm={handleConfirmSettlement}
          actionLoading={actionLoading}
        />
      )}

      {/* ── FINANCIAL INCIDENT DETAIL & RESOLUTION MODAL (PHASE 5) ── */}
      {selectedIncident && (
        <IncidentDetailModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onInvestigate={handleInvestigateIncident}
          onResolve={handleResolveIncident}
          onIgnore={handleIgnoreIncident}
          actionLoading={actionLoading}
        />
      )}

    </div>
  );
}