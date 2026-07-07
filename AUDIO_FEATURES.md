# Audio Features: Lofi Generator + Bell Sound

## Overview

Two audio features for the Pomodoro timer, both using Chrome's **Offscreen Document API** so audio plays in the background even when the popup is closed.

| Feature | Trigger | Stops |
|---|---|---|
| Lofi ambient music | Work session starts | Session ends / pause / skip |
| Bell sound | Any phase transition (work→break, break→work) | (one-shot, ~2 s) |

---

## New Files

### `src/offscreen/index.html`
Minimal HTML entry point for the offscreen document:
```html
<!doctype html>
<html>
  <head><meta charset="UTF-8" /></head>
  <body>
    <script type="module" src="./audioPlayer.ts"></script>
  </body>
</html>
```

### `src/offscreen/audioPlayer.ts`
Owns the `AudioContext` and all Web Audio nodes. Receives messages from the SW.

```typescript
let ctx: AudioContext | null = null;
let lofiNodes: { oscillators: OscillatorNode[]; lfo: OscillatorNode; master: GainNode } | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function playBell(): void {
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.7, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 2);
  osc.connect(gain).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + 2);
}

function startLofi(): void {
  if (lofiNodes) return; // already playing
  const ac = getCtx();

  // Chord roots (pentatonic): A2, B2, C#3, E3, F#3
  const ROOTS = [110, 123.47, 138.59, 164.81, 185];
  const root = ROOTS[0];

  const freqs = [root, root * 1.5, root * 2]; // root, fifth, octave
  const oscillators = freqs.map((f, i) => {
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    osc.detune.value = (i % 2 === 0 ? 1 : -1) * 4; // ±4 cents shimmer
    return osc;
  });

  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 600;

  const master = ac.createGain();
  master.gain.value = 0.12;

  oscillators.forEach(osc => osc.connect(filter));
  filter.connect(master);
  master.connect(ac.destination);
  oscillators.forEach(osc => osc.start());

  // LFO for slow breathing
  const lfo = ac.createOscillator();
  const lfoGain = ac.createGain();
  lfo.type = "sine";
  lfo.frequency.value = 0.08;
  lfoGain.gain.value = 0.04;
  lfo.connect(lfoGain).connect(master.gain);
  lfo.start();

  lofiNodes = { oscillators, lfo, master };

  // Chord changes every 12-20 s
  function scheduleChordChange(): void {
    const delay = 12000 + Math.random() * 8000;
    setTimeout(() => {
      if (!lofiNodes) return;
      const newRoot = ROOTS[Math.floor(Math.random() * ROOTS.length)];
      const newFreqs = [newRoot, newRoot * 1.5, newRoot * 2];
      lofiNodes.oscillators.forEach((osc, i) => {
        osc.frequency.linearRampToValueAtTime(newFreqs[i], ac.currentTime + 2);
      });
      scheduleChordChange();
    }, delay);
  }
  scheduleChordChange();
}

function stopLofi(): void {
  if (!lofiNodes) return;
  const ac = getCtx();
  lofiNodes.master.gain.linearRampToValueAtTime(0, ac.currentTime + 1);
  const nodes = lofiNodes;
  lofiNodes = null;
  setTimeout(() => {
    nodes.oscillators.forEach(o => o.stop());
    nodes.lfo.stop();
  }, 1100);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target !== "offscreen") return;
  if (msg.type === "PLAY_BELL") playBell();
  else if (msg.type === "START_LOFI") startLofi();
  else if (msg.type === "STOP_LOFI") stopLofi();
});
```

### `src/background/audioManager.ts`
Manages the offscreen document lifecycle and sends typed messages.

