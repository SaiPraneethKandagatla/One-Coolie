/**
 * supportStore.js
 *
 * Centralized store & synchronization layer for OneCoolie Help & Support:
 * - Ticket management (CRUD, status, priorities)
 * - Chat conversations & AI summaries
 * - Cross-tab real-time sync via BroadcastChannel ('onecoolie_support_sync')
 * - Local storage persistence with initial seeds directly matching reference design
 */

const STORAGE_KEY = 'onecoolie_passenger_tickets_real';
const CHANNEL_NAME = 'onecoolie_support_sync';

// BroadcastChannel for instant cross-tab sync between Passenger and Admin
let channel = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch (e) {
  console.warn('BroadcastChannel not supported:', e);
}

// Initial sample tickets directly matching the user's reference mockup
export const INITIAL_TICKETS = [
  {
    id: 'OC-10482',
    subject: "Assistant hasn't arrived",
    passengerName: 'Vikas',
    passengerPhone: '+91 98765 43210',
    passengerEmail: 'vikas@onecoolie.com',
    status: 'in_progress', // 'open' | 'in_progress' | 'bot_escalated' | 'resolved' | 'closed'
    priority: 'high', // 'urgent' | 'high' | 'medium' | 'low'
    isBotEscalated: true,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    trip: {
      bookingId: 'RM-VT834-VB',
      trainNo: '20834',
      trainName: 'Vande Bharat Express',
      route: 'Secunderabad → Visakhapatnam',
      fromCode: 'SC',
      toCode: 'VSKP',
      journeyDate: '06 Sep 2026',
      journeyTime: '15:00',
      coach: 'S4',
      seat: '42 (Side Lower)',
      berthType: 'Side Lower',
      serviceType: 'Boarding Load',
      servicesSelected: ['Luggage Handling', 'Seat & Coach Escort'],
      paymentStatus: 'paid',
      paymentAmount: '₹70',
      assistant: {
        assigned: true,
        id: 'AST-7721',
        name: 'Ramesh Kumar',
        phone: '+91 98480 99881',
        station: 'Secunderabad Jn (SC)',
        status: 'At station (Concourse)',
      },
    },
    aiSummary:
      'Passenger reported that the assigned assistant has not arrived at the station concourse. AI checked assignment status (Assistant Ramesh Kumar, AST-7721) and verified arrival ETA. As the train arrival was imminent and assistant was delayed, the bot escalated to human support.',
    conversation: [
      {
        id: 'msg-1',
        sender: 'passenger',
        name: 'Vikas',
        text: "The train is delayed and my assistant is not at the station.",
        timestamp: '09:41 AM',
      },
      {
        id: 'msg-2',
        sender: 'bot',
        name: 'OneCoolie Support Assistant',
        text:
          "I understand this can be frustrating. I've checked your booking for Train 20834 (Coach S4, Seat 42). Assistant Ramesh Kumar is currently on the concourse level. Would you like me to connect you with our support team so they can alert the station supervisor immediately?",
        timestamp: '09:42 AM',
      },
      {
        id: 'msg-3',
        sender: 'system',
        name: 'System',
        text: 'Your conversation has been transferred to OneCoolie Support. A support executive has joined this chat.',
        timestamp: '09:43 AM',
      },
      {
        id: 'msg-4',
        sender: 'support',
        name: 'Kavitha (Support)',
        text: "Hi Vikas! I'm coordinating with the Secunderabad platform supervisor right now. Assistant Ramesh has been directed to Gate 3 concourse.",
        timestamp: '09:45 AM',
      },
    ],
  },
  {
    id: 'OC-10471',
    subject: 'Payment deducted but booking failed',
    passengerName: 'Vikas',
    passengerPhone: '+91 98765 43210',
    passengerEmail: 'vikas@onecoolie.com',
    status: 'resolved',
    priority: 'medium',
    isBotEscalated: false,
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    trip: {
      bookingId: 'RM-FL723-BZA',
      trainNo: '12795',
      trainName: 'Intercity Express',
      route: 'Secunderabad → Vijayawada',
      fromCode: 'SC',
      toCode: 'BZA',
      journeyDate: '04 Sep 2026',
      journeyTime: '06:15',
      coach: 'D2',
      seat: '15',
      berthType: 'Window',
      serviceType: 'Luggage Assistance',
      servicesSelected: ['Luggage Handling'],
      paymentStatus: 'refunded',
      paymentAmount: '₹50',
      assistant: {
        assigned: false,
        name: 'N/A',
        status: 'Unassigned',
      },
    },
    aiSummary:
      'Passenger indicated UPI payment of ₹50 was debited via PhonePe, but booking confirmation was not generated due to gateway timeout. Auto-refund initiated with RRN reference.',
    conversation: [
      {
        id: 'msg-101',
        sender: 'passenger',
        name: 'Priya Sharma',
        text: 'My money was deducted ₹50 on UPI but the booking status is still showing failed.',
        timestamp: '11:15 AM',
      },
      {
        id: 'msg-102',
        sender: 'bot',
        name: 'OneCoolie Support Assistant',
        text:
          'I checked your transaction attempt for Train 12795. The payment was held at gateway authorization. Our banking gateway initiates an automatic refund within 2-4 hours. Would you like a support executive to verify the bank RRN?',
        timestamp: '11:16 AM',
      },
    ],
  },
  {
    id: 'OC-10471',
    subject: 'Train delayed, assistant not informed',
    passengerName: 'Rahul Mehta',
    passengerPhone: '+91 99887 66554',
    passengerEmail: 'rahul.m@outlook.com',
    status: 'in_progress',
    priority: 'medium',
    isBotEscalated: true,
    createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    trip: {
      bookingId: 'RM-MT0X8PRQ',
      trainNo: '17013',
      trainName: 'Kazipet Express',
      route: 'Hadaspar (Pune) → Kazipet',
      fromCode: 'PUNE',
      toCode: 'KZJ',
      journeyDate: '12 Sep 2026',
      journeyTime: '08:10',
      coach: 'S3',
      seat: '23',
      berthType: 'Lower',
      serviceType: 'Seat & Coach Escort',
      servicesSelected: ['Seat & Coach Escort'],
      paymentStatus: 'paid',
      paymentAmount: '₹60',
      assistant: {
        assigned: true,
        id: 'AST-4410',
        name: 'Suresh Babu',
        phone: '+91 94401 22334',
        station: 'Kazipet Jn (KZJ)',
        status: 'On the way',
      },
    },
    aiSummary:
      'Train 17013 running 45 minutes late behind schedule. Passenger inquired whether the booked assistant at Kazipet will adjust arrival schedule to revised platform ETA.',
    conversation: [
      {
        id: 'msg-201',
        sender: 'passenger',
        name: 'Rahul Mehta',
        text: 'My train is running late by 45 minutes. Will the assistant wait or leave?',
        timestamp: '01:20 PM',
      },
      {
        id: 'msg-202',
        sender: 'bot',
        name: 'OneCoolie Support Assistant',
        text:
          'No worries at all! OneCoolie assistants track live NTES train telemetry. Assistant Suresh Babu has already been synced with the rescheduled arrival at 08:55 AM.',
        timestamp: '01:21 PM',
      },
    ],
  },
  {
    id: 'OC-10468',
    subject: 'Change boarding station',
    passengerName: 'Sneha R',
    passengerPhone: '+91 98760 11223',
    passengerEmail: 'sneha.r@gmail.com',
    status: 'open',
    priority: 'low',
    isBotEscalated: false,
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    trip: {
      bookingId: 'RM-12723-TEL',
      trainNo: '20834',
      trainName: 'Vande Bharat Express',
      route: 'Secunderabad → Visakhapatnam',
      fromCode: 'SC',
      toCode: 'VSKP',
      journeyDate: '14 Sep 2026',
      journeyTime: '15:00',
      coach: 'C1',
      seat: '32',
      berthType: 'Window',
      serviceType: 'Luggage Assistance',
      servicesSelected: ['Luggage Handling'],
      paymentStatus: 'paid',
      paymentAmount: '₹40',
      assistant: {
        assigned: false,
        name: 'Pending Assignment',
        status: 'Unassigned',
      },
    },
    aiSummary:
      'Passenger requested to change assistance station from Secunderabad (SC) to Kazipet (KZJ) due to IRCTC boarding station modification.',
    conversation: [
      {
        id: 'msg-301',
        sender: 'passenger',
        name: 'Sneha R',
        text: 'Can I change my boarding assistance to Kazipet station?',
        timestamp: '02:00 PM',
      },
    ],
  },
  {
    id: 'OC-10421',
    subject: 'Refund status',
    passengerName: 'Kishore V',
    passengerPhone: '+91 94411 33221',
    passengerEmail: 'kishore@gmail.com',
    status: 'resolved',
    priority: 'low',
    isBotEscalated: false,
    createdAt: '2026-09-04T10:00:00Z',
    updatedAt: '2026-09-04T11:30:00Z',
    trip: {
      bookingId: 'RM-RF10421',
      trainNo: '17013',
      trainName: 'Kazipet Express',
      route: 'Hadaspar (Pune) → Kazipet',
      fromCode: 'PUNE',
      toCode: 'KZJ',
      journeyDate: '12 Sep 2026',
      coach: 'S2',
      seat: '10',
      paymentStatus: 'refunded',
      paymentAmount: '₹30',
    },
    aiSummary: 'Cancellation refund of ₹30 processed back to original UPI account via Razorpay/Cashfree.',
    conversation: [
      {
        id: 'msg-401',
        sender: 'passenger',
        name: 'Kishore V',
        text: 'Has my refund for cancelled booking been processed?',
        timestamp: '10:00 AM',
      },
      {
        id: 'msg-402',
        sender: 'support',
        name: 'Support Executive',
        text: 'Yes Kishore, refund of ₹30 has been successfully credited to your UPI ID ending in @okaxis.',
        timestamp: '10:15 AM',
      },
    ],
  },
  {
    id: 'OC-10377',
    subject: 'Payment failed',
    passengerName: 'Anand Rao',
    passengerPhone: '+91 97001 88990',
    passengerEmail: 'anand.rao@yahoo.com',
    status: 'closed',
    priority: 'low',
    isBotEscalated: false,
    createdAt: '2026-09-03T16:00:00Z',
    updatedAt: '2026-09-04T09:00:00Z',
    trip: {
      bookingId: 'RM-FAIL10377',
      trainNo: '12795',
      trainName: 'Charminar Express',
      route: 'Secunderabad → Vijayawada',
      fromCode: 'SC',
      toCode: 'BZA',
      journeyDate: '04 Sep 2026',
    },
    aiSummary: 'Payment gateway session timed out; passenger re-booked successfully with fresh transaction.',
    conversation: [
      {
        id: 'msg-501',
        sender: 'passenger',
        name: 'Anand Rao',
        text: 'Session expired during OTP entry.',
        timestamp: '04:00 PM',
      },
      {
        id: 'msg-502',
        sender: 'support',
        name: 'Support Executive',
        text: 'Issue noted. No deduction occurred. Passenger re-booked fresh seat.',
        timestamp: '04:10 PM',
      },
    ],
  },
];

