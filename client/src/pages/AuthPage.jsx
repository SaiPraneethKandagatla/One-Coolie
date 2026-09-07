import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { STATIONS } from '../utils/services';
import oneCoolieLogo from '../assets/onecoolie-logo.png';
import assistantHeroBg from '../assets/images/assistant-hero-bg.jpg';
import passengerHeroBg from '../assets/images/passenger-hero-bg.jpg';
import {
  Mail,
  Lock,
  Phone,
  Eye,
  EyeOff,
  ShieldCheck,
  UserCheck,
  Clock,
  Zap,
  Briefcase,
  Train,
  ArrowRight,
  Sparkles,
  Users,
  MapPin,
  CheckCircle2,
  Luggage,
  Armchair,
  Accessibility,
} from 'lucide-react';

/* ============================================================
   ONECOOLIE AUTHENTICATION PORTAL (Swiss Mobility Standard)
   • 58-60% Left: Immersive Railway Platform Centerpiece
   • 40-42% Right: Floating 500-570px Mobility Login Card
   • Roles:
     - Passenger Portal (/auth): Traveler Transit Assistance
     - Assistant Portal (/assistant-auth): Verified Assistant Network
   ============================================================ */

const maskEmail = (e) => {
  const [l, d] = (e || '').split('@');
  if (!d) return e;
  return `${l[0]}${'•'.repeat(Math.min(l.length - 1, 4))}@${d}`;
};

