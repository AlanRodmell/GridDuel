// Adaptive Multi-Track Fantasy Soundtrack Engine + Custom MP3 Track Player
// Plays rich acoustic & orchestral fantasy game music (Tavern Lute/Flute, Duel Strings/Horns, Boss Symphonic)
// with zero external API keys required, plus supports loading custom local MP3/OGG files.

export type MusicThemeId = 'wardrums' | 'tavern' | 'duel' | 'boss';

export interface MusicTrackMeta {
  id: MusicThemeId;
  title: string;
  subtitle: string;
  bpm: number;
}

const BUILTIN_STUDIO_LOOPS: Partial<Record<MusicThemeId, string>> = {
  tavern: new URL('../assets/sfx/tavern_menu_loop.m4a', import.meta.url).href,
  wardrums: new URL('../assets/sfx/war_drums_loop.m4a', import.meta.url).href,
};

export const MUSIC_TRACKS: MusicTrackMeta[] = [
  {
    id: 'tavern',
    title: 'Hearthfire Tavern (Menus & Forge)',
    subtitle: 'Seamless Celtic Flute, Fiddle, Lute & Strings Score',
    bpm: 120,
  },
  {
    id: 'wardrums',
    title: 'Sanctuary War Drums (Battle)',
    subtitle: 'Trimmed & Attenuated 24-Bar Seamless Percussion Loop',
    bpm: 140,
  },
  {
    id: 'duel',
    title: 'Crossed Blades of the Keep',
    subtitle: 'Synth Harpsichord Ostinato & Strings (Alt)',
    bpm: 92,
  },
  {
    id: 'boss',
    title: 'Sovereign’s Sanctum',
    subtitle: 'Synth Grandmaster Brass & Celesta (Alt)',
    bpm: 98,
  },
];

