import React, { useState } from 'react';
import { 
  ArrowLeft, X, FileText, CheckCircle2, 
  ChevronRight, ArrowRight, Train, HelpCircle, Shield
} from 'lucide-react';
import { createTicket } from '../../utils/supportStore';

export default function RaiseTicketView({ onNavigate, activeTrip, user, bookings = [] }) {
  const [issueType, setIssueType] = useState('Booking');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTripId, setSelectedTripId] = useState(activeTrip?.id || activeTrip?.trainNo || 'active');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState(null);

  // Available trips for dropdown selection
  const tripOptions = [];
  if (activeTrip) {
    tripOptions.push({
      id: activeTrip.id || 'active',
      label: `${activeTrip.trainNo} · ${activeTrip.trainName || 'Express'} (${activeTrip.source || 'Station'} → ${activeTrip.destination || 'Destination'} · ${activeTrip.dateDay || '06'} ${activeTrip.dateMonth || 'Sep'} ${activeTrip.dateYear || '2026'})`,
      raw: activeTrip
    });
  }

  // Add any other user bookings if available and not already added
  if (Array.isArray(bookings)) {
    bookings.forEach((b) => {
      const bId = b.id || b.booking_id;
      if (bId && !tripOptions.some(t => t.id === bId)) {
        tripOptions.push({
          id: bId,
          label: `${b.train_no || b.trainNo || 'Train'} · ${b.train_name || b.trainName || 'Express'} (${b.source || b.from_station || 'Origin'} → ${b.destination || b.to_station || 'Dest'})`,
          raw: {
            trainNo: b.train_no || b.trainNo,
            trainName: b.train_name || b.trainName,
            route: `${b.source || b.from_station || 'Origin'} → ${b.destination || b.to_station || 'Dest'}`,
            coach: b.coach,
            seat: b.seat_number || b.seat,
            journeyDate: b.journey_date || b.created_at
          }
        });
      }
    });
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;

    setIsSubmitting(true);

    const selectedTrip = tripOptions.find(t => t.id === selectedTripId)?.raw || activeTrip || null;

    setTimeout(() => {
      const newTicket = createTicket({
        subject: subject.trim(),
        passengerName: user?.name || 'Passenger',
        passengerPhone: user?.phone || '+91 98765 43210',
        passengerEmail: user?.email || 'passenger@onecoolie.com',
        trip: selectedTrip,
        priority: ['Payment', 'Assistant'].includes(issueType) ? 'high' : 'medium',
        issueType,
        description: description.trim(),
        aiSummary: `${issueType}: ${description.trim()}`,
        initialMessages: [
          {
            id: `msg-${Date.now()}`,
            sender: 'passenger',
            name: user?.name || 'Passenger',
            text: `${subject.trim()}\n\n${description.trim()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]
      });

      setIsSubmitting(false);
      setSubmittedTicket(newTicket);
    }, 400);
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-4 sm:py-6 px-4 sm:px-6 space-y-6 animate-fade-in">
      
      {/* ── SUCCESS STATE SCREEN ─────────────────────────────────── */}
      {submittedTicket ? (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-10 space-y-6 text-center">
          
          <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Ticket Raised Successfully
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-md mx-auto">
              Your support request has been submitted. Our support team will review your request and get back to you shortly.
            </p>
          </div>

          {/* Ticket Receipt Box */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 text-left space-y-3 max-w-md mx-auto">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Ticket ID</span>
              <span className="font-mono font-black text-slate-900 text-sm">
                #{submittedTicket.id}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Status</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-[#1463FF] border border-blue-200">
                Open
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Subject</span>
              <span className="text-xs font-bold text-slate-900 truncate max-w-[200px]">
                {submittedTicket.subject}
              </span>
            </div>

            {submittedTicket.trip?.trainNo && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Train</span>
                <span className="text-xs font-bold text-slate-900">
                  {submittedTicket.trip.trainNo} · {submittedTicket.trip.trainName || 'Express'}
                </span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200/70 text-[11px] text-slate-500">
              Expected response: <strong className="text-slate-700">Within 15 minutes</strong>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('tickets')}
              className="w-full sm:w-auto bg-black hover:bg-zinc-800 text-white font-bold px-6 py-3 rounded-full text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <span>View My Tickets</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 font-bold px-5 py-3 rounded-full text-xs transition-colors cursor-pointer"
            >
              <span>Back to Help &amp; Support</span>
            </button>
          </div>

        </div>
      ) : (

        /* ── TICKET CREATION FORM (MATCHING REFERENCE PANEL 2) ───── */
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
          
          {/* Header with Blue Document Icon & Close Button */}
          <div className="flex items-start justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors border border-slate-200 cursor-pointer shrink-0"
                title="Back to Support"
              >
                <ArrowLeft className="w-4 h-4 text-slate-700" />
              </button>
              <div className="w-10 h-10 rounded-2xl bg-[#1463FF] text-white flex items-center justify-center shadow-xs shrink-0 font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Help &amp; Support / Raise a Ticket
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight mt-0.5">
                  How can we help?
                </h1>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Tell us about your issue and our dedicated support team will get back to you.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Field 1: Issue Type Dropdown */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Issue Type
              </label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50/70 border border-slate-200/90 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1463FF] focus:bg-white transition-all cursor-pointer"
              >
                <option value="Booking">Booking</option>
                <option value="Assistant">Assistant</option>
                <option value="Payment">Payment</option>
                <option value="Refund">Refund</option>
                <option value="Luggage">Luggage</option>
                <option value="Train / Station">Train / Station</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Field 2: Subject Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Subject
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Briefly describe your issue"
                className="w-full px-4 py-3 bg-slate-50/70 border border-slate-200/90 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1463FF] focus:bg-white transition-all"
              />
            </div>

            {/* Field 3: Description Textarea */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Description
              </label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell us what happened..."
                className="w-full px-4 py-3 bg-slate-50/70 border border-slate-200/90 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1463FF] focus:bg-white transition-all resize-none"
              />
            </div>

            {/* Field 4: Select Trip (Optional / Dynamic) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Select Trip <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <select
                value={selectedTripId}
                onChange={(e) => setSelectedTripId(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50/70 border border-slate-200/90 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1463FF] focus:bg-white transition-all cursor-pointer"
              >
                {tripOptions.length > 0 ? (
                  tripOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))
                ) : (
                  <option value="none">No specific trip / General inquiry</option>
                )}
                {tripOptions.length > 0 && (
                  <option value="none">No specific trip / General issue</option>
                )}
              </select>
            </div>

            {/* NOTE: Attachment/photo upload field is REMOVED completely as requested */}

            {/* Form Actions */}
            <div className="pt-3 space-y-2">
              <button
                type="submit"
                disabled={isSubmitting || !subject.trim() || !description.trim()}
                className="w-full bg-black hover:bg-zinc-800 disabled:bg-slate-300 text-white font-bold py-3.5 px-6 rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:cursor-not-allowed"
              >
                <span>{isSubmitting ? 'Submitting...' : 'Submit Ticket'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate('home')}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>

          </form>

        </div>
      )}

    </div>
  );
}
