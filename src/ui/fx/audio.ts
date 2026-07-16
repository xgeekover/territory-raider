/**
 * Synthesized audio: every sound is generated with WebAudio oscillators/noise
 * at runtime — no audio assets, matching the project's shape-and-code ethos.
 *
 * The AudioContext is created lazily on the first user gesture (`unlock`),
 * which satisfies web autoplay policy; Electron simply unlocks on first key.
 * Mute preference persists to localStorage. Safe to import anywhere in the UI:
 * nothing touches WebAudio until unlock() is called.
 */

const MUTE_KEY = 'territory-raider-muted';

export type SfxName =
  | 'claim'
  | 'bigClaim'
  | 'item'
  | 'laser'
  | 'death'
  | 'sparkWarn'
  | 'stageClear'
  | 'gameOver'
  | 'victory'
  | 'bossKill'
  | 'bossShoot'
  | 'bossHit'
  | 'bossRage'
  | 'confirm'
  | 'pause';

export interface AudioSystem {
  /** Create/resume the AudioContext — call from a user-gesture handler. */
  unlock(): void;
  play(name: SfxName): void;
  /** Start/stop the ambient background pad. */
  setMusic(on: boolean): void;
  /** Returns the new muted state. */
  toggleMuted(): boolean;
  isMuted(): boolean;
}

interface ToneSpec {
  type: OscillatorType;
  from: number; // start frequency (Hz)
  to?: number; // optional glide target
  dur: number; // seconds
  at?: number; // schedule offset (s)
  gain?: number;
}

