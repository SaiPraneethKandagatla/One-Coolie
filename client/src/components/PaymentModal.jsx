import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ShieldCheck,
  Check,
  Clock,
  QrCode,
  Info,
  RotateCw,
  ArrowRight,
  ArrowLeft,
  Train,
  Banknote,
  X,
  ExternalLink,
  Smartphone,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';
import oneCoolieLogo from '../assets/onecoolie-logo.png';
import axios from '../api/axios';
import { loadRazorpayScript } from '../utils/razorpay';
import { useAuth } from '../context/AuthContext';

/* ============================================================
   ONECOOLIE PAYMENT MODAL — Swiss Mobility Fintech Checkout
   • UPI Merchant: onecoolie@ybl (VPA hidden from display as requested)
   • Desktop: QR code with 15-minute countdown timer & 5-step walkthrough
   • Phone Screen: Direct 1-tap native UPI app launchers
   • Razorpay Live Online Payment Checkout Integration
   • Cash on Service direct confirmation
   ============================================================ */

const UPI_MERCHANT_ID = 'onecoolie@ybl';
const MERCHANT_NAME = 'OneCoolie';

export default function PaymentModal({ open, total = 0, onClose, onPaid, bookingData }) {
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [paymentStep, setPaymentStep] = useState('select'); // 'select' | 'online'
  const [timeLeft, setTimeLeft] = useState(899); // 14:59 (15 minutes)
  const [qrKey, setQrKey] = useState(0);
  const [bookingRef, setBookingRef] = useState('OC386022');

  // Load or restore active session when modal opens
  useEffect(() => {
    if (open) {
      try {
        const raw = sessionStorage.getItem('onecoolie_active_payment');
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved && saved.active && saved.expireAt && saved.expireAt > Date.now()) {
            setBookingRef(saved.bookingRef || 'OC386022');
            setPaymentStep(saved.paymentStep || 'online');
            const remaining = Math.max(0, Math.floor((saved.expireAt - Date.now()) / 1000));
            setTimeLeft(remaining);
            return;
          }
        }
      } catch (e) {
        // ignore
      }

      // Fresh opening
      const randNum = Math.floor(100000 + Math.random() * 900000);
      setBookingRef(`OC${randNum}`);
      setTimeLeft(899);
      setPaymentStep('select');
    }
  }, [open]);

  // Sync remaining time with real timestamp on visibilitychange / focus & interval
  useEffect(() => {
    if (!open || paymentStep !== 'online') return;

    const syncTime = () => {
      try {
        const raw = sessionStorage.getItem('onecoolie_active_payment');
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved && saved.expireAt) {
            const remaining = Math.max(0, Math.floor((saved.expireAt - Date.now()) / 1000));
            if (remaining <= 0) {
              const newExpire = Date.now() + 899 * 1000;
              saved.expireAt = newExpire;
              sessionStorage.setItem('onecoolie_active_payment', JSON.stringify(saved));
              setQrKey((k) => k + 1);
              setTimeLeft(899);
            } else {
              setTimeLeft(remaining);
            }
            return;
          }
        }
      } catch (e) { }

      setTimeLeft((prev) => (prev > 1 ? prev - 1 : 899));
    };

    const interval = setInterval(syncTime, 1000);

    const handleVisibilityOrFocus = () => {
      syncTime();
    };

    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [open, paymentStep]);

  if (!open) return null;

  const formattedAmount = Number(total || 0).toFixed(2);
  const transactionNote = encodeURIComponent(`OneCoolie Booking #${bookingRef}`);

  // Official NPCI UPI Intent & App Schemes with dynamic amount pre-filled
  const genericUpiUri = `upi://pay?pa=${UPI_MERCHANT_ID}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${formattedAmount}&cu=INR&tn=${transactionNote}&mode=02&purpose=00`;
  const phonePeUri = `phonepe://pay?pa=${UPI_MERCHANT_ID}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${formattedAmount}&cu=INR&tn=${transactionNote}&mode=02`;
  const gPayUri = `tez://upi/pay?pa=${UPI_MERCHANT_ID}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${formattedAmount}&cu=INR&tn=${transactionNote}&mode=02`;
  const paytmUri = `paytmmp://pay?pa=${UPI_MERCHANT_ID}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${formattedAmount}&cu=INR&tn=${transactionNote}&mode=02`;

  const handleSelectOnline = () => {
    setPaymentStep('online');
    const expireTimestamp = Date.now() + 899 * 1000;
    setTimeLeft(899);
    try {
      const sessionData = {
        active: true,
        paymentStep: 'online',
        bookingRef,
        expireAt: expireTimestamp,
        total,
        ...(bookingData || {})
      };
      sessionStorage.setItem('onecoolie_active_payment', JSON.stringify(sessionData));
    } catch (e) {
      console.error(e);
    }
  };

  const handleBackToSelect = () => {
    setPaymentStep('select');
    try {
      sessionStorage.removeItem('onecoolie_active_payment');
    } catch (e) { }
  };

  const handleModalClose = () => {
    try {
      sessionStorage.removeItem('onecoolie_active_payment');
    } catch (e) { }
    onClose();
  };

  const handleRegenerateQr = () => {
    setQrKey((k) => k + 1);
    const expireTimestamp = Date.now() + 899 * 1000;
    setTimeLeft(899);
    try {
      const raw = sessionStorage.getItem('onecoolie_active_payment');
      if (raw) {
        const saved = JSON.parse(raw);
        saved.expireAt = expireTimestamp;
        sessionStorage.setItem('onecoolie_active_payment', JSON.stringify(saved));
      }
    } catch (e) { }
  };

  const handleUpiAppLaunch = () => {
    try {
      const expireTimestamp = Date.now() + timeLeft * 1000;
      sessionStorage.setItem(
        'onecoolie_active_payment',
        JSON.stringify({
          active: true,
          paymentStep: 'online',
          bookingRef,
          expireAt: expireTimestamp,
          total,
          ...(bookingData || {})
        })
      );
    } catch (e) { }
  };

  const handleConfirmPayment = async () => {
    setProcessing(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || typeof window === 'undefined' || !window.Razorpay) {
        toast.error('Payment gateway SDK failed to load. Please check your connection.');
        setProcessing(false);
        return;
      }

      // 1. Create order on backend with authoritative pricing & Option C rules
      const orderPayload = {
        train_no: bookingData?.selectedTrain?.train_no || '12727',
        train_name: bookingData?.selectedTrain?.train_name || 'Godavari Express',
        station_code: bookingData?.station || 'KZJ',
        journey_date: bookingData?.journeyDate || new Date().toISOString().split('T')[0],
        journey_time: bookingData?.journeyTime || '10:00',
        services: {
          ...(bookingData?.services || {}),
          platform: bookingData?.selectedTrain?.platform || '2',
          luggage: bookingData?.luggageTotalCount || 0,
          luggageCounts: bookingData?.luggageCounts || { small: 0, medium: 0, large: 0 },
          luggage_details: bookingData?.luggageSummaryLabel || '',
        },
        payment_method: 'online',
        coach: bookingData?.coach || 'S1',
        seat_number: bookingData?.seatNumber || '1',
        berth_type: bookingData?.berthType || 'LB',
        action_type: bookingData?.actionType || 'load_to_seat',
        pnr: bookingData?.pnrInput || '',
        platform: bookingData?.selectedTrain?.platform || '2',
      };

      const { data: orderRes } = await axios.post('/payments/create-order', orderPayload);

      if (!orderRes || !orderRes.razorpay || !orderRes.razorpay.order_id) {
        throw new Error(orderRes?.message || 'Failed to initialize payment gateway order.');
      }

      const bookingObj = orderRes.booking || {};
      const targetBookingId = bookingObj.id || orderRes.booking_id;

      // 2. Launch Razorpay Standard Checkout
      const options = {
        key: orderRes.razorpay.key_id,
        amount: orderRes.razorpay.amount,
        currency: orderRes.razorpay.currency || 'INR',
        name: 'OneCoolie',
        description: `Station Assistance #${bookingObj.booking_id || targetBookingId}`,
        image: oneCoolieLogo,
        order_id: orderRes.razorpay.order_id,
        handler: async function (response) {
          try {
            setProcessing(true);
            const { data: verifyRes } = await axios.post('/payments/verify', {
              booking_id: targetBookingId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            sessionStorage.removeItem('onecoolie_active_payment');
            await onPaid('online', verifyRes.booking || bookingObj);
          } catch (vErr) {
            console.error('Verification error:', vErr);
            toast.error(vErr.response?.data?.message || 'Payment verification failed. Please contact support.');
          } finally {
            setProcessing(false);
          }
        },
        prefill: {
          name: user?.name || user?.full_name || '',
          email: user?.email || '',
          contact: user?.phone || user?.phoneNumber || user?.phone_number || ''
        },
        theme: {
          color: '#1463FF'
        },
        modal: {
          ondismiss: function () {
            setProcessing(false);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        toast.error(`Payment failed: ${resp?.error?.description || 'Transaction cancelled'}`);
        setProcessing(false);
      });
      rzp.open();
    } catch (err) {
      console.error('Razorpay checkout error:', err);
      const msg = err.response?.data?.message || err.message || 'Unable to open online checkout';
      toast.error(msg);
      setProcessing(false);
    }
  };

  const handleCashConfirm = async () => {
    setProcessing(true);
    try {
      sessionStorage.removeItem('onecoolie_active_payment');
      await onPaid('cash');
    } finally {
      setProcessing(false);
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-900/50 backdrop-blur-md animate-fade-in select-none overflow-y-auto"
      onClick={handleModalClose}
    >
      <div
        className={`w-full ${paymentStep === 'select' ? 'max-w-xl' : 'max-w-4xl'
          } bg-white rounded-[26px] sm:rounded-[32px] border border-slate-200/90 shadow-[0_25px_70px_-15px_rgba(7,26,61,0.22)] p-5 sm:p-7 relative animate-scale-in text-zinc-900 my-auto overflow-hidden transition-all duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top Header Bar ────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3.5 mb-5">
          {/* Left: Brand Logo + Back Button (if on step 2) */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {paymentStep === 'online' && (
              <button
                type="button"
                onClick={handleBackToSelect}
                className="px-2.5 sm:px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-zinc-700 hover:text-zinc-900 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                aria-label="Back to payment methods"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Back</span>
              </button>
            )}
            <img
              src={oneCoolieLogo}
              alt="OneCoolie"
              className="h-8 sm:h-9 md:h-10 w-auto object-contain"
            />
          </div>

          {/* Right: Security Trust Badge & Close Button */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2 text-right">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="hidden sm:block text-left">
                <span className="text-xs font-extrabold text-[#071A3D] block leading-tight">
                  {paymentStep === 'online' ? 'Secure UPI Payment' : 'Secure Payment'}
                </span>
                <span className="text-[11px] font-medium text-[#7C8494] block leading-tight">
                  256-bit encrypted
                </span>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200" />

            <button
              type="button"
              onClick={handleModalClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-zinc-500 hover:text-zinc-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────────
            STEP 1: SELECT PAYMENT METHOD (Online Payment OR Cash on Payment)
            ──────────────────────────────────────────────────────────── */}
        {paymentStep === 'select' && (
          <div className="space-y-5 animate-fade-in">
            {/* Header & Dynamic Amount */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-[#071A3D] tracking-tight leading-tight">
                  Choose Payment Method
                </h3>
                <p className="text-xs sm:text-sm text-zinc-500 mt-1 font-medium">
                  Select your preferred payment option for your OneCoolie booking
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">
                  AMOUNT
                </span>
                <span className="text-2xl sm:text-3xl font-black text-[#1463FF] tracking-tight font-sans">
                  ₹{total}
                </span>
              </div>
            </div>

            {/* The Two Prominent Options */}
            <div className="space-y-3 pt-1">

              {/* Option 1: Online Payment */}
              <div
                role="button"
                tabIndex={0}
                onClick={handleSelectOnline}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleSelectOnline();
                }}
                className="w-full p-4 sm:p-5 rounded-2xl sm:rounded-3xl border-2 border-slate-200 hover:border-[#1463FF] bg-white hover:bg-blue-50/20 transition-all duration-150 cursor-pointer text-left group shadow-xs hover:shadow-md relative overflow-hidden"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1463FF] flex items-center justify-center shrink-0 border border-blue-200/80 group-hover:scale-105 group-hover:bg-[#1463FF] group-hover:text-white transition-all duration-150">
                      <QrCode className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base sm:text-lg font-black text-[#071A3D] group-hover:text-[#1463FF] transition-colors leading-tight">
                          Online Payment
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold tracking-wide uppercase">
                          Fast & Direct
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-zinc-700 text-[10px] font-bold">
                          PhonePe
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-zinc-700 text-[10px] font-bold">
                          Google Pay
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-zinc-700 text-[10px] font-bold">
                          Paytm
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#1463FF] text-[10px] font-bold border border-blue-200/70">
                          UPI QR
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="w-9 h-9 rounded-full bg-slate-100 group-hover:bg-[#1463FF] text-zinc-400 group-hover:text-white flex items-center justify-center shrink-0 transition-all duration-150">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Option 2: Cash on Payment */}
              <div
                role="button"
                tabIndex={0}
                onClick={handleCashConfirm}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleCashConfirm();
                }}
                className="w-full p-4 sm:p-5 rounded-2xl sm:rounded-3xl border-2 border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/20 transition-all duration-150 cursor-pointer text-left group shadow-xs hover:shadow-md relative overflow-hidden"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200/80 group-hover:scale-105 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-150">
                      <Banknote className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base sm:text-lg font-black text-[#071A3D] group-hover:text-emerald-700 transition-colors leading-tight">
                          Cash on Payment
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-zinc-700 border border-slate-200 text-[10px] font-extrabold tracking-wide uppercase">
                          Pay After Service
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-zinc-700 text-[10px] font-bold">
                          Cash upon arrival
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-zinc-700 text-[10px] font-bold">
                          Station Assistant QR
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="w-9 h-9 rounded-full bg-slate-100 group-hover:bg-emerald-600 text-zinc-400 group-hover:text-white flex items-center justify-center shrink-0 transition-all duration-150">
                    {processing ? (
                      <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Security Footer */}
            <div className="pt-2 text-center border-t border-slate-100">
              <p className="text-[11px] text-zinc-400 flex items-center justify-center gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>100% Verified Assistants • Transparent Indian Railway Pricing</span>
              </p>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────
            STEP 2: ONLINE PAYMENT (Redirect from Option 1)
            ──────────────────────────────────────────────────────────── */}
        {paymentStep === 'online' && (
          <div className="space-y-4 animate-fade-in">
            {/* Phone / Mobile View (< md): NO QR, direct UPI app launchers */}
            <div className="md:hidden space-y-4">
              {/* Header & Dynamic Amount */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-[#071A3D] tracking-tight leading-tight">
                    Complete Payment
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5 font-medium">
                    Tap your preferred app to pay instantly
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">
                    AMOUNT
                  </span>
                  <span className="text-2xl font-black text-[#1463FF] tracking-tight font-sans">
                    ₹{total}
                  </span>
                </div>
              </div>

              {/* Booking Metadata Strip (Merchant & Booking Ref, No UPI ID) */}
              <div className="p-3 bg-[#F8FAFC] rounded-2xl border border-slate-200/90 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Merchant
                  </span>
                  <span className="font-bold text-zinc-900">{MERCHANT_NAME}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Booking ID
                  </span>
                  <span className="font-mono font-bold text-zinc-900">#{bookingRef}</span>
                </div>
              </div>

              {/* Native UPI App Deep Link Launchers */}
              <div className="space-y-2.5 pt-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500 block">
                  Choose your UPI app to pay
                </span>

                {/* 1. PhonePe Direct Launch */}
                <a
                  href={phonePeUri}
                  onClick={handleUpiAppLaunch}
                  className="w-full h-14 px-4 rounded-2xl bg-[#5F259F] hover:bg-[#521e8c] active:scale-[0.99] text-white font-bold text-sm flex items-center justify-between transition-all duration-150 shadow-xs cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-black text-sm text-white shrink-0">
                      पे
                    </div>
                    <div className="text-left">
                      <span className="block leading-tight">Pay via PhonePe</span>
                      <span className="text-[11px] text-white/80 font-normal leading-tight">
                        Autofills ₹{total} · 1-Tap Pay
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/80" />
                </a>

                {/* 2. Google Pay Direct Launch */}
                <a
                  href={gPayUri}
                  onClick={handleUpiAppLaunch}
                  className="w-full h-14 px-4 rounded-2xl bg-white hover:bg-slate-50 active:scale-[0.99] border border-slate-300 text-zinc-900 font-bold text-sm flex items-center justify-between transition-all duration-150 shadow-xs cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-black text-xs text-blue-600 border border-slate-200 shrink-0">
                      G
                    </div>
                    <div className="text-left">
                      <span className="block leading-tight">Pay via Google Pay</span>
                      <span className="text-[11px] text-zinc-500 font-normal leading-tight">
                        Autofills ₹{total} · GPay Intent
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-400" />
                </a>

                {/* 3. Paytm Direct Launch */}
                <a
                  href={paytmUri}
                  onClick={handleUpiAppLaunch}
                  className="w-full h-13 px-4 rounded-2xl bg-white hover:bg-slate-50 active:scale-[0.99] border border-slate-200 text-zinc-900 font-bold text-sm flex items-center justify-between transition-all duration-150 shadow-xs cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-black text-xs border border-sky-200 shrink-0">
                      P
                    </div>
                    <div className="text-left">
                      <span className="block text-xs leading-tight">Pay via Paytm</span>
                      <span className="text-[10px] text-zinc-500 font-normal leading-tight">
                        Instant Paytm Wallet / UPI
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </a>

                {/* 4. Any Other UPI App (Generic upi:// intent) */}
                <a
                  href={genericUpiUri}
                  onClick={handleUpiAppLaunch}
                  className="w-full h-13 px-4 rounded-2xl bg-blue-50 hover:bg-blue-100/80 active:scale-[0.99] border border-blue-200 text-[#1463FF] font-bold text-sm flex items-center justify-between transition-all duration-150 shadow-xs cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#1463FF] text-white flex items-center justify-center shrink-0">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <span className="block text-xs leading-tight">Any Other UPI App</span>
                      <span className="text-[10px] text-blue-700/80 font-normal leading-tight">
                        BHIM, CRED, Amazon Pay, Any Bank
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#1463FF]/70" />
                </a>
              </div>

              {/* Action Button: Launch Razorpay Checkout */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-xl p-2 text-center font-medium">
                  Official Razorpay Gateway: Supports UPI, Google Pay, PhonePe, Paytm, Cards & Netbanking.
                </p>
                <button
                  type="button"
                  id="btn-completed-payment-mobile"
                  onClick={handleConfirmPayment}
                  disabled={processing}
                  className="w-full h-13 bg-[#1463FF] hover:bg-[#0d52dd] active:scale-[0.99] text-white font-bold text-sm tracking-wide rounded-full shadow-md shadow-[#1463FF]/25 hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {processing ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Opening Secure Checkout...</span>
                    </span>
                  ) : (
                    <>
                      <span>Proceed to Pay with Razorpay</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <p className="text-center text-[10px] text-zinc-400 pt-1">
                🛡️ Encrypted • Verified Merchant • OneCoolie Rail Network
              </p>
            </div>

            {/* ────────────────────────────────────────────────────────────
            2. DESKTOP VIEW (md: and above):
            • Full 2-column layout matching reference design
            • QR code + 15-minute countdown timer
            • NO UPI ID shown (Clean metadata: Merchant Name, Booking ID, Amount)
            • 5-step numbered walkthrough & train accent card
            ──────────────────────────────────────────────────────────── */}
            <div className="hidden md:grid grid-cols-12 gap-6 lg:gap-8 items-start">

              {/* ────────────────────────────────────────────────────────
              DESKTOP LEFT COLUMN (Col 7): Header, QR Code + Timer, Actions
              ──────────────────────────────────────────────────────── */}
              <div className="col-span-7 space-y-4">

                {/* Title & Dynamic Amount Header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-black text-[#071A3D] tracking-tight leading-tight">
                      Complete Payment
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1 font-medium">
                      Scan the QR code with any UPI app to pay securely.
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">
                      AMOUNT
                    </span>
                    <span className="text-2xl sm:text-3xl font-black text-[#1463FF] tracking-tight font-sans">
                      ₹{total}
                    </span>
                  </div>
                </div>

                {/* QR Code Box + Countdown Timer Box Row */}
                <div className="grid grid-cols-2 gap-3.5 items-stretch">

                  {/* Left Sub-card: Large QR Code */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col items-center justify-center relative">
                    <div className="relative p-2 bg-white rounded-xl">
                      <QRCodeSVG
                        key={qrKey}
                        value={genericUpiUri}
                        size={160}
                        level="M"
                        marginSize={1}
                        bgColor="#FFFFFF"
                        fgColor="#071A3D"
                        className="rounded-lg"
                      />
                      {/* Central Brand Graphic Badge */}
                      <div className="absolute inset-0 m-auto w-8 h-8 rounded-full bg-white shadow-xs border border-blue-100 flex items-center justify-center pointer-events-none">
                        <span className="text-sm font-black text-[#1463FF] select-none">∞</span>
                      </div>
                    </div>

                    <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#1463FF] border border-blue-200/70 text-[11px] font-bold shadow-2xs">
                      <QrCode className="w-3 h-3" />
                      <span>Scan with any UPI App</span>
                    </div>
                  </div>

                  {/* Right Sub-card: Countdown Timer & Regenerate */}
                  <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-3">
                    {/* Timer Header */}
                    <div className="flex items-center gap-1.5 text-zinc-700">
                      <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-600">
                        QR CODE EXPIRES IN
                      </span>
                    </div>

                    {/* Big Clock Counter */}
                    <div className="text-center py-1">
                      <div className="font-mono text-3xl sm:text-4xl font-black text-[#071A3D] tracking-wider tabular-nums">
                        {String(minutes).padStart(2, '0')} : {String(seconds).padStart(2, '0')}
                      </div>
                      <div className="flex justify-center gap-10 text-[10px] uppercase font-bold text-zinc-400 mt-0.5">
                        <span>min</span>
                        <span>sec</span>
                      </div>
                    </div>

                    {/* Security Advisory Pill */}
                    <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200/70 text-[11px] text-blue-900 leading-snug flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-[#1463FF] shrink-0 mt-0.5" />
                      <span>For your security, the QR code refreshes automatically every 15 minutes.</span>
                    </div>

                    {/* Regenerate Button */}
                    <button
                      type="button"
                      onClick={handleRegenerateQr}
                      className="w-full py-2 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-[#1463FF] flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer active:scale-[0.99]"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Regenerate QR</span>
                    </button>
                  </div>

                </div>

                {/* Clean Booking Metadata Strip (UPI ID removed as requested) */}
                <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200/90 shadow-2xs">
                  <div className="grid grid-cols-3 gap-2 text-left">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                        Merchant Name
                      </span>
                      <span className="text-xs font-bold text-zinc-900 truncate block">
                        {MERCHANT_NAME}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                        Booking ID
                      </span>
                      <span className="font-mono text-xs font-bold text-zinc-900 truncate block">
                        #{bookingRef}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                        Amount
                      </span>
                      <span className="text-xs font-extrabold text-[#1463FF] block">
                        ₹{total}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary Action Button: "Proceed to Pay with Razorpay" */}
                <div className="space-y-2">
                  <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-xl p-2 text-center font-medium">
                    Official Razorpay Gateway: Supports UPI, Google Pay, PhonePe, Paytm, Cards & Netbanking.
                  </p>
                  <button
                    type="button"
                    id="btn-completed-payment-desktop"
                    onClick={handleConfirmPayment}
                    disabled={processing}
                    className="w-full h-12 sm:h-13 bg-[#1463FF] hover:bg-[#0d52dd] active:scale-[0.99] text-white font-bold text-sm tracking-wide rounded-full shadow-md shadow-[#1463FF]/25 hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {processing ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        <span>Opening Secure Checkout...</span>
                      </span>
                    ) : (
                      <>
                        <span>Proceed to Pay with Razorpay</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

              </div>

              {/* ────────────────────────────────────────────────────────
              DESKTOP RIGHT COLUMN (Col 5): Safe. Simple. Secure. & Numbered Stepper (1-5)
              ──────────────────────────────────────────────────────── */}
              <div className="col-span-5 space-y-4 flex flex-col justify-between h-full pt-1">

                {/* Safe. Simple. Secure. Banner */}
                <div className="p-3.5 sm:p-4 rounded-2xl bg-[#F0F7FF] border border-blue-100/90 shadow-2xs flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-blue-100 text-[#1463FF] flex items-center justify-center shrink-0 border border-blue-200/60">
                    <Train className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-[#071A3D] tracking-tight leading-tight">
                      Safe. Simple. Secure.
                    </h4>
                    <p className="text-xs text-zinc-600 mt-0.5 leading-snug">
                      Complete your payment and confirm your booking.
                    </p>
                  </div>
                </div>

                {/* Numbered Stepper Walkthrough (Steps 1 to 5) */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3.5 relative">
                  {[
                    {
                      num: 1,
                      title: 'Open any UPI app',
                      desc: 'PhonePe, GPay, Paytm, or any UPI app',
                    },
                    {
                      num: 2,
                      title: 'Scan the QR code',
                      desc: 'Use your UPI app to scan',
                    },
                    {
                      num: 3,
                      title: 'Verify amount',
                      desc: `₹${total} (OneCoolie Booking)`,
                    },
                    {
                      num: 4,
                      title: 'Complete payment',
                      desc: "You'll get a confirmation in your UPI app",
                    },
                    {
                      num: 5,
                      title: 'Return to OneCoolie',
                      desc: 'Tap the button below after payment',
                    },
                  ].map((step, idx, arr) => (
                    <div key={step.num} className="relative flex items-start gap-3 group">
                      {/* Step Connector Dotted Line */}
                      {idx < arr.length - 1 && (
                        <div className="absolute left-3 top-6 bottom-0 w-0 border-l border-dashed border-blue-200 -mb-2" />
                      )}

                      {/* Step Number Badge */}
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-[#1463FF] font-black text-xs flex items-center justify-center shrink-0 z-10 border border-blue-200/70">
                        {step.num}
                      </div>

                      {/* Step Description */}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#071A3D] leading-tight">
                          {step.title}
                        </p>
                        <p className="text-[11px] text-[#7C8494] leading-tight mt-0.5">
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* People. Journeys. A Stronger India Accent Card */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50/70 to-slate-50 border border-blue-100/80 shadow-2xs flex items-center justify-between gap-3 overflow-hidden">
                  {/* Minimal Train Vector Silhouette */}
                  <div className="relative w-28 h-10 flex items-center shrink-0">
                    <svg
                      viewBox="0 0 120 40"
                      className="w-full h-full text-[#1463FF]"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M5 28C20 28 40 28 65 24C85 20.8 105 12 115 12C118 12 119 14 119 17C119 24 115 28 95 28H5Z"
                        fill="currentColor"
                        fillOpacity="0.12"
                      />
                      <path
                        d="M2 28H118M10 20H35M45 20H70M80 18H95"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M100 12C108 12 118 16 118 20C118 25 110 28 95 28C65 28 15 28 2 28"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <circle cx="20" cy="28" r="2.5" fill="currentColor" />
                      <circle cx="45" cy="28" r="2.5" fill="currentColor" />
                      <circle cx="70" cy="28" r="2.5" fill="currentColor" />
                    </svg>
                  </div>

                  {/* National Brand Statement */}
                  <div className="text-right">
                    <span className="text-xs font-extrabold text-[#071A3D] block leading-tight">
                      People. Journeys.
                    </span>
                    <span className="text-[11px] font-bold text-zinc-600 block leading-tight">
                      A Stronger India.
                    </span>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="w-3 h-0.5 rounded-full bg-[#FF9933]" />
                      <span className="w-3 h-0.5 rounded-full bg-slate-300" />
                      <span className="w-3 h-0.5 rounded-full bg-[#128807]" />
                    </div>
                  </div>
                </div>

                {/* Bottom Subtle Trust Statement */}
                <div className="text-center pt-1">
                  <p className="text-[10px] text-zinc-400 flex items-center justify-center gap-1.5 font-medium">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>Encrypted • Verified Merchant • OneCoolie Rail Network</span>
                  </p>
                </div>

              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}