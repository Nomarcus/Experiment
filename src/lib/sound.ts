import type { Phase } from './pacing'

/**
 * Cues are synthesised with the Web Audio API, so the app ships no audio files
 * and still works with no network. They are deliberately soft: the point is to
 * be followable with your eyes closed, not to startle anyone.
 */

let ctx: AudioContext | null = null

function context(): AudioContext | null {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!ctx) ctx = new Ctx()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, delay: number, duration: number, gain: number): void {
  const ac = context()
  if (!ac) return
  const osc = ac.createOscillator()
  const vol = ac.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, ac.currentTime + delay)
  vol.gain.setValueAtTime(0.0001, ac.currentTime + delay)
  vol.gain.exponentialRampToValueAtTime(gain, ac.currentTime + delay + 0.08)
  vol.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + delay + duration)
  osc.connect(vol).connect(ac.destination)
  osc.start(ac.currentTime + delay)
  osc.stop(ac.currentTime + delay + duration + 0.05)
}

/** A distinct, quiet cue for each phase of the pattern. */
export function cue(phase: Phase): void {
  switch (phase) {
    case 'inhale':
      tone(523.25, 0, 0.5, 0.09)
      break
    case 'exhale':
      tone(392, 0, 0.7, 0.09)
      break
    case 'holdIn':
    case 'holdOut':
      tone(659.25, 0, 0.25, 0.05)
      break
  }
}

/** Warm three-note close when the session ends. */
export function finish(): void {
  tone(523.25, 0, 0.5, 0.1)
  tone(659.25, 0.22, 0.5, 0.09)
  tone(783.99, 0.44, 0.9, 0.09)
}

/** Browsers block audio until a gesture; call this from a click handler. */
export function unlockAudio(): void {
  context()
}
