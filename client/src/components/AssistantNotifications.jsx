import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bell,
  Luggage,
  Briefcase,
  Star,
  ShieldCheck,
  CheckCircle2,
  PhoneCall,
  ArrowRight,
  Clock,
  Sparkles,
  Check,
  Radio,
  X,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

/* ============================================================
   ONECOOLIE ASSISTANT NOTIFICATIONS — Dispatch & Duty Alerts
   Apple / Uber-Style Ops Alert Center
   ============================================================ */

export default function AssistantNotifications({
  requests = [],
  activeJobs = [],
  ratedJobs = [],
  online = false,
  station = 'KZJ',
  stationName = 'Kazipet Junction',
  onNavigate,
}) {
  const { lang, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('assistant_dismissed_alerts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [markedAllRead, setMarkedAllRead] = useState(false);
  const dropdownRef = useRef(null);

  // Close on outside click
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

  // Reset markedAllRead when requests count increases
  const prevRequestsCountRef = useRef(requests.length);
  useEffect(() => {
    if (requests.length > prevRequestsCountRef.current) {
      setMarkedAllRead(false);
    }
    prevRequestsCountRef.current = requests.length;
  }, [requests.length]);

  // Build notifications list
  const notificationsList = useMemo(() => {
    const list = [];

    // 1. Available Requests (High Priority)
    if (requests && requests.length > 0) {
      requests.forEach((req, idx) => {
        const reqId = `req-${req.id || idx}`;
        const pnr = req.pnr_number || req.pnr || 'PNR Pending';
        const pf = req.platform_number || '1';
        const bags = req.baggage_count || 1;
        const fare = req.total_price ? `₹${req.total_price}` : '₹150';
        const passenger = req.passenger_name || 'Passenger Assistance';

        list.push({
          id: reqId,
          type: 'request',
          urgency: 'high',
          title: `New Dispatch: ${passenger}`,
          description: `Platform ${pf} · PNR: ${pnr} · ${bags} bag(s) · ${fare}`,
          badge: 'Available Now',
          badgeStyle: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
          icon: Luggage,
          iconBg: 'bg-blue-600 text-white',
          time: 'Action Required',
          tab: 'dashboard',
        });
      });
    }

    // 2. Active Jobs In-Progress
    if (activeJobs && activeJobs.length > 0) {
      activeJobs.forEach((job, idx) => {
        const jobId = `job-${job.id || idx}`;
        const coach = job.coach_position || job.coach || 'Coach';
        const pf = job.platform_number || job.platform || '1';
        const statusLabel =
          job.booking_status === 'confirmed'
            ? 'Awaiting OTP'
            : job.booking_status === 'in_progress'
              ? 'In Service'
              : 'Active';

        list.push({
          id: jobId,
          type: 'job',
          urgency: 'active',
          title: `Active Job: ${job.passenger_name || 'Passenger'}`,
          description: `Coach ${coach} · Platform ${pf} · ${statusLabel}`,
          badge: statusLabel,
          badgeStyle: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
          icon: Briefcase,
          iconBg: 'bg-emerald-600 text-white',
          time: 'Active Duty',
          tab: 'jobs',
        });
      });
    }

    // 3. Recent Ratings Received
    if (ratedJobs && ratedJobs.length > 0) {
      ratedJobs.slice(0, 2).forEach((job, idx) => {
        const ratingId = `rating-${job.id || idx}`;
        list.push({
          id: ratingId,
          type: 'rating',
          urgency: 'info',
          title: `Passenger Rating: ★ ${Number(job.rating).toFixed(1)} / 5.0`,
          description: job.review
            ? `"${job.review}"`
            : 'Passenger submitted 5-star feedback for your assistance.',
          badge: 'Feedback',
          badgeStyle: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
          icon: Star,
          iconBg: 'bg-amber-500 text-white',
          time: 'Recent Review',
          tab: 'earnings',
        });
      });
    }

    // 4. Station Duty Status
    list.push({
      id: 'duty-status',
      type: 'status',
      urgency: 'status',
      title: online ? `On Duty: ${station}` : `Off Duty: ${station}`,
      description: online
        ? `Receiving passenger requests at ${stationName}.`
        : `Go On Duty to receive platform dispatch alerts.`,
      badge: online ? 'Live Radar' : 'Offline',
      badgeStyle: online
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
        : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400 border-slate-200 dark:border-zinc-700',
      icon: ShieldCheck,
      iconBg: online ? 'bg-black text-white dark:bg-zinc-800' : 'bg-slate-400 text-white',
      time: online ? 'Active' : 'Standby',
      tab: 'profile',
    });

    // 5. Emergency Helpline Support
    list.push({
      id: 'railway-safety',
      type: 'helpline',
      urgency: 'support',
      title: 'Railway Helpline & Safety',
      description: 'Dial 139 for Railway Passenger Care · Dial 112 for Police Emergency.',
      badge: '24x7 Help',
      badgeStyle: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      icon: PhoneCall,
      iconBg: 'bg-rose-600 text-white',
      time: 'Support',
      action: () => {
        window.location.href = 'tel:139';
      },
    });

    return list;
  }, [requests, activeJobs, ratedJobs, online, station, stationName]);

  // Filter out dismissed
  const visibleNotifications = notificationsList.filter(
    (n) => !dismissedIds.includes(n.id)
  );

  const visibleRequestsCount = visibleNotifications.filter((n) => n.type === 'request').length;

  // Unread badge count
  const unreadCount = markedAllRead
    ? 0
    : visibleNotifications.filter((n) => n.urgency === 'high' || n.urgency === 'active').length;

  const handleDismissItem = (itemId) => {
    setDismissedIds((prev) => {
      const next = prev.includes(itemId) ? prev : [...prev, itemId];
      try {
        localStorage.setItem('assistant_dismissed_alerts', JSON.stringify(next));
      } catch { }
      return next;
    });
  };

  const handleMarkAllRead = () => {
    const allIds = notificationsList.map((n) => n.id);
    const nextDismissed = Array.from(new Set([...dismissedIds, ...allIds]));
    setDismissedIds(nextDismissed);
    try {
      localStorage.setItem('assistant_dismissed_alerts', JSON.stringify(nextDismissed));
    } catch { }
    setMarkedAllRead(true);
  };

  const handleItemClick = (item) => {
    // Automatically dismiss and remove from notifications list
    handleDismissItem(item.id);

    if (item.action) {
      item.action();
    } else if (item.tab) {
      onNavigate?.(item.tab);
      if (item.tab === 'dashboard') {
        setTimeout(() => {
          document.getElementById('available-requests-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 120);
      }
    }
    setOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`relative p-2.5 rounded-full transition-all cursor-pointer ${open
          ? 'bg-slate-100 dark:bg-zinc-800 text-black dark:text-white ring-2 ring-blue-500/20'
          : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300'
          }`}
        title="Notifications & Duty Alerts"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#2563EB] ring-2 ring-white dark:ring-black" />
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

      {/* Flyout Popover */}
      {open && (
        <div className="fixed inset-x-3 top-[68px] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2.5 w-auto sm:w-96 max-w-lg bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] p-4 sm:p-5 z-50 text-zinc-900 dark:text-white animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-zinc-800/80 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-black text-white dark:bg-white dark:text-black flex items-center justify-center font-bold text-xs shadow-xs">
                <Bell size={14} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-zinc-900 dark:text-white">
                    {t('notificationsTitle')}
                  </h3>
                  {visibleRequestsCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2563EB] text-white">
                      {visibleRequestsCount} {t('active')}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 font-medium">
                  {t('notificationsSub')}
                </p>
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer flex items-center gap-1 transition-colors"
              >
                <Check size={12} />
                <span>{t('markAllRead')}</span>
              </button>
            )}
          </div>

          {/* Notifications Scrollable List */}
          <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-zinc-800">
            {visibleNotifications.length === 0 ? (
              <div className="py-8 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 mb-2.5">
                  <CheckCircle2 size={22} className="text-emerald-500" />
                </div>
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  {t('allCaughtUp')}
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5 max-w-[220px] mx-auto">
                  {t('noPendingAlerts')}
                </p>
              </div>
            ) : (
              visibleNotifications.map((item) => {
                const IconComponent = item.icon;
                const isUrgent = item.urgency === 'high';

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    role="button"
                    tabIndex={0}
                    className={`w-full flex items-start gap-3 p-3 rounded-2xl text-left transition-all cursor-pointer group ${isUrgent
                      ? 'bg-blue-50/70 dark:bg-blue-950/20 hover:bg-blue-100/70 dark:hover:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40'
                      : 'hover:bg-slate-50 dark:hover:bg-zinc-800/50 border border-transparent'
                      }`}
                  >
                    {/* Icon */}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-xs ${item.iconBg}`}
                    >
                      <IconComponent size={16} />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wider ${item.badgeStyle}`}
                          >
                            {item.badge}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDismissItem(item.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-opacity cursor-pointer"
                            title="Dismiss from list"
                            aria-label="Dismiss from list"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>

                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>

                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100/60 dark:border-zinc-800/60">
                        <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                          <Clock size={10} />
                          {item.time}
                        </span>
                        <span className="text-[10px] font-bold text-[#2563EB] dark:text-blue-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                          Open <ArrowRight size={10} />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Action Footer */}
          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <span
                className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                  }`}
              />
              <span>{station} {t('stationRadar')}</span>
            </div>

            {visibleRequestsCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onNavigate?.('dashboard');
                  setTimeout(() => {
                    document.getElementById('available-requests-section')?.scrollIntoView({ behavior: 'smooth' });
                  }, 120);
                }}
                className="font-bold text-[#2563EB] dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer text-[11px]"
              >
                {t('availableRequests')} ({visibleRequestsCount}) <ArrowRight size={12} />
              </button>
            ) : activeJobs.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onNavigate?.('jobs');
                }}
                className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer text-[11px]"
              >
                {t('myAssignedJob')} <ArrowRight size={12} />
              </button>
            ) : (
              <span className="text-[11px] text-zinc-400 font-mono">
                {t('onDuty')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
