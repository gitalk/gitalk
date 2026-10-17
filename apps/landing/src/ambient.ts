/**
 * Ambient sound for the landing page, synthesised live with the Web Audio API.
 *
 * No audio files, no dependencies: every texture below is a small graph of
 * noise buffers, oscillators, filters and envelopes that is built when the
 * visitor turns sound on. The mix is deliberately quiet — it is background
 * texture for reading: measured at about -35 dBFS RMS at the default volume,
 * with peaks near -30 dBFS — and everything fades in and out rather than
 * starting or stopping at full level.
 *
 * Browsers refuse to start an AudioContext outside a user gesture, so this
 * module never touches the Web Audio API at import time: `start()` is called
 * from a click (or, when the visitor's stored preference is "on", from the
 * first gesture afterwards).
 *
 * Seasons are the northern-hemisphere reading of the date, matching the copy
 * on the page: Mar–May spring, Jun–Aug summer, Sep–Nov autumn, Dec–Feb winter.
 */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

/** Display order, also the order a right-click cycles through. */
export const SEASONS: ReadonlyArray<Season> = ['spring', 'summer', 'autumn', 'winter']

export const DEFAULT_VOLUME = 0.6
export const MIN_VOLUME = 0.1
export const VOLUME_STEP = 0.1

/**
 * Master ceiling at volume 1. The season mixes are built around peaks of about
 * 0.5, so this lands near -29 dBFS RMS at full volume and -35 dBFS at the
 * default — audible in a quiet room, never louder than speech.
 */
const MASTER_LEVEL = 0.3
const FADE_IN = 1.6
const FADE_OUT = 0.8
/** Silence held between fading one season out and the next one in. */
const SEASON_GAP = 0.35

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME
  return Math.min(1, Math.max(MIN_VOLUME, value))
}

export function isSeason(value: unknown): value is Season {
  return typeof value === 'string' && (SEASONS as ReadonlyArray<string>).includes(value)
}

