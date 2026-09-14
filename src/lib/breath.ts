/**
 * Breath detection from the microphone.
 *
 * Breathing is broadband, low-energy noise. Rather than look for pitch, the
 * detector tracks how much energy sits in the 200–2000 Hz band relative to the
 * room's own noise floor, smooths that into an envelope, and calls a breath
 * whenever the envelope rises well above the floor and then falls back.
 *
 * Everything here is pure so the whole pipeline can be tested without a
 * microphone; `mic.ts` only supplies frames of spectrum data.
 */

export type DetectorConfig = {
  /** Frames per second the analyser delivers. */
  fps: number
  /** How fast the noise floor adapts, 0–1 per frame. Low = slow and stable. */
  floorAdapt: number
  /** Envelope smoothing, 0–1 per frame. */
  smoothing: number
  /** Envelope must exceed floor by this (in dB) to start a breath. */
  onThresholdDb: number
  /** Breath ends when the envelope falls back to within this of the floor. */
  offThresholdDb: number
  /** Breaths shorter than this are noise, not breathing. */
  minBreathMs: number
  /** Gap after which we assume the person stopped breathing audibly. */
  maxGapMs: number
}

export const DEFAULT_CONFIG: DetectorConfig = {
  fps: 30,
  floorAdapt: 0.02,
  smoothing: 0.25,
  onThresholdDb: 6,
  offThresholdDb: 2.5,
  minBreathMs: 500,
  maxGapMs: 12_000,
}

export type DetectorState = {
  /** Smoothed band energy in dB. */
  envelope: number
  /** Adaptive room-noise floor in dB. */
  floor: number
  /** True while a breath is in progress. */
  inBreath: boolean
  /** Timestamp (ms) the current breath started. */
  breathStart: number
  /** Timestamps of recent completed breath onsets. */
  onsets: number[]
  /** Whether the floor has settled enough to trust detections. */
  calibrated: boolean
  framesSeen: number
}

export function initialState(): DetectorState {
  return {
    envelope: -100,
    floor: -100,
    inBreath: false,
    breathStart: 0,
    onsets: [],
    calibrated: false,
    framesSeen: 0,
  }
}

/** Frames needed before the noise floor is considered settled (~1.5 s). */
const CALIBRATION_FRAMES = 45

export type Frame = {
  /** Per-bin magnitudes in dB, as produced by AnalyserNode.getFloatFrequencyData. */
  bins: Float32Array
  /** Sample rate of the audio context. */
  sampleRate: number
  /** FFT size used, so bin width can be derived. */
  fftSize: number
  /** Monotonic timestamp in ms. */
  now: number
}

/** Mean energy in the band where breath noise lives, in dB. */
export function bandEnergyDb(frame: Frame, lowHz = 200, highHz = 2000): number {
  const binHz = frame.sampleRate / frame.fftSize
  const from = Math.max(1, Math.floor(lowHz / binHz))
  const to = Math.min(frame.bins.length - 1, Math.ceil(highHz / binHz))
  if (to <= from) return -100
  let sum = 0
  let count = 0
  for (let i = from; i <= to; i++) {
    const v = frame.bins[i]
    // Silent bins report -Infinity in some browsers.
    sum += Number.isFinite(v) ? v : -100
    count++
  }
  return count > 0 ? sum / count : -100
}

export type StepResult = {
  state: DetectorState
  /** Set on the frame a breath is first detected. */
  breathStarted: boolean
  /** Set on the frame a breath completes, with its duration. */
  breathEnded: false | { durationMs: number }
  /** How far the envelope sits above the floor, in dB — drives the live visual. */
  aboveFloorDb: number
}

export function step(state: DetectorState, frame: Frame, cfg: DetectorConfig = DEFAULT_CONFIG): StepResult {
  const energy = bandEnergyDb(frame)
  const framesSeen = state.framesSeen + 1

  const envelope =
    state.envelope <= -99 ? energy : state.envelope + (energy - state.envelope) * cfg.smoothing

  // The floor only tracks quiet frames, so a long breath cannot drag it upward.
  const quiet = envelope < state.floor + cfg.onThresholdDb
  const floorTarget = Math.min(envelope, state.floor + 3)
  const adapt = quiet ? cfg.floorAdapt : cfg.floorAdapt * 0.05
  const floor = state.floor <= -99 ? energy : state.floor + (floorTarget - state.floor) * adapt

  const aboveFloorDb = envelope - floor
  const calibrated = state.calibrated || framesSeen >= CALIBRATION_FRAMES

  let inBreath = state.inBreath
  let breathStart = state.breathStart
  let onsets = state.onsets
  let breathStarted = false
  let breathEnded: StepResult['breathEnded'] = false

  if (calibrated) {
    if (!inBreath && aboveFloorDb >= cfg.onThresholdDb) {
      inBreath = true
      breathStart = frame.now
      breathStarted = true
    } else if (inBreath && aboveFloorDb <= cfg.offThresholdDb) {
      const durationMs = frame.now - breathStart
      inBreath = false
      if (durationMs >= cfg.minBreathMs) {
        breathEnded = { durationMs }
        onsets = [...state.onsets, breathStart].slice(-12)
      }
    }
  }

  return {
    state: { envelope, floor, inBreath, breathStart, onsets, calibrated, framesSeen },
    breathStarted,
    breathEnded,
    aboveFloorDb,
  }
}

/**
 * Breaths per minute from recent onsets. Uses the median interval so one missed
 * or doubled breath does not swing the reading, and returns null until there is
 * enough evidence to show a number at all.
 */
export function breathsPerMinute(onsets: number[], now: number, cfg: DetectorConfig = DEFAULT_CONFIG): number | null {
  const recent = onsets.filter((t) => now - t <= 90_000)
  if (recent.length < 3) return null
  const gaps: number[] = []
  for (let i = 1; i < recent.length; i++) {
    const gap = recent[i] - recent[i - 1]
    if (gap > 800 && gap < cfg.maxGapMs) gaps.push(gap)
  }
  if (gaps.length < 2) return null
  const sorted = [...gaps].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  return Math.round((60_000 / median) * 10) / 10
}

/** 0–1 signal strength, used to tell the user the mic is picking them up. */
export function signalQuality(aboveFloorDb: number, cfg: DetectorConfig = DEFAULT_CONFIG): number {
  return Math.max(0, Math.min(1, aboveFloorDb / (cfg.onThresholdDb * 2)))
}
