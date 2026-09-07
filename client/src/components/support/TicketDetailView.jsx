import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Send, Paperclip, CheckCircle, Clock, 
  Train, Check, Headphones, User, CheckCircle2 
} from 'lucide-react';
import { getTicketById, addTicketMessage, updateTicketStatus, subscribeToSupportUpdates } from '../../utils/supportStore';

export default function TicketDetailView({ onNavigate, ticketId, user }) {
  const [ticket, setTicket] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  const fetchTicket = () => {
    const t = getTicketById(ticketId);
    setTicket(t);
  };

  useEffect(() => {
    fetchTicket();
    const unsubscribe = subscribeToSupportUpdates(fetchTicket);
    return () => unsubscribe();
  }, [ticketId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [ticket?.conversation]);

  if (!ticket) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-[#F8FAFC]">
        <p className="text-sm font-semibold text-slate-500 mb-4">Ticket not found.</p>
        <button
          onClick={() => onNavigate('back')}
          className="bg-black text-white px-5 py-2 rounded-full text-xs font-bold cursor-pointer"
        >
          Go Back
        </button>
      </div>
    );
  }

  const isResolved = ['resolved', 'closed'].includes(ticket.status);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    addTicketMessage(ticketId, {
      sender: 'passenger',
      name: user?.name || 'Passenger',
      text: inputValue.trim()
    });
    setInputValue('');
  };

  const handleCloseTicket = () => {
    updateTicketStatus(ticketId, 'resolved');
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-[#1463FF] selection:text-white">
      
      {/* ── HEADER ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200/90 px-4 sm:px-6 py-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => onNavigate('back')}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200/60"
          >
            <ArrowLeft className="w-4 h-4 text-slate-700" />
          </button>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-slate-950 text-sm sm:text-base leading-tight">
                #{ticket.id}
              </span>
              <span className={`px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                isResolved 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {ticket.status.replace('_', ' ')}
              </span>
            </div>
            <span className="text-xs text-slate-500 font-medium truncate max-w-[240px] sm:max-w-md">
              {ticket.subject}
            </span>
          </div>
        </div>

        {!isResolved && (
          <button 
            type="button"
            onClick={handleCloseTicket}
            className="text-[11px] font-bold text-slate-500 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mark Resolved</span>
          </button>
        )}
      </header>

      {/* ── ACTIVE TRIP CAPSULE ─────────────────────────────────── */}
      {ticket.trip && (
        <div className="bg-slate-50 border-b border-slate-200/80 px-4 py-2 flex items-center justify-center text-xs text-slate-600">
          <div className="bg-white border border-slate-200/90 rounded-full px-3.5 py-1 flex items-center gap-2 shadow-2xs max-w-full overflow-hidden">
            <Train className="w-3.5 h-3.5 text-[#1463FF] shrink-0" />
            <span className="font-black text-slate-900 shrink-0">{ticket.trip.trainNo} · {ticket.trip.trainName || 'Express'}</span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-600 truncate">{ticket.trip.route}</span>
            {(ticket.trip.coach || ticket.trip.seat) && (
              <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0">
                {ticket.trip.coach ? `Coach ${ticket.trip.coach}` : ''}
                {ticket.trip.coach && ticket.trip.seat ? ' · ' : ''}
                {ticket.trip.seat ? `Seat ${ticket.trip.seat}` : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── CONVERSATION STREAM ─────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-3xl mx-auto w-full">
        <div className="flex justify-center my-2">
          <span className="bg-slate-200/60 text-slate-600 text-[10px] font-bold uppercase tracking-wider px-3.5 py-1 rounded-full">
            Ticket Created: {new Date(ticket.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        {ticket.conversation?.map((msg) => {
          if (msg.sender === 'system') {
            return (
              <div key={msg.id} className="flex justify-center my-3">
                <span className="bg-slate-900 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-xs flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{msg.text}</span>
                </span>
              </div>
            );
          }

          const isMe = msg.sender === 'passenger';
          const isSupport = msg.sender === 'support';

          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[90%] sm:max-w-[80%] rounded-2xl p-4 sm:p-5 ${
                isMe 
                  ? 'bg-black text-white rounded-tr-xs shadow-md' 
                  : isSupport 
                    ? 'bg-blue-50 border border-blue-200 text-slate-950 rounded-tl-xs shadow-xs' 
                    : 'bg-white border border-slate-200/90 text-slate-950 rounded-tl-xs shadow-2xs'
              }`}>
                {!isMe && (
                  <div className="text-[11px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    {isSupport ? (
                      <span className="text-[#1463FF] flex items-center gap-1">
                        <Headphones className="w-3.5 h-3.5" />
                        {msg.name || 'OneCoolie Support'}
                      </span>
                    ) : (
                      <span className="text-slate-400 flex items-center gap-1">
                        OneCoolie Assistant
                      </span>
                    )}
                  </div>
                )}
                
                <div className="text-sm leading-relaxed whitespace-pre-wrap font-normal">
                  {msg.text}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-slate-400">
                <span>{msg.timestamp}</span>
              </div>
            </div>
          );
        })}

        {isResolved && (
          <div className="flex flex-col items-center justify-center my-6 p-6 bg-emerald-50 rounded-2xl border border-emerald-200 max-w-lg mx-auto text-center">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mb-2 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h4 className="font-extrabold text-sm text-emerald-900">This Ticket is Resolved</h4>
            <p className="text-xs text-emerald-700 mt-1 max-w-sm">
              Our support team has closed this ticket. If you need any further help, you can start a new chat anytime.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('chat')}
              className="mt-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2 rounded-full transition-colors cursor-pointer"
            >
              Start New Chat
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* ── INPUT FOOTER ────────────────────────────────────────── */}
      {!isResolved && (
        <footer className="bg-white border-t border-slate-200 px-4 py-3 z-40">
          <form 
            onSubmit={handleSend}
            className="max-w-3xl mx-auto flex items-center gap-2"
          >
            <button 
              type="button" 
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Reply to support executive..."
              className="flex-1 bg-slate-100/90 border-none rounded-full py-3 px-5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1463FF] focus:bg-white transition-all shadow-inner"
            />
            <button 
              type="submit"
              disabled={!inputValue.trim()}
              className="w-11 h-11 bg-[#1463FF] hover:bg-blue-700 disabled:opacity-40 disabled:bg-slate-300 text-white rounded-full flex items-center justify-center transition-all shadow-md shadow-blue-600/20 shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </form>
        </footer>
      )}

    </div>
  );
}
