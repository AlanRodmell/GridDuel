// Modern Web Audio API Foley & Orchestral Sound Engine
// Uses physical noise sculpting, resonant body filters, FM metallic partials,
// stereo spatial panning, dynamics compression, and algorithmic sanctuary convolution reverb.

import { Rarity } from '../types/game';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbSend: GainNode | null = null;
  private pinkNoiseBuffer: AudioBuffer | null = null;
  private whiteNoiseBuffer: AudioBuffer | null = null;
  private lastHoverAt = 0;

  public enabled = true;

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

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
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
   * Heavy carved stone slab slam onto the battlefield socket, scaled in seismic weight
   * and harmonic resonance by card Rarity ('common' | 'rare' | 'epic' | 'mythic') + Power Relic chime.
   */
  placeSlab(rarity: Rarity = 'common', isRelic = false, pan = 0) {
    const jitter = 0.95 + Math.random() * 0.09;
    const clampedPan = Math.max(-0.65, Math.min(0.65, pan));

    const weightGain =
      rarity === 'mythic'
        ? 0.42
        : rarity === 'epic'
        ? 0.36
        : rarity === 'rare'
        ? 0.32
        : 0.28;
    const subEndFreq =
      rarity === 'mythic' ? 24 : rarity === 'epic' ? 27 : rarity === 'rare' ? 30 : 34;
    const subDuration =
      rarity === 'mythic'
        ? 0.34
        : rarity === 'epic'
        ? 0.26
        : rarity === 'rare'
        ? 0.21
        : 0.17;

    // 1. Fast downward air-displacement whoosh right as the heavy slab drops (0 -> 20ms)
    this.playSculptedNoise({
      color: 'pink',
      filterType: 'bandpass',
      startFreq: 540 * jitter,
      endFreq: 135,
      q: 1.6,
      attack: 0.003,
      duration: 0.048,
      gain: 0.16,
      wet: 0.12,
      pan: clampedPan,
    });

    // 2. Seismic monolith sub-bass chest thump (+16ms)
    this.playImpactBody({
      startFreq: 108 * jitter,
      endFreq: subEndFreq,
      duration: subDuration,
      gain: weightGain,
      delay: 0.016,
      wet: rarity === 'mythic' ? 0.32 : 0.22,
      pan: clampedPan * 0.5,
    });

    // 3. Dense granite / basalt slab-on-stone knock (+17ms)
    this.playImpactBody({
      startFreq: 265 * jitter,
      endFreq: 74,
      duration: 0.095,
      gain: 0.24,
      delay: 0.017,
      wet: 0.2,
      pan: clampedPan,
    });

    // 4. Grinding stone-on-stone grit & rock dust burst (+18ms)
    this.playSculptedNoise({
      color: 'pink',
      filterType: 'bandpass',
      startFreq: 780 * jitter,
      endFreq: 195,
      q: 1.25,
      attack: 0.002,
      duration: 0.125,
      gain: 0.26,
      delay: 0.018,
      wet: 0.26,
      pan: clampedPan,
    });

    // 5. Sharp chiseled stone-edge crack transient (+18ms)
    this.playSculptedNoise({
      color: 'white',
      filterType: 'bandpass',
      startFreq: 2650 * jitter,
      endFreq: 880,
      q: 2.1,
      attack: 0.001,
      duration: 0.045,
      gain: 0.13,
      delay: 0.018,
      wet: 0.18,
      pan: clampedPan,
    });

    // 6. Micro-pebble / stone-chip scatter clicks settling onto the table (+52ms & +84ms)
    [0.052, 0.084].forEach((d, i) => {
      this.playSculptedNoise({
        color: 'white',
        filterType: 'highpass',
        startFreq: 3100 - i * 500,
        endFreq: 1900,
        q: 1.8,
        attack: 0.001,
        duration: 0.022,
        gain: 0.048 - i * 0.014,
        delay: d + Math.random() * 0.012,
        wet: 0.16,
        pan: clampedPan + (i === 0 ? -0.14 : 0.14),
      });
    });

    // 7. Rarity-Specific Resonance Signature
    if (rarity === 'common') {
      // Grounded earthen low-stone resonance
      this.playWarmVoice({
        freq: 110 * jitter, // A2
        duration: 0.19,
        attack: 0.008,
        gain: 0.055,
        delay: 0.02,
        timbre: 'cello',
        wet: 0.28,
        pan: clampedPan,
      });
    } else if (rarity === 'rare') {
      // Crystalline sapphire frost-quartz ring
      this.playMetallicPartials({
        frequencies: [1318.5 * jitter, 1975.5 * jitter, 2960 * jitter],
        duration: 0.26,
        gain: 0.085,
        delay: 0.022,
        wet: 0.38,
        pan: clampedPan,
      });
      this.playWarmVoice({
        freq: 293.66, // D4
        duration: 0.28,
        attack: 0.008,
        gain: 0.065,
        delay: 0.024,
        timbre: 'celesta',
        wet: 0.42,
        pan: clampedPan,
      });
    } else if (rarity === 'epic') {
      // Deep amethyst arcane rift swell + dark brass fifth
      this.playSculptedNoise({
        color: 'pink',
        filterType: 'bandpass',
        startFreq: 320,
        endFreq: 1850,
        q: 2.6,
        attack: 0.02,
        duration: 0.28,
        gain: 0.12,
        delay: 0.024,
        wet: 0.45,
        pan: clampedPan,
      });
      [146.83, 220.0, 329.63].forEach((freq, idx) => {
        this.playWarmVoice({
          freq,
          duration: 0.36,
          attack: 0.012,
          gain: 0.065,
          delay: 0.024 + idx * 0.02,
          timbre: idx === 0 ? 'brass' : 'harp',
          wet: 0.48,
          pan: clampedPan + (idx - 1) * 0.15,
        });
      });
    } else if (rarity === 'mythic') {
      // Sovereign gilded monolith earthshaker: sanctum bell gong + solar brass/celesta chord
      this.playMetallicPartials({
        frequencies: [880, 1318.5, 1760, 2637, 3520],
        duration: 0.48,
        gain: 0.13,
        delay: 0.02,
        wet: 0.55,
        pan: clampedPan,
      });
      [146.83, 293.66, 440.0, 587.33, 739.99].forEach((freq, idx) => {
        this.playWarmVoice({
          freq,
          duration: 0.5,
          attack: 0.012,
          gain: 0.072,
          delay: 0.022 + idx * 0.018,
          timbre: idx < 2 ? 'brass' : 'celesta',
          wet: 0.55,
          pan: clampedPan + ((idx % 2) * 2 - 1) * 0.2,
        });
      });
    }

    // 8. Optional Power Relic Totem Anchor Resonance
    if (isRelic) {
      [523.25, 783.99, 1046.5].forEach((freq, idx) => {
        this.playWarmVoice({
          freq,
          duration: 0.38,
          attack: 0.008,
          gain: 0.06,
          delay: 0.03 + idx * 0.028,
          timbre: 'celesta',
          wet: 0.5,
          pan: clampedPan,
        });
      });
    }
  }

  /**
   * Heavy physical card slam onto an engraved stone socket on the board.
   */
  place() {
    const jitter = 0.96 + Math.random() * 0.08;
    // 1. Sub-bass physical table thud
    this.playImpactBody({
      startFreq: 130 * jitter,
      endFreq: 36,
      duration: 0.135,
      gain: 0.28,
      wet: 0.18,
    });
    // 2. Mid-range stone socket knock
    this.playImpactBody({
      startFreq: 310 * jitter,
      endFreq: 115,
      duration: 0.065,
      gain: 0.15,
      delay: 0.004,
      wet: 0.15,
    });
    // 3. Stone dust / cardstock slap transient
    this.playSculptedNoise({
      color: 'pink',
      filterType: 'bandpass',
      startFreq: 950,
      endFreq: 380,
      q: 1.4,
      attack: 0.002,
      duration: 0.075,
      gain: 0.18,
      wet: 0.2,
    });
    // 4. Crisp card edge snap as it settles flat
    this.playSculptedNoise({
      color: 'white',
      filterType: 'highpass',
      startFreq: 2200,
      endFreq: 1600,
      q: 1.0,
      attack: 0.002,
      duration: 0.035,
      gain: 0.07,
      delay: 0.012,
      wet: 0.15,
    });
    // 5. Subtle runic socket lock resonance
    this.playWarmVoice({
      freq: 220,
      duration: 0.22,
      attack: 0.01,
      gain: 0.05,
      delay: 0.015,
      timbre: 'harp',
      wet: 0.4,
    });
  }

  /**
   * Dedicated Sword & Shield Clash sound when opposing arrows collide on the board.
   */
  clash(attackerWon = true) {
    // 1. Sharp steel blade ring partials
    this.playMetallicPartials({
      frequencies: [1280, 1940, 2890, 4120, 5640],
      duration: 0.28,
      gain: 0.16,
      wet: 0.35,
      pan: -0.15,
    });
    // 2. Metallic scrape transient
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
    // 3. Heavy shield impact punch
    this.playImpactBody({
      startFreq: 165,
      endFreq: 42,
      duration: 0.15,
      gain: 0.26,
      delay: 0.01,
      wet: 0.2,
    });
    // 4. Heroic power chord on win or dark armor recoil on counter
    if (attackerWon) {
      this.playWarmVoice({
        freq: 293.66, // D4
        duration: 0.26,
        attack: 0.012,
        gain: 0.08,
        delay: 0.04,
        timbre: 'brass',
        wet: 0.35,
        pan: 0.15,
      });
      this.playWarmVoice({
        freq: 440, // A4
        duration: 0.3,
        attack: 0.015,
        gain: 0.08,
        delay: 0.06,
        timbre: 'brass',
        wet: 0.4,
        pan: 0.2,
      });
    } else {
      this.playWarmVoice({
        freq: 196.0, // G3
        duration: 0.24,
        attack: 0.01,
        gain: 0.09,
        delay: 0.03,
        timbre: 'cello',
        wet: 0.3,
      });
      this.playWarmVoice({
        freq: 146.83, // D3
        duration: 0.32,
        attack: 0.015,
        gain: 0.1,
        delay: 0.09,
        timbre: 'cello',
        wet: 0.35,
      });
    }
  }

  /**
   * Kinetic card whoosh through the air + physical board re-slap + warm harmonic shimmer.
   */
  flip(wave = 0) {
    const scaleNotes = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25];
    const note = scaleNotes[Math.min(wave, scaleNotes.length - 1)];
    const pan = ((wave % 3) - 1) * 0.22;

    // 1. Aerodynamic card flip air whoosh
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
    // 2. Physical card slap as it lands face-up in its new owner's color
    this.playImpactBody({
      startFreq: 140,
      endFreq: 48,
      duration: 0.085,
      gain: 0.18,
      delay: 0.065,
      wet: 0.15,
      pan,
    });
    this.playSculptedNoise({
      color: 'white',
      filterType: 'bandpass',
      startFreq: 2400,
      endFreq: 1400,
      q: 1.5,
      attack: 0.002,
      duration: 0.035,
      gain: 0.07,
      delay: 0.068,
      wet: 0.12,
      pan,
    });
    // 3. Warm acoustic harp harmonic accent
    this.playWarmVoice({
      freq: note,
      duration: 0.28,
      attack: 0.008,
      gain: 0.085,
      delay: 0.055,
      timbre: 'harp',
      wet: 0.38,
      pan,
    });
  }

  /**
   * Arcane Chain Combo eruption: swirling wind rush + cascading stereo harp & celesta notes.
   */
  combo() {
    // 1. Pressurized arcane wind rush
    this.playSculptedNoise({
      color: 'pink',
      filterType: 'bandpass',
      startFreq: 350,
      endFreq: 2800,
      q: 2.0,
      attack: 0.03,
      duration: 0.28,
      gain: 0.16,
      wet: 0.35,
    });
    // 2. Deep kinetic pulse
    this.playImpactBody({
      startFreq: 135,
      endFreq: 38,
      duration: 0.2,
      gain: 0.24,
      wet: 0.25,
    });
    // 3. Cascading stereo harp & celesta arpeggio (D Major 9)
    const arpeggio = [293.66, 369.99, 440.0, 587.33, 659.25, 880.0];
    arpeggio.forEach((freq, idx) => {
      const pan = (idx % 2 === 0 ? -1 : 1) * (0.15 + idx * 0.08);
      this.playWarmVoice({
        freq,
        duration: 0.36,
        attack: 0.006,
        gain: 0.08,
        delay: idx * 0.048,
        timbre: idx >= 3 ? 'celesta' : 'harp',
        wet: 0.45,
        pan,
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
