# TimeWise

A Chrome extension that tracks time spent on each website and includes a Pomodoro timer.

## Features

- **Stats tab** — see how long you spent on each domain today (or any of the past 7 days), sorted by usage with progress bars
- **Pomodoro tab** — focus timer with work / short break / long break phases, desktop notifications, and session history

## Getting started

**Prerequisites:** Node.js 18+

```bash
npm install
```

### Development

```bash
npm run dev
```

Then load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select the `dist/` folder
4. Pin the TimeWise icon from the toolbar puzzle-piece menu

The popup hot-reloads as you edit source files. After changing background service worker code, click **Update** in `chrome://extensions`.

### Production build

```bash
npm run build
```

Output goes to `dist/`. Load that folder as an unpacked extension (same steps above).

### Tests

```bash
npm test              # run all tests
npm run test:watch    # watch mode
npm run coverage      # tests + coverage report (threshold: 80%)
```

## Project structure

```
src/
├── background/             # Chrome service worker
│   ├── index.ts            # Event listener registration
│   ├── timeTracker.ts      # Per-domain time tracking logic
│   ├── pomodoroTimer.ts    # Pomodoro state machine + alarms
│   └── messageHandler.ts  # Popup ↔ SW message router
│
├── popup/                  # React UI
│   ├── App.tsx             # Tab shell (Stats | Pomodoro)
│   ├── components/
│   │   ├── stats/          # StatsTab, StatsHeader, SiteList, SiteRow
│   │   └── pomodoro/       # PomodoroTab, TimerDisplay, TimerControls, Settings
│   └── hooks/
│       ├── useTimeStats.ts       # Fetches usage data from SW
│       ├── usePomodoroState.ts   # Syncs timer state + local countdown
│       └── useSettings.ts        # Read/write Pomodoro settings
│
├── shared/                 # Shared across background and popup
│   ├── types.ts            # All TypeScript interfaces
│   ├── constants.ts        # Defaults, alarm names, storage keys
│   ├── storage.ts          # Typed chrome.storage.local wrappers
│   ├── timeUtils.ts        # formatTime, toDateKey, getLast7Days
│   └── messages.ts         # sendMessage helper
│
└── __tests__/              # Tests mirror the src structure
    ├── setup.ts            # Global chrome API mock
    ├── background/
    ├── shared/
    └── popup/
```

## Tech stack

| Concern | Tool |
|---|---|
| UI | React 18 + TypeScript |
| Bundler | Vite + @crxjs/vite-plugin |
| Styling | Tailwind CSS |
| Testing | Vitest + @testing-library/react |
| Coverage | V8 (threshold: 80%) |
| Storage | chrome.storage.local |
