import { describe, expect, it } from 'vitest'
import { bandEnergyDb, breathsPerMinute, DEFAULT_CONFIG, initialState, step, type Frame } from './breath'
import { breathsPerMinuteOf, calmScore, cycleSeconds, paceScale, PATTERNS, phaseAt } from './pacing'

const SAMPLE_RATE = 48_000
const FFT = 2048

/** Builds one analyser frame where the 200–2000 Hz band sits at `levelDb`. */
function frame(levelDb: number, now: number, floorDb = -85): Frame {
  const bins = new Float32Array(FFT / 2)
  const binHz = SAMPLE_RATE / FFT
  for (let i = 0; i < bins.length; i++) {
    const hz = i * binHz
    bins[i] = hz >= 200 && hz <= 2000 ? levelDb : floorDb
  }
  return { bins, sampleRate: SAMPLE_RATE, fftSize: FFT, now }
}

/**
 * Feeds the detector a synthetic breathing pattern and returns the onsets it
 * found, so the whole pipeline is exercised without a microphone.
 */
function runBreathing(opts: {
  breaths: number
  periodMs: number
  breathMs: number
  quietDb: number
  breathDb: number
}): { onsets: number[]; lastNow: number } {
  const { breaths, periodMs, breathMs, quietDb, breathDb } = opts
  const frameMs = 1000 / DEFAULT_CONFIG.fps
  let state = initialState()
  let now = 0
  // Let the noise floor settle on silence first, as it does in a real room.
  for (let i = 0; i < 90; i++) {
    state = step(state, frame(quietDb, now), DEFAULT_CONFIG).state
    now += frameMs
  }
  for (let b = 0; b < breaths; b++) {
    for (let t = 0; t < breathMs; t += frameMs) {
      state = step(state, frame(breathDb, now), DEFAULT_CONFIG).state
      now += frameMs
    }
    for (let t = 0; t < periodMs - breathMs; t += frameMs) {
      state = step(state, frame(quietDb, now), DEFAULT_CONFIG).state
      now += frameMs
    }
  }
  return { onsets: state.onsets, lastNow: now }
}

describe('bandEnergyDb', () => {
  it('averages only the breath band', () => {
    expect(bandEnergyDb(frame(-40, 0, -90))).toBeGreaterThan(-45)
    expect(bandEnergyDb(frame(-90, 0, -90))).toBeCloseTo(-90, 0)
  })

  it('survives silent bins reported as -Infinity', () => {
    const f = frame(-40, 0)
    f.bins[10] = -Infinity
    expect(Number.isFinite(bandEnergyDb(f))).toBe(true)
  })
})

describe('detector', () => {
  it('ignores noise until the floor is calibrated', () => {
    let state = initialState()
    const r = step(state, frame(-30, 0), DEFAULT_CONFIG)
    expect(r.breathStarted).toBe(false)
    expect(r.state.calibrated).toBe(false)
  })

  it('finds each breath in a steady pattern', () => {
    const { onsets } = runBreathing({ breaths: 6, periodMs: 6000, breathMs: 1800, quietDb: -85, breathDb: -55 })
    expect(onsets.length).toBeGreaterThanOrEqual(5)
  })

  it('does not fire on a quiet room', () => {
    const { onsets } = runBreathing({ breaths: 6, periodMs: 6000, breathMs: 1800, quietDb: -85, breathDb: -84 })
    expect(onsets).toHaveLength(0)
  })

  it('rejects clicks shorter than a breath', () => {
    const { onsets } = runBreathing({ breaths: 8, periodMs: 3000, breathMs: 100, quietDb: -85, breathDb: -50 })
    expect(onsets).toHaveLength(0)
  })

  it('adapts to a loud room instead of breaking', () => {
    const quiet = runBreathing({ breaths: 6, periodMs: 6000, breathMs: 1800, quietDb: -85, breathDb: -55 })
    const loud = runBreathing({ breaths: 6, periodMs: 6000, breathMs: 1800, quietDb: -45, breathDb: -15 })
    expect(loud.onsets.length).toBe(quiet.onsets.length)
  })
})

