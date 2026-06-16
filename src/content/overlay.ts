const BANNER_ID = "timewise-overlay";

type PartialState = {
  phase: string;
  running: boolean;
  currentTask: string;
  startedAt: number | null;
  elapsedSeconds: number;
  durationSeconds: number;
} | null;

let currentState: PartialState = null;
let dismissed = false;
let peekShown = false;
let tickInterval: ReturnType<typeof setInterval> | null = null;

// px from top that triggers peek — covers the banner (top:12 + height:34) plus a margin
const PEEK_THRESHOLD = 54;

function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function computeRemaining(state: NonNullable<PartialState>): number {
  if (!state.running || state.startedAt === null) {
    return state.durationSeconds - state.elapsedSeconds;
  }
  const elapsed =
    state.elapsedSeconds + Math.floor((Date.now() - state.startedAt) / 1000);
  return state.durationSeconds - elapsed;
}

function getOrCreateBanner(): HTMLElement {
  let el = document.getElementById(BANNER_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = BANNER_ID;
    el.style.cssText = [
      "position:fixed",
      "top:12px",
      "left:50%",
      "transform:translateX(-50%) translateY(-80px)",
      "z-index:2147483647",
      // Glassmorphism
      "background:rgba(55,48,163,0.45)",
      "backdrop-filter:blur(16px) saturate(180%)",
      "-webkit-backdrop-filter:blur(16px) saturate(180%)",
      // Bevel border: lighter on top, slightly darker on bottom
      "border:1px solid rgba(255,255,255,0.22)",
      "box-shadow:" + [
        "inset 0 1px 0 rgba(255,255,255,0.35)",   // bevel top highlight
        "inset 0 -1px 0 rgba(0,0,0,0.18)",        // bevel bottom shadow
        "0 4px 24px rgba(79,70,229,0.35)",         // colored glow
        "0 2px 8px rgba(0,0,0,0.18)",              // drop shadow
      ].join(","),
      // Shape & layout
      "border-radius:999px",
      "padding:0 14px",
      "height:34px",
      "display:none",
      "align-items:center",
      "gap:8px",
      // Typography
      "font-family:system-ui,sans-serif",
      "font-size:13px",
      "font-weight:500",
      "color:rgba(255,255,255,0.95)",
      "white-space:nowrap",
      // Slide-in transition
      "transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1),opacity 0.25s ease",
      "opacity:0",
    ].join(";");
    document.body.appendChild(el);
  }
  return el;
}

function renderBanner(el: HTMLElement, state: NonNullable<PartialState>): void {
  const icon = document.createElement("span");
  icon.textContent = "🍅";
  icon.style.cssText = "font-size:13px;flex-shrink:0";

  const text = document.createElement("span");
  text.style.cssText =
    "max-width:220px;overflow:hidden;text-overflow:ellipsis;color:rgba(255,255,255,0.85)";
  text.textContent = state.currentTask
    ? `Focus: ${state.currentTask}`
    : "Focus session";

  const sep = document.createElement("span");
  sep.textContent = "·";
  sep.style.cssText = "color:rgba(255,255,255,0.35);flex-shrink:0";

  const timer = document.createElement("span");
  timer.id = "timewise-countdown";
  timer.style.cssText =
    "font-variant-numeric:tabular-nums;flex-shrink:0;color:rgba(255,255,255,0.95);font-weight:600;letter-spacing:0.04em";
  timer.textContent = formatTime(computeRemaining(state));

  const dismissBtn = document.createElement("button");
  dismissBtn.textContent = "✕";
  dismissBtn.style.cssText = [
    "background:none",
    "border:none",
    "color:rgba(255,255,255,0.4)",
    "cursor:pointer",
    "font-size:11px",
    "padding:0 0 0 4px",
    "line-height:1",
    "flex-shrink:0",
    "transition:color 0.15s",
  ].join(";");
  dismissBtn.addEventListener("mouseover", () => {
    dismissBtn.style.color = "rgba(255,255,255,0.85)";
  });
  dismissBtn.addEventListener("mouseout", () => {
    dismissBtn.style.color = "rgba(255,255,255,0.4)";
  });
  dismissBtn.addEventListener("click", () => {
    dismissed = true;
    peekShown = false;
    hideBanner(el);
    stopTick();
  });

  el.innerHTML = "";
  el.appendChild(icon);
  el.appendChild(text);
  el.appendChild(sep);
  el.appendChild(timer);
  el.appendChild(dismissBtn);
}

function showBanner(el: HTMLElement): void {
  el.style.display = "flex";
  el.getBoundingClientRect(); // force reflow so transition fires
  el.style.transform = "translateX(-50%) translateY(0)";
  el.style.opacity = "1";
}

function hideBanner(el: HTMLElement): void {
  el.style.transform = "translateX(-50%) translateY(-80px)";
  el.style.opacity = "0";
  setTimeout(() => {
    el.style.display = "none";
  }, 300);
}

function stopTick(): void {
  if (tickInterval !== null) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

function startTick(el: HTMLElement): void {
  stopTick();
  tickInterval = setInterval(() => {
    if (!currentState?.running) return;
    const countdown = el.querySelector<HTMLElement>("#timewise-countdown");
    if (countdown) countdown.textContent = formatTime(computeRemaining(currentState));
  }, 1000);
}

function peekBanner(): void {
  if (!dismissed) return;
  const isActive = currentState?.phase === "work" && currentState?.running;
  if (!isActive) return;
  peekShown = true;
  const el = getOrCreateBanner();
  renderBanner(el, currentState!);
  showBanner(el);
  startTick(el);
}

function unpeekBanner(): void {
  peekShown = false;
  const el = document.getElementById(BANNER_ID);
  if (el) hideBanner(el);
  stopTick();
}

document.addEventListener("mousemove", (e: MouseEvent) => {
  if (!dismissed) return;
  if (e.clientY < PEEK_THRESHOLD) {
    if (!peekShown) peekBanner();
  } else if (peekShown) {
    unpeekBanner();
  }
});

function updateBanner(state: PartialState): void {
  const isActive = state?.phase === "work" && state.running;

  if (!isActive) {
    dismissed = false;
    peekShown = false;
    const el = document.getElementById(BANNER_ID);
    if (el) hideBanner(el);
    stopTick();
    return;
  }

  if (dismissed) return;

  const el = getOrCreateBanner();
  renderBanner(el, state);
  showBanner(el);
  startTick(el);
}

chrome.storage.local.get("pomodoroState").then((result) => {
  currentState = (result.pomodoroState as PartialState) ?? null;
  updateBanner(currentState);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.pomodoroState) return;
  const newState = (changes.pomodoroState.newValue as PartialState) ?? null;
  if (newState?.running && !currentState?.running) dismissed = false;
  currentState = newState;
  updateBanner(currentState);
});