```typescript
const OFFSCREEN_URL = chrome.runtime.getURL("src/offscreen/index.html");

async function ensureOffscreenDocument(): Promise<void> {
  const existing = await chrome.offscreen.hasDocument();
  if (!existing) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: "Play lofi music and bell sounds during Pomodoro sessions",
    });
  }
}

async function send(type: string): Promise<void> {
  try {
    await ensureOffscreenDocument();
    await chrome.runtime.sendMessage({ type, target: "offscreen" });
  } catch {
    // offscreen unavailable — skip silently
  }
}

export const playBell = () => send("PLAY_BELL");
export const startLofi = () => send("START_LOFI");
export const stopLofi = () => send("STOP_LOFI");
```

---

## Modified Files

### `manifest.json`
Add `"offscreen"` to the permissions array:
```json
"permissions": ["tabs", "storage", "idle", "alarms", "notifications", "offscreen"]
```

### `vite.config.ts`
Add the offscreen HTML as a Rollup input so CRXJS bundles it:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    rollupOptions: {
      input: { offscreen: "src/offscreen/index.html" },
    },
  },
});
```

### `src/shared/types.ts`
Add two fields to `PomodoroSettings`:
```typescript
interface PomodoroSettings {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number;
  notificationsEnabled: boolean;
  lofiEnabled: boolean;   // NEW
  bellEnabled: boolean;   // NEW
}
```

### `src/shared/constants.ts`
Add defaults in `DEFAULT_SETTINGS`:
```typescript
export const DEFAULT_SETTINGS: PomodoroSettings = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  notificationsEnabled: true,
  lofiEnabled: true,   // NEW
  bellEnabled: true,   // NEW
};
```

### `src/background/pomodoroTimer.ts`
Import audioManager at the top:
```typescript
import * as audioManager from "./audioManager";
```

Then call audio at these 4 points (fire-and-forget, no `await`):

| Function | Where | Call |
|---|---|---|
| `startTimer()` | after `setPomodoroState(updated)` | `if (settings.lofiEnabled && updated.phase === "work") audioManager.startLofi()` |
| `pauseTimer()` | after `setPomodoroState(updated)` | `audioManager.stopLofi()` |
| `handleAlarm()` | after `setPomodoroState(updated)` | `audioManager.stopLofi(); if (settings.bellEnabled) audioManager.playBell()` |
| `skipPhase()` | after `setPomodoroState(updated)` | `audioManager.stopLofi()` |

`startTimer()` needs to read settings — it's already available via `getSettings()` at the top of that function, or add a `const settings = await getSettings()` call.

### `src/popup/components/pomodoro/Settings.tsx`
Add two toggles below the existing `notificationsEnabled` checkbox, using the same pattern:
```tsx
<label className="flex items-center gap-2 text-sm">
  <input
    type="checkbox"
    checked={draft.lofiEnabled}
    onChange={e => setDraft({ ...draft, lofiEnabled: e.target.checked })}
  />
  Lofi music during work sessions
</label>

<label className="flex items-center gap-2 text-sm">
  <input
    type="checkbox"
    checked={draft.bellEnabled}
    onChange={e => setDraft({ ...draft, bellEnabled: e.target.checked })}
  />
  Bell on session end
</label>
```

---

## Verification Steps

1. `npm run build` — must compile without errors
2. Load unpacked extension: `chrome://extensions/` → Load unpacked → select `dist/`
3. Start a work session → lofi drone should begin (check via OS audio mixer)
4. Close the popup → lofi should keep playing
5. Skip to break → bell should ring once, lofi should fade out
6. Toggle `lofiEnabled` off in settings → restart session → silence
7. Toggle `bellEnabled` off → skip phase → no bell
8. `npm test` — all existing tests must pass (Web Audio API is not testable in Vitest; no new tests needed)

---

## Notes

- The offscreen document with `AUDIO_PLAYBACK` reason stays alive as long as it's playing. If Chrome kills it (memory pressure), lofi won't auto-resume until the next user interaction. This is acceptable for an MVP.
- `startLofi()` is idempotent — calling it when already playing is a no-op.
- All audio calls in `pomodoroTimer.ts` are fire-and-forget (no `await`, errors silently ignored) so audio failures never break timer logic.