describe('breathsPerMinute', () => {
  it('reports the rate of a steady pattern', () => {
    const { onsets, lastNow } = runBreathing({ breaths: 8, periodMs: 6000, breathMs: 1800, quietDb: -85, breathDb: -55 })
    const bpm = breathsPerMinute(onsets, lastNow)
    expect(bpm).not.toBeNull()
    expect(bpm!).toBeGreaterThan(8)
    expect(bpm!).toBeLessThan(12)
  })

  it('stays null until there is enough evidence', () => {
    expect(breathsPerMinute([], 0)).toBeNull()
    expect(breathsPerMinute([0, 4000], 4000)).toBeNull()
  })

  it('shrugs off one missed breath', () => {
    // A doubled gap in the middle must not halve the reported rate.
    const onsets = [0, 5000, 10_000, 20_000, 25_000, 30_000]
    expect(breathsPerMinute(onsets, 30_000)).toBeCloseTo(12, 0)
  })
})

describe('patterns', () => {
  it('reports the advertised pace', () => {
    const coherence = PATTERNS.find((p) => p.id === 'coherence')!
    expect(breathsPerMinuteOf(coherence)).toBeCloseTo(5.5, 1)
    expect(cycleSeconds(PATTERNS.find((p) => p.id === 'box')!)).toBe(16)
  })

  it('walks the phases in order and loops', () => {
    const box = PATTERNS.find((p) => p.id === 'box')!
    expect(phaseAt(box, 1).phase).toBe('inhale')
    expect(phaseAt(box, 5).phase).toBe('holdIn')
    expect(phaseAt(box, 9).phase).toBe('exhale')
    expect(phaseAt(box, 13).phase).toBe('holdOut')
    expect(phaseAt(box, 17).phase).toBe('inhale')
  })

  it('skips zero-length phases', () => {
    const coherence = PATTERNS.find((p) => p.id === 'coherence')!
    expect(phaseAt(coherence, 6).phase).toBe('exhale')
  })

  it('expands on the way in and contracts on the way out', () => {
    const coherence = PATTERNS.find((p) => p.id === 'coherence')!
    expect(phaseAt(coherence, 0.1).expansion).toBeLessThan(0.2)
    expect(phaseAt(coherence, 5.4).expansion).toBeGreaterThan(0.9)
    expect(phaseAt(coherence, 10.9).expansion).toBeLessThan(0.1)
  })
})

describe('paceScale', () => {
  const coherence = PATTERNS.find((p) => p.id === 'coherence')!

  it('runs at the nominal pace for a calm start', () => {
    expect(paceScale({ pattern: coherence, startBpm: 5, elapsed: 0 })).toBe(1)
  })

  it('starts near the user and glides down', () => {
    const atStart = paceScale({ pattern: coherence, startBpm: 16, elapsed: 0 })
    const midway = paceScale({ pattern: coherence, startBpm: 16, elapsed: 60 })
    const later = paceScale({ pattern: coherence, startBpm: 16, elapsed: 130 })
    expect(atStart).toBeLessThan(0.5001)
    expect(midway).toBeGreaterThan(atStart)
    expect(later).toBe(1)
  })

  it('never chases a pace more than twice the target', () => {
    expect(paceScale({ pattern: coherence, startBpm: 40, elapsed: 0 })).toBeGreaterThanOrEqual(0.5)
  })

  it('leaves fixed patterns alone', () => {
    const fixed = PATTERNS.find((p) => p.id === '478')!
    expect(paceScale({ pattern: fixed, startBpm: 20, elapsed: 0 })).toBe(1)
  })

  it('falls back to the nominal pace when the mic heard nothing', () => {
    expect(paceScale({ pattern: coherence, startBpm: null, elapsed: 0 })).toBe(1)
  })
})

describe('calmScore', () => {
  it('rewards slowing down', () => {
    expect(calmScore(16, 7, 300)).toBeGreaterThan(calmScore(16, 15, 300))
  })

  it('still scores a session with no mic reading', () => {
    const s = calmScore(null, null, 300)
    expect(s).toBeGreaterThan(0)
    expect(s).toBeLessThanOrEqual(100)
  })

  it('stays within bounds at the extremes', () => {
    expect(calmScore(40, 3, 3600)).toBeLessThanOrEqual(100)
    expect(calmScore(6, 6, 5)).toBeGreaterThanOrEqual(0)
  })
})
