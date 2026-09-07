/**
 * supportAiEngine.js
 *
 * Context-aware AI travel assistance engine for OneCoolie Support:
 * - Natural query understanding
 * - Automatically injects passenger's active booking context (Train, Coach, Seat, Service, Assistant)
 * - Offers interactive actions (Cancel, Platform info, Refund check)
 * - Triggers human escalation when appropriate
 * - Generates concise summaries for support executives
 */

export const SUGGESTED_QUESTIONS = [
  'Where is my assistant?',
  'How long will it take?',
  'Can I cancel my booking?',
  'What is the refund policy?',
  'My assistant hasn’t arrived',
  'My payment failed',
  'Where is my platform?',
  'Talk to a support agent',
];

export const QUICK_CATEGORIES = [
  {
    id: 'booking',
    title: 'Booking & Trip',
    subtitle: 'Manage your booking',
    icon: 'Luggage',
    popularQuestions: [
      'How do I view my confirmed booking?',
      'Can I change my coach or seat number?',
      'How to book an assistant for elderly parents?',
    ],
  },
  {
    id: 'assistant',
    title: 'Assistant',
    subtitle: 'Track or report issues',
    icon: 'UserCheck',
    popularQuestions: [
      'Where is my assistant?',
      'How do I verify the assistant on the platform?',
      'Can I tip my assistant directly?',
    ],
  },
  {
    id: 'luggage',
    title: 'Luggage & Service',
    subtitle: 'Luggage related help',
    icon: 'Briefcase',
    popularQuestions: [
      'What is the maximum baggage weight per porter?',
      'Can I add extra luggage items at the station?',
      'Do you provide wheelchair assistance?',
    ],
  },
  {
    id: 'payment',
    title: 'Payment & Refund',
    subtitle: 'Payments, invoices',
    icon: 'CreditCard',
    popularQuestions: [
      'What is the refund policy?',
      'My payment failed but money was deducted',
      'Where can I download my GST invoice?',
    ],
  },
  {
    id: 'train',
    title: 'Train & Station',
    subtitle: 'Platform, delay, change',
    icon: 'Train',
    popularQuestions: [
      'Where is my platform?',
      'What happens if my train is delayed?',
      'Which stations currently have OneCoolie service?',
    ],
  },
  {
    id: 'account',
    title: 'Account',
    subtitle: 'Login, profile, OTP',
    icon: 'Shield',
    popularQuestions: [
      'How do I change my registered phone number?',
      'Why is there a limit of 2 phone changes per month?',
      'How to update my notification preferences?',
    ],
  },
];

/**
 * Generate a context-aware AI response based on query and active trip context
 */