// MIDI note number to frequency (A4 = 69 = 440Hz)
function mtof(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

interface StepNote {
  lead?: number;      // MIDI note for Flute / Brass / Celesta lead
  leadDur?: number;   // In 16th-note steps
  lute?: number[];    // MIDI notes for Plucked Lute / Harpsichord arpeggio or chord
  bass?: number;      // MIDI note for Pizzicato Bass / Cello pedal
  bassDur?: number;   // In 16th-note steps
  drum?: 'kick' | 'rim' | 'shaker' | 'timpani';
}

/**
 * 1. "Hearthfire Tavern" (Tavern / Lobby / Compendium Theme)
 * 64-step (4-bar) D Dorian Renaissance card-hall groove at a relaxed 82 BPM.
 * Spacious lute chords and lyrical flute phrases with breathing room.
 */
const TAVERN_PATTERN: StepNote[] = [
  // Bar 1: Dm7 (D - F - A - C)
  { bass: 50, bassDur: 6, lute: [62, 69], lead: 74, leadDur: 4, drum: 'kick' },
  {},
  { lute: [65] },
  {},
  { lute: [69], lead: 76, leadDur: 4, drum: 'rim' },
  {},
  { lute: [72] },
  {},
  { bass: 50, bassDur: 6, lute: [62, 65], lead: 74, leadDur: 4, drum: 'kick' },
  {},
  { lute: [69] },
  {},
  { bass: 48, bassDur: 4, lute: [60, 67], lead: 69, leadDur: 4, drum: 'rim' },
  {},
  { lute: [64] },
  {},

  // Bar 2: G Major (G - B - D) -> C Major (C - E - G)
  { bass: 55, bassDur: 6, lute: [67, 71], lead: 71, leadDur: 4, drum: 'kick' },
  {},
  { lute: [62] },
  {},
  { lute: [67], lead: 74, leadDur: 4, drum: 'rim' },
  {},
  { lute: [71] },
  {},
  { bass: 48, bassDur: 6, lute: [60, 64], lead: 76, leadDur: 4, drum: 'kick' },
  {},
  { lute: [67] },
  {},
  { lute: [64, 67], lead: 72, leadDur: 4, drum: 'rim' },
  {},
  { lute: [60] },
  {},

  // Bar 3: Dm7 -> Bb Maj7 (Bb - D - F - A)
  { bass: 50, bassDur: 6, lute: [62, 65], lead: 74, leadDur: 4, drum: 'kick' },
  {},
  { lute: [69] },
  {},
  { lute: [65, 72], lead: 77, leadDur: 4, drum: 'rim' },
  {},
  { lute: [69] },
  {},
  { bass: 46, bassDur: 6, lute: [58, 65], lead: 76, leadDur: 4, drum: 'kick' },
  {},
  { lute: [62] },
  {},
  { lute: [62, 69], lead: 74, leadDur: 4, drum: 'rim' },
  {},
  { lute: [65] },
  {},

  // Bar 4: C Major -> A minor turnaround
  { bass: 48, bassDur: 6, lute: [60, 67], lead: 72, leadDur: 4, drum: 'kick' },
  {},
  { lute: [64] },
  {},
  { lute: [67, 72], lead: 76, leadDur: 4, drum: 'rim' },
  {},
  { lute: [64] },
  {},
  { bass: 45, bassDur: 6, lute: [57, 64], lead: 69, leadDur: 4, drum: 'kick' },
  {},
  { lute: [60] },
  {},
  { bass: 50, bassDur: 4, lute: [62, 69], lead: 74, leadDur: 4, drum: 'rim' },
  {},
  { lute: [65] },
  {},
];

/**
 * 2. "Crossed Blades of the Keep" (Arena Duel Theme)
 * 64-step (4-bar) A Minor tactical card duel theme at a measured 92 BPM.
 * Poised 8th-note harpsichord accompaniment and warm horn melody without rushed 16th runs.
 */
const DUEL_PATTERN: StepNote[] = [
  // Bar 1: Am (A - C - E)
  { bass: 45, bassDur: 4, lute: [57, 64], lead: 69, leadDur: 4, drum: 'kick' },
  {},
  { lute: [60], drum: 'shaker' },
  {},
  { bass: 52, bassDur: 4, lute: [57, 69], lead: 72, leadDur: 4, drum: 'rim' },
  {},
  { lute: [64], drum: 'shaker' },
  {},
  { bass: 45, bassDur: 4, lute: [57, 64], lead: 76, leadDur: 4, drum: 'kick' },
  {},
  { lute: [60], drum: 'shaker' },
  {},
  { bass: 48, bassDur: 4, lute: [60, 67], lead: 71, leadDur: 4, drum: 'rim' },
  {},
  { lute: [64] },
  {},

  // Bar 2: F Maj7 -> G6
  { bass: 41, bassDur: 4, lute: [53, 60], lead: 69, leadDur: 4, drum: 'kick' },
  {},
  { lute: [65], drum: 'shaker' },
  {},
  { bass: 48, bassDur: 4, lute: [60, 65], lead: 77, leadDur: 4, drum: 'rim' },
  {},
  { lute: [69], drum: 'shaker' },
  {},
  { bass: 43, bassDur: 4, lute: [55, 62], lead: 74, leadDur: 4, drum: 'kick' },
  {},
  { lute: [67], drum: 'shaker' },
  {},
  { bass: 50, bassDur: 4, lute: [59, 67], lead: 79, leadDur: 4, drum: 'rim' },
  {},
  { lute: [62] },
  {},

  // Bar 3: Dm7 -> Em7
  { bass: 50, bassDur: 4, lute: [62, 65], lead: 77, leadDur: 4, drum: 'kick' },
  {},
  { lute: [69], drum: 'shaker' },
  {},
  { bass: 45, bassDur: 4, lute: [62, 69], lead: 74, leadDur: 4, drum: 'rim' },
  {},
  { lute: [65], drum: 'shaker' },
  {},
  { bass: 40, bassDur: 4, lute: [52, 59], lead: 71, leadDur: 4, drum: 'kick' },
  {},
  { lute: [64], drum: 'shaker' },
  {},
  { bass: 47, bassDur: 4, lute: [56, 64], lead: 76, leadDur: 4, drum: 'rim' },
  {},
  { lute: [59] },
  {},

  // Bar 4: F -> E7 Phrygian cadence -> Am
  { bass: 41, bassDur: 4, lute: [53, 60], lead: 77, leadDur: 4, drum: 'kick' },
  {},
  { lute: [65], drum: 'shaker' },
  {},
  { bass: 40, bassDur: 4, lute: [52, 59], lead: 74, leadDur: 4, drum: 'rim' },
  {},
  { lute: [68], drum: 'shaker' },
  {},
  { bass: 45, bassDur: 8, lute: [57, 64], lead: 69, leadDur: 8, drum: 'kick' },
  {},
  { lute: [60] },
  {},
  { lute: [57, 64, 69], drum: 'rim' },
  {},
  { lute: [60] },
  {},
];

/**
 * 3. "Sovereign's Sanctum" (Boss & Tier 9-10 Grandmaster Theme)
 * 64-step (4-bar) C Harmonic Minor symphonic boss theme at a stately 98 BPM.
 * Majestic orchestral chords and deliberate brass phrases instead of rapid arpeggios.
 */
const BOSS_PATTERN: StepNote[] = [
  // Bar 1: Cm (C - Eb - G)
  { bass: 36, bassDur: 6, lute: [48, 60, 67], lead: 72, leadDur: 4, drum: 'timpani' },
  {},
  { lute: [63] },
  {},
  { bass: 48, bassDur: 4, lute: [60, 63], lead: 75, leadDur: 4, drum: 'rim' },
  {},
  { lute: [67], drum: 'shaker' },
  {},
  { bass: 36, bassDur: 6, lute: [48, 60], lead: 79, leadDur: 4, drum: 'timpani' },
  {},
  { lute: [63] },
  {},
  { bass: 43, bassDur: 4, lute: [55, 62], lead: 74, leadDur: 4, drum: 'timpani' },
  {},
  { lute: [67] },
  {},

  // Bar 2: Ab Maj7 (Ab - C - Eb - G) -> G7 (G - B - D - F)
  { bass: 44, bassDur: 6, lute: [56, 63, 68], lead: 75, leadDur: 4, drum: 'timpani' },
  {},
  { lute: [60] },
  {},
  { bass: 44, bassDur: 4, lute: [60, 68], lead: 80, leadDur: 4, drum: 'rim' },
  {},
  { lute: [63], drum: 'shaker' },
  {},
  { bass: 43, bassDur: 6, lute: [55, 59, 67], lead: 77, leadDur: 4, drum: 'timpani' },
  {},
  { lute: [62] },
  {},
  { bass: 31, bassDur: 4, lute: [55, 59, 65], lead: 71, leadDur: 4, drum: 'timpani' },
  {},
  { lute: [62] },
  {},

  // Bar 3: Fm7 (F - Ab - C - Eb) -> Bb7 (Bb - D - F - Ab)
  { bass: 41, bassDur: 6, lute: [53, 60, 65], lead: 77, leadDur: 4, drum: 'timpani' },
  {},
  { lute: [56] },
  {},
  { bass: 41, bassDur: 4, lute: [56, 65], lead: 72, leadDur: 4, drum: 'rim' },
  {},
  { lute: [60], drum: 'shaker' },
  {},
  { bass: 46, bassDur: 6, lute: [58, 62, 65], lead: 74, leadDur: 4, drum: 'timpani' },
  {},
  { lute: [65] },
  {},
  { bass: 46, bassDur: 4, lute: [58, 65, 70], lead: 79, leadDur: 4, drum: 'rim' },
  {},
  { lute: [62] },
  {},

  // Bar 4: Ab -> G7b9 -> Cm climax
  { bass: 44, bassDur: 6, lute: [56, 63, 68], lead: 80, leadDur: 4, drum: 'timpani' },
  {},
  { lute: [60] },
  {},
  { bass: 43, bassDur: 4, lute: [55, 59, 68], lead: 74, leadDur: 4, drum: 'timpani' },
  {},
  { lute: [65] },
  {},
  { bass: 36, bassDur: 8, lute: [48, 55, 60, 63], lead: 72, leadDur: 8, drum: 'timpani' },
  {},
  { lute: [60] },
  {},
  { lute: [67], drum: 'timpani' },
  {},
  { lute: [63] },
  {},
];

const PATTERNS: Record<Exclude<MusicThemeId, 'wardrums'>, StepNote[]> = {
  tavern: TAVERN_PATTERN,
  duel: DUEL_PATTERN,
  boss: BOSS_PATTERN,
};

class MusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private pinkNoise: AudioBuffer | null = null;

  private isPlaying = false;
  private currentTheme: MusicThemeId = 'tavern';
  private volume = 0.36;
  private stepIndex = 0;
  private nextNoteTime = 0;
  private timerId: number | null = null;

  // Built-in seamless Web Audio buffer loops ('tavern' menu score & 'wardrums' battle score)
  private studioRawBytes: Partial<Record<MusicThemeId, ArrayBuffer>> = {};
  private studioBuffers: Partial<Record<MusicThemeId, AudioBuffer>> = {};
  private studioDecoding: Partial<Record<MusicThemeId, boolean>> = {};
  private activeStudioTheme: MusicThemeId | null = null;
  private activeStudioSource: AudioBufferSourceNode | null = null;
  private activeStudioGain: GainNode | null = null;
  private unlockBound = false;

  // Optional user-loaded custom MP3/OGG URLs per theme
  private customAudioUrls: Partial<Record<MusicThemeId, string>> = {};
  private customAudioEl: HTMLAudioElement | null = null;
  private activeCustomUrl: string | null = null;

  constructor() {
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      (Object.keys(BUILTIN_STUDIO_LOOPS) as MusicThemeId[]).forEach((themeKey) => {
        const url = BUILTIN_STUDIO_LOOPS[themeKey];
        if (!url) return;
        fetch(url)
          .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject()))
          .then((bytes) => {
            this.studioRawBytes[themeKey] = bytes;
            if (this.ctx) {
              this.decodeStudioBuffer(this.ctx, themeKey);
            }
          })
          .catch(() => {});
      });
    }
  }

  private decodeStudioBuffer(ctx: AudioContext, themeKey: MusicThemeId) {
    if (
      this.studioBuffers[themeKey] ||
      this.studioDecoding[themeKey] ||
      !this.studioRawBytes[themeKey]
    ) {
      return;
    }
    this.studioDecoding[themeKey] = true;
    ctx
      .decodeAudioData(this.studioRawBytes[themeKey]!.slice(0))
      .then((decoded) => {
        this.studioBuffers[themeKey] = decoded;
        if (
          this.isPlaying &&
          this.currentTheme === themeKey &&
          !this.customAudioUrls[themeKey]
        ) {
          this.ensureStudioLoopPlaying(themeKey);
        }
      })
      .catch(() => {})
      .finally(() => {
        this.studioDecoding[themeKey] = false;
      });
  }

  private decodeAllStudioBuffers(ctx: AudioContext) {
    (Object.keys(BUILTIN_STUDIO_LOOPS) as MusicThemeId[]).forEach((k) => {
      this.decodeStudioBuffer(ctx, k);
    });
  }

  private bindGestureUnlock() {
    if (this.unlockBound || typeof window === 'undefined') return;
    this.unlockBound = true;
    const resumeAudio = () => {
      if (!this.isPlaying) return;
      const ctx = this.initContext();
      if (ctx && ctx.state === 'suspended') {
        ctx
          .resume()
          .then(() => {
            if (this.isPlaying) this.schedulerTick();
          })
          .catch(() => {});
      } else if (this.isPlaying) {
        this.schedulerTick();
      }
    };
    window.addEventListener('pointerdown', resumeAudio, { passive: true });
    window.addEventListener('keydown', resumeAudio, { passive: true });
  }

  private ensureStudioLoopPlaying(themeKey: MusicThemeId) {
    const ctx = this.initContext();
    if (!ctx || !this.masterGain) return;
    this.decodeStudioBuffer(ctx, themeKey);
    const buffer = this.studioBuffers[themeKey];
    if (!buffer) return;
    if (this.activeStudioSource && this.activeStudioTheme === themeKey) return;

    if (this.activeStudioSource) {
      this.stopStudioLoop();
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const loopGain = ctx.createGain();
    loopGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    loopGain.gain.linearRampToValueAtTime(0.85, ctx.currentTime + 0.55);

    src.connect(loopGain);
    loopGain.connect(this.masterGain);
    src.start(0);

    this.activeStudioTheme = themeKey;
    this.activeStudioSource = src;
    this.activeStudioGain = loopGain;
  }

  private stopStudioLoop() {
    const src = this.activeStudioSource;
    const gainNode = this.activeStudioGain;
    this.activeStudioTheme = null;
    this.activeStudioSource = null;
    this.activeStudioGain = null;

    if (src && gainNode && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(Math.max(0.0001, gainNode.gain.value), now);
        gainNode.gain.linearRampToValueAtTime(0.0001, now + 0.35);
        src.stop(now + 0.38);
        window.setTimeout(() => {
          try {
            src.disconnect();
            gainNode.disconnect();
          } catch {
            // Ignore
          }
        }, 420);
        return;
      } catch {
        // Fallback below
      }
    }

    if (src) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // Ignore
      }
    }
    if (gainNode) {
      try {
        gainNode.disconnect();
      } catch {
        // Ignore
      }
    }
  }

  private initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      const ctx = new AudioCtx();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.setValueAtTime(this.volume, ctx.currentTime);
      master.connect(ctx.destination);
      this.masterGain = master;

      this.buildNoise(ctx);
      this.buildReverb(ctx, master);
      this.decodeAllStudioBuffers(ctx);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private buildNoise(ctx: AudioContext) {
    const sr = ctx.sampleRate;
    const len = sr;
    const buf = ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99 * b0 + w * 0.08;
      b1 = 0.96 * b1 + w * 0.15;
      b2 = 0.85 * b2 + w * 0.3;
      data[i] = (b0 + b1 + b2) * 0.2;
    }
    this.pinkNoise = buf;
  }

  private buildReverb(ctx: AudioContext, dest: AudioNode) {
    try {
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 1.8);
      const impulse = ctx.createBuffer(2, len, sr);
      const L = impulse.getChannelData(0);
      const R = impulse.getChannelData(1);
      let lpL = 0;
      let lpR = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = Math.pow(1 - t, 2.5);
        lpL += 0.28 * ((Math.random() * 2 - 1) * env - lpL);
        lpR += 0.28 * ((Math.random() * 2 - 1) * env - lpR);
        L[i] = lpL;
        R[i] = lpR;
      }
      const conv = ctx.createConvolver();
      conv.buffer = impulse;
      const revGain = ctx.createGain();
      revGain.gain.setValueAtTime(0.38, ctx.currentTime);
      conv.connect(revGain);
      revGain.connect(dest);
      this.reverbNode = conv;
    } catch {
      // Ignore if Convolver fails
    }
  }

  private connectVoice(node: AudioNode, wet = 0.35, pan = 0) {
    if (!this.ctx || !this.masterGain) return;
    let out: AudioNode = node;
    if (typeof this.ctx.createStereoPanner === 'function' && pan !== 0) {
      const p = this.ctx.createStereoPanner();
      p.pan.setValueAtTime(pan, this.ctx.currentTime);
      node.connect(p);
      out = p;
    }
    out.connect(this.masterGain);
    if (this.reverbNode && wet > 0) {
      const send = this.ctx.createGain();
      send.gain.setValueAtTime(wet, this.ctx.currentTime);
      out.connect(send);
      send.connect(this.reverbNode);
    }
  }

  // 1. Acoustic Lute / Baroque Harpsichord Pluck
  private scheduleLuteNote(midi: number, time: number, theme: MusicThemeId, idx = 0) {
    if (!this.ctx) return;
    const freq = mtof(midi);
    const dur = theme === 'tavern' ? 0.42 : 0.28;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();

    osc1.type = theme === 'tavern' ? 'triangle' : 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, time);
    osc2.frequency.setValueAtTime(freq, time);
    osc1.detune.setValueAtTime(-4, time);
    osc2.detune.setValueAtTime(4, time);

    filter.type = 'lowpass';
    filter.Q.setValueAtTime(1.8, time);
    const peakFilter = theme === 'tavern' ? freq * 4.5 : freq * 6.5;
    filter.frequency.setValueAtTime(Math.min(4500, peakFilter), time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(240, freq * 1.15), time + dur);

    const mix2 = this.ctx.createGain();
    mix2.gain.setValueAtTime(theme === 'tavern' ? 0.25 : 0.45, time);

    const strumDelay = idx * 0.014;
    const startTime = time + strumDelay;
    const gain = theme === 'tavern' ? 0.085 : 0.068;

    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(gain, startTime + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

    osc1.connect(filter);
    osc2.connect(mix2);
    mix2.connect(filter);
    filter.connect(env);

    this.connectVoice(env, 0.38, (idx % 2 === 0 ? -1 : 1) * 0.22);

    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + dur + 0.02);
    osc2.stop(startTime + dur + 0.02);
  }

  // 2. Expressive Wooden Flute (Tavern), Heroic Horn/Violin (Duel), or Symphonic Brass/Choir (Boss)
  private scheduleLeadNote(midi: number, time: number, durSeconds: number, theme: MusicThemeId) {
    if (!this.ctx) return;
    const freq = mtof(midi);

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const vibrato = this.ctx.createOscillator();
    const vibGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();

    // Gentle acoustic vibrato
    vibrato.frequency.setValueAtTime(5.2, time);
    vibGain.gain.setValueAtTime(theme === 'tavern' ? 2.8 : 3.5, time);
    vibrato.connect(vibGain);
    vibGain.connect(osc1.frequency);
    vibGain.connect(osc2.frequency);

    if (theme === 'tavern') {
      // Breathy wooden recorder / concert flute
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq, time);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(2400, freq * 2.6), time);
    } else if (theme === 'duel') {
      // Expressive violin / French horn lead
      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq, time);
      osc1.detune.setValueAtTime(-6, time);
      osc2.detune.setValueAtTime(6, time);
      filter.type = 'lowpass';
      filter.Q.setValueAtTime(1.4, time);
      filter.frequency.setValueAtTime(320, time);
      filter.frequency.exponentialRampToValueAtTime(
        Math.min(3200, freq * 4.2),
        time + Math.min(0.12, durSeconds * 0.35)
      );
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(400, freq * 1.8),
        time + durSeconds
      );
    } else {
      // Boss Symphonic Brass & Octave Choir
      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq * 0.5, time); // Sub-octave brass body
      osc1.detune.setValueAtTime(-7, time);
      osc2.detune.setValueAtTime(7, time);
      filter.type = 'lowpass';
      filter.Q.setValueAtTime(1.6, time);
      filter.frequency.setValueAtTime(350, time);
      filter.frequency.exponentialRampToValueAtTime(
        Math.min(3600, freq * 4.8),
        time + Math.min(0.1, durSeconds * 0.3)
      );
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(420, freq * 1.6),
        time + durSeconds
      );
    }

    const mix2 = this.ctx.createGain();
    mix2.gain.setValueAtTime(theme === 'tavern' ? 0.35 : 0.45, time);

    const attack = theme === 'tavern' ? 0.035 : 0.025;
    const peakGain = theme === 'tavern' ? 0.095 : theme === 'duel' ? 0.085 : 0.09;

    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(peakGain, time + attack);
    env.gain.setValueAtTime(peakGain * 0.85, time + Math.max(attack, durSeconds * 0.7));
    env.gain.exponentialRampToValueAtTime(0.0001, time + durSeconds + 0.04);

    osc1.connect(filter);
    osc2.connect(mix2);
    mix2.connect(filter);
    filter.connect(env);

    this.connectVoice(env, 0.48, 0.12);

    osc1.start(time);
    osc2.start(time);
    vibrato.start(time);
    osc1.stop(time + durSeconds + 0.06);
    osc2.stop(time + durSeconds + 0.06);
    vibrato.stop(time + durSeconds + 0.06);
  }

  // 3. Pizzicato Upright Bass / Bowed Cello Pedal
  private scheduleBassNote(midi: number, time: number, durSeconds: number, theme: MusicThemeId) {
    if (!this.ctx) return;
    const freq = mtof(midi);

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();

    osc1.type = theme === 'tavern' ? 'triangle' : 'sawtooth';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(freq, time);
    osc2.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(theme === 'tavern' ? 520 : 680, time);
    filter.frequency.exponentialRampToValueAtTime(140, time + durSeconds);

    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(0.13, time + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, time + durSeconds);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(env);

    this.connectVoice(env, 0.18, -0.1);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + durSeconds + 0.03);
    osc2.stop(time + durSeconds + 0.03);
  }

  // 4. Acoustic Tavern Frame Drum, Rim Tap, Shaker, & Concert Timpani
  private schedulePercussion(
    type: NonNullable<StepNote['drum']>,
    time: number
  ) {
    if (!this.ctx) return;

    if (type === 'kick' || type === 'timpani') {
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'sine';
      const startF = type === 'timpani' ? 115 : 102;
      const endF = type === 'timpani' ? 48 : 42;
      const dur = type === 'timpani' ? 0.28 : 0.14;

      osc.frequency.setValueAtTime(startF, time);
      osc.frequency.exponentialRampToValueAtTime(endF, time + dur);

      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(type === 'timpani' ? 0.16 : 0.11, time + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, time + dur);

      osc.connect(env);
      this.connectVoice(env, type === 'timpani' ? 0.35 : 0.12, 0);

      osc.start(time);
      osc.stop(time + dur + 0.02);
    } else if (type === 'rim') {
      // Wooden bodhran / frame-drum rim tap
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(340, time);
      osc.frequency.exponentialRampToValueAtTime(160, time + 0.045);

      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(0.055, time + 0.002);
      env.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);

      osc.connect(env);
      this.connectVoice(env, 0.2, 0.18);
      osc.start(time);
      osc.stop(time + 0.05);
    } else if (type === 'shaker' && this.pinkNoise) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.pinkNoise;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(3800, time);
      filter.Q.setValueAtTime(2.5, time);

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(0.032, time + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);

      src.connect(filter);
      filter.connect(env);
      this.connectVoice(env, 0.15, -0.2);

      src.start(time, Math.random() * 0.5, 0.045);
      src.stop(time + 0.045);
    }
  }

  private getStepDurationSeconds(): number {
    const track = MUSIC_TRACKS.find((t) => t.id === this.currentTheme) ?? MUSIC_TRACKS[0];
    // 16th note duration = (60 / bpm) / 4
    return 60 / track.bpm / 4;
  }

  private schedulerTick = () => {
    if (!this.isPlaying) return;

    // If a custom MP3 file is loaded for the current theme, use HTMLAudioElement instead
    const customUrl = this.customAudioUrls[this.currentTheme];
    if (customUrl) {
      this.stopStudioLoop();
      this.ensureCustomAudioPlaying(customUrl);
      return;
    } else if (this.customAudioEl && !this.customAudioEl.paused) {
      this.customAudioEl.pause();
      this.activeCustomUrl = null;
    }

    // Built-in gapless Web Audio studio loops ('tavern' menu score & 'wardrums' battle score)
    if (BUILTIN_STUDIO_LOOPS[this.currentTheme]) {
      this.ensureStudioLoopPlaying(this.currentTheme);
      return;
    } else {
      this.stopStudioLoop();
    }

    const ctx = this.initContext();
    if (!ctx) return;

    const lookaheadSeconds = 0.14;
    const stepDur = this.getStepDurationSeconds();
    const pattern = PATTERNS[this.currentTheme as Exclude<MusicThemeId, 'wardrums'>] ?? TAVERN_PATTERN;

    if (this.nextNoteTime < ctx.currentTime) {
      this.nextNoteTime = ctx.currentTime + 0.03;
    }

    while (this.nextNoteTime < ctx.currentTime + lookaheadSeconds) {
      const step = pattern[this.stepIndex % pattern.length];
      if (step) {
        if (step.bass !== undefined) {
          this.scheduleBassNote(
            step.bass,
            this.nextNoteTime,
            (step.bassDur ?? 2) * stepDur,
            this.currentTheme
          );
        }
        if (step.lute && step.lute.length > 0) {
          step.lute.forEach((n, idx) =>
            this.scheduleLuteNote(n, this.nextNoteTime, this.currentTheme, idx)
          );
        }
        if (step.lead !== undefined) {
          this.scheduleLeadNote(
            step.lead,
            this.nextNoteTime,
            (step.leadDur ?? 2) * stepDur,
            this.currentTheme
          );
        }
        if (step.drum) {
          this.schedulePercussion(step.drum, this.nextNoteTime);
        }
      }

      this.nextNoteTime += stepDur;
      this.stepIndex = (this.stepIndex + 1) % pattern.length;
    }
  };

  private ensureCustomAudioPlaying(url: string) {
    if (!this.customAudioEl) {
      this.customAudioEl = new Audio();
      this.customAudioEl.loop = true;
    }
    this.customAudioEl.volume = Math.max(0, Math.min(1, this.volume));
    if (this.activeCustomUrl !== url) {
      this.activeCustomUrl = url;
      this.customAudioEl.src = url;
    }
    if (this.customAudioEl.paused && this.isPlaying) {
      this.customAudioEl.play().catch(() => {});
    }
  }

  public start() {
    this.bindGestureUnlock();
    if (this.isPlaying) return;
    this.isPlaying = true;
    const ctx = this.initContext();
    if (ctx) {
      this.nextNoteTime = ctx.currentTime + 0.04;
    }
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
    }
    this.timerId = window.setInterval(this.schedulerTick, 45);
    this.schedulerTick();
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    this.stopStudioLoop();
    if (this.customAudioEl && !this.customAudioEl.paused) {
      this.customAudioEl.pause();
    }
  }

  public setEnabled(enabled: boolean) {
    if (enabled) {
      this.start();
    } else {
      this.stop();
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.04);
    }
    if (this.customAudioEl) {
      this.customAudioEl.volume = this.volume;
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setTheme(theme: MusicThemeId) {
    if (this.currentTheme === theme) return;
    this.stopStudioLoop();
    this.currentTheme = theme;
    this.stepIndex = 0;
    if (this.ctx) {
      this.nextNoteTime = this.ctx.currentTime + 0.05;
    }
    if (this.isPlaying) {
      this.schedulerTick();
    }
  }

  public getTheme(): MusicThemeId {
    return this.currentTheme;
  }

  public setCustomTrack(theme: MusicThemeId, objectUrl: string | null) {
    if (objectUrl) {
      this.customAudioUrls[theme] = objectUrl;
    } else {
      delete this.customAudioUrls[theme];
    }
    if (this.currentTheme === theme) {
      this.activeCustomUrl = null;
      if (this.customAudioEl) {
        this.customAudioEl.pause();
      }
      if (this.isPlaying) {
        this.schedulerTick();
      }
    }
  }

  public hasCustomTrack(theme: MusicThemeId): boolean {
    return Boolean(this.customAudioUrls[theme]);
  }
}

export const music = new MusicEngine();
