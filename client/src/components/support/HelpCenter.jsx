import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, MessageSquare, Briefcase, UserCheck, 
  CreditCard, Train, Shield, ChevronRight, Phone, 
  AlertTriangle, Luggage, HelpCircle, FileText, 
  Bell, ChevronDown, ChevronUp, Check, ArrowRight, Clock,
  Calendar, CheckCircle2, Headphones, X
} from 'lucide-react';
import oneCoolieLogo from '../../assets/onecoolie-logo.png';
import trainHeroImg from '../../assets/images/vande-bharat-crisp.jpg';
import aiRobotImg from '../../assets/images/ai-support-robot.jpg';
import { getTickets, subscribeToSupportUpdates } from '../../utils/supportStore';
import { FAQ_CATEGORIES, FAQ_QUESTIONS } from '../../utils/supportFaqData';
import ProfileMenu from '../../context/ProfileMenu';
import PassengerNotifications from '../PassengerNotifications';

export default function HelpCenter({ onNavigate, activeTrip, user, embeddedInDashboard = false }) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [tickets, setTickets] = useState([]);
  const [selectedFaqCategory, setSelectedFaqCategory] = useState('all');
  const [faqSearchQuery, setFaqSearchQuery] = useState('');
  const [expandedFaqId, setExpandedFaqId] = useState(null);

  useEffect(() => {
    setTickets(getTickets());
    const unsubscribe = subscribeToSupportUpdates(() => {
      setTickets(getTickets());
    });
    return () => unsubscribe();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onNavigate('chat', { initialQuery: searchQuery.trim() });
    }
  };

  const handleQuickQuestion = (q) => {
    onNavigate('chat', { initialQuery: q });
  };

  const toggleFaq = (id) => {
    setExpandedFaqId(prev => prev === id ? null : id);
  };

  const filteredFaqs = useMemo(() => {
    return FAQ_QUESTIONS.filter((faq) => {
      const matchesCategory = selectedFaqCategory === 'all' || faq.category === selectedFaqCategory;
      const q = faqSearchQuery.toLowerCase().trim();
      const matchesQuery = !q || 
        faq.question.toLowerCase().includes(q) || 
        faq.answer.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [selectedFaqCategory, faqSearchQuery]);

  // Top 2 tickets for the summary view
  const displayedTickets = tickets.slice(0, 2);

  return (
    <div className={`${embeddedInDashboard ? 'w-full' : 'min-h-screen flex flex-col bg-[#F8FAFC]'} text-slate-900 font-sans selection:bg-[#1463FF] selection:text-white`}>
      
      {/* ── 1. TOP NAVBAR (MATCHING STANDARD PASSENGER PORTAL) ───── */}
      {!embeddedInDashboard && (
        <>
          {/* 1A. Mobile Phone Screen Navbar (<md) */}
          {/* 1A. Mobile Phone Screen Navbar (<md) */}
          <header className="sticky top-2.5 z-40 px-3 max-w-full md:hidden mb-2">
            <div className="bg-white rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-200/80 px-4 py-2 flex items-center justify-between">
              <button type="button" onClick={() => navigate('/')} className="flex items-center cursor-pointer">
                <img src={oneCoolieLogo} alt="OneCoolie" className="h-9 w-auto object-contain" />
              </button>
              <div className="flex items-center gap-2">
                <PassengerNotifications
                  onNavigateTab={(t) => navigate(`/dashboard?tab=${t}`)}
                  buttonClassName="w-9 h-9 rounded-full bg-slate-100 text-zinc-700 flex items-center justify-center relative border border-slate-200/60 shadow-2xs cursor-pointer"
                />
                <ProfileMenu role="passenger" onNavigate={(t) => navigate(`/dashboard?tab=${t}`)} />
              </div>
            </div>

            {/* Mobile Tab Row */}
            <div className="flex items-center justify-between p-1 bg-slate-100/90 rounded-full border border-slate-200/60 mt-2 w-full shadow-2xs gap-1">
              <button
                type="button"
                onClick={() => navigate('/dashboard?tab=book')}
                className="flex-1 py-2 rounded-full text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 text-zinc-600"
              >
                <Train className="w-3.5 h-3.5" />
                <span>Book</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard?tab=trips')}
                className="flex-1 py-2 rounded-full text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 text-zinc-600"
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>My Trips</span>
                <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-black text-white">
                  3
                </span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="flex-1 py-2 rounded-full text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 bg-black text-white shadow-xs"
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>Help</span>
              </button>
            </div>
          </header>

          {/* 1B. Laptop / Desktop Full-Width Corner-to-Corner Navbar (>=md) */}
          <header className="hidden md:block sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
            <div className="w-full px-6 lg:px-10 xl:px-12 py-3.5 lg:py-4 flex items-center justify-between">
              {/* Far Left: OneCoolie Logo */}
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
                  onClick={() => navigate('/dashboard?tab=book')}
                  className="px-5 lg:px-6 py-2.5 rounded-full text-xs lg:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer text-zinc-600 hover:text-black font-semibold"
                >
                  <Train className="w-4 h-4" />
                  <span>Book</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/dashboard?tab=trips')}
                  className="px-5 lg:px-6 py-2.5 rounded-full text-xs lg:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer text-zinc-600 hover:text-black font-semibold"
                >
                  <Briefcase className="w-4 h-4" />
                  <span>My Trips</span>
                  <span className="min-w-[20px] h-[20px] px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center bg-black text-white">
                    3
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('home')}
                  className="px-5 lg:px-6 py-2.5 rounded-full text-xs lg:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer bg-black text-white shadow-xs"
                >
                  <Headphones className="w-4 h-4" />
                  <span>Help & Support</span>
                </button>
              </div>

              {/* Far Right: Notification Bell + Profile Menu */}
              <div className="flex items-center gap-3.5">
                <PassengerNotifications
                  onNavigateTab={(t) => navigate(`/dashboard?tab=${t}`)}
                  buttonClassName="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-zinc-700 flex items-center justify-center transition-colors relative cursor-pointer group border border-slate-200/60 shadow-2xs"
                />

                <ProfileMenu role="passenger" onNavigate={(t) => navigate(`/dashboard?tab=${t}`)} />
              </div>
            </div>
          </header>
        </>
      )}

      {/* ── MAIN CONTENT CONTAINER ──────────────────────────────── */}
      <div className={`w-full ${embeddedInDashboard ? 'space-y-8' : 'flex-1 max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8'}`}>

        {/* ── 2. HERO / SUPPORT HEADER ──────────────────────────── */}
        <section className="relative rounded-3xl bg-gradient-to-r from-white via-white to-blue-50/40 border border-slate-200/70 p-6 sm:p-10 overflow-hidden shadow-2xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            
            {/* Left Column: Heading + Search + Popular Questions */}
            <div className="lg:col-span-7 space-y-5">
              
              <div>
                <h1 className="text-3xl sm:text-4xl lg:text-[46px] font-black text-slate-950 tracking-tight leading-[1.15] mt-1">
                  How can we <span className="text-[#1463FF]">help you today?</span>
                </h1>
                <p className="text-sm sm:text-base text-slate-500 font-medium mt-2">
                  Find answers, raise a ticket, or talk to our support team.
                </p>
              </div>

              {/* Large Search Bar */}
              <form onSubmit={handleSearchSubmit} className="relative max-w-xl">
                <div className="relative flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search FAQs or describe your issue..."
                    className="block w-full pl-11 pr-14 py-3.5 bg-white border border-slate-200/90 rounded-full text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1463FF] focus:border-transparent shadow-xs transition-all"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 w-9 h-9 rounded-full bg-[#1463FF] hover:bg-blue-700 text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>

              {/* Popular Questions Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="text-slate-500 font-semibold mr-1">Popular:</span>
                {[
                  'Where is my assistant?',
                  'Payment issue',
                  'Refund',
                  'Luggage',
                  'Booking',
                  'Train delay'
                ].map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickQuestion(q)}
                    className="bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 font-medium px-3.5 py-1.5 rounded-full transition-all cursor-pointer shadow-2xs hover:border-slate-300"
                  >
                    {q}
                  </button>
                ))}
              </div>

            </div>

            {/* Right Column: Train Visual Graphic with Soft Fade */}
            <div className="lg:col-span-5 hidden lg:block relative">
              <div className="relative rounded-2xl overflow-hidden shadow-md border border-slate-200/60 bg-white">
                
                {/* Train Image */}
                <div className="relative h-64 w-full overflow-hidden">
                  <img
                    src={trainHeroImg}
                    alt="OneCoolie High Speed Rail"
                    className="w-full h-full object-cover object-right"
                  />
                  {/* Subtle Gradient Blend */}
                  <div className="absolute inset-0 bg-gradient-to-r from-white/30 via-transparent to-black/10"></div>
                </div>

                {/* Top-Right Badge Box matching reference mockup */}
                <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-xl p-2.5 shadow-md flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#1463FF] text-white font-black text-sm flex items-center justify-center shadow-xs">
                    1
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-900 leading-none">
                      PEOPLE TRAVEL.
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-900 leading-none mt-0.5">
                      WE ASSIST.
                    </span>
                    <span className="text-[10px] font-black tracking-wider text-[#1463FF] mt-1 uppercase">
                      ONECOOLIE
                    </span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* ── 3. THREE PRIMARY SUPPORT ACTION CARDS (MATCHING REFERENCE MOCKUP) ── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Card 1: FAQs */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-2xs hover:border-blue-300 hover:shadow-xs transition-all flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-[#1463FF] text-white flex items-center justify-center shadow-xs">
                <HelpCircle className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">FAQs</h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
                Find quick answers to common questions.
              </p>
            </div>

            <div className="pt-6 space-y-3">
              <button
                type="button"
                onClick={() => onNavigate('faq')}
                className="w-full bg-black hover:bg-zinc-800 text-white font-bold py-3 px-5 rounded-full text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs group-hover:bg-zinc-900"
              >
                <span>Browse FAQs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                <Check className="w-3.5 h-3.5 text-[#1463FF]" />
                <span>Instant answers</span>
              </div>
            </div>
          </div>

          {/* Card 2: Raise a Ticket */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-2xs hover:border-blue-300 hover:shadow-xs transition-all flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-[#1463FF] text-white flex items-center justify-center shadow-xs">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Raise a Ticket</h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
                Tell us what went wrong and our support team will help.
              </p>
            </div>

            <div className="pt-6 space-y-3">
              <button
                type="button"
                onClick={() => onNavigate('raise_ticket')}
                className="w-full bg-black hover:bg-zinc-800 text-white font-bold py-3 px-5 rounded-full text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs group-hover:bg-zinc-900"
              >
                <span>Raise a Ticket</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                <Clock className="w-3.5 h-3.5 text-[#1463FF]" />
                <span>Get a response from our team</span>
              </div>
            </div>
          </div>

          {/* Card 3: Chat with Support */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-2xs hover:border-blue-300 hover:shadow-xs transition-all flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-[#1463FF] text-white flex items-center justify-center shadow-xs">
                <Headphones className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Chat with Support</h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
                Chat with our AI assistant or connect with a support agent.
              </p>
            </div>

            <div className="pt-6 space-y-3">
              <button
                type="button"
                onClick={() => onNavigate('chat')}
                className="w-full bg-black hover:bg-zinc-800 text-white font-bold py-3 px-5 rounded-full text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs group-hover:bg-zinc-900"
              >
                <span>Start Chat</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Online · Available 24/7</span>
              </div>
            </div>
          </div>

        </section>

        {/* ── 4. ACTIVE TRIP SUPPORT ─────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1463FF] flex items-center justify-center border border-blue-100 shadow-2xs">
                <Train className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 leading-tight">Need help with a trip?</h3>
                <p className="text-xs text-slate-500">Select a trip to get personalized support with its details.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/dashboard?tab=trips')}
              className="text-xs font-bold text-[#1463FF] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All Trips</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Active Trip Horizontal Card - Dynamic Real Data or Clean Empty State */}
          {activeTrip ? (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-5 hover:border-slate-300 transition-all">
              {/* Left: Date Box & Details */}
              <div className="flex items-start sm:items-center gap-4 sm:gap-6">
                {/* Vertical Date Box */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-center min-w-[72px] shrink-0">
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    {activeTrip.dateMonth || 'TRIP'}
                  </span>
                  <span className="block text-2xl font-black text-slate-900 leading-tight my-0.5">
                    {activeTrip.dateDay || '--'}
                  </span>
                  <span className="block text-[10px] font-semibold text-slate-400">
                    {activeTrip.dateYear || new Date().getFullYear()}
                  </span>
                  <span className="block text-[10px] font-black text-slate-600 uppercase mt-0.5">
                    {activeTrip.dateDayName || 'ACTIVE'}
                  </span>
                </div>

                {/* Train Route & Meta Chips */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base sm:text-lg font-black text-slate-900">
                      {activeTrip.trainNo} · {activeTrip.trainName}
                    </h4>
                  </div>
                  
                  <p className="text-xs sm:text-sm font-semibold text-slate-500 flex items-center gap-1.5">
                    <span>{activeTrip.source || 'Origin Station'}</span>
                    <span className="text-slate-400">→</span>
                    <span>{activeTrip.destination || 'Destination'}</span>
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {activeTrip.coach && (
                      <span className="bg-slate-50 border border-slate-200/70 rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-700 flex items-center gap-1.5">
                        <Train className="w-3 h-3 text-[#1463FF]" />
                        <span>{activeTrip.coach}</span>
                      </span>
                    )}
                    {activeTrip.seat && (
                      <span className="bg-slate-50 border border-slate-200/70 rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-700 flex items-center gap-1.5">
                        <span className="w-3 h-3 flex items-center justify-center text-[#1463FF] font-bold text-[10px]">🪑</span>
                        <span>{activeTrip.seat}</span>
                      </span>
                    )}
                    <span className="bg-slate-50 border border-slate-200/70 rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-700 flex items-center gap-1.5">
                      <Luggage className="w-3 h-3 text-[#1463FF]" />
                      <span>{activeTrip.service || 'Station Assistance'}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Confirmed Badge & CTA */}
              <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider rounded-md border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {activeTrip.status || 'CONFIRMED'}
                </span>

                <button
                  type="button"
                  onClick={() => onNavigate('chat', { preloadContext: 'trip', trip: activeTrip })}
                  className="bg-black hover:bg-zinc-800 text-white font-bold px-6 py-3 rounded-full text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs"
                >
                  <span>Get Help With This Trip</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                  <Train className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900">
                    No active railway journey found
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5 max-w-md">
                    You have no active bookings. Book coolie &amp; porter assistance for your upcoming train journey to get live assistant tracking and priority help.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard?tab=book')}
                  className="w-full sm:w-auto bg-black hover:bg-zinc-800 text-white font-bold px-5 py-2.5 rounded-full text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Train className="w-3.5 h-3.5" />
                  <span>Book Assistance</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('chat')}
                  className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2.5 rounded-full text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>Ask Support</span>
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── 5. YOUR SUPPORT TICKETS (MATCHING REFERENCE MOCKUP) ──── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1463FF] flex items-center justify-center border border-blue-100 shadow-2xs">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 leading-tight">Your Support Tickets</h3>
                <p className="text-xs text-slate-500">Track your open and previous support requests.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('tickets')}
              className="text-xs font-bold text-[#1463FF] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All Tickets</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Ticket Rows or Real Clean Empty State */}
          {displayedTickets.length === 0 ? (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-8 text-center space-y-3 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1463FF] flex items-center justify-center mx-auto border border-blue-100">
                <FileText className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900">No support tickets yet</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                You have not submitted any support tickets. If you need help with a journey, assistant, or refund, start a chat with our support team.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('chat')}
                  className="inline-flex items-center gap-2 bg-black hover:bg-zinc-800 text-white font-bold px-5 py-2.5 rounded-full text-xs transition-all shadow-xs cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Start Support Chat</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedTickets.map((ticket) => {
                const isResolved = ['resolved', 'closed'].includes(ticket.status);
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => onNavigate('ticket_detail', { ticketId: ticket.id })}
                    className="w-full bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 flex items-center justify-between text-left hover:border-slate-300 hover:shadow-2xs transition-all cursor-pointer group"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-500 shrink-0 group-hover:text-[#1463FF] group-hover:bg-blue-50 transition-colors mt-0.5">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900 font-mono tracking-wide">
                            #{ticket.id}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 truncate mt-0.5">
                          {ticket.subject}
                        </h4>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {ticket.trip?.trainNo ? `Train ${ticket.trip.trainNo}${ticket.trip.route ? ` · ${ticket.trip.route}` : ''}` : 'General Support Inquiry'}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {ticket.trip?.journeyDate || (ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent')} · {isResolved ? 'Resolved' : 'In Progress'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      {isResolved ? (
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider rounded-md border border-emerald-200">
                          RESOLVED
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-wider rounded-md border border-amber-200">
                          IN PROGRESS
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── 6. EMERGENCY HELP BANNER (MATCHING REFERENCE MOCKUP) ── */}
        <section className="bg-rose-50/40 border border-rose-100 rounded-3xl p-5 sm:p-6 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 w-full sm:w-auto">
            <div className="w-12 h-12 rounded-2xl bg-[#E11D48] text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-600/20">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                Emergency Help
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                For immediate danger or medical/security emergencies.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end shrink-0">
            <a
              href="tel:112"
              className="bg-[#E11D48] hover:bg-rose-700 text-white font-black py-2.5 px-6 rounded-full flex items-center justify-center gap-2 text-xs shadow-md shadow-rose-600/20 transition-all cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call 112</span>
            </a>

            <button
              type="button"
              onClick={() => onNavigate('faq', { category: 'train' })}
              className="text-xs font-bold text-[#1463FF] hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <span>Station Help &amp; Safety information</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>

      </div>

      {/* ── 7. FOOTER ───────────────────────────────────────────── */}
      {!embeddedInDashboard && (
        <footer className="w-full bg-white border-t border-slate-200/80 py-6 mt-12">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-medium">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-center sm:text-left">
              <span className="font-semibold text-slate-800">© 2026 OneCoolie. All rights reserved.</span>
              <span className="text-slate-400">Under Movesphere Technologies</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="w-8 h-px bg-slate-300"></span>
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                People Travel. We Assist.
              </span>
            </div>
          </div>
        </footer>
      )}

    </div>
  );
}