export function generateAiResponse(query, activeTrip) {
  const q = (query || '').toLowerCase().trim();

  // Active trip telemetry fallback
    const trip = activeTrip || null;

  // 1. Where is my assistant?
  if (q.includes('where is my assistant') || q.includes('track assistant') || q.includes('where is assistant')) {
    if (!trip.assistant || !trip.assistant.assigned) {
      return {
        text: `I've checked your booking details.\n\nTrain: ${trip.trainNo} (${trip.trainName || 'Express'})\nCoach: ${trip.coach} • Seat: ${trip.seat}\nStation: ${trip.station || 'Secunderabad'}\n\nYour assistant has not been assigned yet. We are currently searching for the nearest available assistant at ${trip.station || 'the concourse'}.\n\nYou'll be notified automatically as soon as an assistant is assigned. ✓`,
        showFeedback: true,
        actions: [{ type: 'track_trip', label: 'View Trip Progress →' }],
      };
    }

    return {
      text: `I checked your booking for Train ${trip.trainNo} (${trip.coach} / ${trip.seat}).\n\nAssigned Assistant: ${trip.assistant.name}\nStatus: ${trip.assistant.status || 'At station'}\nContact: ${trip.assistant.phone || 'Available in booking'}\n\nYour assistant is ready at the platform concourse. You will share your secret 6-digit OTP in person to start the service.`,
      showFeedback: true,
      actions: [{ type: 'track_trip', label: 'Track Live Status →' }],
    };
  }

  // 2. Assistant hasn't arrived / delayed / train running late -> Propose human escalation
  if (
    q.includes("hasn't arrived") ||
    q.includes('has not arrived') ||
    q.includes('delayed') ||
    q.includes('not at the station') ||
    q.includes('missing') ||
    q.includes('late')
  ) {
    return {
      text: `I understand this can be frustrating. I've checked your booking for Train ${trip.trainNo} (${trip.route || 'Active Journey'}).\n\nI couldn't find an instant automated resolution for this specific concourse situation. Would you like me to connect you with our support team? They can verify with the station supervisor and help you immediately.`,
      escalationProposed: true,
      escalationReason: 'Assistant not at station / train schedule delay',
      actions: [{ type: 'escalate_support', label: 'Connect With Support →' }],
    };
  }

  // 3. Talk to a support agent / human escalation explicitly requested
  if (
    q.includes('support agent') ||
    q.includes('human') ||
    q.includes('support executive') ||
    q.includes('agent') ||
    q.includes('talk to someone') ||
    q.includes('call support')
  ) {
    return {
      text: "I can connect you right away with a OneCoolie Support Executive. Your trip details, coach/seat information, and our chat transcript will be attached automatically so you don't have to repeat anything.",
      escalationProposed: true,
      escalationReason: 'Passenger explicitly requested human support',
      actions: [{ type: 'escalate_support', label: 'Connect Now →' }],
    };
  }

  // 4. How long will it take?
  if (q.includes('how long') || q.includes('eta') || q.includes('time') || q.includes('arrival')) {
    return {
      text: `For Train ${trip.trainNo}, our verified assistants are dispatched 20 minutes prior to scheduled train arrival or boarding time at ${trip.station || 'your station'}.\n\nAs soon as your assistant reaches your platform or gate, you will receive an SMS and audio chime on your dashboard.`,
      showFeedback: true,
      actions: [{ type: 'track_trip', label: 'Check Trip Timeline →' }],
    };
  }

  // 5. Can I cancel my booking? / Cancellation
  if (q.includes('cancel') || q.includes('cancellation')) {
    return {
      text: `Yes, you can cancel your OneCoolie booking up to 30 minutes before your train departure with 100% full refund.\n\nWould you like to cancel booking ${trip.bookingId || 'RM-VT834-VB'} for Train ${trip.trainNo}?`,
      showFeedback: true,
      actions: [
        { type: 'cancel_booking', label: 'Cancel This Booking' },
        { type: 'refund_policy', label: 'View Refund Policy' },
      ],
    };
  }

  // 6. What is the refund policy?
  if (q.includes('refund') || q.includes('money back')) {
    return {
      text: `OneCoolie Refund Policy:\n\n• Cancellations made ≥ 30 mins before train arrival receive a 100% instant refund.\n• In case an assistant is unavailable at your station, a 100% automatic refund is credited.\n• Refunds are processed back to your original payment method (UPI / Card / NetBanking) within 2-4 hours.`,
      showFeedback: true,
      actions: [{ type: 'track_refund', label: 'Check Refund Status' }],
    };
  }

  // 7. Payment failed / deducted
  if (q.includes('payment failed') || q.includes('deducted') || q.includes('money deducted') || q.includes('double charge')) {
    return {
      text: `If money was debited from your bank account but your booking shows pending or failed, our payment gateway auto-reconciles transactions within 15 minutes.\n\nIf the booking is not confirmed, the debited amount is returned to your account automatically within 24 hours. Would you like me to flag this for a support executive to trace the bank RRN?`,
      escalationProposed: true,
      escalationReason: 'Payment gateway deduction dispute',
      actions: [{ type: 'escalate_support', label: 'Connect With Support →' }],
    };
  }

  // 8. Where is my platform? / Platform diversion
  if (q.includes('platform') || q.includes('which platform') || q.includes('where is platform')) {
    return {
      text: `Your train (${trip.trainNo} ${trip.trainName || ''}) at ${trip.station || 'Secunderabad'} is scheduled on Platform ${trip.platform || '1'}.\n\n⚠️ Note: Station platform assignments can be updated by Railway Traffic Control at short notice. Your assistant will automatically track live platform changes.`,
      showFeedback: true,
      actions: [{ type: 'view_map', label: 'View Concourse Map →' }],
    };
  }

  // Default intelligent fallback
  return {
    text: `I've analyzed your question regarding your journey on Train ${trip.trainNo} (${trip.route || 'OneCoolie Network'}).\n\nOur platform assistants handle station porterage, wheelchair escort, and berth guidance seamlessly.\n\nIf this doesn't fully resolve what you need, let me know or click below to connect directly with our 24/7 human support team.`,
    showFeedback: true,
    actions: [
      { type: 'suggested_question', label: 'Where is my assistant?' },
      { type: 'escalate_support', label: 'Talk to a support agent →' },
    ],
  };
}

/**
 * Generate executive AI summary for human support agents upon escalation
 */
export function generateEscalationSummary(chatHistory = [], activeTrip = null) {
  const lastUserMsg = [...chatHistory].reverse().find((m) => m.sender === 'passenger')?.text || 'Assistance requested';
  const trip = activeTrip || {
    trainNo: '20834',
    route: 'Secunderabad → Visakhapatnam',
    coach: 'S4',
    seat: '42',
    service: 'Boarding Load',
  };

  return `Passenger reported: "${lastUserMsg}".
Trip context: Train ${trip.trainNo} (${trip.route || 'Active Journey'}), Coach ${trip.coach}, Seat ${trip.seat}, Service: ${trip.service || 'Boarding'}.
AI attempted automated assignment & telemetry check.
Issue was unresolved automatically. Ticket escalated for immediate human assistance.`;
}
