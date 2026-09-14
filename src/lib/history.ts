export type SessionRecord = {
  /** ISO date, YYYY-MM-DD. */
  date: string
  patternId: string
  seconds: number
  startBpm: number | null
  endBpm: number | null
  score: number
}

const KEY = 'aria.history.v1'
const PREFS = 'aria.prefs.v1'

export type Prefs = {
  patternId: string
  minutes: number
  sound: boolean
  haptics: boolean
}

export const DEFAULT_PREFS: Prefs = { patternId: 'coherence', minutes: 5, sound: true, haptics: true }

/** localStorage throws in private windows and when site data is blocked. */
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* History simply does not persist this session. */
  }
}

export const loadHistory = (): SessionRecord[] => read<SessionRecord[]>(KEY, [])
export const loadPrefs = (): Prefs => ({ ...DEFAULT_PREFS, ...read<Partial<Prefs>>(PREFS, {}) })
export const savePrefs = (p: Prefs): void => write(PREFS, p)

export function addSession(record: SessionRecord): SessionRecord[] {
  // 400 sessions is over a year of daily use and still a tiny payload.
  const next = [...loadHistory(), record].slice(-400)
  write(KEY, next)
  return next
}

/** Consecutive days practised, counting back from today. */
export function streakOf(history: SessionRecord[]): number {
  const days = new Set(history.map((h) => h.date))
  if (days.size === 0) return 0
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const cursor = new Date()
  // Yesterday still counts until today's session is done.
  if (!days.has(iso(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!days.has(iso(cursor))) return 0
  }
  let streak = 0
  while (days.has(iso(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function totalMinutes(history: SessionRecord[]): number {
  return Math.round(history.reduce((n, h) => n + h.seconds, 0) / 60)
}

/** Best drop in breathing rate achieved in any session, for the stats row. */
export function bestDrop(history: SessionRecord[]): number | null {
  const drops = history
    .filter((h) => h.startBpm !== null && h.endBpm !== null)
    .map((h) => h.startBpm! - h.endBpm!)
    .filter((d) => d > 0)
  return drops.length > 0 ? Math.round(Math.max(...drops) * 10) / 10 : null
}
