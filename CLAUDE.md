# TimeWise — Agent Context

## Commands

```bash
npm test              # run all tests (vitest run)
npm run test:watch    # vitest watch mode
npm run coverage      # tests + V8 coverage (must stay ≥ 80% on all metrics)
npm run build         # tsc --noEmit then vite build → dist/
npm run dev           # vite dev with CRXJS hot reload
```

## Architecture

### Background service worker (single source of truth)

All mutable state lives in `chrome.storage.local`. The popup is a thin display layer — it sends typed messages to the SW and reads from storage. The SW can be suspended by Chrome at any time, so nothing important is kept in memory.

- `src/background/timeTracker.ts` — tracks the active tab domain and flushes elapsed seconds on tab/window/lock events and once per minute via a `chrome.alarms` flush alarm; persists tracking state (`TrackerState`) to storage so it survives SW suspension
- `src/background/pomodoroTimer.ts` — Pomodoro state machine; uses `startedAt` (epoch ms) + `elapsedSeconds` so remaining time can be recomputed after SW suspension; phase transitions driven by a named `chrome.alarms` entry (`"pomodoro_end"`)
- `src/background/messageHandler.ts` — single `chrome.runtime.onMessage` listener; switches on message type and delegates to the appropriate module
- `src/background/index.ts` — only registers Chrome event listeners; contains no business logic; excluded from coverage

### Popup (React)

- Two tabs: **Stats** and **Pomodoro**, rendered by `src/popup/App.tsx`
- `usePomodoroState` — syncs from SW on mount, then runs a 1-second `setInterval` for the visual countdown; re-syncs on SW phase-change push events
- `useTimeStats` — flushes the SW before fetching so data is always current
- `useSettings` — reads from storage on mount; writes via `UPDATE_SETTINGS` message so the SW can adjust the active timer duration

### Shared layer

- **`src/shared/storage.ts`** — the ONLY place that calls `chrome.storage.local`. All other files import from here. This keeps mocking simple in tests.
- **`src/shared/types.ts`** — single source of truth for all interfaces (`PomodoroState`, `PomodoroSettings`, `DailyUsage`, `TrackerState`, message union types)
- **`src/shared/timeUtils.ts`** — pure functions only; fully unit-tested

### Message protocol

```typescript
// Popup → SW (all handled in messageHandler.ts)
type PopupRequest =
  | { type: "GET_POMODORO_STATE" }
  | { type: "POMODORO_START" | "POMODORO_PAUSE" | "POMODORO_RESET" | "POMODORO_SKIP" }
  | { type: "UPDATE_SETTINGS"; payload: PomodoroSettings }
  | { type: "GET_USAGE"; payload: { dateKey: string } }
  | { type: "FLUSH_TIME" }

// SW → Popup (best-effort push on phase change)
{ type: "POMODORO_PHASE_CHANGE"; payload: PomodoroState }
```

### Storage key scheme

| Key | Value |
|---|---|
| `usage_YYYY-MM-DD` | `Record<hostname, seconds>` |
| `pomodoroState` | `PomodoroState` |
| `settings` | `PomodoroSettings` |
| `trackerState` | `TrackerState` — active tab, host, session start, focus flag, lock flag; recovered on SW wake-up |

## Testing

Chrome APIs are mocked globally in `src/__tests__/setup.ts` via `vi.stubGlobal("chrome", chromeMock)`. Every test file gets a clean mock via `vi.clearAllMocks()` in `beforeEach`.

**Do NOT use `vi.useFakeTimers()` in React component tests.** It fakes `setTimeout`, which breaks `waitFor` from `@testing-library/react`. Use it only in pure unit tests (timeUtils, storage, background modules).

**SW suspension tests** — `timeTracker.test.ts` has a `"service worker suspension recovery"` describe block that simulates Chrome killing the SW by calling `_resetState()` (wipes module vars) and mocking `chrome.storage.local.get` to return persisted `TrackerState`. Use this pattern when testing any new code that must survive SW restarts.

Coverage is configured in `vitest.config.ts`. The following are excluded:
- `src/__tests__/**`
- `src/background/index.ts` (pure wiring, no logic)
- `src/shared/types.ts` (type declarations only)
- `*.config.*`, `*.js`, `*.html`, `*.css`

## Key design decisions

**`startedAt` + `elapsedSeconds` for Pomodoro state** — not `remainingSeconds`. When the SW wakes from suspension, it recomputes: `remaining = duration - (elapsedSeconds + floor((Date.now() - startedAt) / 1000))`. A stored `remainingSeconds` would be stale.

**`chrome.alarms` for phase transitions** — alarms survive SW suspension. `setTimeout` does not.

**Popup-side countdown** — the popup runs its own 1-second `setInterval` rather than having the SW push ticks. SW-side ticking would fight Chrome's suspension logic and generate unnecessary wake-ups.

**Single storage boundary** — only `src/shared/storage.ts` touches `chrome.storage.local`. Migrating to IndexedDB in the future is a one-file change.

**Persisted tracker state** — `timeTracker.ts` persists `TrackerState` (active tab, host, session start, focus flag, lock flag) to storage on every state mutation and restores it lazily via `loadState()` on the first call after SW restart. This prevents time loss when Chrome suspends the SW while the user stays on a page.

**Idle vs locked** — the `"idle"` Chrome idle state (no mouse/keyboard activity) is intentionally ignored so passive consumption like watching a video is still tracked. Only `"locked"` (screen lock) pauses tracking, since a locked screen is an unambiguous signal the user is away.
