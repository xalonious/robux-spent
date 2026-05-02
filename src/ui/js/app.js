import { state } from "./state.js";
import { els, setProgress, setStatus } from "./dom.js";
import { drawChart, setGranularity, setMetric, bindChartEvents } from "./chart.js";
import { bindProgressEvents, appendLog, stopRateLimitCountdown } from "./progress.js";
import { showStats } from "./stats.js";
import { showInsights, showRegretSimulatorFromTotals } from "./insights.js";

bindChartEvents();
bindProgressEvents();

els.pickBtn.addEventListener("click", async () => {
  const res = await window.api.pickCookieFile();

  state.cookieValidated = false;
  els.scanBtn.disabled = true;

  if (!res.ok) {
    els.fileName.textContent = "No file selected";
    state.cookiePath = null;
    setStatus("Ready");
    return;
  }

  state.cookiePath = res.path;
  els.fileName.textContent = state.cookiePath.split(/[\\/]/).pop();
  appendLog(`Selected cookie file: ${els.fileName.textContent}`, { level: "muted" });

  setStatus("Validating...", "working");
  els.progressSection.style.display = "block";
  setProgress(2, "Validating cookie...");

  const v = await window.api.validateCookie({ cookiePath: state.cookiePath });

  if (!v.ok) {
    state.cookieValidated = false;
    els.scanBtn.disabled = true;
    setStatus("Invalid cookie", "error");
    setProgress(0, `Invalid cookie: ${v.error}`, "invalid", "bad");
    appendLog(`Cookie invalid: ${v.error}`, { level: "error" });
    return;
  }

  state.cookieValidated = true;
  els.scanBtn.disabled = false;
  setStatus("Cookie OK");
  setProgress(0, "Ready to scan", "ok", "good");
});

els.scanBtn.addEventListener("click", async () => {
  if (!state.cookiePath || state.scanning || !state.cookieValidated) return;

  state.scanning = true;
  els.pickBtn.disabled = true;
  els.scanBtn.disabled = true;

  els.statsSection.style.display = "none";
  els.progressSection.style.display = "block";
  stopRateLimitCountdown();
  setStatus("Scanning...", "working");
  setProgress(0, "Starting...");
  appendLog("Scan started.", { level: "muted" });

  state.spendSeries = { monthly: [], yearly: [], usdPerRobux: state.spendSeries.usdPerRobux ?? 0.01 };
  state.insights = null;
  state.hoverIndex = -1;
  drawChart();

  const res = await window.api.scanSpend({ cookiePath: state.cookiePath });

  state.scanning = false;
  els.pickBtn.disabled = false;
  els.scanBtn.disabled = false;

  stopRateLimitCountdown();

  if (!res.ok) {
    setStatus("Error", "error");
    setProgress(0, "Failed", "error", "bad");
    appendLog(`Scan failed: ${res.error}`, { level: "error" });
    return;
  }

  setStatus("Complete");
  setProgress(100, "Complete", "done", "good");

  showStats(res.totals, res.purchasesCount);
  showRegretSimulatorFromTotals(res.totals);

  state.spendSeries = res.series || { monthly: [], yearly: [], usdPerRobux: 0.01 };
  showInsights(res.insights || null);

  setGranularity("month");
  setMetric("robux");

  els.statsSection.style.display = "block";
  requestAnimationFrame(() => drawChart());
  appendLog(`Saved results to: ${res.dataDir}`, { level: "ok" });
});

requestAnimationFrame(() => drawChart());
