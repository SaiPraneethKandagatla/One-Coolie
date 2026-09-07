import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Clock, CheckCircle, Search, 
  Train, ChevronRight, FileText, ArrowRight 
} from 'lucide-react';
import oneCoolieLogo from '../../assets/onecoolie-logo.png';
import { getTickets, subscribeToSupportUpdates } from '../../utils/supportStore';

export default function TicketTracking({ onNavigate, user }) {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState('all');

  const fetchUserTickets = () => {
    const all = getTickets();
    setTickets(all);
  };

  useEffect(() => {
    fetchUserTickets();
    const unsubscribe = subscribeToSupportUpdates(fetchUserTickets);
    return () => unsubscribe();
  }, []);

  const filteredTickets = tickets.filter(t => {
    if (filter === 'open') return ['open', 'in_progress', 'bot_escalated'].includes(t.status);
    if (filter === 'resolved') return ['resolved', 'closed'].includes(t.status);
    return true;
  });

  const getStatusBadge = (status) => {
    const s = status.toLowerCase();
    if (['resolved', 'closed'].includes(s)) {
      return (
        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider rounded-md border border-emerald-200 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" /> Resolved
        </span>
      );
    }
    return (
      <span className="px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-wider rounded-md border border-amber-200 flex items-center gap-1">
        <Clock className="w-3 h-3" /> In Progress
      </span>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900 font-sans selection:bg-[#1463FF] selection:text-white">
      
      {/* ── TOP HEADER ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 px-4 sm:px-8 py-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => onNavigate('back')}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200/60"
          >
            <ArrowLeft className="w-4 h-4 text-slate-700" />
          </button>
          
          <div>
            <span className="font-black text-slate-950 text-base leading-tight block">
              Support Tickets
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              Track your raised issues and conversations
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('chat')}
          className="bg-black hover:bg-zinc-800 text-white font-bold px-4 py-2 rounded-full text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Raise New Ticket</span>
        </button>
      </header>

      {/* ── MAIN CONTENT ────────────────────────────────────────── */}
      <main className="flex-1 max-w-[1280px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button 
            type="button"
            onClick={() => setFilter('all')}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              filter === 'all' 
                ? 'bg-black text-white shadow-xs' 
                : 'bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All Tickets ({tickets.length})
          </button>
          
          <button 
            type="button"
            onClick={() => setFilter('open')}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              filter === 'open' 
                ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs' 
                : 'bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50'
            }`}
          >
            In Progress ({tickets.filter(t => ['open', 'in_progress', 'bot_escalated'].includes(t.status)).length})
          </button>

          <button 
            type="button"
            onClick={() => setFilter('resolved')}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              filter === 'resolved' 
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs' 
                : 'bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Resolved ({tickets.filter(t => ['resolved', 'closed'].includes(t.status)).length})
          </button>
        </div>

        {/* Tickets Grid / List */}
        <div className="space-y-3">
          {filteredTickets.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white border border-slate-200/80 rounded-3xl shadow-2xs">
              <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="font-black text-slate-900 text-base mb-1">No tickets found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                You don't have any support tickets matching this filter.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('chat')}
                className="bg-[#1463FF] hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-full inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <span>Start a Support Chat</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            filteredTickets.map((ticket) => {
              return (
                <button 
                  key={ticket.id}
                  type="button"
                  onClick={() => onNavigate('ticket_detail', { ticketId: ticket.id })}
                  className="w-full text-left bg-white border border-slate-200/90 rounded-2xl p-5 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-600 shrink-0 group-hover:bg-blue-50 group-hover:text-[#1463FF] transition-colors mt-0.5">
                      <FileText className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black font-mono text-slate-900">
                          #{ticket.id}
                        </span>
                        {ticket.isBotEscalated && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-blue-50 text-[#1463FF] rounded border border-blue-200">
                            BOT ESCALATED
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
                        {ticket.subject}
                      </h3>

                      <p className="text-xs text-slate-500 font-medium">
                        {ticket.trip?.trainNo ? `Train ${ticket.trip.trainNo}${ticket.trip.route ? ` · ${ticket.trip.route}` : ''}` : 'General Support Request'}
                      </p>

                      <p className="text-[11px] text-slate-400">
                        {ticket.trip?.journeyDate || (ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent')} · Updated {new Date(ticket.updatedAt || ticket.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    {getStatusBadge(ticket.status)}
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#1463FF] group-hover:translate-x-1 transition-all" />
                  </div>
                </button>
              );
            })
          )}
        </div>

      </main>

    </div>
  );
}
