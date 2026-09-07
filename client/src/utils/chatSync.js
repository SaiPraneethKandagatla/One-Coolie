/**
 * chatSync.js
 *
 * Robust, multi-tier chat synchronization and persistence utility:
 * 1. Instant local display & cross-tab sync via localStorage + BroadcastChannel
 * 2. Permanent cloud persistence via Supabase REST (services.chat_messages)
 * 3. Automatic recovery on page refresh or browser restarts across all devices
 */

const SUPABASE_URL = 'https://pzrttunhyfporcpcybax.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dXyQiI56vk_nQF_l8DiysQ_sCa4bPt4';

/**
 * Get cached chat messages from localStorage immediately (synchronous)
 */
export function getLocalChat(bookingId, bookingCode) {
  try {
    if (bookingId) {
      const raw = localStorage.getItem(`oc_chat_${bookingId}`);
      if (raw) return JSON.parse(raw);
    }
    if (bookingCode) {
      const raw = localStorage.getItem(`oc_chat_${bookingCode}`);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {}
  return [];
}

/**
 * Save chat messages to localStorage under all booking identifiers
 */
export function saveLocalChat(bookingId, bookingCode, messages) {
  try {
    const raw = JSON.stringify(messages);
    if (bookingId) localStorage.setItem(`oc_chat_${bookingId}`, raw);
    if (bookingCode && bookingCode !== bookingId) {
      localStorage.setItem(`oc_chat_${bookingCode}`, raw);
    }
  } catch (e) {}
}

/**
 * Remove chat messages from localStorage once a booking is completed
 */
export function clearLocalChat(bookingId, bookingCode) {
  try {
    if (bookingId) localStorage.removeItem(`oc_chat_${bookingId}`);
    if (bookingCode) localStorage.removeItem(`oc_chat_${bookingCode}`);
  } catch (e) {}
}

/**
 * Broadcast message across tabs in the same browser
 */
export function broadcastChatTab(bookingId, bookingCode, message) {
  try {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel('onecoolie_chat_channel');
      bc.postMessage({ bookingId, bookingCode, message });
      bc.close();
    }
  } catch (e) {}
}

/**
 * Merge two chat arrays without duplicates based on sender, text, and timestamp
 */
export function mergeChatMessages(existing = [], incoming = []) {
  const merged = [...existing];
  let changed = false;

  incoming.forEach((inMsg) => {
    if (!inMsg || !inMsg.text) return;
    const inTime = inMsg.timestamp ? new Date(inMsg.timestamp).getTime() : 0;
    const exists = merged.some((m) => {
      if (m.from === inMsg.from && m.text === inMsg.text) {
        const mTime = m.timestamp ? new Date(m.timestamp).getTime() : 0;
        return Math.abs(mTime - inTime) < 6000;
      }
      return false;
    });
    if (!exists) {
      merged.push(inMsg);
      changed = true;
    }
  });

  return { merged, changed };
}

/**
 * Fetch remote chat history directly from Supabase bookings.services.chat_messages
 */
export async function fetchRemoteChat(bookingId, bookingCode) {
  const ref = bookingId || bookingCode;
  if (!ref) return [];

  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
    const filter = isUUID ? `id=eq.${ref}` : `booking_id=eq.${ref}`;
    const url = `${SUPABASE_URL}/rest/v1/bookings?${filter}&select=services`;

    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const services = data[0]?.services;
        if (services && Array.isArray(services.chat_messages)) {
          return services.chat_messages;
        }
      }
    }
  } catch (err) {
    console.warn('Direct chat fetch notice:', err);
  }
  return [];
}

/**
 * Persist a new message into Supabase bookings.services.chat_messages
 */
export async function persistRemoteChat(bookingId, bookingCode, message) {
  const ref = bookingId || bookingCode;
  if (!ref || !message) return;

  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
    const filter = isUUID ? `id=eq.${ref}` : `booking_id=eq.${ref}`;
    const url = `${SUPABASE_URL}/rest/v1/bookings?${filter}&select=id,services`;

    const getRes = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!getRes.ok) return;
    const data = await getRes.json();
    if (!Array.isArray(data) || data.length === 0) return;

    const row = data[0];
    const currentServices = row.services && typeof row.services === 'object' ? row.services : {};
    const oldMessages = Array.isArray(currentServices.chat_messages) ? currentServices.chat_messages : [];

    const msgTime = message.timestamp ? new Date(message.timestamp).getTime() : Date.now();
    const alreadyExists = oldMessages.some((m) => {
      if (m.from === message.from && m.text === message.text) {
        const mTime = m.timestamp ? new Date(m.timestamp).getTime() : Date.now();
        return Math.abs(mTime - msgTime) < 6000;
      }
      return false;
    });

    if (alreadyExists) return;

    const updatedMessages = [...oldMessages, message];

    await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        services: {
          ...currentServices,
          chat_messages: updatedMessages,
        },
        updated_at: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.warn('Direct chat persist notice:', err);
  }
}
