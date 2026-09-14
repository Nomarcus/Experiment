# Aria — breathing that listens back

A calm-down coach for the phone. The microphone hears you breathing, the app works
out your actual breathing rate, and the pacing **starts near your rhythm and eases
down** instead of demanding you jump straight to a slow one.

Nothing is recorded, stored or uploaded. The audio graph ends at an analyser node —
there is no recorder and no network call anywhere in the app. It runs fully offline.

## Why this can be a business

- **Global by construction.** No language-specific content, no local rules, no
  content library to license. Ships in one build to every country.
- **No backend, so no marginal cost.** Static files on a CDN. A million sessions
  cost the same as ten. That is what makes an ad-funded model actually work.
- **Installs like an app.** It is a PWA: Safari on iPhone can add it to the home
  screen, where it opens full-screen, offline, with its own icon.
- **Demonstrable in five seconds.** The orb moves with your breathing. That is the
  whole advertisement.

Revenue is ad-funded (the user's choice): a single ad slot on the home and summary
screens, never during a session. See `src/components/AdSlot.tsx`.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 22 unit tests over the signal chain and pacing
npm run build      # static site in dist/
```

Deploy `dist/` to any static host. For a GitHub Pages project site build with
`BASE_PATH=/<repo>/ npm run build`.

## Configuration

Copy `.env.example` to `.env`:

| Variable | Purpose |
| --- | --- |
| `VITE_AD_CLIENT` | AdSense publisher id. Unset renders a house promo instead. |
| `VITE_AD_SLOT` | AdSense slot id. |
| `BASE_PATH` | Sub-path when hosting under a folder, e.g. `/aria/`. |

With no ad ids configured the app ships a house promo in the slot, so screenshots
and the first launch never show an empty box.

## How the breath detection works

`src/lib/breath.ts` is the whole signal chain, written as pure functions so it can
be tested without a microphone:

1. **Band energy.** Breath is broadband noise, not pitch, so the detector averages
   the 200–2000 Hz bins rather than looking for a fundamental.
2. **Adaptive noise floor.** The floor only tracks quiet frames, so a long breath
   cannot drag it upward and silence it. This is what lets the same thresholds work
   in a quiet bedroom and a noisy room — there is a test for exactly that.
3. **Hysteresis.** A breath starts at +6 dB over the floor and ends at +2.5 dB, so
   the envelope crossing the threshold once does not produce a burst of breaths.
4. **Median interval.** The rate comes from the median gap between onsets, so one
   missed or doubled breath cannot swing the number.

`src/lib/pacing.ts` decides what to ask of the user. If you start at 16 breaths a
minute, a 5.5/min target is unreachable; `paceScale` begins near your own rate
(never more than 2× the target) and glides to the nominal pace over two minutes.

## Layout

```
src/lib/breath.ts     microphone signal chain (pure, tested)
src/lib/pacing.ts     patterns, phase maths, adaptive pace, calm score (pure, tested)
src/lib/mic.ts        getUserMedia + AnalyserNode wiring
src/lib/sound.ts      synthesised phase cues, no audio files
src/lib/history.ts    localStorage history, streaks
src/components/       Orb, Session, AdSlot
src/App.tsx           home, summary, preferences
public/sw.js          offline cache
scripts/make-icons.mjs  generates the PNG icons with no image dependencies
```

## What is deliberately not here

- No account, no sync, no server. Adding one would mean handling health-adjacent
  data, which is the opposite of the promise the app makes.
- No health claims. Aria measures the rate of audible breathing and paces you; it
  is not a medical device and does not diagnose anything.