export function createAudioSystem(): AudioSystem {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let musicNodes: { stop(): void } | null = null;
  let musicWanted = false; // desired state — survives mute toggles
  let muted = false;
  try {
    muted = window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    /* storage unavailable — default unmuted */
  }

  function ensure(): AudioContext | null {
    if (!ctx) return null;
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  }

  function tone(spec: ToneSpec): void {
    const ac = ensure();
    if (!ac || !master || muted) return;
    const t0 = ac.currentTime + (spec.at ?? 0);
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = spec.type;
    osc.frequency.setValueAtTime(spec.from, t0);
    if (spec.to !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(spec.to, 1), t0 + spec.dur);
    }
    const peak = spec.gain ?? 0.2;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + spec.dur + 0.05);
  }

  function noise(dur: number, gain: number, at = 0, lowpassHz?: number): void {
    const ac = ensure();
    if (!ac || !master || muted) return;
    const t0 = ac.currentTime + at;
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    if (lowpassHz) {
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpassHz;
      src.connect(f).connect(g).connect(master);
    } else {
      src.connect(g).connect(master);
    }
    src.start(t0);
  }

  /** Quick ascending arpeggio helper for fanfares. */
  function arp(freqs: number[], noteDur: number, type: OscillatorType, gain = 0.16): void {
    freqs.forEach((f, i) => tone({ type, from: f, dur: noteDur * 1.6, at: i * noteDur, gain }));
  }

  const SFX: Record<SfxName, () => void> = {
    claim: () => tone({ type: 'square', from: 380, to: 640, dur: 0.09, gain: 0.12 }),
    bigClaim: () => {
      tone({ type: 'square', from: 380, to: 760, dur: 0.16, gain: 0.14 });
      tone({ type: 'square', from: 570, to: 1140, dur: 0.16, at: 0.05, gain: 0.1 });
      noise(0.12, 0.05, 0, 4000);
    },
    item: () => arp([660, 880, 1320], 0.055, 'triangle', 0.18),
    laser: () => {
      tone({ type: 'sawtooth', from: 950, to: 160, dur: 0.18, gain: 0.14 });
      noise(0.08, 0.06);
    },
    death: () => {
      noise(0.35, 0.22, 0, 1800);
      tone({ type: 'square', from: 220, to: 55, dur: 0.5, gain: 0.2 });
      tone({ type: 'sawtooth', from: 160, to: 40, dur: 0.55, at: 0.05, gain: 0.12 });
    },
    sparkWarn: () => {
      tone({ type: 'square', from: 1250, dur: 0.045, gain: 0.09 });
      tone({ type: 'square', from: 1250, dur: 0.045, at: 0.08, gain: 0.09 });
    },
    stageClear: () => arp([523, 659, 784, 1047], 0.11, 'triangle', 0.2),
    gameOver: () => arp([311, 233, 155], 0.22, 'sawtooth', 0.13),
    victory: () => arp([523, 659, 784, 1047, 1319], 0.13, 'triangle', 0.22),
    bossKill: () => {
      noise(0.6, 0.28, 0, 900);
      tone({ type: 'sine', from: 70, to: 30, dur: 0.7, gain: 0.3 });
      arp([784, 1047, 1568], 0.09, 'triangle', 0.14);
    },
    bossShoot: () => tone({ type: 'square', from: 240, to: 95, dur: 0.13, gain: 0.07 }),
    bossHit: () => {
      tone({ type: 'triangle', from: 880, to: 420, dur: 0.09, gain: 0.16 });
      noise(0.05, 0.06, 0, 5000);
    },
    bossRage: () => {
      // Roar: rising snarl into a falling growl + rumble.
      tone({ type: 'sawtooth', from: 90, to: 220, dur: 0.18, gain: 0.16 });
      tone({ type: 'sawtooth', from: 220, to: 55, dur: 0.4, at: 0.16, gain: 0.18 });
      noise(0.5, 0.1, 0.1, 700);
    },
    confirm: () => tone({ type: 'square', from: 520, to: 780, dur: 0.07, gain: 0.12 }),
    pause: () => tone({ type: 'triangle', from: 440, to: 330, dur: 0.08, gain: 0.1 }),
  };

  // --- background music: a proper chiptune loop -----------------------------
  // 4-bar sequence in A minor (Am → F → C → G) at 118 BPM, 16th-note grid.
  // Driving square bass, sparkling arp lead, kick/snare/hat — the classic
  // arcade territory-capture feel. Scheduled with the standard WebAudio
  // lookahead pattern so timing stays sample-accurate.
  const BPM = 118;
  const STEP_DUR = 60 / BPM / 4; // one 16th note
  const STEPS_PER_BAR = 16;
  const BARS = 4;

  // Chord roots per bar (Hz): A2, F2, C3, G2.
  const ROOTS = [110.0, 87.31, 130.81, 98.0] as const;
  // Arp chord tones as multiples of the root: root, 3rd(min/maj via table), 5th, octave.
  // Am: 1, 6/5(C), 3/2(E) · F: 1, 5/4(A), 3/2(C) · C: 1, 5/4(E), 3/2(G) · G: 1, 5/4(B), 3/2(D)
  const THIRDS = [1.2, 1.25, 1.25, 1.25] as const;
  // 16-step arp contour (indices into [root, third, fifth, octave] two octaves up).
  const ARP_PATTERN = [0, 2, 1, 3, 0, 2, 1, 2, 0, 2, 1, 3, 2, 1, 2, 0] as const;
  // Bass rhythm: driving 8ths with a fifth walk-up at the bar's tail.
  const BASS_STEPS = new Set([0, 2, 4, 6, 8, 10, 12, 14]);

  function scheduleStep(globalStep: number, t: number): void {
    const ac = ctx;
    if (!ac || !master || muted) return;
    const bar = Math.floor(globalStep / STEPS_PER_BAR) % BARS;
    const step = globalStep % STEPS_PER_BAR;
    const root = ROOTS[bar]!;
    const third = THIRDS[bar]!;

    const note = (freq: number, dur: number, type: OscillatorType, gain: number): void => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(master!);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    };

    // Bass: root 8ths; steps 12/14 walk the fifth/octave for momentum.
    if (BASS_STEPS.has(step)) {
      const f = step === 12 ? root * 1.5 : step === 14 ? root * 2 : root;
      note(f, STEP_DUR * 1.7, 'square', 0.075);
    }

    // Arp lead: chord tones two octaves up, quiet and glassy.
    const tones = [4, 4 * third, 6, 8] as const; // ×root — root/3rd/5th/octave
    const idx = ARP_PATTERN[step]!;
    note(root * tones[idx]!, STEP_DUR * 1.1, 'triangle', 0.05);

    // Drums.
    if (step === 0 || step === 8) {
      // Kick: sine drop.
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.11);
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + 0.15);
    }
    if (step === 4 || step === 12) {
      // Snare: bandpassed noise snap.
      const len = Math.floor(ac.sampleRate * 0.09);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const f = ac.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1900;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.06, t);
      src.connect(f).connect(g).connect(master);
      src.start(t);
    }
    if (step % 2 === 0) {
      // Closed hat: tiny highpassed tick on 8ths, accented off-beat.
      const len = Math.floor(ac.sampleRate * 0.025);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const f = ac.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 7000;
      const g = ac.createGain();
      g.gain.setValueAtTime(step % 4 === 2 ? 0.035 : 0.018, t);
      src.connect(f).connect(g).connect(master);
      src.start(t);
    }
  }

  function startMusic(): void {
    const ac = ensure();
    if (!ac || !master || musicNodes) return;
    let step = 0;
    let nextTime = ac.currentTime + 0.06;
    const timer = window.setInterval(() => {
      // Lookahead scheduling: queue every step falling inside the next 120ms.
      while (nextTime < ac.currentTime + 0.12) {
        scheduleStep(step, nextTime);
        step = (step + 1) % (STEPS_PER_BAR * BARS);
        nextTime += STEP_DUR;
      }
    }, 30);
    musicNodes = { stop: () => window.clearInterval(timer) };
  }

  function stopMusic(): void {
    musicNodes?.stop();
    musicNodes = null;
  }

  return {
    unlock(): void {
      if (ctx) {
        if (ctx.state === 'suspended') void ctx.resume();
        return;
      }
      try {
        ctx = new AudioContext();
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
      } catch {
        ctx = null; // no audio available — game runs silent
      }
    },
    play(name: SfxName): void {
      if (muted) return;
      SFX[name]();
    },
    setMusic(on: boolean): void {
      musicWanted = on;
      if (on && !muted) startMusic();
      else stopMusic();
    },
    toggleMuted(): boolean {
      muted = !muted;
      if (muted) stopMusic();
      else if (musicWanted) startMusic(); // unmuting mid-run resumes the loop
      try {
        window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch {
        /* best-effort */
      }
      return muted;
    },
    isMuted: () => muted,
  };
}

/** Shared UI-layer instance (the game has exactly one audio pipeline). */
export const audioSystem = createAudioSystem();
