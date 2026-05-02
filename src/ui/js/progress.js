import { state } from "./state.js";
import { els, setProgress, setStatus } from "./dom.js";
import { parseLocaleNumber } from "./format.js";

let logLines = 0;
let rlTimer = null;
let rlUntil = 0;
let inRateLimitMode = false;

export function appendLog(msg, meta = {}, ts = Date.now()) {
  const t = new Date(ts);
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  const ss = String(t.getSeconds()).padStart(2, "0");

  const line = document.createElement("div");
  line.className = "ll";

  const lvl = (meta.level || "").toLowerCase();
  if (lvl) line.classList.add(lvl);

  if (meta.kind === "ratelimit") line.classList.add("warn");
  if (meta.kind === "retry") line.classList.add("warn");

  line.textContent = `[${hh}:${mm}:${ss}] ${msg}`;
  els.logEl.appendChild(line);

  logLines++;
  els.logCountEl.textContent = `${logLines} line${logLines === 1 ? "" : "s"}`;

  const nearBottom = els.logEl.scrollTop + els.logEl.clientHeight >= els.logEl.scrollHeight - 120;
  if (nearBottom) els.logEl.scrollTop = els.logEl.scrollHeight;
}

export function stopRateLimitCountdown() {
  if (rlTimer) clearInterval(rlTimer);
  rlTimer = null;
  rlUntil = 0;
  inRateLimitMode = false;
}

export function startRateLimitCountdown(delayMs) {
  if (typeof delayMs !== "number" || !isFinite(delayMs) || delayMs <= 0) return;
  if (rlTimer) clearInterval(rlTimer);
  rlUntil = Date.now() + delayMs;
  inRateLimitMode = true;

  const tick = () => {
    if (!inRateLimitMode) return;
    const left = Math.max(0, rlUntil - Date.now());
    const ms = Math.ceil(left);
    if (ms <= 0) {
      stopRateLimitCountdown();
      return;
    }
    setStatus("Rate limited", "working");
    setProgress(
      Math.max(5, parseFloat(els.progressFill.style.width) || 5),
      `Ratelimited. Retrying in ${ms.toLocaleString()} ms...`,
      "429",
      "warn"
    );
  };

  tick();
  rlTimer = setInterval(tick, 120);
}

export function hardClearRateLimit() {
  stopRateLimitCountdown();
  if (state.scanning) setStatus("Scanning...", "working");
}

function friendlyKind(rawLabel) {
  const l = String(rawLabel || "").trim().toLowerCase();

  if (l === "purchase") return { noun: "purchase", chip: "Purchases" };
  if (l === "currencypurchase") return { noun: "robux bought", chip: "Bought" };
  if (l === "premiumstipend") return { noun: "premium stipend", chip: "Premium" };
  if (l === "engagementpayout") return { noun: "engagement payout", chip: "Engagement" };
  if (l === "grouppayout") return { noun: "group payout", chip: "Group" };
  if (l === "sale") return { noun: "sale", chip: "Sales" };
  if (l === "traderobux") return { noun: "trade", chip: "Trades" };
  if (l === "currencytransfer") return { noun: "robux transfer", chip: "Transfers" };

  if (l.includes("premium")) return { noun: "premium transaction", chip: "Premium" };
  if (l.includes("currency") || l.includes("robux")) return { noun: "robux transaction", chip: "Robux" };
  return { noun: "transaction", chip: rawLabel };
}

const pluralize = (noun, n) => (n === 1 ? noun : `${noun}s`);

export function handleProgress({ msg, meta, ts }) {
  appendLog(msg, meta, ts);

  const clearRLIfNeeded = () => {
    if (inRateLimitMode) hardClearRateLimit();
  };

  if (/^Fetched\s/i.test(msg)) hardClearRateLimit();

  if (meta?.status === 429 || meta?.kind === "ratelimit") {
    if (typeof meta.delayMs === "number") startRateLimitCountdown(meta.delayMs);
  } else {
    clearRLIfNeeded();
  }

  const rules = [
    {
      re: /^Fetched\s([\d.,\s]+)\s+(.+?)\s+tx\s+\(page\s+(\d+)\)/i,
      run: (m) => {
        const count = parseLocaleNumber(m[1]);
        const rawLabel = m[2].trim();
        const { noun, chip } = friendlyKind(rawLabel);
        const label = pluralize(noun, count);
        const pct = Math.min(95, 10 + Math.log10(1 + count) * 18);
        setStatus("Scanning...", "working");
        setProgress(pct, `Scanned ${count.toLocaleString()} ${label}`, chip ? String(chip) : null, "good");
      },
    },
    {
      re: /Authenticating/i,
      run: () => {
        hardClearRateLimit();
        setStatus("Scanning...", "working");
        setProgress(3, "Authenticating...");
      },
    },
    {
      re: /Authenticated/i,
      run: () => {
        hardClearRateLimit();
        setStatus("Scanning...", "working");
        setProgress(6, "Authenticated. Scanning...");
      },
    },
    {
      re: /Computing totals/i,
      run: () => {
        hardClearRateLimit();
        setStatus("Scanning...", "working");
        setProgress(95, "Computing totals...", "finalizing", null);
      },
    },
    {
      re: /Computing leaderboards/i,
      run: () => {
        hardClearRateLimit();
        setStatus("Scanning...", "working");
        setProgress(96, "Computing leaderboards...", "leaderboards", null);
      },
    },
    {
      re: /Computing spend over time/i,
      run: () => {
        hardClearRateLimit();
        setStatus("Scanning...", "working");
        setProgress(96, "Computing spend over time...", "series", null);
      },
    },
    {
      re: /Computing Robux spend over time/i,
      run: () => {
        hardClearRateLimit();
        setStatus("Scanning...", "working");
        setProgress(96, "Computing spend over time...", "series", null);
      },
    },
    {
      re: /Computing USD spend over time/i,
      run: () => {
        hardClearRateLimit();
        setStatus("Scanning...", "working");
        setProgress(96, "Computing spend over time...", "series", null);
      },
    },
    {
      re: /Fetching current Robux balance/i,
      run: () => {
        hardClearRateLimit();
        setStatus("Scanning...", "working");
        setProgress(97, "Fetching current balance...", "balance", null);
      },
    },
    {
      re: /Scanning Robux inflow/i,
      run: () => {
        hardClearRateLimit();
        setStatus("Scanning...", "working");
        setProgress(98, "Scanning Robux inflow...", "inflow", null);
      },
    },
    {
      re: /Fetching inflow:/i,
      run: () => {
        hardClearRateLimit();
        setStatus("Scanning...", "working");
        setProgress(98, "Fetching inflow transactions...", "inflow", "good");
      },
    },
    {
      re: /Done/i,
      run: () => {
        stopRateLimitCountdown();
        setStatus("Complete");
        setProgress(100, "Complete", "done", "good");
      },
    },
    {
      re: /Error:/i,
      run: () => {
        stopRateLimitCountdown();
        setStatus("Error", "error");
        setProgress(0, "Failed", "error", "bad");
      },
    },
  ];

  for (const r of rules) {
    const m = r.re.exec(msg);
    if (m) {
      r.run(m);
      break;
    }
  }
}

export function bindProgressEvents() {
  els.clearLogBtn.addEventListener("click", () => {
    els.logEl.innerHTML = "";
    logLines = 0;
    els.logCountEl.textContent = "0 lines";
  });

  window.api.onProgress(handleProgress);
}
