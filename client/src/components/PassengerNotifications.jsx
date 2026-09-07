import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bell,
  Train,
  Luggage,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Check,
  X,
  Sparkles,
  MapPin,
  Info,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/* ============================================================
   ONECOOLIE PASSENGER NOTIFICATIONS — Real-Time Travel Alerts
   Swiss Minimalist Luxury Design with Live Journey Status
   ============================================================ */

export default function PassengerNotifications({
  bookings = [],
  activeBookings = [],
  onNavigateTab,
  className = '',
  buttonClassName = '',
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('passenger_dismissed_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [readIds, setReadIds] = useState(() => {
    try {
      const saved = localStorage.getItem('passenger_read_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Persist dismissed and read notifications
  useEffect(() => {
    try {
      localStorage.setItem('passenger_dismissed_notifications', JSON.stringify(dismissedIds));
    } catch { }
  }, [dismissedIds]);

  useEffect(() => {
    try {
      localStorage.setItem('passenger_read_notifications', JSON.stringify(readIds));
    } catch { }
  }, [readIds]);

  // Build notifications feed
  const notificationsList = useMemo(() => {
    const list = [];

    // 1. Active In-Progress / Upcoming Bookings
    if (activeBookings && activeBookings.length > 0) {
      activeBookings.forEach((b) => {
        const isAssigned = Boolean(
          b.assistant_id ||
          b.assistant ||
          ['assigned', 'accepted', 'arriving', 'in_service', 'reached'].includes(b.booking_status?.toLowerCase())
        );

        list.push({
          id: `active-${b.id || b.booking_id}`,
          bookingId: b.id,
          booking: b,
          type: 'active',
          urgency: 'high',
          title: isAssigned
            ? `Assistant En Route · Train ${b.train_no || 'Express'}`
            : `Booking Active · Train ${b.train_no || 'Express'}`,
          description: isAssigned
            ? `Porter assigned for Coach ${b.coach || 'TBD'}, Seat ${b.seat_number || 'TBD'}. Meeting at platform.`
            : `Assistance scheduled at ${b.station_code || 'station'}. A licensed assistant will be assigned shortly.`,
          badge: isAssigned ? 'Assigned' : 'Scheduled',
          badgeStyle: isAssigned
            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
            : 'bg-blue-100 text-blue-800 border-blue-200',
          icon: isAssigned ? Luggage : Train,
          iconBg: isAssigned ? 'bg-emerald-600 text-white' : 'bg-black text-white',
          time: b.journey_time ? `Arrival: ${b.journey_time}` : 'Today',
        });
      });
    }

    // 2. Recent Confirmed Bookings (up to 3)
    if (bookings && bookings.length > 0) {
      bookings.slice(0, 3).forEach((b) => {
        const key = `booking-${b.id || b.booking_id}`;
        // Skip if already in active list
        if (list.some((item) => item.bookingId === b.id)) return;

        const isCompleted = b.booking_status === 'completed';
        const isCancelled = b.booking_status === 'cancelled';

        list.push({
          id: key,
          bookingId: b.id,
          booking: b,
          type: 'history',
          urgency: 'normal',
          title: isCompleted
            ? `Trip Completed · Train ${b.train_no}`
            : isCancelled
              ? `Booking Cancelled · Train ${b.train_no}`
              : `Assistance Confirmed · Train ${b.train_no}`,
          description: isCompleted
            ? `Assistance at ${b.station_code || 'station'} completed. Thank you for travelling with OneCoolie.`
            : `Booking Ref #${b.booking_id || b.id} · Coach ${b.coach || '--'} · Total: ₹${b.total_price || 30}`,
          badge: isCompleted ? 'Completed' : isCancelled ? 'Cancelled' : 'Confirmed',
          badgeStyle: isCompleted
            ? 'bg-slate-100 text-zinc-700 border-slate-200'
            : isCancelled
              ? 'bg-rose-100 text-rose-700 border-rose-200'
              : 'bg-slate-100 text-zinc-900 border-slate-200',
          icon: isCompleted ? CheckCircle2 : Train,
          iconBg: isCompleted ? 'bg-zinc-800 text-white' : 'bg-slate-100 text-zinc-800',
          time: b.journey_date || 'Recent',
        });
      });
    }

    // 3. Platform & Security Essential Notices
    list.push({
      id: 'tip-otp-security',
      type: 'tip',
      urgency: 'normal',
      title: 'Safe Journey: OTP Verification',
      description: 'Share your 6-digit verification code with your assistant only after meeting in person at the coach.',
      badge: 'Security',
      badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: ShieldCheck,
      iconBg: 'bg-emerald-600 text-white',
      time: 'Safety Tip',
    });

    list.push({
      id: 'tip-helpline-support',
      type: 'tip',
      urgency: 'normal',
      title: '24/7 Platform Helpline Active',
      description: 'Need urgent station assistance or coach guidance? Dial Railway Helpline 139 or contact OneCoolie support.',
      badge: 'Help',
      badgeStyle: 'bg-slate-100 text-zinc-700 border-slate-200',
      icon: Info,
      iconBg: 'bg-black text-white',
      time: '24/7',
    });

    return list;
  }, [bookings, activeBookings]);

  // Filter out dismissed
  const visibleNotifications = useMemo(() => {
    return notificationsList.filter((n) => !dismissedIds.includes(n.id));
  }, [notificationsList, dismissedIds]);

  // Unread count
  const unreadCount = useMemo(() => {
    return visibleNotifications.filter((n) => !readIds.includes(n.id)).length;
  }, [visibleNotifications, readIds]);

  const handleMarkAllRead = (e) => {
    e.stopPropagation();
    const allIds = visibleNotifications.map((n) => n.id);
    setDismissedIds((prev) => Array.from(new Set([...prev, ...allIds])));
    setReadIds((prev) => Array.from(new Set([...prev, ...allIds])));
  };

  const handleDismiss = (id, e) => {
    e.stopPropagation();
    setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handleItemClick = (item) => {
    // When viewed, remove it from the notifications list immediately
    setDismissedIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
    if (!readIds.includes(item.id)) {
      setReadIds((prev) => [...prev, item.id]);
    }
    setOpen(false);

    if (item.bookingId) {
      if (item.booking) {
        navigate(`/booking/${item.bookingId}`, { state: { booking: item.booking } });
      } else {
        onNavigateTab?.('trips');
      }
    } else {
      onNavigateTab?.('trips');
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Bell Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={
          buttonClassName ||
          `w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-zinc-700 flex items-center justify-center transition-colors relative cursor-pointer group border border-slate-200/60 shadow-2xs ${open ? 'bg-slate-200 ring-2 ring-black/10' : ''
          }`
        }
        title="Notifications & Travel Alerts"
        aria-label="Notifications"
      >
        <Bell className="w-4.5 h-4.5 text-zinc-700 group-hover:scale-110 transition-transform" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 ring-2 ring-white" />
          </span>
        )}
      </button>

      {/* Mobile Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/25 z-40 sm:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Flyout Notification Popover Panel */}
      {open && (
        <div className="fixed inset-x-3 top-[68px] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 w-auto sm:w-96 max-w-lg bg-white border border-slate-200/90 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.12)] p-4 sm:p-5 z-50 text-zinc-900 animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-xs shadow-xs">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-zinc-900">
                    Notifications
                  </h3>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black text-white">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 font-medium">
                  Trip telemetry &amp; station updates
                </p>
              </div>
            </div>

            {visibleNotifications.length > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-bold text-zinc-600 hover:text-black cursor-pointer flex items-center gap-1 transition-colors"
              >
                <Check className="w-3 h-3" />
                <span>Clear all</span>
              </button>
            )}
          </div>

          {/* Notifications Scrollable List */}
          <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1 no-scrollbar">
            {visibleNotifications.length === 0 ? (
              <div className="py-8 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2.5">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
                <p className="text-xs font-bold text-zinc-800">All caught up!</p>
                <p className="text-[11px] text-zinc-400 mt-0.5 max-w-[220px] mx-auto">
                  No pending alerts or notifications for your account.
                </p>
              </div>
            ) : (
              visibleNotifications.map((item) => {
                const IconComponent = item.icon;
                const isUnread = !readIds.includes(item.id);
                const isUrgent = item.urgency === 'high';

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    role="button"
                    tabIndex={0}
                    className={`w-full flex items-start gap-3 p-3 rounded-2xl text-left transition-all cursor-pointer group ${isUrgent
                      ? 'bg-slate-50/90 hover:bg-slate-100 border border-slate-200/80 shadow-2xs'
                      : isUnread
                        ? 'bg-slate-50/60 hover:bg-slate-100 border border-transparent'
                        : 'hover:bg-slate-50 border border-transparent opacity-80 hover:opacity-100'
                      }`}
                  >
                    {/* Icon */}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-xs ${item.iconBg}`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5 mb-0.5">
                        <p className={`text-xs font-bold truncate ${isUnread ? 'text-zinc-900' : 'text-zinc-700'}`}>
                          {item.title}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wider ${item.badgeStyle}`}
                          >
                            {item.badge}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleDismiss(item.id, e)}
                            className="text-zinc-300 hover:text-zinc-600 p-0.5 rounded transition-colors"
                            title="Dismiss"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <p className="text-[11px] text-zinc-500 leading-snug font-medium line-clamp-2">
                        {item.description}
                      </p>

                      <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-slate-100/60 text-[10px]">
                        <span className="text-zinc-400 font-mono font-medium">{item.time}</span>
                        <span className="text-black font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                          <span>View</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer View All Trips Button */}
          <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onNavigateTab?.('trips');
              }}
              className="text-xs font-bold text-zinc-700 hover:text-black flex items-center gap-1.5 transition-colors cursor-pointer w-full justify-center py-1.5"
            >
              <span>Manage All Your Bookings</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
