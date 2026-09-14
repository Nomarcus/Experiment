import { useEffect, useRef, useState } from 'react'
import { breathsPerMinute, signalQuality } from '../lib/breath'
import { BreathMic, type MicStatus } from '../lib/mic'
import { breathsPerMinuteOf, calmScore, paceScale, phaseAt, type Pattern, type Phase } from '../lib/pacing'
import { cue } from '../lib/sound'
import { Orb } from './Orb'

export type SessionResult = {
  seconds: number
  startBpm: number | null
  endBpm: number | null
  score: number
}

export function Session({
  pattern,
  minutes,
  sound,
  haptics,
  onDone,
  onQuit,
}: {
  pattern: Pattern
  minutes: number
  sound: boolean
  haptics: boolean
  onDone: (r: SessionResult) => void
  onQuit: () => void
}) {
  const [elapsed, setElapsed] = useState(0)
  const [micStatus, setMicStatus] = useState<MicStatus>('idle')
  const [live, setLive] = useState(0)
  const [bpm, setBpm] = useState<number | null>(null)
  const [scale, setScale] = useState(1)

  // Refs hold everything the animation loop reads, so the loop never restarts.
  const startedAt = useRef(performance.now())
  const startBpm = useRef<number | null>(null)
  const lastBpm = useRef<number | null>(null)
  const lastPhase = useRef<Phase | null>(null)
  const onsets = useRef<number[]>([])
  const raf = useRef(0)
  const finished = useRef(false)

  const total = minutes * 60

  useEffect(() => {
    const mic = new BreathMic((result, now) => {
      setLive(signalQuality(result.aboveFloorDb))
      if (result.breathEnded) {
        onsets.current = result.state.onsets
        const rate = breathsPerMinute(onsets.current, now)
        if (rate !== null) {
          lastBpm.current = rate
          setBpm(rate)
          // The first solid reading sets the pace the session starts from.
          if (startBpm.current === null) startBpm.current = rate
        }
      }
    }, setMicStatus)
    void mic.start()
    return () => mic.stop()
  }, [])

  useEffect(() => {
    function frame() {
      const seconds = (performance.now() - startedAt.current) / 1000
      setElapsed(seconds)
      const s = paceScale({ pattern, startBpm: startBpm.current, elapsed: seconds })
      setScale(s)

      const info = phaseAt(pattern, seconds, s)
      if (lastPhase.current !== info.phase) {
        // A cue on every phase change is what lets people close their eyes.
        if (lastPhase.current !== null) {
          if (sound) cue(info.phase)
          if (haptics) navigator.vibrate?.(info.phase === 'inhale' ? 30 : 18)
        }
        lastPhase.current = info.phase
      }

      if (seconds >= total && !finished.current) {
        finished.current = true
        onDone({
          seconds: Math.round(seconds),
          startBpm: startBpm.current,
          endBpm: lastBpm.current,
          score: calmScore(startBpm.current, lastBpm.current, seconds),
        })
        return
      }
      raf.current = requestAnimationFrame(frame)
    }
    raf.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf.current)
  }, [pattern, total, sound, haptics, onDone])

  const info = phaseAt(pattern, elapsed, scale)
  const remaining = Math.max(0, total - elapsed)
  const targetBpm = breathsPerMinuteOf(pattern, scale)

  function endEarly() {
    if (finished.current) return
    finished.current = true
    const seconds = Math.round(elapsed)
    if (seconds < 20) {
      onQuit()
      return
    }
    onDone({
      seconds,
      startBpm: startBpm.current,
      endBpm: lastBpm.current,
      score: calmScore(startBpm.current, lastBpm.current, seconds),
    })
  }

  return (
    <div className={`session phase-${info.phase}`}>
      <div className="session-top">
        <button className="link" onClick={endEarly}>
          Finish
        </button>
        <span className="timeleft">{formatTime(remaining)}</span>
      </div>

      <Orb
        expansion={info.expansion}
        live={live}
        label={info.label}
        countdown={info.remaining}
        listening={micStatus === 'listening'}
      />

      <div className="session-readout">
        <Readout label="You" value={bpm !== null ? `${bpm.toFixed(1)}` : '–'} unit="breaths/min" />
        <Readout label="Pace" value={targetBpm.toFixed(1)} unit="breaths/min" />
      </div>

      <p className="micline">{micLine(micStatus, bpm, startBpm.current, scale)}</p>

      <div className="session-progress">
        <div className="bar" style={{ width: `${Math.min(100, (elapsed / total) * 100)}%` }} />
      </div>
    </div>
  )
}

function Readout({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="readout">
      <small>{label}</small>
      <strong>{value}</strong>
      <small>{unit}</small>
    </div>
  )
}

function micLine(status: MicStatus, bpm: number | null, startBpm: number | null, scale: number): string {
  switch (status) {
    case 'starting':
      return 'Waking the microphone…'
    case 'denied':
      return 'Microphone off — just follow the orb. Allow the mic to have Aria match your rhythm.'
    case 'unsupported':
      return 'This browser has no microphone access. The guided pace still works.'
    case 'error':
      return 'Could not open the microphone. The guided pace still works.'
    case 'listening':
      if (bpm === null) return 'Listening… breathe so you can just hear yourself.'
      if (startBpm !== null && scale < 0.98) return 'Matching your rhythm, then easing it down.'
      return 'Good. Stay with the orb.'
    default:
      return ''
  }
}

function formatTime(seconds: number): string {
  const s = Math.ceil(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
