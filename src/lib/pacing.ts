/**
 * The pacing side of the app: which breathing pattern is running, where in the
 * cycle we are right now, and how the target pace eases down to meet the user
 * instead of demanding they jump straight to a slow rate.
 */

export type Phase = 'inhale' | 'holdIn' | 'exhale' | 'holdOut'

export type Pattern = {
  id: string
  name: string
  description: string
  /** Seconds per phase at the pattern's nominal pace. */
  inhale: number
  holdIn: number
  exhale: number
  holdOut: number
  /** Patterns with a fixed ratio scale with pace; fixed ones never stretch. */
  scalable: boolean
}

export const PATTERNS: Pattern[] = [
  {
    id: 'coherence',
    name: 'Coherence',
    description: 'Even in, even out. The classic calm-down rhythm at about 5.5 breaths a minute.',
    inhale: 5.5,
    holdIn: 0,
    exhale: 5.5,
    holdOut: 0,
    scalable: true,
  },
  {
    id: 'extended',
    name: 'Long exhale',
    description: 'Breathe out twice as long as you breathe in. The fastest way down when you are wound up.',
    inhale: 4,
    holdIn: 0,
    exhale: 8,
    holdOut: 0,
    scalable: true,
  },
  {
    id: 'box',
    name: 'Box',
    description: 'Four counts each: in, hold, out, hold. Steadies a racing mind.',
    inhale: 4,
    holdIn: 4,
    exhale: 4,
    holdOut: 4,
    scalable: true,
  },
  {
    id: '478',
    name: '4-7-8',
    description: 'In for four, hold for seven, out for eight. Built for falling asleep.',
    inhale: 4,
    holdIn: 7,
    exhale: 8,
    holdOut: 0,
    scalable: false,
  },
]

export function cycleSeconds(p: Pattern, scale = 1): number {
  const s = p.scalable ? scale : 1
  return (p.inhale + p.holdIn + p.exhale + p.holdOut) * s
}

export function breathsPerMinuteOf(p: Pattern, scale = 1): number {
  return Math.round((60 / cycleSeconds(p, scale)) * 10) / 10
}

export type PhaseInfo = {
  phase: Phase
  /** 0–1 through the current phase. */
  t: number
  /** Seconds left in the current phase, for the countdown. */
  remaining: number
  /** 0–1 target size of the orb: 0 fully contracted, 1 fully expanded. */
  expansion: number
  label: string
}

/** Where in the pattern we are, `elapsed` seconds into the session. */
export function phaseAt(p: Pattern, elapsed: number, scale = 1): PhaseInfo {
  const s = p.scalable ? scale : 1
  const durations: [Phase, number][] = [
    ['inhale', p.inhale * s],
    ['holdIn', p.holdIn * s],
    ['exhale', p.exhale * s],
    ['holdOut', p.holdOut * s],
  ]
  const total = durations.reduce((n, [, d]) => n + d, 0)
  let pos = ((elapsed % total) + total) % total

  for (const [phase, duration] of durations) {
    if (duration <= 0) continue
    if (pos < duration) {
      const t = pos / duration
      return {
        phase,
        t,
        remaining: duration - pos,
        expansion: expansionFor(phase, t),
        label: LABELS[phase],
      }
    }
    pos -= duration
  }
  // Only reachable if every phase is zero; treat as a held inhale.
  return { phase: 'inhale', t: 0, remaining: 0, expansion: 1, label: LABELS.inhale }
}

const LABELS: Record<Phase, string> = {
  inhale: 'Breathe in',
  holdIn: 'Hold',
  exhale: 'Breathe out',
  holdOut: 'Hold',
}

function expansionFor(phase: Phase, t: number): number {
  switch (phase) {
    // Eased so the orb slows at the top and bottom, the way real breath does.
    case 'inhale':
      return ease(t)
    case 'exhale':
      return 1 - ease(t)
    case 'holdIn':
      return 1
    case 'holdOut':
      return 0
  }
}

function ease(t: number): number {
  return 0.5 - Math.cos(Math.PI * Math.min(1, Math.max(0, t))) / 2
}

/**
 * Picks the pace to run at. If the user is breathing much faster than the
 * pattern's nominal rate, the session starts near their own rate and glides
 * down over `rampSeconds` — chasing a pace you cannot reach is what makes
 * breathing exercises feel like failure.
 */
export function paceScale(opts: {
  pattern: Pattern
  /** Measured breaths per minute at the start, or null when the mic heard nothing. */
  startBpm: number | null
  elapsed: number
  rampSeconds?: number
}): number {
  const { pattern, startBpm, elapsed, rampSeconds = 120 } = opts
  if (!pattern.scalable || startBpm === null) return 1
  const nominal = breathsPerMinuteOf(pattern, 1)
  if (startBpm <= nominal) return 1
  // Never start more than twice as fast as the target, however fast they breathe.
  const startScale = Math.max(0.5, Math.min(1, nominal / startBpm))
  const progress = Math.min(1, Math.max(0, elapsed / rampSeconds))
  return startScale + (1 - startScale) * ease(progress)
}

/**
 * A 0–100 score for the session: how far the breathing rate came down, plus
 * credit for simply staying with it. Shown once, at the end, never live.
 */
export function calmScore(startBpm: number | null, endBpm: number | null, seconds: number): number {
  const duration = Math.min(1, seconds / 300) * 40
  if (startBpm === null || endBpm === null) return Math.round(duration + 30)
  const drop = Math.max(0, startBpm - endBpm)
  const slowness = Math.max(0, Math.min(1, (14 - endBpm) / 8)) * 30
  return Math.round(Math.min(100, duration + slowness + Math.min(30, drop * 6)))
}
