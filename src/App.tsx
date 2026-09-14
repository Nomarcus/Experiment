import { useState } from 'react'
import { AdSlot } from './components/AdSlot'
import { Session, type SessionResult } from './components/Session'
import {
  addSession,
  bestDrop,
  loadHistory,
  loadPrefs,
  savePrefs,
  streakOf,
  totalMinutes,
  type SessionRecord,
} from './lib/history'
import { breathsPerMinuteOf, PATTERNS } from './lib/pacing'
import { finish, unlockAudio } from './lib/sound'

type View = 'home' | 'session' | 'summary'

const MINUTE_CHOICES = [2, 5, 10, 15]

export default function App() {
  const [view, setView] = useState<View>('home')
  const [prefs, setPrefs] = useState(loadPrefs)
  const [history, setHistory] = useState<SessionRecord[]>(loadHistory)
  const [last, setLast] = useState<SessionResult | null>(null)

  const pattern = PATTERNS.find((p) => p.id === prefs.patternId) ?? PATTERNS[0]

  function update(patch: Partial<typeof prefs>) {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    savePrefs(next)
  }

  function begin() {
    // Audio must be unlocked inside the gesture that starts the session.
    unlockAudio()
    setView('session')
  }

  function complete(result: SessionResult) {
    finish()
    setLast(result)
    setHistory(
      addSession({
        date: new Date().toISOString().slice(0, 10),
        patternId: pattern.id,
        seconds: result.seconds,
        startBpm: result.startBpm,
        endBpm: result.endBpm,
        score: result.score,
      }),
    )
    setView('summary')
  }

  if (view === 'session') {
    return (
      <Session
        pattern={pattern}
        minutes={prefs.minutes}
        sound={prefs.sound}
        haptics={prefs.haptics}
        onDone={complete}
        onQuit={() => setView('home')}
      />
    )
  }

  if (view === 'summary' && last) {
    return <Summary result={last} streak={streakOf(history)} onHome={() => setView('home')} onAgain={begin} />
  }

  return (
    <div className="home">
      <header className="hero">
        <h1>Aria</h1>
        <p>Breathing that listens back.</p>
      </header>

      <div className="stats">
        <Stat value={String(streakOf(history))} label="day streak" />
        <Stat value={String(totalMinutes(history))} label="minutes" />
        <Stat value={bestDrop(history) !== null ? `−${bestDrop(history)}` : '–'} label="best slowdown" />
      </div>

      <section className="picker">
        <h2>Pattern</h2>
        <div className="patterns">
          {PATTERNS.map((p) => (
            <button
              key={p.id}
              className={p.id === pattern.id ? 'pattern on' : 'pattern'}
              onClick={() => update({ patternId: p.id })}
            >
              <strong>{p.name}</strong>
              <small>{p.description}</small>
              <span className="rate">{breathsPerMinuteOf(p)} breaths/min</span>
            </button>
          ))}
        </div>
      </section>

      <section className="picker">
        <h2>Length</h2>
        <div className="chips">
          {MINUTE_CHOICES.map((m) => (
            <button key={m} className={m === prefs.minutes ? 'chip on' : 'chip'} onClick={() => update({ minutes: m })}>
              {m} min
            </button>
          ))}
        </div>
        <div className="chips">
          <button className={prefs.sound ? 'chip on' : 'chip'} onClick={() => update({ sound: !prefs.sound })}>
            {prefs.sound ? '🔔 Sound on' : '🔕 Sound off'}
          </button>
          <button className={prefs.haptics ? 'chip on' : 'chip'} onClick={() => update({ haptics: !prefs.haptics })}>
            {prefs.haptics ? '📳 Vibration on' : '📴 Vibration off'}
          </button>
        </div>
      </section>

      <button className="btn primary huge" onClick={begin}>
        Start
      </button>

      <p className="privacy">
        Aria listens through the microphone to find your rhythm. Nothing is recorded, stored or uploaded — the
        audio never leaves this device, and the whole app works offline.
      </p>

      <AdSlot placement="home" />

      {history.length > 0 && (
        <section className="picker">
          <h2>Recent</h2>
          <ul className="history">
            {[...history]
              .slice(-7)
              .reverse()
              .map((h, i) => (
                <li key={`${h.date}-${i}`}>
                  <span>{h.date}</span>
                  <span>{PATTERNS.find((p) => p.id === h.patternId)?.name ?? h.patternId}</span>
                  <span>{Math.round(h.seconds / 60)} min</span>
                  <span className="score">{h.score}</span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Summary({
  result,
  streak,
  onHome,
  onAgain,
}: {
  result: SessionResult
  streak: number
  onHome: () => void
  onAgain: () => void
}) {
  const drop =
    result.startBpm !== null && result.endBpm !== null ? Math.round((result.startBpm - result.endBpm) * 10) / 10 : null

  return (
    <div className="summary">
      <h1>{result.score}</h1>
      <p className="scorelabel">calm score</p>

      <div className="stats">
        {result.seconds >= 60 ? (
          <Stat value={`${Math.round(result.seconds / 60)}`} label="minutes" />
        ) : (
          <Stat value={`${result.seconds}`} label="seconds" />
        )}
        <Stat value={result.startBpm !== null ? result.startBpm.toFixed(1) : '–'} label="start rate" />
        <Stat value={result.endBpm !== null ? result.endBpm.toFixed(1) : '–'} label="end rate" />
      </div>

      <p className="verdict">
        {drop !== null && drop > 0.5
          ? `You slowed down by ${drop} breaths a minute.`
          : drop !== null
            ? 'Your rate held steady. That counts too.'
            : 'No mic reading this time — the pacing still did its work.'}
      </p>
      <p className="verdict">{streak > 1 ? `${streak} days in a row.` : 'Come back tomorrow to start a streak.'}</p>

      <AdSlot placement="summary" />

      <div className="row">
        <button className="btn primary" onClick={onAgain}>
          Again
        </button>
        <button className="btn" onClick={onHome}>
          Done
        </button>
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  )
}
