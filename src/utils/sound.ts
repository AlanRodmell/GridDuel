// Modern Web Audio API Foley & Orchestral Sound Engine
// Uses physical noise sculpting, resonant body filters, FM metallic partials,
// stereo spatial panning, dynamics compression, and algorithmic sanctuary convolution reverb.

import { Rarity } from '../types/game';

type SampleKey = 'stoneSlam' | 'bladeSlash' | 'bladeRing';

const SAMPLE_URLS: Record<SampleKey, string> = {
  stoneSlam: new URL('../assets/sfx/stone_slam.wav', import.meta.url).href,
  bladeSlash: new URL('../assets/sfx/blade_slash.wav', import.meta.url).href,
  bladeRing: new URL('../assets/sfx/blade_ring.wav', import.meta.url).href,
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbSend: GainNode | null = null;
  private pinkNoiseBuffer: AudioBuffer | null = null;
  private whiteNoiseBuffer: AudioBuffer | null = null;
  private rawSampleBytes: Partial<Record<SampleKey, ArrayBuffer>> = {};
  private sampleBuffers: Partial<Record<SampleKey, AudioBuffer>> = {};
  private decodingSamples: Partial<Record<SampleKey, boolean>> = {};
  private lastHoverAt = 0;

  public enabled = true;

  constructor() {
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      this.prefetchSampleBytes();
    }
  }

  private prefetchSampleBytes() {
    (Object.keys(SAMPLE_URLS) as SampleKey[]).forEach((key) => {
      fetch(SAMPLE_URLS[key])
        .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject()))
        .then((buf) => {
          this.rawSampleBytes[key] = buf;
          if (this.ctx) {
            this.decodeSingleSample(this.ctx, key);
          }
        })
        .catch(() => {
          // Graceful procedural fallback if offline/blocked
        });
    });
  }

  private decodeSingleSample(ctx: AudioContext, key: SampleKey) {
    if (this.sampleBuffers[key] || this.decodingSamples[key]) return;
    const raw = this.rawSampleBytes[key];
    if (!raw) return;

    this.decodingSamples[key] = true;
    ctx
      .decodeAudioData(raw.slice(0))
      .then((decoded) => {
        this.sampleBuffers[key] = decoded;
      })
      .catch(() => {})
      .finally(() => {
        this.decodingSamples[key] = false;
      });
  }

  private decodeAllSamples(ctx: AudioContext) {
    (Object.keys(SAMPLE_URLS) as SampleKey[]).forEach((key) => {
      this.decodeSingleSample(ctx, key);
    });
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      const ctx = new AudioCtx();
      this.ctx = ctx;

      // Studio Master Bus: Compressor -> Master Gain -> Destination
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-14, ctx.currentTime);
      comp.knee.setValueAtTime(12, ctx.currentTime);
      comp.ratio.setValueAtTime(4, ctx.currentTime);
      comp.attack.setValueAtTime(0.003, ctx.currentTime);
      comp.release.setValueAtTime(0.16, ctx.currentTime);

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.9, ctx.currentTime);

      comp.connect(master);
      master.connect(ctx.destination);

      this.compressor = comp;
      this.masterGain = master;

      // Pre-compute Pink & White Noise Buffers for physical foley (cardstock, stone, wind, metal)
      this.buildNoiseBuffers(ctx);

      // Build Stereo Sanctuary Hall Convolution Reverb
      this.buildReverbBus(ctx, comp);
    }

    this.decodeAllSamples(this.ctx);

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Plays a pre-decoded studio foley sample buffer through optional filter sculpting,
   * pitch/playback-rate scaling, stereo panning, dynamics compression, and hall reverb.
   */
  private playSample(
    key: SampleKey,
    params: {
      gain?: number;
      playbackRate?: number;
      offset?: number;
      duration?: number;
      delay?: number;
      wet?: number;
      pan?: number;
      lowpassFreq?: number;
    } = {}
  ): boolean {
    const ctx = this.ensureContext();
    if (!ctx) return false;
    const buffer = this.sampleBuffers[key];
    if (!buffer) return false;

    const now = ctx.currentTime + (params.delay ?? 0);
    const rate = Math.max(0.5, Math.min(2.0, params.playbackRate ?? 1));
    const offset = Math.max(0, Math.min(buffer.duration - 0.02, params.offset ?? 0));
    const maxPlayDur = (buffer.duration - offset) / rate;
    const playDur = params.duration ? Math.min(maxPlayDur, params.duration) : maxPlayDur;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.setValueAtTime(rate, now);

    const env = ctx.createGain();
    const peakGain = params.gain ?? 0.85;
    env.gain.setValueAtTime(peakGain, now);
    if (params.duration && params.duration < maxPlayDur) {
      const fadeStart = now + Math.max(0.01, playDur - 0.045);
      env.gain.setValueAtTime(peakGain, fadeStart);
      env.gain.exponentialRampToValueAtTime(0.0001, now + playDur);
    }

    if (params.lowpassFreq) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(params.lowpassFreq, now);
      src.connect(lp);
      lp.connect(env);
    } else {
      src.connect(env);
    }

    this.connectOutput(env, params.wet ?? 0.14, params.pan ?? 0);
    src.start(now, offset, playDur + 0.02);
    src.stop(now + playDur + 0.03);
    return true;
  }

  private buildNoiseBuffers(ctx: AudioContext) {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 2;

    // White Noise Buffer
    const white = ctx.createBuffer(1, length, sampleRate);
    const wData = white.getChannelData(0);
    for (let i = 0; i < length; i++) {
      wData[i] = Math.random() * 2 - 1;
    }
    this.whiteNoiseBuffer = white;

    // Paul Kellet's Pink Noise (1/f warm acoustic spectrum)
    const pink = ctx.createBuffer(1, length, sampleRate);
    const pData = pink.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < length; i++) {
      const wn = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + wn * 0.0555179;
      b1 = 0.99332 * b1 + wn * 0.0750759;
      b2 = 0.96900 * b2 + wn * 0.1538520;
      b3 = 0.86650 * b3 + wn * 0.3104856;
      b4 = 0.55000 * b4 + wn * 0.5329522;
      b5 = -0.7616 * b5 - wn * 0.0168980;
      pData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + wn * 0.5362) * 0.11;
      b6 = wn * 0.115926;
    }
    this.pinkNoiseBuffer = pink;
  }

  private buildReverbBus(ctx: AudioContext, destination: AudioNode) {
    try {
      const duration = 1.35;
      const sampleRate = ctx.sampleRate;
      const length = Math.floor(sampleRate * duration);
      const impulse = ctx.createBuffer(2, length, sampleRate);
      const left = impulse.getChannelData(0);
      const right = impulse.getChannelData(1);

      const preDelaySamples = Math.floor(sampleRate * 0.016);
      let lpL = 0;
      let lpR = 0;

      for (let i = preDelaySamples; i < length; i++) {
        const t = (i - preDelaySamples) / (length - preDelaySamples);
        // Dual-stage exponential room decay + early reflections
        const env = Math.pow(1 - t, 2.8) * 0.75 + Math.exp(-t * 14) * 0.25;
        const rawL = (Math.random() * 2 - 1) * env;
        const rawR = (Math.random() * 2 - 1) * env;
        // Warm low-pass damping so high frequencies decay naturally like a wood/stone hall
        const damp = 0.35;
        lpL = lpL + damp * (rawL - lpL);
        lpR = lpR + damp * (rawR - lpR);
        left[i] = lpL;
        right[i] = lpR;
      }

      const convolver = ctx.createConvolver();
      convolver.buffer = impulse;

      const reverbGain = ctx.createGain();
      reverbGain.gain.setValueAtTime(0.28, ctx.currentTime);

      convolver.connect(reverbGain);
      reverbGain.connect(destination);

      this.reverbNode = convolver;
      this.reverbSend = reverbGain;
    } catch {
      // Fallback if ConvolverNode fails
    }
  }

  private connectOutput(node: AudioNode, wetAmount = 0.2, pan = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.compressor) return;

    let lastNode: AudioNode = node;
    if (typeof ctx.createStereoPanner === 'function' && pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime);
      node.connect(panner);
      lastNode = panner;
    }

    lastNode.connect(this.compressor);

    if (this.reverbNode && wetAmount > 0) {
      const send = ctx.createGain();
      send.gain.setValueAtTime(wetAmount, ctx.currentTime);
      lastNode.connect(send);
      send.connect(this.reverbNode);
    }
  }

  /**
   * Sculpted physical noise generator for cardstock friction, air whooshes, stone grit, and foil tears.
   */
  private playSculptedNoise(params: {
    color?: 'pink' | 'white';
    filterType: BiquadFilterType;
    startFreq: number;
    endFreq: number;
    q?: number;
    attack: number;
    duration: number;
    gain: number;
    delay?: number;
    wet?: number;
    pan?: number;
  }) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const buffer =
      params.color === 'white' ? this.whiteNoiseBuffer : this.pinkNoiseBuffer;
    if (!buffer) return;

    const now = ctx.currentTime + (params.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = params.filterType;
    filter.Q.setValueAtTime(params.q ?? 1.5, now);
    filter.frequency.setValueAtTime(Math.max(30, params.startFreq), now);
    if (params.endFreq !== params.startFreq) {
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(30, params.endFreq),
        now + params.duration
      );
    }

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(params.gain, now + Math.max(0.002, params.attack));
    env.gain.exponentialRampToValueAtTime(0.0001, now + params.duration);

    src.connect(filter);
    filter.connect(env);
    this.connectOutput(env, params.wet ?? 0.15, params.pan ?? 0);

    // Random offset into 2s noise buffer so consecutive card sounds never sound robotic or identical
    const offset = Math.random() * 1.1;
    src.start(now, offset, params.duration + 0.04);
    src.stop(now + params.duration + 0.04);
  }

  /**
   * Physical percussive membrane / wooden table / sub-bass thud generator.
   */
  private playImpactBody(params: {
    startFreq: number;
    endFreq: number;
    duration: number;
    gain: number;
    delay?: number;
    wet?: number;
    pan?: number;
  }) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + (params.delay ?? 0);
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(params.startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(24, params.endFreq),
      now + params.duration
    );

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(params.startFreq * 2.5, now);
    filter.frequency.exponentialRampToValueAtTime(90, now + params.duration);

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(params.gain, now + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, now + params.duration);

    osc.connect(filter);
    filter.connect(env);
    this.connectOutput(env, params.wet ?? 0.12, params.pan ?? 0);

    osc.start(now);
    osc.stop(now + params.duration + 0.03);
  }

  /**
   * Warm polyphonic acoustic / orchestral voice (dual detuned oscillators + dynamic low-pass filter envelope).
   */
  private playWarmVoice(params: {
    freq: number;
    duration: number;
    attack?: number;
    gain: number;
    delay?: number;
    timbre?: 'harp' | 'brass' | 'celesta' | 'cello';
    wet?: number;
    pan?: number;
  }) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + (params.delay ?? 0);
    const attack = params.attack ?? 0.015;
    const timbre = params.timbre ?? 'harp';

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();

    if (timbre === 'brass') {
      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      osc1.detune.setValueAtTime(-6, now);
      osc2.detune.setValueAtTime(6, now);
      filter.type = 'lowpass';
      filter.Q.setValueAtTime(1.4, now);
      filter.frequency.setValueAtTime(260, now);
      filter.frequency.exponentialRampToValueAtTime(
        Math.min(4200, params.freq * 4.5),
        now + Math.min(0.14, params.duration * 0.4)
      );
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(320, params.freq * 1.6),
        now + params.duration
      );
    } else if (timbre === 'cello') {
      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.detune.setValueAtTime(-8, now);
      osc2.detune.setValueAtTime(8, now);
      filter.type = 'lowpass';
      filter.Q.setValueAtTime(1.1, now);
      filter.frequency.setValueAtTime(Math.min(1100, params.freq * 3.2), now);
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(180, params.freq * 1.2),
        now + params.duration
      );
    } else if (timbre === 'celesta') {
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(params.freq * 2, now); // Octave harmonic bell overtone
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3600, now);
      filter.frequency.exponentialRampToValueAtTime(800, now + params.duration);
    } else {
      // Plucked acoustic harp / lute string
      osc1.type = 'triangle';
      osc2.type = 'sawtooth';
      osc1.detune.setValueAtTime(-4, now);
      osc2.detune.setValueAtTime(4, now);
      filter.type = 'lowpass';
      filter.Q.setValueAtTime(2.0, now);
      filter.frequency.setValueAtTime(Math.min(4800, params.freq * 6), now);
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(280, params.freq * 1.15),
        now + params.duration
      );
    }

    osc1.frequency.setValueAtTime(params.freq, now);
    if (timbre !== 'celesta') {
      osc2.frequency.setValueAtTime(params.freq, now);
    }

    const osc2Mix = ctx.createGain();
    osc2Mix.gain.setValueAtTime(timbre === 'celesta' ? 0.22 : 0.45, now);

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(params.gain, now + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, now + params.duration);

    osc1.connect(filter);
    osc2.connect(osc2Mix);
    osc2Mix.connect(filter);
    filter.connect(env);

    this.connectOutput(env, params.wet ?? 0.35, params.pan ?? 0);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + params.duration + 0.04);
    osc2.stop(now + params.duration + 0.04);
  }

  /**
   * Metallic modal resonator for realistic gold coins, steel swords, and armor impacts.
   */
  private playMetallicPartials(params: {
    frequencies: number[];
    duration: number;
    gain: number;
    delay?: number;
    wet?: number;
    pan?: number;
  }) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + (params.delay ?? 0);
    params.frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();

      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      // Higher metallic modes decay faster than fundamental ring
      const modeDuration = params.duration * Math.pow(0.76, idx);
      const modeGain = (params.gain / params.frequencies.length) * Math.pow(0.82, idx);

      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(modeGain, now + 0.002);
      env.gain.exponentialRampToValueAtTime(0.0001, now + modeDuration);

      osc.connect(env);
      this.connectOutput(env, params.wet ?? 0.25, params.pan ?? 0);

      osc.start(now);
      osc.stop(now + modeDuration + 0.02);
    });
  }

  // ============================================================================
  // PUBLIC GAME SOUND EFFECTS
  // ============================================================================

  /**
   * Subtle physical paper whisper when hovering cards or board sockets.
   */
  hover() {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this.lastHoverAt < 55) return;
    this.lastHoverAt = nowMs;

    this.playSculptedNoise({
      color: 'pink',
      filterType: 'bandpass',
      startFreq: 1900,
      endFreq: 2700,
      q: 2.8,
      attack: 0.004,
      duration: 0.032,
      gain: 0.035,
      wet: 0.08,
    });
  }

  /**
   * Tactile cardstock slide + warm mahogany table tap when selecting a card or tab.
   */
  select() {
    const jitter = 0.97 + Math.random() * 0.06;
    // 1. Crisp cardstock brush slide
    this.playSculptedNoise({
      color: 'pink',
      filterType: 'bandpass',
      startFreq: 1500 * jitter,
      endFreq: 3100 * jitter,
      q: 2.2,
      attack: 0.005,
      duration: 0.055,
      gain: 0.09,
      wet: 0.12,
    });
    // 2. Damped wooden table tap body
    this.playImpactBody({
      startFreq: 210 * jitter,
      endFreq: 95 * jitter,
      duration: 0.048,
      gain: 0.11,
      wet: 0.1,
    });
    // 3. Subtle warm crystal click
    this.playWarmVoice({
      freq: 587.33 * jitter,
      duration: 0.065,
      attack: 0.003,
      gain: 0.035,
      timbre: 'harp',
      wet: 0.2,
    });
  }

  /**
   * Heavy carved stone slab slam onto the battlefield socket, powered by studio stone-slam foley
   * scaled in seismic pitch/weight and harmonic resonance by card Rarity + Power Relic chime.
   */
  placeSlab(rarity: Rarity = 'common', isRelic = false, pan = 0) {
    const jitter = 0.97 + Math.random() * 0.06;
    const clampedPan = Math.max(-0.65, Math.min(0.65, pan));

    const sampleRateByRarity: Record<Rarity, number> = {
      common: 1.05,
      rare: 0.99,
      epic: 0.92,
      mythic: 0.85,
    };
    const sampleGainByRarity: Record<Rarity, number> = {
      common: 0.78,
      rare: 0.85,
      epic: 0.92,
      mythic: 1.0,
    };

    const playedSample = this.playSample('stoneSlam', {
      gain: sampleGainByRarity[rarity],
      playbackRate: sampleRateByRarity[rarity] * jitter,
      wet: rarity === 'mythic' ? 0.24 : 0.14,
      pan: clampedPan,
    });

    if (!playedSample) {
      // Procedural stone fallback while sample decodes on cold first millisecond
      const weightGain =
        rarity === 'mythic' ? 0.42 : rarity === 'epic' ? 0.36 : rarity === 'rare' ? 0.32 : 0.28;
      this.playImpactBody({
        startFreq: 108 * jitter,
        endFreq: rarity === 'mythic' ? 24 : 32,
        duration: rarity === 'mythic' ? 0.34 : 0.2,
        gain: weightGain,
        delay: 0.012,
        wet: 0.22,
        pan: clampedPan * 0.5,
      });
      this.playSculptedNoise({
        color: 'pink',
        filterType: 'bandpass',
        startFreq: 780 * jitter,
        endFreq: 195,
        q: 1.25,
        attack: 0.002,
        duration: 0.125,
        gain: 0.26,
        delay: 0.014,
        wet: 0.24,
        pan: clampedPan,
      });
    } else if (rarity === 'epic' || rarity === 'mythic') {
      // Reinforce Epic & Mythic slams with extra chest sub-bass weight beneath the stone foley
      this.playImpactBody({
        startFreq: 96 * jitter,
        endFreq: rarity === 'mythic' ? 24 : 28,
        duration: rarity === 'mythic' ? 0.34 : 0.24,
        gain: rarity === 'mythic' ? 0.26 : 0.18,
        delay: 0.02,
        wet: 0.22,
        pan: clampedPan * 0.4,
      });
    }

    // Rarity-Specific Harmonic Signature layered subtly over the stone impact
    if (rarity === 'rare') {
      this.playMetallicPartials({
        frequencies: [1318.5 * jitter, 1975.5 * jitter, 2960 * jitter],
        duration: 0.24,
        gain: 0.055,
        delay: 0.03,
        wet: 0.36,
        pan: clampedPan,
      });
    } else if (rarity === 'epic') {
      [146.83, 220.0, 329.63].forEach((freq, idx) => {
        this.playWarmVoice({
          freq,
          duration: 0.34,
          attack: 0.012,
          gain: 0.05,
          delay: 0.03 + idx * 0.02,
          timbre: idx === 0 ? 'brass' : 'harp',
          wet: 0.45,
          pan: clampedPan + (idx - 1) * 0.15,
        });
      });
    } else if (rarity === 'mythic') {
      this.playMetallicPartials({
        frequencies: [880, 1318.5, 1760, 2637],
        duration: 0.44,
        gain: 0.085,
        delay: 0.028,
        wet: 0.5,
        pan: clampedPan,
      });
      [146.83, 293.66, 440.0, 587.33, 739.99].forEach((freq, idx) => {
        this.playWarmVoice({
          freq,
          duration: 0.48,
          attack: 0.012,
          gain: 0.058,
          delay: 0.028 + idx * 0.018,
          timbre: idx < 2 ? 'brass' : 'celesta',
          wet: 0.52,
          pan: clampedPan + ((idx % 2) * 2 - 1) * 0.2,
        });
      });
    }

    // Optional Power Relic Totem Anchor Chime
    if (isRelic) {
      this.playSample('bladeRing', {
        offset: 0.2,
        playbackRate: 1.06,
        gain: 0.42,
        delay: 0.04,
        wet: 0.32,
        pan: clampedPan,
      });
      [523.25, 783.99, 1046.5].forEach((freq, idx) => {
        this.playWarmVoice({
          freq,
          duration: 0.36,
          attack: 0.008,
          gain: 0.05,
          delay: 0.035 + idx * 0.028,
          timbre: 'celesta',
          wet: 0.48,
          pan: clampedPan,
        });
      });
    }
  }

  /**
   * Crisp stone socket lock when initializing the battlefield.
   */
  place() {
    const jitter = 0.96 + Math.random() * 0.08;
    const played = this.playSample('stoneSlam', {
      gain: 0.52,
      playbackRate: 1.18 * jitter,
      duration: 0.58,
      wet: 0.14,
    });
    if (!played) {
      this.playImpactBody({
        startFreq: 130 * jitter,
        endFreq: 36,
        duration: 0.135,
        gain: 0.26,
        wet: 0.18,
      });
    }
  }

  /**
   * Dedicated Sword & Shield Clash sound when opposing arrows collide on the board:
   * - Attacker Won: Studio steel clash + victorious singing sword ring (`blade_ring.wav`)
   * - Countered: Studio deflected steel blade slash/parry (`blade_slash.wav`) + dark recoil
   */
  clash(attackerWon = true) {
    const jitter = 0.97 + Math.random() * 0.06;

    if (attackerWon) {
      const played = this.playSample('bladeRing', {
        offset: 0.03,
        playbackRate: 1.0 * jitter,
        gain: 0.88,
        wet: 0.22,
        pan: 0.08,
      });
      if (!played) {
        this.playMetallicPartials({
          frequencies: [1280, 1940, 2890, 4120, 5640],
          duration: 0.28,
          gain: 0.16,
          wet: 0.35,
        });
      }
      // Subtle shield punch + warm brass fifth beneath the singing blade
      this.playImpactBody({
        startFreq: 165,
        endFreq: 42,
        duration: 0.14,
        gain: 0.2,
        delay: 0.05,
        wet: 0.18,
      });
      this.playWarmVoice({
        freq: 293.66,
        duration: 0.26,
        attack: 0.012,
        gain: 0.06,
        delay: 0.08,
        timbre: 'brass',
        wet: 0.35,
        pan: 0.15,
      });
    } else {
      const played = this.playSample('bladeSlash', {
        offset: 0.12,
        playbackRate: 0.92 * jitter,
        gain: 0.84,
        wet: 0.18,
        pan: -0.08,
      });
      if (!played) {
        this.playSculptedNoise({
          color: 'white',
          filterType: 'bandpass',
          startFreq: 3800,
          endFreq: 1200,
          q: 3.8,
          attack: 0.002,
          duration: 0.09,
          gain: 0.16,
          wet: 0.25,
        });
      }
      // Dark parried recoil
      this.playImpactBody({
        startFreq: 150,
        endFreq: 40,
        duration: 0.16,
        gain: 0.22,
        delay: 0.06,
        wet: 0.2,
      });
      this.playWarmVoice({
        freq: 146.83,
        duration: 0.28,
        attack: 0.012,
        gain: 0.08,
        delay: 0.08,
        timbre: 'cello',
        wet: 0.32,
      });
    }
  }

  /**
   * Kinetic blade-cut capture whoosh (`blade_slash.wav`) + rising harmonic note when flipping cards.
   */
  flip(wave = 0) {
    const scaleNotes = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25];
    const note = scaleNotes[Math.min(wave, scaleNotes.length - 1)];
    const pan = ((wave % 3) - 1) * 0.22;
    const rate = Math.min(1.28, 1.05 + wave * 0.04);

    const played = this.playSample('bladeSlash', {
      offset: 0.24,
      duration: 0.62,
      playbackRate: rate,
      gain: 0.64,
      wet: 0.16,
      pan,
    });

    if (!played) {
      this.playSculptedNoise({
        color: 'pink',
        filterType: 'bandpass',
        startFreq: 420,
        endFreq: 2100,
        q: 1.8,
        attack: 0.02,
        duration: 0.13,
        gain: 0.15,
        wet: 0.18,
        pan,
      });
    }

    // Physical card settle + warm harp pitch step
    this.playImpactBody({
      startFreq: 140,
      endFreq: 48,
      duration: 0.08,
      gain: 0.14,
      delay: 0.075,
      wet: 0.14,
      pan,
    });
    this.playWarmVoice({
      freq: note,
      duration: 0.26,
      attack: 0.008,
      gain: 0.075,
      delay: 0.06,
      timbre: 'harp',
      wet: 0.36,
      pan,
    });
  }

  /**
   * Arcane Chain Combo eruption: resonant sword-ring bell (`blade_ring.wav`) + cascading stereo arpeggio.
   */
  combo() {
    this.playSample('bladeRing', {
      offset: 0.12,
      playbackRate: 1.08,
      gain: 0.76,
      wet: 0.28,
    });
    this.playImpactBody({
      startFreq: 135,
      endFreq: 38,
      duration: 0.2,
      gain: 0.22,
      wet: 0.25,
    });
    const arpeggio = [293.66, 369.99, 440.0, 587.33, 659.25, 880.0];
    arpeggio.forEach((freq, idx) => {
      const pan = (idx % 2 === 0 ? -1 : 1) * (0.15 + idx * 0.08);
      this.playWarmVoice({
        freq,
        duration: 0.36,
        attack: 0.006,
        gain: 0.075,
        delay: idx * 0.048,
        timbre: idx >= 3 ? 'celesta' : 'harp',
        wet: 0.45,
        pan,
      });
    });
  }

  /**
   * Resonant chime & shimmer when a Battlefield Augment or Power Relic Aura triggers on units.
   */
  augment(isDebuff = false) {
    this.playSample('bladeRing', {
      offset: 0.19,
      playbackRate: isDebuff ? 0.86 : 1.08,
      gain: 0.62,
      wet: 0.32,
    });
    const freqs = isDebuff ? [261.63, 196.0] : [523.25, 659.25, 783.99];
    freqs.forEach((freq, idx) => {
      this.playWarmVoice({
        freq,
        duration: 0.3,
        attack: 0.01,
        gain: 0.055,
        delay: 0.03 + idx * 0.035,
        timbre: isDebuff ? 'cello' : 'celesta',
        wet: 0.42,
      });
    });
  }

  /**
   * Realistic gold coin pouch & multi-coin metallic clinks.
   */
  coin() {
    // 1. Soft leather pouch thump
    this.playImpactBody({
      startFreq: 150,
      endFreq: 65,
      duration: 0.075,
      gain: 0.14,
      wet: 0.1,
    });
    // 2. Three staggered physical gold coin clinks
    const clinkDelays = [0.005, 0.055, 0.115];
    const baseMods = [1.0, 1.06, 1.12];
    clinkDelays.forEach((delay, i) => {
      const m = baseMods[i];
      this.playMetallicPartials({
        frequencies: [2720 * m, 4180 * m, 5890 * m, 7350 * m],
        duration: 0.19,
        gain: 0.11,
        delay,
        wet: 0.28,
        pan: (i - 1) * 0.25,
      });
      // Crisp coin edge click
      this.playSculptedNoise({
        color: 'white',
        filterType: 'highpass',
        startFreq: 4500,
        endFreq: 3500,
        q: 1.5,
        attack: 0.001,
        duration: 0.015,
        gain: 0.045,
        delay,
        wet: 0.1,
      });
    });
  }

  /**
   * Booster chest / reliquary opening: wax seal crack, foil tear, and arcane shimmer.
   */
  packOpen() {
    // 1. Heavy chest latch thud
    this.playImpactBody({
      startFreq: 145,
      endFreq: 35,
      duration: 0.18,
      gain: 0.28,
      wet: 0.22,
    });
    // 2. Crisp foil / parchment tear sweep
    this.playSculptedNoise({
      color: 'white',
      filterType: 'bandpass',
      startFreq: 1100,
      endFreq: 4600,
      q: 2.2,
      attack: 0.015,
      duration: 0.18,
      gain: 0.14,
      delay: 0.02,
      wet: 0.25,
    });
    // 3. Warm ascending crystal shimmer
    const notes = [329.63, 440.0, 554.37, 659.25];
    notes.forEach((freq, i) => {
      this.playWarmVoice({
        freq,
        duration: 0.35,
        attack: 0.01,
        gain: 0.07,
        delay: 0.04 + i * 0.04,
        timbre: 'celesta',
        wet: 0.45,
        pan: (i - 1.5) * 0.2,
      });
    });
  }

  /**
   * Card flip reveal inside a booster pack or post-match spoil claim.
   */
  packReveal(isRareOrNew: boolean) {
    // Card flip whoosh & snap
    this.flip(isRareOrNew ? 3 : 1);

    if (isRareOrNew) {
      this.playSample('bladeRing', {
        offset: 0.18,
        playbackRate: 1.05,
        gain: 0.48,
        delay: 0.03,
        wet: 0.3,
      });
      // Deep cinematic sub-drop
      this.playImpactBody({
        startFreq: 105,
        endFreq: 32,
        duration: 0.28,
        gain: 0.26,
        delay: 0.03,
        wet: 0.3,
      });
      // Lush golden chord (D Major Add9)
      const chord = [293.66, 440.0, 587.33, 659.25, 739.99, 880.0];
      chord.forEach((freq, idx) => {
        this.playWarmVoice({
          freq,
          duration: 0.55,
          attack: 0.018,
          gain: 0.07,
          delay: 0.05 + idx * 0.028,
          timbre: idx < 2 ? 'brass' : 'celesta',
          wet: 0.5,
          pan: ((idx % 2) * 2 - 1) * 0.3,
        });
      });
    }
  }

  /**
   * Modern Orchestral Brass, Timpani & Harp Victory Fanfare.
   */
  victory() {
    // 1. Concert Timpani Strike
    this.playImpactBody({
      startFreq: 110,
      endFreq: 42,
      duration: 0.32,
      gain: 0.32,
      wet: 0.3,
    });
    this.playSculptedNoise({
      color: 'pink',
      filterType: 'lowpass',
      startFreq: 900,
      endFreq: 180,
      q: 1.2,
      attack: 0.003,
      duration: 0.14,
      gain: 0.14,
      wet: 0.25,
    });

    // 2. Heroic French Horn & String Progression
    const brassProgression: { freq: number; delay: number; dur: number; pan: number }[] = [
      // Chord 1: D4 + A4
      { freq: 293.66, delay: 0.0, dur: 0.22, pan: -0.2 },
      { freq: 440.0, delay: 0.0, dur: 0.22, pan: 0.2 },
      // Step 2: E4 + B4
      { freq: 329.63, delay: 0.14, dur: 0.22, pan: -0.25 },
      { freq: 493.88, delay: 0.14, dur: 0.22, pan: 0.25 },
      // Step 3: F#4 + C#5
      { freq: 369.99, delay: 0.28, dur: 0.24, pan: -0.3 },
      { freq: 554.37, delay: 0.28, dur: 0.24, pan: 0.3 },
      // Final Majestic Resolve: D3 + A3 + D4 + F#4 + A4 + D5
      { freq: 146.83, delay: 0.44, dur: 0.85, pan: 0 },
      { freq: 220.0, delay: 0.44, dur: 0.85, pan: -0.15 },
      { freq: 293.66, delay: 0.44, dur: 0.85, pan: 0.15 },
      { freq: 369.99, delay: 0.46, dur: 0.85, pan: -0.35 },
      { freq: 440.0, delay: 0.46, dur: 0.85, pan: 0.35 },
      { freq: 587.33, delay: 0.48, dur: 0.9, pan: 0 },
    ];

    brassProgression.forEach((n) => {
      this.playWarmVoice({
        freq: n.freq,
        duration: n.dur,
        attack: 0.022,
        gain: 0.075,
        delay: n.delay,
        timbre: 'brass',
        wet: 0.48,
        pan: n.pan,
      });
    });

    // 3. Second Timpani Roll Hit on the Final Chord
    this.playImpactBody({
      startFreq: 98,
      endFreq: 38,
      duration: 0.4,
      gain: 0.3,
      delay: 0.44,
      wet: 0.35,
    });

    // 4. Sparkling Harp Overtones on the Resolve
    const harpSparkle = [587.33, 739.99, 880.0, 1174.66];
    harpSparkle.forEach((freq, i) => {
      this.playWarmVoice({
        freq,
        duration: 0.5,
        attack: 0.008,
        gain: 0.055,
        delay: 0.48 + i * 0.045,
        timbre: 'celesta',
        wet: 0.55,
        pan: (i - 1.5) * 0.25,
      });
    });
  }

  /**
   * Atmospheric Low Cello, Horn & Distant War-Drum Defeat Cadence.
   */
  defeat() {
    // Distant war-drum thud
    this.playImpactBody({
      startFreq: 92,
      endFreq: 32,
      duration: 0.35,
      gain: 0.26,
      wet: 0.35,
    });

    // Dark minor cello & horn resolve (D minor -> A minor low)
    const notes: { freq: number; delay: number; dur: number; pan: number }[] = [
      { freq: 293.66, delay: 0.0, dur: 0.38, pan: -0.2 }, // D4
      { freq: 220.0, delay: 0.0, dur: 0.38, pan: 0.2 }, // A3
      { freq: 174.61, delay: 0.0, dur: 0.38, pan: 0 }, // F3
      { freq: 261.63, delay: 0.28, dur: 0.65, pan: -0.25 }, // C4
      { freq: 196.0, delay: 0.28, dur: 0.65, pan: 0.25 }, // G3
      { freq: 130.81, delay: 0.28, dur: 0.72, pan: 0 }, // C3
    ];

    notes.forEach((n) => {
      this.playWarmVoice({
        freq: n.freq,
        duration: n.dur,
        attack: 0.03,
        gain: 0.075,
        delay: n.delay,
        timbre: 'cello',
        wet: 0.48,
        pan: n.pan,
      });
    });
  }
}

export const sound = new SoundEngine();
