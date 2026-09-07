import { Toaster } from 'react-hot-toast';

/* ============================================================
   TOAST PROVIDER — Apple-Style Minimal Notifications
   ============================================================ */

export default function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 3500,
        style: {
          background: '#000000',
          color: '#ffffff',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          padding: '12px 18px',
          fontSize: '13px',
          fontWeight: '600',
          fontFamily: 'var(--font-sans)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
        },
        success: {
          iconTheme: {
            primary: '#2563eb',
            secondary: '#ffffff',
          },
        },
        error: {
          iconTheme: {
            primary: '#ffffff',
            secondary: '#000000',
          },
        },
      }}
    />
  );
}