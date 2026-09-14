import { useEffect, useRef } from 'react'

/**
 * The single advertising surface. Ads never appear during a session — a breathing
 * app that interrupts your breathing has nothing to sell twice — so slots only
 * render on the home and summary screens.
 *
 * With no ad client configured (VITE_AD_CLIENT / VITE_AD_SLOT) this renders a
 * house promo instead of an empty box, which is also what ships in screenshots.
 */
const AD_CLIENT = import.meta.env.VITE_AD_CLIENT as string | undefined
const AD_SLOT = import.meta.env.VITE_AD_SLOT as string | undefined

export function AdSlot({ placement }: { placement: 'home' | 'summary' }) {
  const ref = useRef<HTMLModElement>(null)
  const pushed = useRef(false)

  useEffect(() => {
    if (!AD_CLIENT || !AD_SLOT || pushed.current || !ref.current) return
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] }
      w.adsbygoogle = w.adsbygoogle ?? []
      w.adsbygoogle.push({})
      pushed.current = true
    } catch {
      /* Ad blocked or script missing: the slot stays empty, app unaffected. */
    }
  }, [])

  if (!AD_CLIENT || !AD_SLOT) {
    return (
      <div className="adslot house">
        <strong>Breathe with your own rhythm</strong>
        <span>
          {placement === 'home'
            ? 'Aria listens and slows down with you. No account, no upload, works on a plane.'
            : 'Come back tomorrow to keep your streak alive.'}
        </span>
      </div>
    )
  }

  return (
    <div className="adslot">
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={AD_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
