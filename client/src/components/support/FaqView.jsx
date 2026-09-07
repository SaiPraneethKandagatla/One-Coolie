import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Search, X, ChevronDown, 
  HelpCircle, ThumbsUp, ThumbsDown, ArrowRight,
  Headphones, FileText, CheckCircle2
} from 'lucide-react';
import { FAQ_CATEGORIES, FAQ_QUESTIONS } from '../../utils/supportFaqData';

export default function FaqView({ onNavigate, user }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedFaqId, setExpandedFaqId] = useState('faq-a1'); // Default first expanded like mockup ("Where is my assistant?")
  const [feedbackGiven, setFeedbackGiven] = useState({});

  const toggleFaq = (id) => {
    setExpandedFaqId(prev => prev === id ? null : id);
  };

  const handleFeedback = (id, isHelpful) => {
    setFeedbackGiven(prev => ({ ...prev, [id]: isHelpful }));
  };

  const filteredFaqs = useMemo(() => {
    return FAQ_QUESTIONS.filter((faq) => {
      const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || 
        faq.question.toLowerCase().includes(q) || 
        faq.answer.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="w-full max-w-4xl mx-auto py-4 sm:py-6 px-4 sm:px-6 space-y-6 animate-fade-in">
      
      {/* ── CARD CONTAINER (MATCHING REFERENCE PANEL 1) ─────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
        
        {/* Header with Blue Icon, Title & Close Button */}
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
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Help &amp; Support / FAQs
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight mt-0.5">
                Frequently Asked Questions
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
          Find quick answers to common questions about your journey and station assistance.
        </p>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions..."
            className="w-full pl-11 pr-10 py-3 bg-slate-50/70 border border-slate-200/90 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1463FF] focus:bg-white transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Filter Pills (Matching Reference) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
          {[
            { id: 'all', label: 'All' },
            { id: 'booking', label: 'Booking' },
            { id: 'assistant', label: 'Assistant' },
            { id: 'payment', label: 'Payment' },
            { id: 'refund', label: 'Refund' },
            { id: 'luggage', label: 'Luggage' },
            { id: 'train', label: 'Train & Station' },
          ].map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? 'bg-[#1463FF] text-white shadow-xs'
                    : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Accordion Questions List */}
        <div className="space-y-3 pt-2">
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((faq) => {
              const isExpanded = expandedFaqId === faq.id;
              const feedback = feedbackGiven[faq.id];

              return (
                <div
                  key={faq.id}
                  className={`border rounded-2xl transition-all duration-200 overflow-hidden ${
                    isExpanded
                      ? 'border-blue-200 bg-blue-50/20 shadow-2xs'
                      : 'border-slate-200/80 bg-white hover:border-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(faq.id)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left cursor-pointer gap-4 group"
                  >
                    <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#1463FF] transition-colors leading-snug">
                      {faq.question}
                    </span>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-200 shrink-0 ${
                      isExpanded ? 'text-[#1463FF] rotate-180' : 'text-slate-400 group-hover:text-slate-600'
                    }`}>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100/80 space-y-4">
                      <p>{faq.answer}</p>

                      {/* Was this helpful? Section (Matches Mockup) */}
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-medium">Was this helpful?</span>
                          {feedback === undefined ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleFeedback(faq.id, true)}
                                className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-full text-slate-700 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                              >
                                <ThumbsUp className="w-3 h-3 text-slate-500" />
                                <span>Yes</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleFeedback(faq.id, false)}
                                className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-full text-slate-700 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                              >
                                <ThumbsDown className="w-3 h-3 text-slate-500" />
                                <span>No</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-emerald-600 font-bold flex items-center gap-1 text-[11px]">
                              <CheckCircle2 className="w-3 h-3" />
                              Thank you for your feedback!
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => onNavigate('chat', { initialQuery: faq.question })}
                          className="text-[#1463FF] hover:underline font-bold text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <span>Ask Assistant about this →</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 px-4 bg-slate-50/60 rounded-2xl border border-slate-200/80 space-y-3">
              <HelpCircle className="w-8 h-8 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800">No questions found</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                We couldn't find any questions matching "{searchQuery}". You can search another term or ask our support team directly.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('chat', { initialQuery: searchQuery })}
                  className="bg-[#1463FF] hover:bg-blue-600 text-white font-bold text-xs px-5 py-2.5 rounded-full inline-flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Headphones className="w-3.5 h-3.5" />
                  <span>Ask Support Assistant</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Callout: Didn't find what you were looking for? */}
        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Didn't find what you were looking for?
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Connect with our station team or raise a formal support request.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('raise_ticket')}
              className="flex-1 sm:flex-initial bg-white hover:bg-slate-50 text-slate-900 border border-slate-200/90 font-bold px-4 py-2.5 rounded-full text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-[#1463FF]" />
              <span>Raise a Ticket →</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('chat')}
              className="flex-1 sm:flex-initial bg-black hover:bg-zinc-800 text-white font-bold px-4 py-2.5 rounded-full text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Headphones className="w-3.5 h-3.5 text-white" />
              <span>Chat with Support →</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