/**
 * Get all support tickets from localStorage or initial seed
 */
export function getTickets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    // Seed initial tickets if not present
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TICKETS));
    }
    return INITIAL_TICKETS;
  } catch (e) {
    console.error('Error reading support tickets:', e);
  }
  return INITIAL_TICKETS;
}

/**
 * Save tickets to localStorage and broadcast to other tabs
 */
export function saveTickets(tickets) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
    if (channel) {
      channel.postMessage({ type: 'TICKETS_UPDATED', timestamp: Date.now() });
    }
  } catch (e) {
    console.error('Error saving support tickets:', e);
  }
}

/**
 * Get single ticket by ID
 */
export function getTicketById(id) {
  const tickets = getTickets();
  return tickets.find((t) => t.id.toLowerCase() === String(id).toLowerCase().replace('#', '')) || null;
}

/**
 * Create a new support ticket (usually called upon Human Support Escalation)
 */
export function createTicket({
  subject,
  passengerName,
  passengerPhone,
  passengerEmail,
  priority = 'high',
  trip = null,
  aiSummary = '',
  initialMessages = [],
}) {
  const tickets = getTickets();
  const nextNum = 10483 + Math.floor(Math.random() * 100);
  const ticketId = `OC-${nextNum}`;

  const newTicket = {
    id: ticketId,
    subject: subject || "Passenger Assistance Query",
    passengerName: passengerName || 'Passenger',
      passengerPhone: passengerPhone || '',
      passengerEmail: passengerEmail || '',
    status: 'in_progress', // immediately in_progress as bot escalated
    priority,
    isBotEscalated: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
      trip: trip || null,
    aiSummary:
      aiSummary ||
      'Passenger requested human support assistance regarding an active booking. AI conversation transcript and trip telemetry attached.',
    conversation: [
      ...initialMessages,
      {
        id: `msg-${Date.now()}-sys`,
        sender: 'system',
        name: 'System',
        text: 'Your conversation has been transferred to OneCoolie Support. A support executive has joined this chat.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ],
  };

  const updated = [newTicket, ...tickets];
  saveTickets(updated);
  return newTicket;
}

/**
 * Add a message to an existing ticket conversation
 */
export function addTicketMessage(ticketId, message) {
  const tickets = getTickets();
  const index = tickets.findIndex((t) => t.id === ticketId);
  if (index === -1) return null;

  const ticket = tickets[index];
  const newMsg = {
    id: `msg-${Date.now()}`,
    sender: message.sender || 'passenger',
    name: message.name || (message.sender === 'support' ? 'Support Executive' : 'Passenger'),
    text: message.text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };

  ticket.conversation = [...(ticket.conversation || []), newMsg];
  ticket.updatedAt = new Date().toISOString();

  // If support executive replies and status was open or bot_escalated, move to in_progress
  if (message.sender === 'support' && (ticket.status === 'open' || ticket.status === 'bot_escalated')) {
    ticket.status = 'in_progress';
  }

  tickets[index] = { ...ticket };
  saveTickets(tickets);
  return newMsg;
}

/**
 * Update ticket status
 */
export function updateTicketStatus(ticketId, newStatus) {
  const tickets = getTickets();
  const index = tickets.findIndex((t) => t.id === ticketId);
  if (index === -1) return null;

  tickets[index].status = newStatus;
  tickets[index].updatedAt = new Date().toISOString();

  // Add system note
  const statusLabels = {
    open: 'Open',
    in_progress: 'In Progress',
    waiting_passenger: 'Waiting for Passenger',
    waiting_assistant: 'Waiting for Assistant',
    resolved: 'Resolved',
    closed: 'Closed',
  };

  tickets[index].conversation.push({
    id: `msg-${Date.now()}-status`,
    sender: 'system',
    name: 'System',
    text: `Ticket status updated to ${statusLabels[newStatus] || newStatus.toUpperCase()}.`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });

  saveTickets(tickets);
  return tickets[index];
}

/**
 * Update ticket priority
 */
export function updateTicketPriority(ticketId, newPriority) {
  const tickets = getTickets();
  const index = tickets.findIndex((t) => t.id === ticketId);
  if (index === -1) return null;

  tickets[index].priority = newPriority;
  tickets[index].updatedAt = new Date().toISOString();
  saveTickets(tickets);
  return tickets[index];
}

/**
 * Get aggregated statistics for the Admin Support Inbox
 */
export function getSupportStats() {
  const tickets = getTickets();
  return {
    all: tickets.length,
    urgent: tickets.filter((t) => t.priority === 'urgent' || (t.priority === 'high' && t.status !== 'resolved' && t.status !== 'closed')).length,
    open: tickets.filter((t) => t.status === 'open').length,
    botEscalated: tickets.filter((t) => t.isBotEscalated && t.status !== 'resolved' && t.status !== 'closed').length,
    resolved: tickets.filter((t) => t.status === 'resolved').length,
  };
}

/**
 * Subscribe to cross-tab updates
 */
export function subscribeToSupportUpdates(callback) {
  if (!channel) return () => {};
  const handler = (event) => {
    if (event.data?.type === 'TICKETS_UPDATED') {
      callback();
    }
  };
  channel.addEventListener('message', handler);
  return () => {
    channel.removeEventListener('message', handler);
  };
}