/** `month` is 1-based (January = 1), matching how people read a calendar. */
export function seasonForMonth(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

export function seasonForDate(date: Date): Season {
  return seasonForMonth(date.getMonth() + 1)
}

/**
 * Owns exactly one AudioContext at a time and every node derived from it.
 *
 * Lifecycle:
 *   start(season)      create the context, build the graph, fade in
 *   switchSeason(next) fade out, rebuild, fade in (never a hard cut)
 *   setVolume(v)       re-target the master gain
 *   mute()             fade out, then close the context
 *   dispose()          immediate teardown, for unmount
 */
export class AmbientEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private season: Season | null = null
  private volume: number
  /** Every node of the current season, so teardown can disconnect it all. */
  private nodes = new Set<AudioNode>()
  private sources = new Set<AudioScheduledSourceNode>()
  /** Pending notes (drips, chirps, crackles, gusts). Cleared on any stop. */
  private timers = new Set<number>()
  /** The one pending fade-out/rebuild timer, if any. */
  private transition: number | null = null
  /** Bumped on every transition so stale timers can tell they are stale. */
  private generation = 0

  constructor(volume: number = DEFAULT_VOLUME) {
    this.volume = clampVolume(volume)
  }

  /** Exposed for diagnostics; null while the sound is off. */
  get context(): AudioContext | null {
    return this.ctx
  }

  start(season: Season): void {
    if (this.ctx) {
      if (this.transition !== null) {
        // A fade-out was already in flight (a quick off → on, or a season
        // swap): cancel it and rebuild, or its timer would close the context
        // under the sound the visitor just asked for.
        this.generation++
        this.clearTransition()
        this.clearTimers()
        this.teardownGraph()
        this.build(season)
        this.rampMaster(this.targetGain(), FADE_IN)
        void this.ctx.resume().catch(() => {})
        return
      }
      if (this.season === season) {
        void this.ctx.resume().catch(() => {})
        return
      }
      this.switchSeason(season)
      return
    }

    // The only place a context is created. Callers must be inside a gesture.
    const ctx = new AudioContext()
    this.ctx = ctx
    // Safari can hand back a suspended context even inside a gesture.
    void ctx.resume().catch(() => {})

    const master = ctx.createGain()
    master.gain.value = 0.0001
    master.connect(ctx.destination)
    this.master = master

    this.build(season)
    this.rampMaster(this.targetGain(), FADE_IN)
  }

  switchSeason(season: Season): void {
    const ctx = this.ctx
    if (!ctx || this.season === season) return

    const generation = ++this.generation
    this.clearTransition()
    // Stop scheduling new events immediately; the old texture keeps sounding
    // while its master fades, then the graph is swapped in near silence.
    this.clearTimers()
    this.rampMaster(0.0001, SEASON_GAP)

    this.transition = window.setTimeout(() => {
      this.transition = null
      if (this.generation !== generation || this.ctx !== ctx) return
      this.teardownGraph()
      this.build(season)
      this.rampMaster(this.targetGain(), FADE_IN)
    }, SEASON_GAP * 1000)
  }

  setVolume(volume: number): void {
    this.volume = clampVolume(volume)
    // Do not fight a fade-out: only follow the slider while the graph is up.
    if (this.ctx && this.master && this.transition === null) {
      this.rampMaster(this.targetGain(), 0.25)
    }
  }

  mute(): void {
    const ctx = this.ctx
    if (!ctx) return

    const generation = ++this.generation
    this.clearTransition()
    this.clearTimers()
    this.rampMaster(0.0001, FADE_OUT)

    this.transition = window.setTimeout(() => {
      this.transition = null
      if (this.generation !== generation || this.ctx !== ctx) return
      this.dispose()
    }, FADE_OUT * 1000 + 60)
  }

  /** Immediate teardown: unmount must not leave an oscillator running. */
  dispose(): void {
    const ctx = this.ctx
    this.generation++
    this.clearTransition()
    this.clearTimers()
    this.ctx = null
    this.master = null
    this.season = null
    this.teardownGraph()
    if (ctx) {
      // close() releases the output stream and moves the state to 'closed'.
      void ctx.close().catch(() => {})
    }
  }

  /* ---------- graph construction ---------- */

  private build(season: Season): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return

    this.season = season
    const bus = ctx.createGain()
    bus.gain.value = 1
    bus.connect(master)

    switch (season) {
      case 'spring':
        this.buildSpring(ctx, bus)
        break
      case 'summer':
        this.buildSummer(ctx, bus)
        break
      case 'autumn':
        this.buildAutumn(ctx, bus)
        break
      case 'winter':
        this.buildWinter(ctx, bus)
        break
    }
  }

  /**
   * Spring rain: filtered white noise for the body, plus random drips built
   * from a fast-decaying sine whose pitch falls as it dies (a water droplet
   * is a resonance that loses energy, not a pure beep).
   */
  private buildSpring(ctx: AudioContext, bus: AudioNode): void {
    const noise = this.noise(ctx, 3)
    // Two decorrelated layers, panned apart: width without a reverb impulse.
    const beds: ReadonlyArray<{ pan: number; gain: number; cutoff: number }> = [
      { pan: -0.55, gain: 0.5, cutoff: 1350 },
      { pan: 0.6, gain: 0.4, cutoff: 1950 }
    ]

    for (const bed of beds) {
      const source = this.source(ctx.createBufferSource())
      source.buffer = noise
      source.loop = true

      const highpass = this.node(ctx.createBiquadFilter())
      highpass.type = 'highpass'
      highpass.frequency.value = 420
      highpass.Q.value = 0.6

      const lowpass = this.node(ctx.createBiquadFilter())
      lowpass.type = 'lowpass'
      lowpass.frequency.value = bed.cutoff
      lowpass.Q.value = 0.55

      const gain = this.node(ctx.createGain())
      gain.gain.value = bed.gain

      const pan = this.node(ctx.createStereoPanner())
      pan.pan.value = bed.pan

      source.connect(highpass)
      highpass.connect(lowpass)
      lowpass.connect(gain)
      gain.connect(pan)
      pan.connect(bus)
      source.start()

      // A fixed cutoff reads as a hiss; letting it drift reads as weather.
      const drift = this.source(ctx.createOscillator())
      drift.type = 'sine'
      drift.frequency.value = 0.05 + Math.random() * 0.05
      const driftDepth = this.node(ctx.createGain())
      driftDepth.gain.value = bed.cutoff * 0.22
      drift.connect(driftDepth)
      driftDepth.connect(lowpass.frequency)
      drift.start()
    }

    const drips = () => {
      if (!this.ctx) return
      this.drip(ctx, bus)
      this.schedule(drips, 90 + Math.random() * 430)
    }
    this.schedule(drips, 180)
  }

  private drip(ctx: AudioContext, bus: AudioNode): void {
    const now = ctx.currentTime
    const decay = 0.05 + Math.random() * 0.12

    const osc = this.source(ctx.createOscillator())
    osc.type = 'sine'
    const start = 1500 + Math.random() * 1700
    osc.frequency.setValueAtTime(start, now)
    // Falling pitch is what makes a sine read as a droplet rather than a ping.
    osc.frequency.exponentialRampToValueAtTime(start * (0.32 + Math.random() * 0.22), now + decay)

    const gain = this.node(ctx.createGain())
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.05 + Math.random() * 0.07, now + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.004 + decay)

    const pan = this.node(ctx.createStereoPanner())
    pan.pan.value = Math.random() * 1.6 - 0.8

    osc.connect(gain)
    gain.connect(pan)
    pan.connect(bus)
    osc.start(now)
    osc.stop(now + decay + 0.08)
    // One-shot nodes are dropped as soon as they end: at a few drips a second
    // a long listening session would otherwise keep every envelope around.
    osc.addEventListener('ended', () => this.release(gain, pan))
  }

  /**
   * Summer insects: a high carrier amplitude-modulated at 28–50 Hz (the
   * "grain" of a cricket), gated by a short multi-pulse chirp envelope. Four
   * voices, each with its own pitch, pan and rhythm, so they never line up.
   */
  private buildSummer(ctx: AudioContext, bus: AudioNode): void {
    const noise = this.noise(ctx, 2)

    // Faint low night air, so the chirps sit in a place rather than a void.
    const air = this.source(ctx.createBufferSource())
    air.buffer = noise
    air.loop = true
    const airFilter = this.node(ctx.createBiquadFilter())
    airFilter.type = 'lowpass'
    airFilter.frequency.value = 480
    const airGain = this.node(ctx.createGain())
    airGain.gain.value = 0.05
    air.connect(airFilter)
    airFilter.connect(airGain)
    airGain.connect(bus)
    air.start()

    const voices = 4
    for (let index = 0; index < voices; index++) {
      this.cricket(ctx, bus, index, voices)
    }
  }

  private cricket(ctx: AudioContext, bus: AudioNode, index: number, voices: number): void {
    const baseFrequency = 3400 + Math.random() * 1900
    const spread = voices > 1 ? index / (voices - 1) : 0.5

    const carrier = this.source(ctx.createOscillator())
    carrier.type = 'sine'
    carrier.frequency.value = baseFrequency

    const tremolo = this.source(ctx.createOscillator())
    tremolo.type = 'sine'
    tremolo.frequency.value = 28 + Math.random() * 22

    // vca sits at 0.5 with the tremolo swinging ±0.45 around it: 0.05–0.95.
    const tremoloDepth = this.node(ctx.createGain())
    tremoloDepth.gain.value = 0.45
    const vca = this.node(ctx.createGain())
    vca.gain.value = 0.5

    // The chirp envelope, separate from the tremolo, so silence is total.
    const chirp = this.node(ctx.createGain())
    chirp.gain.value = 0.0001

    const pan = this.node(ctx.createStereoPanner())
    pan.pan.value = spread * 1.7 - 0.85 + (Math.random() - 0.5) * 0.2

    const level = this.node(ctx.createGain())
    // Insects are sparse by nature: measured RMS is far below the beds, so
    // the per-voice gain is set by peak level, not by the average.
    level.gain.value = 0.18 + Math.random() * 0.06

    carrier.connect(vca)
    vca.connect(chirp)
    chirp.connect(pan)
    pan.connect(level)
    level.connect(bus)
    tremolo.connect(tremoloDepth)
    tremoloDepth.connect(vca.gain)

    carrier.start()
    tremolo.start()

    const period = 750 + Math.random() * 1400
    const chirpLoop = () => {
      if (!this.ctx) return
      this.chirp(ctx, chirp.gain, carrier.frequency, baseFrequency)
      this.schedule(chirpLoop, period * (0.75 + Math.random() * 0.6))
    }
    this.schedule(chirpLoop, 150 + Math.random() * 900)
  }

  private chirp(
    ctx: AudioContext,
    gain: AudioParam,
    frequency: AudioParam,
    baseFrequency: number
  ): void {
    const start = ctx.currentTime + 0.04
    const pulses = 2 + Math.floor(Math.random() * 3)

    gain.cancelScheduledValues(start)
    gain.setValueAtTime(0.0001, start)
    // Tiny per-chirp detune keeps repeated calls from sounding mechanical.
    frequency.setValueAtTime(baseFrequency * (0.96 + Math.random() * 0.08), start)

    for (let pulse = 0; pulse < pulses; pulse++) {
      const at = start + pulse * 0.062
      gain.setValueAtTime(0.0001, at)
      gain.linearRampToValueAtTime(1, at + 0.006)
      gain.linearRampToValueAtTime(0.6, at + 0.03)
      gain.linearRampToValueAtTime(0.0001, at + 0.045)
    }
  }

  /**
   * Autumn fire: brown noise under a low lowpass for the bed of the fire, a
   * quiet mid layer for the body of the flame, and short filtered noise
   * bursts at random intervals for the crackles.
   */
  private buildAutumn(ctx: AudioContext, bus: AudioNode): void {
    const brown = this.noise(ctx, 3, true)
    const white = this.noise(ctx, 2)

    const rumble = this.source(ctx.createBufferSource())
    rumble.buffer = brown
    rumble.loop = true
    const rumbleFilter = this.node(ctx.createBiquadFilter())
    rumbleFilter.type = 'lowpass'
    rumbleFilter.frequency.value = 240
    rumbleFilter.Q.value = 0.7
    const rumbleGain = this.node(ctx.createGain())
    rumbleGain.gain.value = 0.55
    rumble.connect(rumbleFilter)
    rumbleFilter.connect(rumbleGain)
    rumbleGain.connect(bus)
    rumble.start()

    const body = this.source(ctx.createBufferSource())
    body.buffer = white
    body.loop = true
    const bodyFilter = this.node(ctx.createBiquadFilter())
    bodyFilter.type = 'lowpass'
    bodyFilter.frequency.value = 900
    bodyFilter.Q.value = 0.5
    const bodyGain = this.node(ctx.createGain())
    bodyGain.gain.value = 0.05
    body.connect(bodyFilter)
    bodyFilter.connect(bodyGain)
    bodyGain.connect(bus)
    body.start()

    // Slow flicker on the bed, the way a fire breathes.
    const flicker = this.source(ctx.createOscillator())
    flicker.type = 'sine'
    flicker.frequency.value = 0.16 + Math.random() * 0.08
    const flickerDepth = this.node(ctx.createGain())
    flickerDepth.gain.value = 0.14
    flicker.connect(flickerDepth)
    flickerDepth.connect(rumbleGain.gain)
    flicker.start()

    const crackles = () => {
      if (!this.ctx) return
      this.crackle(ctx, bus, white)
      // Fires pop in little clusters, not on a metronome.
      if (Math.random() < 0.16) {
        this.schedule(() => {
          if (this.ctx) this.crackle(ctx, bus, white)
        }, 25 + Math.random() * 70)
      }
      this.schedule(crackles, 90 + Math.random() * 520)
    }
    this.schedule(crackles, 120)
  }

  private crackle(ctx: AudioContext, bus: AudioNode, noise: AudioBuffer): void {
    const now = ctx.currentTime
    const duration = 0.03 + Math.random() * 0.12
    const offset = Math.random() * 1.4

    const source = this.source(ctx.createBufferSource())
    source.buffer = noise

    const filter = this.node(ctx.createBiquadFilter())
    filter.type = 'bandpass'
    filter.frequency.value = 700 + Math.random() * 3600
    filter.Q.value = 0.7 + Math.random() * 1.1

    const gain = this.node(ctx.createGain())
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.1 + Math.random() * 0.16, now + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    const pan = this.node(ctx.createStereoPanner())
    pan.pan.value = Math.random() * 1.4 - 0.7

    source.connect(filter)
    filter.connect(gain)
    gain.connect(pan)
    pan.connect(bus)
    source.start(now, offset, duration + 0.02)
    source.stop(now + duration + 0.03)
    source.addEventListener('ended', () => this.release(filter, gain, pan))
  }

  /**
   * Winter wind: two bandpassed noise layers panned wide with independent
   * slow LFOs for the moment-to-moment movement, plus a scheduled gust that
   * swells the shared level every few seconds.
   */
  private buildWinter(ctx: AudioContext, bus: AudioNode): void {
    const noise = this.noise(ctx, 3)

    const wind = this.node(ctx.createGain())
    wind.gain.value = 0.45
    wind.connect(bus)

    const layers: ReadonlyArray<{ pan: number; center: number; q: number; gain: number }> = [
      { pan: -0.7, center: 620, q: 0.9, gain: 0.5 },
      { pan: 0.75, center: 880, q: 1.1, gain: 0.38 }
    ]

    for (const layer of layers) {
      const source = this.source(ctx.createBufferSource())
      source.buffer = noise
      source.loop = true

      const band = this.node(ctx.createBiquadFilter())
      band.type = 'bandpass'
      band.frequency.value = layer.center
      band.Q.value = layer.q

      const gain = this.node(ctx.createGain())
      gain.gain.value = layer.gain

      const pan = this.node(ctx.createStereoPanner())
      pan.pan.value = layer.pan

      source.connect(band)
      band.connect(gain)
      gain.connect(pan)
      pan.connect(wind)
      source.start()

      const sweep = this.source(ctx.createOscillator())
      sweep.type = 'sine'
      sweep.frequency.value = 0.04 + Math.random() * 0.05
      const sweepDepth = this.node(ctx.createGain())
      sweepDepth.gain.value = layer.center * 0.55
      sweep.connect(sweepDepth)
      sweepDepth.connect(band.frequency)
      sweep.start()

      const swell = this.source(ctx.createOscillator())
      swell.type = 'sine'
      swell.frequency.value = 0.05 + Math.random() * 0.06
      const swellDepth = this.node(ctx.createGain())
      swellDepth.gain.value = layer.gain * 0.55
      swell.connect(swellDepth)
      swellDepth.connect(gain.gain)
      swell.start()
    }

    // A hiss layer for the snow itself, high and quiet.
    const hiss = this.source(ctx.createBufferSource())
    hiss.buffer = noise
    hiss.loop = true
    const hissFilter = this.node(ctx.createBiquadFilter())
    hissFilter.type = 'highpass'
    hissFilter.frequency.value = 2800
    const hissGain = this.node(ctx.createGain())
    hissGain.gain.value = 0.035
    hiss.connect(hissFilter)
    hissFilter.connect(hissGain)
    hissGain.connect(wind)
    hiss.start()

    const gusts = () => {
      if (!this.ctx) return
      const now = ctx.currentTime
      const rise = 1.6 + Math.random() * 2.4
      const peak = 0.62 + Math.random() * 0.3
      wind.gain.cancelScheduledValues(now)
      wind.gain.setValueAtTime(Math.max(wind.gain.value, 0.01), now)
      wind.gain.linearRampToValueAtTime(peak, now + rise)
      wind.gain.linearRampToValueAtTime(0.28 + Math.random() * 0.22, now + rise + 2 + Math.random() * 3)
      this.schedule(gusts, (rise + 4 + Math.random() * 5) * 1000)
    }
    this.schedule(gusts, 500)
  }

  /* ---------- shared plumbing ---------- */

  private targetGain(): number {
    return Math.max(0.0001, this.volume * MASTER_LEVEL)
  }

  private rampMaster(target: number, seconds: number): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const now = ctx.currentTime
    const gain = master.gain
    gain.cancelScheduledValues(now)
    // Start from wherever the ramp currently is, so repeated changes never
    // jump. `value` reads the computed gain, including mid-ramp.
    gain.setValueAtTime(Math.max(gain.value, 0.0001), now)
    gain.linearRampToValueAtTime(Math.max(target, 0.0001), now + seconds)
  }

  private schedule(fn: () => void, delay: number): void {
    const id = window.setTimeout(() => {
      this.timers.delete(id)
      if (!this.ctx) return
      fn()
    }, delay)
    this.timers.add(id)
  }

  private clearTimers(): void {
    for (const timer of this.timers) window.clearTimeout(timer)
    this.timers.clear()
  }

  private clearTransition(): void {
    if (this.transition !== null) {
      window.clearTimeout(this.transition)
      this.transition = null
    }
  }

  /** Removes the current season's nodes, leaving the master gain in place. */
  private teardownGraph(): void {
    for (const timer of this.timers) window.clearTimeout(timer)
    this.timers.clear()

    for (const source of this.sources) {
      try {
        source.stop()
      } catch {
        // Already stopped, or never started: nothing to release.
      }
    }
    this.sources.clear()

    for (const node of this.nodes) {
      try {
        node.disconnect()
      } catch {
        // Disconnecting a node twice is harmless; ignore it.
      }
    }
    this.nodes.clear()
  }

  private node<T extends AudioNode>(node: T): T {
    this.nodes.add(node)
    return node
  }

  /** Drops finished one-shot nodes out of the graph and the teardown set. */
  private release(...nodes: AudioNode[]): void {
    for (const node of nodes) {
      this.nodes.delete(node)
      try {
        node.disconnect()
      } catch {
        // Already disconnected as part of a full teardown.
      }
    }
  }

  private source<T extends AudioScheduledSourceNode>(node: T): T {
    this.nodes.add(node)
    this.sources.add(node)
    node.addEventListener('ended', () => {
      this.sources.delete(node)
      this.nodes.delete(node)
      try {
        node.disconnect()
      } catch {
        // Already disconnected with the rest of the graph.
      }
    })
    return node
  }

  /**
   * A loopable noise buffer. White for most textures, brown (integrated white,
   * normalised) for the fire, whose low end needs more weight than white noise
   * through a lowpass can give.
   */
  private noise(ctx: AudioContext, seconds: number, brown = false): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)

    if (brown) {
      let last = 0
      for (let index = 0; index < length; index++) {
        const white = Math.random() * 2 - 1
        last = (last + 0.02 * white) / 1.02
        data[index] = last * 3.5
      }
    } else {
      for (let index = 0; index < length; index++) {
        data[index] = Math.random() * 2 - 1
      }
    }

    return buffer
  }
}
