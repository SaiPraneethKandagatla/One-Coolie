/**
 * Audio Alert Synthesizer for OneCoolie Assistant Operations
 * Uses Web Audio API (zero external asset requests, 0ms latency, cross-browser).
 */

let sharedAudioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * 1. ON DUTY SUCCESSFUL CHIME
 * Uplifting, crisp ascending major chord (E5 -> G#5 -> B5 -> E6)
 * Triggered when assistant successfully goes ON DUTY.
 */
export function playOnDutySound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Chord sequence: E5 (659.25Hz), G#5 (830.61Hz), B5 (987.77Hz), E6 (1318.51Hz)
    const notes = [
      { freq: 659.25, start: now + 0.00, dur: 0.18, vol: 0.28 },
      { freq: 830.61, start: now + 0.08, dur: 0.22, vol: 0.32 },
      { freq: 987.77, start: now + 0.16, dur: 0.28, vol: 0.38 },
      { freq: 1318.51, start: now + 0.24, dur: 0.45, vol: 0.42 }
    ];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, n.start);

      gain.gain.setValueAtTime(0.0001, n.start);
      gain.gain.linearRampToValueAtTime(n.vol, n.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, n.start + n.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(n.start);
      osc.stop(n.start + n.dur);
    });
  } catch (err) {
    console.warn('Could not play on-duty audio chime:', err);
  }
}

/**
 * 2. NEW DISPATCH / BOOKING ARRIVAL SOUND
 * High-clarity double attention chime (F#5 -> C#6, repeated)
 * Standout alert chime designed for railway station hubs.
 */
export function playNewBookingSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Pulse 1 & Pulse 2 notes
    const pulses = [
      // Pulse 1
      { freq: 739.99, start: now + 0.00, dur: 0.14, vol: 0.35, type: 'triangle' },
      { freq: 1108.73, start: now + 0.07, dur: 0.28, vol: 0.45, type: 'sine' },
      { freq: 2217.46, start: now + 0.07, dur: 0.20, vol: 0.15, type: 'sine' }, // Harmonic shimmer

      // Pulse 2 (accentuated second ring)
      { freq: 739.99, start: now + 0.24, dur: 0.14, vol: 0.40, type: 'triangle' },
      { freq: 1108.73, start: now + 0.31, dur: 0.55, vol: 0.55, type: 'sine' },
      { freq: 2217.46, start: now + 0.31, dur: 0.40, vol: 0.20, type: 'sine' }, // Harmonic shimmer
    ];

    pulses.forEach((p) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = p.type || 'sine';
      osc.frequency.setValueAtTime(p.freq, p.start);

      gain.gain.setValueAtTime(0.0001, p.start);
      gain.gain.linearRampToValueAtTime(p.vol, p.start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, p.start + p.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(p.start);
      osc.stop(p.start + p.dur);
    });
  } catch (err) {
    console.warn('Could not play new booking audio alert:', err);
  }
}
