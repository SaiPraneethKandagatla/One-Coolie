/**
 * supportFaqData.js
 * Comprehensive, verified FAQ repository for OneCoolie Railway Station Assistance.
 */

export const FAQ_CATEGORIES = [
  { id: 'all', label: 'All Topics' },
  { id: 'booking', label: 'Booking & Trip' },
  { id: 'assistant', label: 'Assistant' },
  { id: 'luggage', label: 'Luggage & Service' },
  { id: 'payment', label: 'Payment & Refund' },
  { id: 'train', label: 'Train & Station' },
  { id: 'account', label: 'Account & Safety' },
];

export const FAQ_QUESTIONS = [
  // ── Booking & Trip ──────────────────────────────────────────
  {
    id: 'faq-b1',
    category: 'booking',
    question: 'How do I book coolie assistance using my 10-digit IRCTC PNR?',
    answer: 'Enter your 10-digit IRCTC PNR on the Book tab. OneCoolie automatically verifies your train number, coach, journey date, and source station. Then select your luggage count and optional escort services, review the total fare, and confirm.'
  },
  {
    id: 'faq-b2',
    category: 'booking',
    question: 'Can I book station assistance without an IRCTC PNR number?',
    answer: 'Yes! On Step 1 of the booking wizard, select "Station & Train" search. Pick your station (e.g. Kazipet, Secunderabad, Hyderabad Deccan) and enter your train number to book assistance directly.'
  },
  {
    id: 'faq-b3',
    category: 'booking',
    question: 'Can I modify my coach or seat number after booking?',
    answer: 'Yes. You can edit your coach and seat details directly in "My Trips" up to 1 hour before scheduled train arrival, or open Support Chat to have our AI update the assignment in real time.'
  },
  {
    id: 'faq-b4',
    category: 'booking',
    question: 'What happens if my train is delayed or rescheduled?',
    answer: 'OneCoolie tracks live NTES railway running telemetry. If your train is delayed, your assigned assistant\'s reporting time is automatically adjusted at no extra charge.'
  },
  {
    id: 'faq-b5',
    category: 'booking',
    question: 'How do I cancel a booking and what is the cancellation policy?',
    answer: 'Go to "My Trips", select your active booking, and click "Cancel Booking". Cancellations made up to 2 hours before the scheduled train arrival receive a 100% full refund with zero cancellation fee.'
  },

  // ── Assistant ───────────────────────────────────────────────
  {
    id: 'faq-a1',
    category: 'assistant',
    question: 'Where will the assistant meet me at the railway station?',
    answer: 'For Boarding Assistance (train departures), the assistant meets you at the designated Station Entrance Gate (or IRCTC Helpdesk) 30 minutes before departure. For De-boarding Assistance (train arrivals), the assistant waits directly outside your coach door on the platform.'
  },
  {
    id: 'faq-a2',
    category: 'assistant',
    question: 'How do I identify and call my assigned assistant?',
    answer: 'Once an assistant is dispatched, their name, official OneCoolie badge number, phone number, and real-time status appear in "My Trips". All verified assistants wear official red OneCoolie uniforms with a badge.'
  },
  {
    id: 'faq-a3',
    category: 'assistant',
    question: 'What should I do if the assistant does not arrive on time?',
    answer: 'Tap "Need help with a trip?" on the Help page or click "Track Assistant". You can call the assistant directly or chat with our 24/7 supervisor who will immediately re-assign a standby platform porter.'
  },
  {
    id: 'faq-a4',
    category: 'assistant',
    question: 'Can the assistant assist senior citizens or passengers needing wheelchairs?',
    answer: 'Yes! Select the "Wheelchair & Priority" service option during booking. The assigned assistant will bring a station wheelchair, navigate platform foot-overbridges/ramps, and safely escort the passenger to their berth.'
  },

  // ── Luggage & Service ───────────────────────────────────────
  {
    id: 'faq-l1',
    category: 'luggage',
    question: 'How are luggage handling charges calculated?',
    answer: 'Fares are fixed, regulated, and transparent: ₹30 for Small items (backpacks/handbags up to 10kg), ₹40 for Medium items (cabin trolley bags up to 20kg), and ₹60 for Large items (check-in suitcases over 20kg). No haggling or hidden fees.'
  },
  {
    id: 'faq-l2',
    category: 'luggage',
    question: 'Will the assistant load luggage inside the train coach onto my berth?',
    answer: 'Yes. OneCoolie luggage handling includes carrying bags from the station gate, crossing platforms via foot-overbridges, entering your train coach, and lifting/stowing the bags onto your berth.'
  },
  {
    id: 'faq-l3',
    category: 'luggage',
    question: 'Can I add extra bags after the assistant has arrived?',
    answer: 'Yes, you can adjust the luggage count with your assistant prior to commencing the service, and pay the regulated fare difference digitally or via cash.'
  },

  // ── Payment & Refund ────────────────────────────────────────
  {
    id: 'faq-p1',
    category: 'payment',
    question: 'Which payment methods are accepted?',
    answer: 'We accept UPI (Google Pay, PhonePe, Paytm, BHIM), Credit/Debit Cards (Visa, Mastercard, RuPay), Net Banking across 50+ Indian banks, and Pay at Station upon service completion.'
  },
  {
    id: 'faq-p2',
    category: 'payment',
    question: 'My money was deducted but booking is not showing as confirmed. What should I do?',
    answer: 'If a bank gateway timeout occurs, our automated reconciliation system verifies the transaction within 15 minutes. If unconfirmed, the deducted amount is automatically refunded to your source bank account within 24-48 business hours.'
  },
  {
    id: 'faq-p3',
    category: 'payment',
    question: 'How long does a refund take to reach my account?',
    answer: 'UPI refunds are processed instantly or within 2-4 hours. Card and Net Banking refunds are credited within 3-5 business days depending on your issuing bank.'
  },

  // ── Train & Station ─────────────────────────────────────────
  {
    id: 'faq-t1',
    category: 'train',
    question: 'Which railway stations currently support OneCoolie assistance?',
    answer: 'We operate across key South Central Railway stations including Secunderabad (SC), Hyderabad Deccan (HYB), Kazipet Jn (KZJ), Warangal (WL), and Vijayawada Jn (BZA), with rapid expansion to other zonal stations.'
  },
  {
    id: 'faq-t2',
    category: 'train',
    question: 'How do I know which platform my train will arrive at?',
    answer: 'Platform numbers are synced with live railway station displays and updated in "My Trips". You can also ask our Support Assistant in the chat for the latest platform announcement.'
  },
  {
    id: 'faq-t3',
    category: 'train',
    question: 'Where is the OneCoolie Station Supervisor desk located?',
    answer: 'Our physical helpdesks are located at Main Entrance Gate 1 (Concourse area near Platform 1) at all supported railway junctions.'
  },

  // ── Account & Safety ────────────────────────────────────────
  {
    id: 'faq-ac1',
    category: 'account',
    question: 'How do I update my registered mobile number?',
    answer: 'Click your profile icon in the top-right navbar, open Settings, and select "Edit Mobile Number". Verify your new 10-digit number with the SMS OTP to update your profile.'
  },
  {
    id: 'faq-ac2',
    category: 'account',
    question: 'Is my luggage insured against loss or damage during handling?',
    answer: 'Yes! Every booking is protected by OneCoolie Transit Baggage Protection, covering accidental physical damage or loss during station porter handling.'
  },
  {
    id: 'faq-ac3',
    category: 'account',
    question: 'How do I reach Railway Police (RPF) in an emergency?',
    answer: 'Tap the red "Call 112" emergency button on the Help page, or dial the national Indian Railway passenger helpline 139 directly.'
  },
];
