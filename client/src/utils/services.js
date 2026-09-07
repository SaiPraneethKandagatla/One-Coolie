export const SERVICE_LABELS = {
  luggage: '🧳 Luggage Assistance',
  escort: '🚶 Seat Escort',
  language: '🗣️ Language Help',
  wheelchair: '♿ Wheelchair',
  snacks: '🍱 Snacks & Water',
  transport: '🛺 Exit Transport',
};

export const STATIONS = [
  { code: 'KZJ', name: 'Kazipet Jn', division: 'Secunderabad' },
  { code: 'WL', name: 'Warangal', division: 'Secunderabad' },
  { code: 'BZA', name: 'Vijayawada Jn', division: 'Vijayawada' },
  { code: 'SC', name: 'Secunderabad Jn', division: 'Secunderabad' },
];

const EXCLUDED_SERVICE_METADATA = new Set([
  'coach',
  'seat_number',
  'berth_type',
  'action_type',
  'pnr',
  'platform',
  'luggageCounts',
  'luggage_details',
  'chat_messages',
  'pricing_breakdown',
  'price_breakdown',
  'messages',
  'pricing',
  'review',
  'rating',
  'otp',
  'start_otp',
]);

export const activeServices = (services = {}) => {
  if (!services || typeof services !== 'object') return [];

  return Object.entries(services)
    .filter(([k, v]) => {
      if (EXCLUDED_SERVICE_METADATA.has(k)) return false;
      if (!SERVICE_LABELS[k]) return false; // Strict guard: only show genuine railway services
      return typeof v === 'number' ? v > 0 : Boolean(v);
    })
    .map(([k, v]) => {
      let val = 'Yes';
      if (k === 'luggage') {
        const count = typeof v === 'number' ? v : 1;
        const details = services.luggage_details;
        val = details ? `${count} item(s) (${details})` : `${count} item(s)`;
      } else if (typeof v === 'number') {
        val = `${v} item(s)`;
      }
      return {
        key: k,
        label: SERVICE_LABELS[k] || k,
        value: val,
      };
    });
};