import { useState, useEffect } from 'react';

/* ============================================================
   OFFLINE BANNER — Minimalist Connectivity Alert
   ============================================================ */

export default function OfflineBanner() {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOffline = () => setOnline(false);
    const handleOnline = () => setOnline(true);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (online) return null;

  return (
    <aside
      aria-label="Offline status banner"
      className="fixed top-0 left-0 right-0 z-[200] bg-black text-white text-center text-xs font-semibold py-2.5 px-4 border-b border-white/20 animate-fade-in flex items-center justify-center gap-2"
    >
      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
      <span>You are currently offline. Attempting to reconnect to OneCoolie network...</span>
    </aside>
  );
}