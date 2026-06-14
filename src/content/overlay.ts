const BANNER_ID = "timewise-overlay";

function getOrCreateBanner(): HTMLElement {
  let el = document.getElementById(BANNER_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = BANNER_ID;
    el.style.cssText = [
      "position:fixed",
      "bottom:0",
      "left:0",
      "right:0",
      "z-index:2147483647",
      "background:#1f2937",
      "color:#f9fafb",
      "font-family:system-ui,sans-serif",
      "font-size:13px",
      "padding:8px 16px",
      "display:none",
      "align-items:center",
      "gap:8px",
      "box-shadow:0 -2px 8px rgba(0,0,0,0.25)",
    ].join(";");
    document.body.appendChild(el);
  }
  return el;
}

type PartialState = { phase: string; running: boolean; currentTask: string } | null;

function updateBanner(state: PartialState): void {
  const el = getOrCreateBanner();
  if (state?.phase === "work" && state.running) {
    el.style.display = "flex";
    el.textContent = state.currentTask
      ? `Focus: ${state.currentTask}`
      : "Focus session in progress";
  } else {
    el.style.display = "none";
  }
}

chrome.storage.local.get("pomodoroState").then((result) => {
  updateBanner((result.pomodoroState as PartialState) ?? null);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.pomodoroState) return;
  updateBanner((changes.pomodoroState.newValue as PartialState) ?? null);
});
