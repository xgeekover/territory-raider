/**
 * Synthesized audio: every sound is generated with WebAudio oscillators/noise
 * at runtime — no audio assets, matching the project's shape-and-code ethos.
 *
 * The AudioContext is created lazily on the first user gesture (`unlock`),
 * which satisfies web autoplay policy; Electron simply unlocks on first key.
 * Mute preference persists to localStorage. Safe to import anywhere in the UI:
 * nothing touches WebAudio until unlock() is called.
 */

import type { ThemeKind } from '../../engine/core/types';

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
  | 'hazardBurn'
  | 'hazardSlow'
  | 'hazardStun'
  | 'confirm'
  | 'pause';

export interface AudioSystem {
  /** Create/resume the AudioContext — call from a user-gesture handler. */
  unlock(): void;
  play(name: SfxName): void;
  /** Start/stop the ambient background pad. */
  setMusic(on: boolean): void;
  /** Elemental theme of the current stage — reshapes the music loop live. */
  setTheme(theme: ThemeKind | undefined): void;
  /** Returns the new muted state. */
  toggleMuted(): boolean;
  isMuted(): boolean;
}

/**
 * Per-theme variation of the chiptune loop: same 4-bar / 16-step machinery,
 * different key, tempo and timbre. Neutral keeps the original A-minor drive;
 * fire snarls in D minor on a saw bass; ice drifts slow and glassy through a
 * C-major wash; lightning races in E minor with an urgent tick.
 */
interface MusicTheme {
  bpm: number;
  roots: readonly [number, number, number, number];
  thirds: readonly [number, number, number, number]; // 1.2 = minor, 1.25 = major
  bassType: OscillatorType;
  arpType: OscillatorType;
  arpGain: number;
  hatMod: 2 | 4; // hat tick every Nth step
}

const MUSIC_THEMES: Record<'none' | ThemeKind, MusicTheme> = {
  // Am → F → C → G (the original loop)
  none: {
    bpm: 118,
    roots: [110.0, 87.31, 130.81, 98.0],
    thirds: [1.2, 1.25, 1.25, 1.25],
    bassType: 'square',
    arpType: 'triangle',
    arpGain: 0.05,
    hatMod: 2,
  },
  // Dm → B♭ → Gm → A: darker, saw-driven, a shade faster
  fire: {
    bpm: 126,
    roots: [73.42, 116.54, 98.0, 110.0],
    thirds: [1.2, 1.25, 1.2, 1.25],
    bassType: 'sawtooth',
    arpType: 'triangle',
    arpGain: 0.045,
    hatMod: 2,
  },
  // C → G → Am → Em: slow, glassy, sparse percussion
  ice: {
    bpm: 102,
    roots: [130.81, 98.0, 110.0, 82.41],
    thirds: [1.25, 1.25, 1.2, 1.2],
    bassType: 'triangle',
    arpType: 'sine',
    arpGain: 0.06,
    hatMod: 4,
  },
  // Em → C → D → B: urgent tempo, busy tick
  lightning: {
    bpm: 134,
    roots: [82.41, 130.81, 146.83, 123.47],
    thirds: [1.2, 1.25, 1.25, 1.25],
    bassType: 'square',
    arpType: 'triangle',
    arpGain: 0.05,
    hatMod: 2,
  },
};

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
    hazardBurn: () => {
      // Fire: whoosh + crackle + a falling snarl as the cut goes up in flames.
      noise(0.3, 0.2, 0, 2400);
      tone({ type: 'sawtooth', from: 620, to: 85, dur: 0.35, gain: 0.16 });
      noise(0.14, 0.1, 0.07, 5200);
    },
    hazardSlow: () => {
      // Ice: a crystalline double ping sliding down.
      tone({ type: 'sine', from: 1250, to: 880, dur: 0.22, gain: 0.11 });
      tone({ type: 'triangle', from: 1870, to: 1560, dur: 0.14, at: 0.06, gain: 0.08 });
    },
    hazardStun: () => {
      // Lightning: zap crack + thunder body.
      tone({ type: 'sawtooth', from: 2600, to: 240, dur: 0.12, gain: 0.14 });
      noise(0.42, 0.24, 0.02, 1100);
      tone({ type: 'square', from: 170, to: 48, dur: 0.32, at: 0.03, gain: 0.18 });
    },
    confirm: () => tone({ type: 'square', from: 520, to: 780, dur: 0.07, gain: 0.12 }),
    pause: () => tone({ type: 'triangle', from: 440, to: 330, dur: 0.08, gain: 0.1 }),
  };

  // --- background music: a proper chiptune loop -----------------------------
  // 4-bar sequence on a 16th-note grid; key/tempo/timbre come from the active
  // MusicTheme (see MUSIC_THEMES) so each elemental block sounds distinct.
  // Scheduled with the standard WebAudio lookahead pattern so timing stays
  // sample-accurate; theme switches take effect from the next queued step.
  const STEPS_PER_BAR = 16;
  const BARS = 4;
  let musicTheme: 'none' | ThemeKind = 'none';

  // 16-step arp contour (indices into [root, third, fifth, octave] two octaves up).
  const ARP_PATTERN = [0, 2, 1, 3, 0, 2, 1, 2, 0, 2, 1, 3, 2, 1, 2, 0] as const;
  // Bass rhythm: driving 8ths with a fifth walk-up at the bar's tail.
  const BASS_STEPS = new Set([0, 2, 4, 6, 8, 10, 12, 14]);

  function scheduleStep(globalStep: number, t: number): void {
    const ac = ctx;
    if (!ac || !master || muted) return;
    const theme = MUSIC_THEMES[musicTheme];
    const STEP_DUR = 60 / theme.bpm / 4;
    const bar = Math.floor(globalStep / STEPS_PER_BAR) % BARS;
    const step = globalStep % STEPS_PER_BAR;
    const root = theme.roots[bar]!;
    const third = theme.thirds[bar]!;

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
      note(f, STEP_DUR * 1.7, theme.bassType, 0.075);
    }

    // Arp lead: chord tones two octaves up, quiet and glassy.
    const tones = [4, 4 * third, 6, 8] as const; // ×root — root/3rd/5th/octave
    const idx = ARP_PATTERN[step]!;
    note(root * tones[idx]!, STEP_DUR * 1.1, theme.arpType, theme.arpGain);

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
    if (step % theme.hatMod === 0) {
      // Closed hat: tiny highpassed tick, accented off-beat (sparser on ice).
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
      // The step duration is read per step so a theme switch retimes the loop.
      while (nextTime < ac.currentTime + 0.12) {
        scheduleStep(step, nextTime);
        step = (step + 1) % (STEPS_PER_BAR * BARS);
        nextTime += 60 / MUSIC_THEMES[musicTheme].bpm / 4;
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
    setTheme(theme: ThemeKind | undefined): void {
      musicTheme = theme ?? 'none';
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
