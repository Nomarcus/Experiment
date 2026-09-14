/**
 * The breathing orb. Two rings: the solid one is the pace the app is asking
 * for, the soft outer glow is what the microphone is actually hearing — so the
 * gap between them is the whole feedback loop, visible at a glance.
 */
export function Orb({
  expansion,
  live,
  label,
  countdown,
  listening,
}: {
  expansion: number
  /** 0–1 live mic energy above the room's noise floor. */
  live: number
  label: string
  countdown: number
  listening: boolean
}) {
  const size = 40 + expansion * 46
  const liveSize = size + live * 22

  return (
    <div className="orb-wrap" aria-live="polite">
      {listening && (
        <div className="orb-live" style={{ width: `${liveSize}%`, opacity: 0.18 + live * 0.5 }} />
      )}
      <div className="orb" style={{ width: `${size}%` }}>
        <div className="orb-inner" />
      </div>
      <div className="orb-text">
        <span className="orb-label">{label}</span>
        <span className="orb-count">{Math.ceil(countdown)}</span>
      </div>
    </div>
  )
}
