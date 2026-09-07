import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Send, Paperclip, Check, Train, 
  HelpCircle, User, Shield, AlertTriangle, ChevronRight,
  Headphones, CheckCircle2, MoreVertical, ThumbsUp, ThumbsDown
} from 'lucide-react';
import oneCoolieLogo from '../../assets/onecoolie-logo.png';
import aiRobotImg from '../../assets/images/ai-support-robot.jpg';
import { generateAiResponse, generateEscalationSummary, SUGGESTED_QUESTIONS } from '../../utils/supportAiEngine';
import { createTicket, getTicketById, addTicketMessage, subscribeToSupportUpdates } from '../../utils/supportStore';

export default function SupportAssistantChat({ 
  onNavigate, 
  activeTrip, 
  user,
  preloadContext,
  initialQuery 
}) {
  const [messages, setMessages] = useState(() => {
    const hasTrip = preloadContext === 'trip' && activeTrip;
    const welcomeText = hasTrip 
      ? `Hi! I'm your OneCoolie Support Assistant. I've attached your booking details for Train ${activeTrip.trainNo} (${activeTrip.trainName}) to our conversation.\n\nHow can I help you with your journey today?`
      : `Hi! I'm your OneCoolie Support Assistant. Ask me anything about your booking, assistant, luggage, payment or journey. How can I help?`;

    return [{
      id: 'msg-welcome',
      sender: 'bot',
      name: 'OneCoolie Support Assistant',
      text: welcomeText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      tripCard: hasTrip ? activeTrip : null,
      actions: [
        { label: 'Where is my assistant?', type: 'suggested_question' },
        { label: 'Payment issue', type: 'suggested_question' },
        { label: 'Cancel my booking', type: 'suggested_question' },
        { label: 'Refund status', type: 'suggested_question' },
        { label: 'Train delay', type: 'suggested_question' },
        { label: 'Talk to support', type: 'escalate_support' },
      ]
    }];
  });

  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [connectedToSupport, setConnectedToSupport] = useState(false);
  const [escalationTicketId, setEscalationTicketId] = useState(null);
  const messagesEndRef = useRef(null);
  const initialQueryExecuted = useRef(false);

  // Handle auto-submitting initialQuery if provided
  useEffect(() => {
    if (initialQuery && !initialQueryExecuted.current && messages.length > 0) {
      initialQueryExecuted.current = true;
      setTimeout(() => {
        handleSend(initialQuery);
      }, 300);
    }
  }, [initialQuery, messages.length]);

  // Cross-tab real-time sync when escalated to a human ticket
  useEffect(() => {
    let unsubscribe;
    if (escalationTicketId) {
      unsubscribe = subscribeToSupportUpdates(() => {
        const ticket = getTicketById(escalationTicketId);
        if (ticket && ticket.conversation) {
          setMessages(ticket.conversation);
        }
      });
    }
    return () => unsubscribe && unsubscribe();
  }, [escalationTicketId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = (text) => {
    const query = (text || inputValue).trim();
    if (!query) return;

    const passengerDisplayName = user?.name || user?.email?.split('@')[0] || 'Passenger';
    const passengerMsg = {
      id: `msg-${Date.now()}`,
      sender: 'passenger',
      name: passengerDisplayName,
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, passengerMsg]);
    setInputValue('');

    // If connected to human support, route to supportStore ticket
    if (connectedToSupport && escalationTicketId) {
      addTicketMessage(escalationTicketId, passengerMsg);
      return;
    }

    // AI Bot processing
    setIsTyping(true);

    setTimeout(() => {
      const response = generateAiResponse(query, activeTrip);
      setIsTyping(false);

      const hasTripContext = query.toLowerCase().includes('assistant') || 
                             query.toLowerCase().includes('booking') || 
                             query.toLowerCase().includes('seat') || 
                             query.toLowerCase().includes('train') || 
                             query.toLowerCase().includes('cancel');

      const aiMsg = {
        id: `msg-${Date.now() + 1}`,
        sender: 'bot',
        name: 'OneCoolie Support Assistant',
        text: response.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tripCard: hasTripContext ? activeTrip : null,
        actions: response.actions,
        showFeedback: response.showFeedback,
        escalationProposed: response.escalationProposed,
        escalationReason: response.escalationReason
      };

      setMessages((prev) => [...prev, aiMsg]);
    }, 700);
  };

  const triggerEscalation = () => {
    const currentMessages = [...messages];
    const summary = generateEscalationSummary(currentMessages, activeTrip);
    const passengerDisplayName = user?.name || user?.email?.split('@')[0] || 'Passenger';
    
    // Create new support ticket
    const newTicket = createTicket({
      subject: activeTrip ? `Trip Support: Train ${activeTrip.trainNo}` : 'Passenger Requested Support',
      passengerName: passengerDisplayName,
      passengerPhone: user?.phone || '',
      passengerEmail: user?.email || '',
      trip: activeTrip,
      priority: 'high',
      aiSummary: summary,
      initialMessages: currentMessages,
    });

    setEscalationTicketId(newTicket.id);
    setConnectedToSupport(true);

    // System banner message
    const sysMsg = {
      id: `msg-${Date.now()}-sys`,
      sender: 'system',
      name: 'System',
      text: `Connected to OneCoolie Support · Ticket #${newTicket.id}`,
      ticketId: newTicket.id,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, sysMsg]);
    addTicketMessage(newTicket.id, sysMsg);

    // Simulate supportive human response if not responded by admin
    setTimeout(() => {
      const agentReply = {
        id: `msg-${Date.now()}-agent`,
        sender: 'support',
        name: 'Support Executive',
        text: `Hello ${passengerDisplayName}! I'm coordinating with the station team right now.${activeTrip ? ` I can see your booking for Train ${activeTrip.trainNo} (${activeTrip.coach || ''}, ${activeTrip.seat || ''}).` : ''} How can I assist you right away?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      addTicketMessage(newTicket.id, agentReply);
    }, 1800);
  };

  const handleActionClick = (action) => {
    if (action.type === 'suggested_question') {
      handleSend(action.label);
    } else if (action.type === 'escalate_support') {
      triggerEscalation();
    } else {
      handleSend(action.label);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-[#1463FF] selection:text-white">
      
      {/* ── TOP HEADER ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 px-4 sm:px-6 py-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => onNavigate('back')}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200/60"
          >
            <ArrowLeft className="w-4 h-4 text-slate-700" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center shadow-xs">
                {connectedToSupport ? (
                  <Headphones className="w-5 h-5 text-white" />
                ) : (
                  <img src={aiRobotImg} alt="AI" className="w-full h-full object-cover" />
                )}
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base text-slate-950 leading-tight">
                  {connectedToSupport ? 'OneCoolie Support Team' : 'OneCoolie Support Assistant'}
                </span>
                {escalationTicketId && (
                  <span className="px-2 py-0.5 bg-blue-50 text-[#1463FF] text-[10px] font-mono font-bold rounded-md border border-blue-200">
                    #{escalationTicketId}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                <span>●</span> {connectedToSupport ? 'Executive Active' : 'Online · Available 24/7'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {escalationTicketId && (
            <button
              type="button"
              onClick={() => onNavigate('ticket_detail', { ticketId: escalationTicketId })}
              className="text-xs font-bold text-[#1463FF] hover:bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200 transition-colors hidden sm:flex items-center gap-1 cursor-pointer"
            >
              <span>View Ticket</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
          <button 
            type="button"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── STICKY ACTIVE TRIP CAPSULE ─────────────────────────── */}
      {activeTrip && (
        <div className="bg-slate-50/90 backdrop-blur-xs border-b border-slate-200/80 px-4 py-2 flex items-center justify-center text-xs text-slate-600">
          <div className="bg-white border border-slate-200/90 rounded-full px-3.5 py-1 flex items-center gap-2 shadow-2xs max-w-full overflow-hidden">
            <Train className="w-3.5 h-3.5 text-[#1463FF] shrink-0" />
            <span className="font-black text-slate-900 shrink-0">{activeTrip.trainNo} · {activeTrip.trainName}</span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-600 truncate">{activeTrip.route}</span>
            <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0">
              {String(activeTrip.coach || '').startsWith('Coach') ? activeTrip.coach : `Coach ${activeTrip.coach || ''}`} · {String(activeTrip.seat || '').startsWith('Seat') ? activeTrip.seat : `Seat ${activeTrip.seat || ''}`}
            </span>
          </div>
        </div>
      )}

      {/* ── CHAT MESSAGES AREA ─────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-3xl mx-auto w-full pb-36">
        {messages.map((msg) => {
          if (msg.sender === 'system') {
            return (
              <div key={msg.id} className="flex justify-center my-3">
                <div className="bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-full shadow-md flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{msg.text}</span>
                </div>
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
                
                {/* Sender Tag */}
                {!isMe && (
                  <div className="flex items-center gap-1.5 text-[11px] font-bold mb-2 uppercase tracking-wider">
                    {isSupport ? (
                      <span className="text-[#1463FF] flex items-center gap-1">
                        <Headphones className="w-3.5 h-3.5" />
                        {msg.name || 'OneCoolie Support'}
                      </span>
                    ) : (
                      <span className="text-slate-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#1463FF]"></span>
                        OneCoolie Assistant
                      </span>
                    )}
                  </div>
                )}

                {/* Optional Embedded Booking Context Card */}
                {msg.tripCard && (
                  <div className="mb-3 bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>Train {msg.tripCard.trainNo} · {msg.tripCard.trainName || 'Express'}</span>
                      <span className="text-emerald-700 text-[10px] font-black uppercase">Confirmed</span>
                    </div>
                    <p className="text-slate-500 font-medium">{msg.tripCard.route}</p>
                    <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-600 font-medium">
                      <span>Coach {msg.tripCard.coach}</span>
                      <span>•</span>
                      <span>Seat {msg.tripCard.seat}</span>
                      <span>•</span>
                      <span>{msg.tripCard.service || 'Boarding Load'}</span>
                    </div>
                  </div>
                )}

                {/* Message Text */}
                <div className="text-sm leading-relaxed whitespace-pre-wrap font-normal">
                  {msg.text}
                </div>

                {/* Suggested Inline Actions */}
                {msg.actions && msg.actions.length > 0 && !connectedToSupport && (
                  <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                    {msg.actions.map((act, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleActionClick(act)}
                        className={`text-xs font-bold py-1.5 px-3 rounded-full border transition-all cursor-pointer ${
                          act.type === 'escalate_support' 
                            ? 'bg-[#1463FF] text-white border-transparent hover:bg-blue-700 shadow-xs' 
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200/80'
                        }`}
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Bot -> Human Escalation Card */}
                {msg.escalationProposed && !connectedToSupport && (
                  <div className="mt-4 bg-[#0B0F19] text-white rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-xl space-y-3">
                    <div>
                      <h4 className="font-extrabold text-sm text-white">Let’s get you more help.</h4>
                      <p className="text-xs text-slate-300 mt-0.5">
                        I couldn't resolve this specific issue. I can connect you with our support team.
                      </p>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Your trip details will be attached</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Your conversation will be shared</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>A support executive can continue from here</span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={triggerEscalation}
                        className="w-full sm:w-auto bg-white hover:bg-slate-100 text-black font-extrabold text-xs px-5 py-2.5 rounded-full transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <span>Connect with Support →</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSend("What is the refund policy?")}
                        className="w-full sm:w-auto text-xs text-slate-400 hover:text-white px-3 py-2 transition-colors cursor-pointer text-center"
                      >
                        Show me more solutions
                      </button>
                    </div>
                  </div>
                )}

              </div>

              {/* Timestamp and Feedback */}
              <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-slate-400">
                <span>{msg.timestamp}</span>
                {msg.showFeedback && !isMe && (
                  <div className="flex items-center gap-1.5 ml-2">
                    <span>Helpful?</span>
                    <button type="button" className="hover:text-emerald-600 transition-colors cursor-pointer">
                      <ThumbsUp className="w-3 h-3" />
                    </button>
                    <button type="button" className="hover:text-rose-600 transition-colors cursor-pointer">
                      <ThumbsDown className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

            </div>
          );
        })}

        {isTyping && (
          <div className="flex items-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs p-4 shadow-2xs">
              <div className="flex space-x-1.5">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* ── FOOTER: SUGGESTED ACTIONS & INPUT BAR ──────────────── */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 z-40">
        <div className="max-w-3xl mx-auto space-y-2.5">
          
          {/* Suggested Quick Actions Pill Bar */}
          {!connectedToSupport && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              {[
                { label: 'Where is my assistant?', isEscalate: false },
                { label: 'Payment issue', isEscalate: false },
                { label: 'Cancel my booking', isEscalate: false },
                { label: 'Refund status', isEscalate: false },
                { label: 'Train delay', isEscalate: false },
                { label: 'Talk to support', isEscalate: true }
              ].map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => item.isEscalate ? triggerEscalation() : handleSend(item.label)}
                  className="whitespace-nowrap bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-700 font-medium px-3 py-1 rounded-full text-xs transition-colors cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Clean Message Input */}
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(inputValue); }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
              title="Attach File / Screenshot"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={connectedToSupport ? "Reply to support executive..." : "Type your message..."}
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

        </div>
      </footer>

    </div>
  );
}
