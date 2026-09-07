import React, { useState, useEffect, useRef } from 'react';
import { getTickets, subscribeToSupportUpdates, addTicketMessage, updateTicketStatus } from '../../utils/supportStore';
import { Search, Filter, Clock, CheckCircle, MessageSquare, Train, User, Phone, Send, MoreVertical, ShieldAlert } from 'lucide-react';

export default function SupportInbox() {
  const [tickets, setTickets] = useState([]);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [filter, setFilter] = useState('all'); // all, open, resolved
  const [replyText, setReplyText] = useState('');
  const messagesEndRef = useRef(null);

  const fetchTickets = () => {
    setTickets(getTickets());
  };

  useEffect(() => {
    fetchTickets();
    const unsubscribe = subscribeToSupportUpdates(fetchTickets);
    return () => unsubscribe();
  }, []);

  const selectedTicket = tickets.find(t => t.id === selectedTicketId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedTicket?.conversation]);

  const filteredTickets = tickets.filter(t => {
    if (filter === 'open') return ['open', 'in_progress', 'bot_escalated'].includes(t.status);
    if (filter === 'resolved') return ['resolved', 'closed'].includes(t.status);
    return true;
  });

  const handleReply = (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;

    addTicketMessage(selectedTicket.id, {
      sender: 'support',
      text: replyText.trim()
    });
    setReplyText('');
  };

  const handleStatusChange = (newStatus) => {
    if (!selectedTicket) return;
    updateTicketStatus(selectedTicket.id, newStatus);
  };

  return (
    <div className="flex h-[800px] max-h-[85vh] bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm font-sans">
      
      {/* 1. Sidebar List */}
      <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50">
        <div className="p-4 border-b border-slate-200 bg-white">
          <h2 className="font-bold text-slate-900 text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Support Inbox
          </h2>
          <div className="mt-4 flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setFilter('open')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${filter === 'open' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Active
            </button>
            <button 
              onClick={() => setFilter('resolved')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${filter === 'resolved' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Resolved
            </button>
            <button 
              onClick={() => setFilter('all')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${filter === 'all' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              All
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredTickets.map(ticket => (
            <button
              key={ticket.id}
              onClick={() => setSelectedTicketId(ticket.id)}
              className={`w-full text-left p-3 rounded-2xl transition-all border ${
                selectedTicketId === ticket.id 
                  ? 'bg-blue-50 border-blue-200 shadow-sm' 
                  : 'bg-white border-slate-200 hover:border-blue-300'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold font-mono text-slate-500">{ticket.id}</span>
                <span className={`w-2 h-2 rounded-full ${
                  ['resolved', 'closed'].includes(ticket.status) ? 'bg-emerald-500' : 
                  ticket.status === 'bot_escalated' ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
                }`} />
              </div>
              <h4 className={`font-bold text-sm truncate pr-2 ${selectedTicketId === ticket.id ? 'text-blue-900' : 'text-slate-900'}`}>
                {ticket.subject}
              </h4>
              <p className="text-xs text-slate-500 truncate mt-1">
                {ticket.passengerName || 'Passenger'}
              </p>
            </button>
          ))}
          {filteredTickets.length === 0 && (
            <div className="text-center p-6 text-slate-400 text-sm">
              No tickets found.
            </div>
          )}
        </div>
      </div>

      {/* 2. Active Thread View */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedTicket ? (
          <>
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white shadow-sm z-10">
              <div>
                <h3 className="font-bold text-lg text-slate-900">{selectedTicket.subject}</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">Ticket ID: {selectedTicket.id}</p>
              </div>
              <div className="flex gap-2">
                {['resolved', 'closed'].includes(selectedTicket.status) ? (
                   <button 
                     onClick={() => handleStatusChange('open')}
                     className="px-4 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold text-xs rounded-xl transition-colors border border-amber-200"
                   >
                     Reopen Ticket
                   </button>
                ) : (
                   <button 
                     onClick={() => handleStatusChange('resolved')}
                     className="px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs rounded-xl transition-colors flex items-center gap-1 border border-emerald-200"
                   >
                     <CheckCircle className="w-4 h-4" /> Resolve
                   </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-6">
              {selectedTicket.aiSummary && (
                <div className="bg-[#0A0A0A] rounded-2xl p-4 text-white shadow-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <h4 className="font-bold text-sm text-rose-400 uppercase tracking-wider">AI Escalation Summary</h4>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">{selectedTicket.aiSummary}</p>
                </div>
              )}

              {selectedTicket.conversation?.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.sender === 'support' ? 'items-end' : 'items-start'}`}>
                  {msg.sender === 'system' ? (
                     <div className="w-full flex justify-center my-2">
                       <span className="bg-slate-200/60 text-slate-600 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                         {msg.text}
                       </span>
                     </div>
                  ) : (
                    <>
                      <div className={`max-w-[80%] p-4 rounded-2xl ${
                        msg.sender === 'support' 
                          ? 'bg-blue-600 text-white rounded-tr-sm' 
                          : msg.sender === 'bot'
                            ? 'bg-slate-800 text-white rounded-tl-sm'
                            : 'bg-white border border-slate-200 text-slate-900 rounded-tl-sm shadow-sm'
                      }`}>
                        <div className={`text-[10px] font-bold uppercase mb-1 flex items-center gap-1 ${
                          msg.sender === 'support' ? 'text-blue-200' : msg.sender === 'bot' ? 'text-slate-400' : 'text-blue-600'
                        }`}>
                          {msg.name}
                        </div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</div>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.timestamp}</span>
                    </>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-slate-200 bg-white">
              <form onSubmit={handleReply} className="flex gap-3">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply to the passenger..."
                  className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button 
                  type="submit"
                  disabled={!replyText.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  Send <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <MessageSquare className="w-16 h-16 mb-4 text-slate-200" />
            <p className="font-medium">Select a ticket to view the conversation</p>
          </div>
        )}
      </div>

      {/* 3. Context Panel */}
      {selectedTicket && (
        <div className="w-72 border-l border-slate-200 bg-white p-5 overflow-y-auto">
          <h3 className="font-bold text-slate-900 mb-4 uppercase tracking-wider text-xs">Trip Context</h3>
          
          {selectedTicket.trip ? (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                  <Train className="w-4 h-4" />
                  <span className="font-bold text-sm">Train {selectedTicket.trip.trainNo}</span>
                </div>
                <p className="text-xs text-slate-600 font-medium">{selectedTicket.trip.trainName}</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase">{selectedTicket.trip.route}</p>
                
                <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between text-xs font-bold text-slate-700">
                  <span>Coach: {selectedTicket.trip.coach}</span>
                  <span>Seat: {selectedTicket.trip.seat}</span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">Passenger</h4>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-900">{selectedTicket.passengerName || 'N/A'}</p>
                    <p className="text-xs text-slate-500">{selectedTicket.passengerPhone || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100">
              No active trip context available for this ticket.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