/* ─── 6-DIGIT OTP BOXES ─────────────────────────────────────── */
function OtpBoxes({ value, onChange, disabled }) {
  const refs = useRef([]);
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);

  const set = (i, ch) => {
    const next = [...digits];
    next[i] = ch;
    onChange(next.join(''));
    if (ch && i < 5) refs.current[i + 1]?.focus();
  };

  return (
    <div className="flex gap-2 sm:gap-2.5">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          id={`otp-${i}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          disabled={disabled}
          autoComplete="one-time-code"
          onChange={(e) => set(i, e.target.value.replace(/\D/, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              if (d) set(i, '');
              else if (i > 0) {
                refs.current[i - 1]?.focus();
                set(i - 1, '');
              }
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
            onChange(p.padEnd(6, '').slice(0, 6));
            refs.current[Math.min(p.length, 5)]?.focus();
          }}
          style={{ caretColor: 'transparent' }}
          className={[
            'flex-1 min-w-0 h-12 sm:h-14 text-center text-xl font-bold font-mono rounded-xl border-2',
            'transition-all duration-150 outline-none select-none',
            disabled ? 'opacity-40 cursor-not-allowed bg-zinc-50' : 'cursor-text',
            d
              ? 'border-[#1463FF] bg-blue-50/70 text-[#1463FF] shadow-xs'
              : 'border-[#E3E8F0] bg-white text-zinc-900 focus:border-[#1463FF] focus:bg-blue-50/30',
          ].join(' ')}
        />
      ))}
    </div>
  );
}

/* ─── COUNTDOWN TIMER ───────────────────────────────────────── */
function Countdown({ seconds, onDone }) {
  const [t, setT] = useState(seconds);
  useEffect(() => { setT(seconds); }, [seconds]);
  useEffect(() => {
    if (t <= 0) { onDone?.(); return; }
    const id = setTimeout(() => setT((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [t, onDone]);
  if (t <= 0) return null;
  return (
    <span className="font-mono font-bold text-[#1463FF] text-xs tabular-nums">
      {String(Math.floor(t / 60)).padStart(2, '0')}:{String(t % 60).padStart(2, '0')}
    </span>
  );
}

/* ─── MINIMAL RAILWAY/TRAIN LOADER (Inside CTA Button) ────────── */
function ButtonTrainLoader({ text = 'Connecting...' }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-0.5">
      <div className="relative w-24 h-5 flex items-center overflow-hidden">
        {/* Sleeper Track dash line */}
        <div className="absolute inset-x-0 bottom-1.5 h-0.5 border-b border-dashed border-white/50" />
        {/* Moving Train */}
        <div className="animate-train-glide flex items-center gap-1 text-white">
          <Train className="w-5 h-5 drop-shadow-sm" />
          <span className="w-1.5 h-1 bg-white/80 rounded-full" />
        </div>
      </div>
      <span className="text-xs font-bold tracking-wider uppercase text-white/95">{text}</span>
    </div>
  );
}

/* ─── MAIN AUTH PAGE COMPONENT ──────────────────────────────── */
export default function AuthPage({ role = 'passenger' }) {
  const isA = role === 'assistant';

  // Primary active tab: 'login' | 'signup'
  const [activeTab, setActiveTab] = useState('login');

  // Sign up verification sub-step: 'form' | 'otp' | 'success'
  const [signupStep, setSignupStep] = useState('form');

  // Form fields
  const [loginMethod, setLoginMethod] = useState('email'); // 'email' | 'phone'
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [stationCode, setStationCode] = useState('KZJ');
  const [otpValue, setOtpValue] = useState('');

  // UI status
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [resendKey, setResendKey] = useState(0);

  const { login, sendOtp, verifyOtpRegister } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Listen for navigation flash messages (e.g. from registration redirect)
  useEffect(() => {
    if (location.state?.message) {
      if (/success|registered|approved/i.test(location.state.message)) {
        setSuccessMsg(location.state.message);
      } else {
        setInfoMsg(location.state.message);
      }
    }
  }, [location.state]);

  // Focus OTP box when entering OTP step
  useEffect(() => {
    if (activeTab === 'signup' && signupStep === 'otp') {
      setTimeout(() => document.getElementById('otp-0')?.focus(), 100);
    }
  }, [activeTab, signupStep]);

  // Auto-verify on 6th digit in OTP step
  useEffect(() => {
    if (activeTab === 'signup' && signupStep === 'otp' && otpValue.length === 6 && !loading) {
      handleVerifyOtp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpValue]);

  const clearAlerts = () => {
    setError('');
    setInfoMsg('');
    setSuccessMsg('');
  };

  const switchTab = (tab) => {
    clearAlerts();
    setActiveTab(tab);
    setSignupStep('form');
    setOtpValue('');
  };

  /* ============================================================
     1. SIGN IN SUBMISSION (Email / Phone + Password)
     ============================================================ */
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    clearAlerts();

    let identifier = '';
    if (loginMethod === 'phone') {
      const cleanDigits = loginPhone.replace(/\D/g, '');
      if (!cleanDigits) {
        setError('Please enter your 10-digit mobile number.');
        return;
      }
      if (cleanDigits.length !== 10) {
        setError('Please enter a valid 10-digit mobile number.');
        return;
      }
      identifier = cleanDigits;
    } else {
      const raw = loginEmail.trim();
      if (!raw) {
        setError('Please enter your email address or mobile number.');
        return;
      }
      // If user typed a 10-digit mobile number in the email field, extract digits
      const digitsOnly = raw.replace(/\D/g, '');
      if (digitsOnly.length === 10 && !raw.includes('@')) {
        identifier = digitsOnly;
      } else {
        identifier = raw.toLowerCase();
      }
    }

    if (!loginPassword) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const userData = await login(identifier, loginPassword, role, '', loginMethod === 'phone' ? loginPhone : '');
      setSignupStep('success');
      setTimeout(() => {
        const search = location.search || '';
        if (userData.role === 'assistant') {
          navigate('/assistant', { replace: true });
        } else {
          navigate(`/dashboard${search}`, { replace: true });
        }
      }, 900);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Invalid credentials. Please check and try again.';
      if (/awaiting.*admin.*approval/i.test(msg)) {
        setSuccessMsg(msg);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     2. SIGN UP: STEP 1 — Send OTP
     ============================================================ */
  const handleSendSignupOtp = async (e) => {
    e.preventDefault();
    clearAlerts();

    const name = signupName.trim();
    const email = signupEmail.trim().toLowerCase();
    const cleanPhone = signupPhone.replace(/\D/g, '');

    if (!name) {
      setError('Please enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address (e.g. name@gmail.com).');
      return;
    }
    if (!cleanPhone || cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile phone number.');
      return;
    }
    if (signupPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await sendOtp(email, 'signup');
      setInfoMsg(res?.message || `A 6-digit verification code has been sent to ${email}`);
      setCanResend(false);
      setResendKey((k) => k + 1);
      setOtpValue('');
      setSignupStep('otp');
    } catch (err) {
      const msg = err?.response?.data?.message;
      if (err?.response?.status === 409 || msg?.toLowerCase().includes('already exists')) {
        setError(msg || 'An account with this email already exists.');
        setLoginEmail(email);
      } else {
        setError(msg || 'Unable to send verification code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     3. SIGN UP: STEP 2 — Verify OTP & Register
     ============================================================ */
  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    clearAlerts();

    if (otpValue.length !== 6) {
      setError('Please enter all 6 digits of the verification code.');
      return;
    }

    setLoading(true);
    try {
      const cleanPhone = signupPhone.replace(/\D/g, '');
      const formattedPhone = cleanPhone.length === 10 ? `+91 ${cleanPhone}` : signupPhone.trim();

      const res = await verifyOtpRegister(
        signupName.trim(),
        signupEmail.trim().toLowerCase(),
        otpValue,
        signupPassword,
        role,
        isA ? stationCode : undefined,
        formattedPhone
      );

      if (res?.token || res?.user?.token) {
        setSignupStep('success');
        setTimeout(() => {
          const search = location.search || '';
          navigate(role === 'assistant' ? '/assistant' : `/dashboard${search}`, { replace: true });
        }, 1100);
      } else {
        setActiveTab('login');
        setSignupStep('form');
        setLoginEmail(signupEmail.trim().toLowerCase());
        setSuccessMsg(res?.message || 'Registration successful! Your account is awaiting admin approval.');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Verification failed. Please check the code.';
      if (err?.response?.status === 409 || msg.toLowerCase().includes('already exists')) {
        setError('An account with this verified email already exists.');
        setLoginEmail(signupEmail.trim().toLowerCase());
      } else {
        setError(msg);
      }
      if (/expired|invalidated/i.test(msg)) {
        setCanResend(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend || loading) return;
    clearAlerts();
    setLoading(true);
    try {
      const res = await sendOtp(signupEmail.trim().toLowerCase(), 'signup');
      setInfoMsg(res?.message || 'A fresh verification code was sent to your email.');
      setCanResend(false);
      setResendKey((k) => k + 1);
      setOtpValue('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     SUCCESS SCREEN
     ============================================================ */
  if (signupStep === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] p-6 font-sans">
        <div className="text-center space-y-5 max-w-sm bg-white p-8 sm:p-10 rounded-[32px] border border-[#E3E8F0] shadow-xl">
          <div className="w-16 h-16 rounded-full bg-[#071A3D] text-white flex items-center justify-center shadow-md mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-[#071A3D]">
              {activeTab === 'login' ? 'Welcome Back!' : 'Account Created!'}
            </h2>
            <p className="text-xs text-[#7C8494] mt-1.5">
              Taking you to your {isA ? 'assistant portal' : 'dashboard'}...
            </p>
          </div>
          <div className="flex justify-center gap-1.5 pt-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-[#1463FF] animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ============================================================
     FEATURE ITEMS DATA
     ============================================================ */
  const passengerFeatures = [
    {
      title: 'Luggage Assistance',
      desc: 'Porters for hassle-free travel',
      icon: Luggage,
    },
    {
      title: 'Seat Escorting',
      desc: 'Get help to your coach',
      icon: Armchair,
    },
    {
      title: 'Wheelchair Assistance',
      desc: 'Travel comfortably',
      icon: Accessibility,
    },
    {
      title: 'Senior Citizen Support',
      desc: 'A safer, smoother journey',
      icon: Users,
    },
  ];

  const assistantFeatures = [
    {
      title: 'Verified Assistant',
      desc: 'Trusted and trained',
      icon: UserCheck,
    },
    {
      title: 'On-Demand Requests',
      desc: 'Assist passengers when needed',
      icon: Clock,
    },
    {
      title: 'Smart Dispatch',
      desc: 'Get assigned assistance requests',
      icon: Zap,
    },
    {
      title: 'Flexible Work',
      desc: 'Serve passengers across stations',
      icon: Briefcase,
    },
  ];

  const features = isA ? assistantFeatures : passengerFeatures;

  /* ============================================================
     RENDER AUTH PAGE (Swiss Two-Column Production Experience)
     • Desktop: 58-60% Left Hero / 40-42% Right Login Card (500-570px)
     • Mobile: Single-Column Layout (< 768px)
     ============================================================ */
  return (
    <div className="min-h-screen lg:h-screen w-full flex flex-col lg:flex-row bg-[#F5F7FA] text-zinc-900 font-sans selection:bg-[#1463FF] selection:text-white overflow-x-hidden">

      {/* ────────────────────────────────────────────────────────
          LEFT SECTION (~58-60% on Desktop): Immersive Railway Centerpiece
          ──────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[58%] xl:w-[60%] relative overflow-hidden flex-col justify-between p-8 xl:p-12 2xl:p-14 select-none">
        {/* Photographic Railway Station Centerpiece */}
        <img
          src={isA ? assistantHeroBg : passengerHeroBg}
          alt={isA ? 'OneCoolie Assistant Platform' : 'OneCoolie Passenger Railway Assistance'}
          className="absolute inset-0 w-full h-full object-cover object-center"
        />

        {/* Subtle white-to-transparent fade ensuring 100% typography legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/88 to-white/20 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-transparent to-white/95 pointer-events-none" />

        {/* Content Container (Layered above scrim) */}
        <div className="relative z-10 flex flex-col justify-between h-full">

          {/* Top-Left Header: Brand Identity & Status Pill */}
          <div className="space-y-3">
            <Link to="/" className="inline-block group">
              <img
                src={oneCoolieLogo}
                alt="OneCoolie"
                className="h-10 sm:h-12 md:h-13 w-auto object-contain transition-transform duration-200 group-hover:scale-102"
              />
            </Link>

            <p className="text-xs text-[#7C8494] font-medium tracking-wide">
              Making Every Journey Easier.
            </p>

            <div className="pt-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-2xs text-[11px] font-semibold text-zinc-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{isA ? 'Trusted • Safe • Hassle-Free' : 'Trusted. Safe. Hassle-Free.'}</span>
              </div>
            </div>
          </div>

          {/* Center Left: Headline, Subheading & 4 Features Stack */}
          <div className="py-4 xl:py-6 max-w-lg">
            {/* Headline */}
            {isA ? (
              <>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#7C8494] block mb-2">
                  ASSISTANT NETWORK
                </span>
                <h1 className="text-3xl sm:text-4xl xl:text-5xl font-extrabold text-[#071A3D] tracking-tight leading-[1.12] mb-3.5">
                  Powering <span className="text-[#1463FF]">Better</span><br />
                  Journeys, Together.
                </h1>
                <p className="text-xs sm:text-sm xl:text-base text-zinc-600 font-normal leading-relaxed mb-6">
                  Connect with passengers, manage assistance requests, and make every station journey easier.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-3xl sm:text-4xl xl:text-5xl 2xl:text-[52px] font-extrabold text-[#071A3D] tracking-tight leading-[1.1] mb-3.5">
                  Your Journey.<br />
                  <span className="text-[#1463FF]">Our Support.</span>
                </h1>
                <p className="text-xs sm:text-sm xl:text-base text-zinc-600 font-normal leading-relaxed mb-6">
                  Book trained assistants, get real-time help at railway stations, and travel with confidence.
                </p>
              </>
            )}

            {/* 4 Clean Feature Rows */}
            <div className="space-y-3.5">
              {features.map((feat, idx) => {
                const IconComponent = feat.icon;
                return (
                  <div key={idx} className="flex items-center gap-3.5 group">
                    <div className="w-10 sm:w-11 h-10 sm:h-11 rounded-full bg-[#1463FF]/10 text-[#1463FF] border border-[#1463FF]/20 flex items-center justify-center shrink-0 shadow-2xs transition-transform duration-200 group-hover:scale-105">
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#071A3D] tracking-tight leading-snug">
                        {feat.title}
                      </h3>
                      <p className="text-xs text-[#7C8494] leading-tight">
                        {feat.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom-Left Brand Statement & Station Pill */}
          <div className="pt-4 border-t border-slate-200/70 flex items-end justify-between">
            <div>
              <div className="w-6 h-0.5 bg-[#1463FF] mb-2 rounded-full" />
              <span className="text-xs font-bold text-[#071A3D] block tracking-tight">
                People. Journeys.
              </span>
              <span className="text-xs font-medium text-[#7C8494]">
                A Stronger India.
              </span>
            </div>

            {/* Platform Accent Capsule */}
            <div className="hidden xl:inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white/95 backdrop-blur-md border border-[#E3E8F0] shadow-2xs">
              <Train className="w-5 h-5 text-[#1463FF]" />
              <div className="text-[11px] leading-tight text-left font-medium text-[#071A3D]">
                <span className="font-bold block">More Stations. More Journeys.</span>
                <span className="text-[#7C8494]">A More Inclusive India.</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ────────────────────────────────────────────────────────
          RIGHT SECTION (40-42% on Desktop): Large Floating White Login Card (500-570px)
          ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-between p-4 sm:p-6 lg:p-8 xl:p-10 relative overflow-y-auto min-h-screen lg:min-h-0 bg-[#F5F7FA]">

        {/* Top Header Row: Back to Home Link (Desktop & Mobile) */}
        <div className="relative z-20 flex items-center justify-between w-full max-w-[500px] xl:max-w-[550px] mx-auto lg:max-w-none lg:justify-end">
          {/* Mobile Logo on top of screen */}
          <Link to="/" className="lg:hidden flex items-center gap-2">
            <img src={oneCoolieLogo} alt="OneCoolie" className="h-8 sm:h-9 w-auto object-contain" />
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7C8494] hover:text-[#071A3D] transition-colors py-2 px-3.5 rounded-full hover:bg-white border border-transparent hover:border-[#E3E8F0]"
          >
            <span>&larr;</span>
            <span>Back to Home</span>
          </Link>
        </div>

        {/* Center: Large Floating White Login Card (approx 500-570px wide) */}
        <div className="relative z-10 flex-1 flex items-center justify-center py-4 sm:py-6">
          <div className="w-full max-w-[480px] sm:max-w-[520px] xl:max-w-[550px] bg-white rounded-[28px] sm:rounded-[32px] border border-blue-100/90 shadow-[0_20px_60px_-15px_rgba(7,26,61,0.06)] p-6 sm:p-9 xl:p-10 transition-all">

            {/* Card Brand Header & Clear Portal Badge */}
            <div className="text-center mb-4 sm:mb-5">
              <div className="flex flex-col items-center justify-center">
                <img
                  src={oneCoolieLogo}
                  alt="OneCoolie"
                  className="h-10 sm:h-12 md:h-13 max-h-[52px] w-auto object-contain mb-2.5 transition-transform hover:scale-102"
                />

                {/* Portal Pill Badge with Icon */}
                <span
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider border transition-all duration-200 ${isA
                      ? 'bg-amber-50 text-amber-900 border-amber-200/90 shadow-2xs'
                      : 'bg-blue-50 text-[#1463FF] border-blue-200/90 shadow-2xs'
                    }`}
                >
                  {isA ? (
                    <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                  ) : (
                    <Users className="w-3.5 h-3.5 text-[#1463FF]" />
                  )}
                  <span>{isA ? 'ASSISTANT PORTAL' : 'PASSENGER PORTAL'}</span>
                </span>
              </div>
            </div>

            {/* Headline & Subheading */}
            <div className="text-center mb-4 sm:mb-5">
              <h1 className="text-2xl sm:text-[26px] font-extrabold text-[#071A3D] tracking-tight mb-1">
                {activeTab === 'login'
                  ? 'Welcome Back'
                  : signupStep === 'otp'
                    ? 'Verify Email'
                    : isA
                      ? 'Create Assistant Account'
                      : 'Create Account'}
              </h1>
              <p className="text-xs sm:text-sm text-[#7C8494] font-normal">
                {activeTab === 'login'
                  ? isA
                    ? 'Sign in to manage your assistance requests.'
                    : 'Sign in to continue your journey with OneCoolie.'
                  : signupStep === 'otp'
                    ? `Enter the 6-digit code sent to ${maskEmail(signupEmail)}`
                    : isA
                      ? 'Sign up to register as a verified station assistant.'
                      : 'Sign up to start your journey with OneCoolie.'}
              </p>
            </div>

            {/* Inline Alert / Error Notice */}
            {error && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs flex items-start gap-2.5 animate-shake">
                <span className="font-bold shrink-0">⚠️</span>
                <span className="leading-snug">{error}</span>
              </div>
            )}
            {successMsg && (
              <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-300 text-emerald-800 text-xs flex items-start gap-2.5 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-snug font-medium">{successMsg}</span>
              </div>
            )}
            {infoMsg && (
              <div
                className={`mb-4 p-3.5 rounded-2xl text-xs flex items-start gap-2.5 shadow-2xs ${/success|registered|approval/i.test(infoMsg)
                    ? 'bg-emerald-50/90 border border-emerald-300 text-emerald-800'
                    : 'bg-blue-50 border border-blue-200/80 text-blue-800'
                  }`}
              >
                {/success|registered|approval/i.test(infoMsg) ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <span className="font-bold shrink-0">ℹ️</span>
                )}
                <span className="leading-snug font-medium">{infoMsg}</span>
              </div>
            )}

            {/* ── TAB 1: SIGN IN (Email / Phone + Password) ───────── */}
            {activeTab === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">

                {/* Sign-in Method Switcher: Email Address vs Phone Number */}
                <div className="flex items-center p-1 bg-slate-100 rounded-2xl mb-3 border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMethod('email');
                      clearAlerts();
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
                      loginMethod === 'email'
                        ? 'bg-white text-[#1463FF] shadow-xs'
                        : 'text-[#7C8494] hover:text-[#071A3D]'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email Address</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMethod('phone');
                      clearAlerts();
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
                      loginMethod === 'phone'
                        ? 'bg-white text-[#1463FF] shadow-xs'
                        : 'text-[#7C8494] hover:text-[#071A3D]'
                    }`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Mobile Number</span>
                  </button>
                </div>

                {/* Identifier Input (Email or Phone Number) */}
                {loginMethod === 'phone' ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 px-3.5 py-3 bg-zinc-50/70 hover:bg-white focus-within:bg-white border border-[#E3E8F0] focus-within:border-[#1463FF] focus-within:ring-4 focus-within:ring-[#1463FF]/10 rounded-2xl transition-all duration-200">
                      <div className="flex items-center gap-1.5 pr-2.5 border-r border-slate-200 text-xs font-bold text-zinc-700 select-none shrink-0">
                        <span className="text-sm leading-none">🇮🇳</span>
                        <span>+91</span>
                      </div>
                      <Phone className="w-4 h-4 text-[#7C8494] shrink-0" />
                      <input
                        id="login-phone"
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        required
                        autoComplete="tel"
                        placeholder="10-digit mobile number"
                        value={loginPhone}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setLoginPhone(digits);
                          if (error) clearAlerts();
                        }}
                        disabled={loading}
                        className="w-full bg-transparent text-sm text-[#071A3D] placeholder:text-[#7C8494] outline-none font-medium tracking-wide"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 px-4 py-3 bg-zinc-50/70 hover:bg-white focus-within:bg-white border border-[#E3E8F0] focus-within:border-[#1463FF] focus-within:ring-4 focus-within:ring-[#1463FF]/10 rounded-2xl transition-all duration-200">
                      <Mail className="w-5 h-5 text-[#7C8494] shrink-0" />
                      <input
                        id="login-email"
                        type="text"
                        required
                        autoComplete="email"
                        placeholder="Email address or mobile number"
                        value={loginEmail}
                        onChange={(e) => {
                          setLoginEmail(e.target.value);
                          if (error) clearAlerts();
                        }}
                        disabled={loading}
                        className="w-full bg-transparent text-sm text-[#071A3D] placeholder:text-[#7C8494] outline-none font-medium"
                      />
                    </div>
                  </div>
                )}

                {/* Password Field */}
                <div className="space-y-1">
                  <div className="flex items-center gap-3 px-4 py-3 bg-zinc-50/70 hover:bg-white focus-within:bg-white border border-[#E3E8F0] focus-within:border-[#1463FF] focus-within:ring-4 focus-within:ring-[#1463FF]/10 rounded-2xl transition-all duration-200">
                    <Lock className="w-5 h-5 text-[#7C8494] shrink-0" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      placeholder="Password"
                      value={loginPassword}
                      onChange={(e) => {
                        setLoginPassword(e.target.value);
                        if (error) clearAlerts();
                      }}
                      disabled={loading}
                      className="w-full bg-transparent text-sm text-[#071A3D] placeholder:text-[#7C8494] outline-none font-medium"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((s) => !s)}
                      className="text-[#7C8494] hover:text-[#071A3D] transition-colors p-1"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Keep Me Signed In & Forgot Password */}
                <div className="flex items-center justify-between text-xs text-[#7C8494] pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-[#E3E8F0] text-[#1463FF] focus:ring-[#1463FF]/20 accent-[#1463FF] cursor-pointer"
                    />
                    <span className="font-medium text-zinc-700">Keep me signed in</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      if (loginMethod === 'phone') {
                        if (!loginPhone.trim()) {
                          setError('Please enter your mobile number above to receive password reset instructions.');
                        } else {
                          setInfoMsg(`Password recovery instructions sent to +91 ${loginPhone}. Please check your phone.`);
                        }
                      } else {
                        if (!loginEmail.trim()) {
                          setError('Please enter your email above to receive password reset instructions.');
                        } else {
                          setInfoMsg(`Password recovery instructions sent to ${loginEmail}. Please check your inbox.`);
                        }
                      }
                    }}
                    className="font-semibold text-[#1463FF] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Primary CTA Button (Sign In ->) with Minimal Moving Train Loader */}
                <button
                  type="submit"
                  id="btn-login-submit"
                  disabled={
                    loading ||
                    (loginMethod === 'email' ? !loginEmail.trim() : loginPhone.replace(/\D/g, '').length !== 10) ||
                    !loginPassword
                  }
                  className="w-full h-[54px] sm:h-[56px] px-6 rounded-[28px] bg-[#1463FF] hover:bg-[#0d52dd] active:scale-[0.99] text-white font-bold text-sm tracking-wide shadow-md shadow-[#1463FF]/25 hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <ButtonTrainLoader text="Signing In..." />
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Account Toggle Link */}
                <div className="pt-2 text-center text-xs text-[#7C8494] font-medium">
                  <span>Don&apos;t have an account? </span>
                  <button
                    type="button"
                    onClick={() => switchTab('signup')}
                    className="font-bold text-[#1463FF] hover:underline cursor-pointer ml-1"
                  >
                    {isA ? 'Create Assistant Account' : 'Create Account'}
                  </button>
                </div>

                {/* Explicit OR Divider */}
                <div className="relative pt-3 text-center">
                  <div className="absolute inset-0 flex items-center pt-3">
                    <div className="w-full border-t border-[#E3E8F0]" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-3 text-[#7C8494] font-bold uppercase tracking-wider text-[11px]">
                      or
                    </span>
                  </div>
                </div>

                {/* Secondary Portal Switch */}
                <div className="pt-2 text-center">
                  {isA ? (
                    <Link
                      to="/auth"
                      className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 px-4 rounded-2xl text-xs font-semibold text-[#475569] bg-[#F8FAFC] hover:bg-blue-50/80 border border-[#E2E8F0] hover:border-[#1463FF]/30 transition-all duration-200 shadow-2xs group"
                    >
                      <div className="w-6 h-6 rounded-full bg-blue-100/70 flex items-center justify-center text-[#1463FF] shrink-0">
                        <Train className="w-3.5 h-3.5" />
                      </div>
                      <span>Are you a passenger?</span>
                      <span className="font-bold text-[#1463FF] group-hover:underline">Passenger Portal &rarr;</span>
                    </Link>
                  ) : (
                    <Link
                      to="/assistant-auth"
                      className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 px-4 rounded-2xl text-xs font-semibold text-[#475569] bg-[#F8FAFC] hover:bg-blue-50/80 border border-[#E2E8F0] hover:border-[#1463FF]/30 transition-all duration-200 shadow-2xs group"
                    >
                      <div className="w-6 h-6 rounded-full bg-blue-100/70 flex items-center justify-center text-[#1463FF] shrink-0">
                        <Train className="w-3.5 h-3.5" />
                      </div>
                      <span>Are you an assistant?</span>
                      <span className="font-bold text-[#1463FF] group-hover:underline">Assistant Portal &rarr;</span>
                    </Link>
                  )}
                </div>

                {/* Security Reassurance Badge */}
                <div className="pt-2 text-center">
                  <p className="text-[10px] text-[#7C8494] flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      {isA
                        ? 'Encrypted • Verified Identity • OneCoolie Assistant Network'
                        : 'Encrypted • Verified Identity • OneCoolie Rail Network'}
                    </span>
                  </p>
                </div>

                {/* Bottom Right Indian Accent Tag */}
                <div className="pt-2 flex justify-end">
                  <div className="flex flex-col items-end text-right select-none opacity-85">
                    <span className="text-[10px] font-bold text-[#071A3D] leading-tight">Safer Journeys</span>
                    <span className="text-[10px] font-medium text-[#7C8494] leading-tight">Stronger India.</span>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="w-3.5 h-0.5 rounded-full bg-[#FF9933]" />
                      <span className="w-3.5 h-0.5 rounded-full bg-slate-300" />
                      <span className="w-3.5 h-0.5 rounded-full bg-[#128807]" />
                    </div>
                  </div>
                </div>
              </form>
            )}

            {/* ── TAB 2: SIGN UP — STEP 1 (Details Form) ─────────── */}
            {activeTab === 'signup' && signupStep === 'form' && (
              <form onSubmit={handleSendSignupOtp} className="space-y-4">
                {/* Name Field */}
                <div className="space-y-1">
                  <div className="flex items-center gap-3 px-4 py-3 bg-zinc-50/70 hover:bg-white focus-within:bg-white border border-[#E3E8F0] focus-within:border-[#1463FF] focus-within:ring-4 focus-within:ring-[#1463FF]/10 rounded-2xl transition-all duration-200">
                    <UserCheck className="w-5 h-5 text-[#7C8494] shrink-0" />
                    <input
                      id="signup-name"
                      type="text"
                      required
                      autoFocus
                      placeholder="Full Name"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      disabled={loading}
                      className="w-full bg-transparent text-sm text-[#071A3D] placeholder:text-[#7C8494] outline-none font-medium"
                    />
                  </div>
                </div>

                {/* Email Field */}
                <div className="space-y-1">
                  <div className="flex items-center gap-3 px-4 py-3 bg-zinc-50/70 hover:bg-white focus-within:bg-white border border-[#E3E8F0] focus-within:border-[#1463FF] focus-within:ring-4 focus-within:ring-[#1463FF]/10 rounded-2xl transition-all duration-200">
                    <Mail className="w-5 h-5 text-[#7C8494] shrink-0" />
                    <input
                      id="signup-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="Email address (e.g. name@gmail.com) *"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      disabled={loading}
                      className="w-full bg-transparent text-sm text-[#071A3D] placeholder:text-[#7C8494] outline-none font-medium"
                    />
                  </div>
                </div>

                {/* Mobile Number Field (Required) */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 px-3.5 py-3 bg-zinc-50/70 hover:bg-white focus-within:bg-white border border-[#E3E8F0] focus-within:border-[#1463FF] focus-within:ring-4 focus-within:ring-[#1463FF]/10 rounded-2xl transition-all duration-200">
                    <div className="flex items-center gap-1.5 pr-2.5 border-r border-slate-200 text-xs font-bold text-zinc-700 select-none shrink-0">
                      <span className="text-sm leading-none">🇮🇳</span>
                      <span>+91</span>
                    </div>
                    <Phone className="w-4 h-4 text-[#7C8494] shrink-0" />
                    <input
                      id="signup-phone"
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      required
                      autoComplete="tel"
                      placeholder="10-digit mobile number *"
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      disabled={loading}
                      className="w-full bg-transparent text-sm text-[#071A3D] placeholder:text-[#7C8494] outline-none font-medium tracking-wide"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1">
                  <div className="flex items-center gap-3 px-4 py-3 bg-zinc-50/70 hover:bg-white focus-within:bg-white border border-[#E3E8F0] focus-within:border-[#1463FF] focus-within:ring-4 focus-within:ring-[#1463FF]/10 rounded-2xl transition-all duration-200">
                    <Lock className="w-5 h-5 text-[#7C8494] shrink-0" />
                    <input
                      id="signup-password"
                      type={showSignupPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      placeholder="Create Password (min. 6 characters)"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      disabled={loading}
                      className="w-full bg-transparent text-sm text-[#071A3D] placeholder:text-[#7C8494] outline-none font-medium"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowSignupPassword((s) => !s)}
                      className="text-[#7C8494] hover:text-[#071A3D] transition-colors p-1"
                      aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                    >
                      {showSignupPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Assistant Station Selection (Only if role === 'assistant') */}
                {isA && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 px-4 py-3 bg-zinc-50/70 hover:bg-white focus-within:bg-white border border-[#E3E8F0] focus-within:border-[#1463FF] rounded-2xl transition-all duration-200">
                      <MapPin className="w-5 h-5 text-[#1463FF] shrink-0" />
                      <select
                        id="signup-station"
                        value={stationCode}
                        onChange={(e) => setStationCode(e.target.value)}
                        disabled={loading}
                        className="w-full bg-transparent text-sm font-semibold text-[#071A3D] outline-none cursor-pointer"
                      >
                        {STATIONS.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.name} ({s.code}) — {s.division}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Create Account Primary Button */}
                <button
                  type="submit"
                  id="btn-signup-send-otp"
                  disabled={loading || !signupName.trim() || !signupEmail.trim() || signupPhone.replace(/\D/g, '').length !== 10 || signupPassword.length < 6}
                  className="w-full h-[54px] sm:h-[56px] px-6 rounded-[28px] bg-[#1463FF] hover:bg-[#0d52dd] active:scale-[0.99] text-white font-bold text-sm tracking-wide shadow-md shadow-[#1463FF]/25 hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <ButtonTrainLoader text="Sending OTP..." />
                  ) : (
                    <>
                      <span>{isA ? 'Create Assistant Account' : 'Send Verification Code'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Account Toggle */}
                <div className="pt-2 text-center text-xs text-[#7C8494] font-medium">
                  <span>Already have an account? </span>
                  <button
                    type="button"
                    onClick={() => switchTab('login')}
                    className="font-bold text-[#1463FF] hover:underline cursor-pointer ml-1"
                  >
                    Sign In
                  </button>
                </div>

                {/* Explicit OR Divider */}
                <div className="relative pt-3 text-center">
                  <div className="absolute inset-0 flex items-center pt-3">
                    <div className="w-full border-t border-[#E3E8F0]" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-3 text-[#7C8494] font-bold uppercase tracking-wider text-[11px]">
                      or
                    </span>
                  </div>
                </div>

                {/* Secondary Portal Link */}
                <div className="pt-2 text-center">
                  {isA ? (
                    <Link
                      to="/auth"
                      className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 px-4 rounded-2xl text-xs font-semibold text-[#475569] bg-[#F8FAFC] hover:bg-blue-50/80 border border-[#E2E8F0] hover:border-[#1463FF]/30 transition-all duration-200 shadow-2xs group"
                    >
                      <div className="w-6 h-6 rounded-full bg-blue-100/70 flex items-center justify-center text-[#1463FF] shrink-0">
                        <Train className="w-3.5 h-3.5" />
                      </div>
                      <span>Are you a passenger?</span>
                      <span className="font-bold text-[#1463FF] group-hover:underline">Passenger Portal &rarr;</span>
                    </Link>
                  ) : (
                    <Link
                      to="/assistant-auth"
                      className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 px-4 rounded-2xl text-xs font-semibold text-[#475569] bg-[#F8FAFC] hover:bg-blue-50/80 border border-[#E2E8F0] hover:border-[#1463FF]/30 transition-all duration-200 shadow-2xs group"
                    >
                      <div className="w-6 h-6 rounded-full bg-blue-100/70 flex items-center justify-center text-[#1463FF] shrink-0">
                        <Train className="w-3.5 h-3.5" />
                      </div>
                      <span>Are you an assistant?</span>
                      <span className="font-bold text-[#1463FF] group-hover:underline">Assistant Portal &rarr;</span>
                    </Link>
                  )}
                </div>

                {/* Security Badge */}
                <div className="pt-2 text-center">
                  <p className="text-[10px] text-[#7C8494] flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      {isA
                        ? 'Encrypted • Verified Identity • OneCoolie Assistant Network'
                        : 'Encrypted • Verified Identity • OneCoolie Rail Network'}
                    </span>
                  </p>
                </div>
              </form>
            )}

            {/* ── TAB 2: SIGN UP — STEP 2 (OTP Entry) ────────────── */}
            {activeTab === 'signup' && signupStep === 'otp' && (
              <div className="space-y-5 animate-fade-in-up">
                <div className="p-3.5 bg-blue-50/80 border border-blue-100 rounded-2xl text-center">
                  <p className="text-xs text-blue-800 font-medium">
                    Code sent to <span className="font-mono font-bold text-[#071A3D]">{signupEmail}</span>
                  </p>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-center text-xs font-bold uppercase tracking-wider text-[#7C8494]">
                      Enter 6-Digit Code
                    </label>
                    <OtpBoxes value={otpValue} onChange={setOtpValue} disabled={loading} />
                  </div>

                  <button
                    type="submit"
                    id="btn-verify-signup-otp"
                    disabled={loading || otpValue.length < 6}
                    className="w-full h-[54px] sm:h-[56px] px-6 rounded-[28px] bg-[#1463FF] hover:bg-[#0d52dd] active:scale-[0.99] text-white font-bold text-sm tracking-wide shadow-md shadow-[#1463FF]/25 hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    {loading ? (
                      <ButtonTrainLoader text="Verifying..." />
                    ) : (
                      <>
                        <span>Verify &amp; Create Account</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSignupStep('form');
                      clearAlerts();
                    }}
                    className="text-[#7C8494] hover:text-[#071A3D] font-medium"
                  >
                    &larr; Back to details
                  </button>

                  <div className="text-right">
                    {canResend ? (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={loading}
                        className="font-bold text-[#1463FF] hover:underline cursor-pointer"
                      >
                        Resend Code
                      </button>
                    ) : (
                      <span className="text-[#7C8494]">
                        Resend in <Countdown key={resendKey} seconds={60} onDone={() => setCanResend(true)} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Mobile-Only Below-Login Hero Banner & Features */}
        <div className="lg:hidden w-full max-w-[480px] mx-auto mt-4 mb-6 space-y-4">
          <div className="relative rounded-[24px] overflow-hidden border border-[#E3E8F0] shadow-sm">
            <img
              src={isA ? assistantHeroBg : passengerHeroBg}
              alt="OneCoolie Railway Station"
              className="w-full h-44 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#071A3D]/90 via-[#071A3D]/40 to-transparent flex flex-col justify-end p-4 text-white">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#1463FF] bg-white/90 px-2.5 py-0.5 rounded-full w-fit mb-1">
                {isA ? 'Assistant Network' : 'Passenger Support'}
              </span>
              <h3 className="text-base font-extrabold leading-tight">
                {isA ? 'Powering Better Journeys' : 'Your Journey. Our Support.'}
              </h3>
              <p className="text-xs text-slate-200 mt-0.5">
                {isA
                  ? 'Connect with passengers and manage station requests.'
                  : 'Book trained assistants and travel with confidence.'}
              </p>
            </div>
          </div>

          {/* Feature Badges Grid on Mobile */}
          <div className="grid grid-cols-2 gap-2.5">
            {features.map((feat, idx) => {
              const IconComponent = feat.icon;
              return (
                <div
                  key={idx}
                  className="bg-white p-3 rounded-2xl border border-[#E3E8F0] shadow-2xs flex items-center gap-2.5"
                >
                  <div className="w-8 h-8 rounded-full bg-[#1463FF]/10 text-[#1463FF] flex items-center justify-center shrink-0">
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-[#071A3D] truncate">{feat.title}</h4>
                    <p className="text-[10px] text-[#7C8494] truncate">{feat.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Attribution (Mobile & Desktop) */}
        <div className="relative z-20 text-center py-2 text-[11px] text-[#7C8494] font-medium">
          <span>© 2026 OneCoolie. Making Every Journey Easier.</span>
        </div>

      </div>
    </div>
  );
}