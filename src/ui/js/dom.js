export const els = {
  canvas:           document.getElementById("spendChart"),
  pickBtn:          document.getElementById("pick"),
  scanBtn:          document.getElementById("scan"),
  fileName:         document.getElementById("fileName"),
  statusText:       document.getElementById("statusText"),
  statusDot:        document.getElementById("statusDot"),
  progressSection:  document.getElementById("progressSection"),
  progressFill:     document.getElementById("progressFill"),
  progressText:     document.getElementById("progressText"),
  progressChip:     document.getElementById("progressChip"),
  statsSection:     document.getElementById("statsSection"),
  logEl:            document.getElementById("log"),
  logCountEl:       document.getElementById("logCount"),
  clearLogBtn:      document.getElementById("clearLog"),
  granMonthBtn:     document.getElementById("granMonth"),
  granYearBtn:      document.getElementById("granYear"),
  metricRobux:      document.getElementById("metricRobux"),
  metricUSD:        document.getElementById("metricUSD"),
  chartEmpty:       document.getElementById("chartEmpty"),
  chartLegendLabel: document.getElementById("chartLegendLabel"),
  chartHint:        document.getElementById("chartHint"),
  avgPerMonthEl:       document.getElementById("avgPerMonth"),
  avgPerYearEl:        document.getElementById("avgPerYear"),
  avgPerPurchaseEl:    document.getElementById("avgPerPurchase"),
  peakMonthLabelEl:    document.getElementById("peakMonthLabel"),
  peakMonthRobuxEl:    document.getElementById("peakMonthRobux"),
  topPurchasesListEl:  document.getElementById("topPurchasesList"),
  topPurchasesEmptyEl: document.getElementById("topPurchasesEmpty"),
  topGamesListEl:      document.getElementById("topGamesList"),
  topGamesEmptyEl:     document.getElementById("topGamesEmpty"),
  bigDayLabelEl:       document.getElementById("bigDayLabel"),
  bigDayRobuxEl:       document.getElementById("bigDayRobux"),
  bigDayTopListEl:     document.getElementById("bigDayTopList"),
  bigDayTopEmptyEl:    document.getElementById("bigDayTopEmpty"),
  regretTotalUsdEl:    document.getElementById("regretTotalUsd"),
  regretMetaEl:        document.getElementById("regretMeta"),
  regretListEl:        document.getElementById("regretList"),
  regretEmptyEl:       document.getElementById("regretEmpty"),
};

export const ctx = els.canvas.getContext("2d", { alpha: true });

export function setStatus(text, mode) {
  els.statusText.textContent = text;
  els.statusDot.className = "dot";
  if (mode === "working") els.statusDot.classList.add("working");
  else if (mode === "error") els.statusDot.classList.add("error");
  else if (!mode || mode === "idle") els.statusDot.classList.add("idle");
}

export function setProgress(pct, text, chipText = null, chipKind = null) {
  els.progressFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  els.progressText.textContent = text;
  if (chipText) {
    els.progressChip.style.display = "inline-flex";
    els.progressChip.textContent = chipText;
    els.progressChip.className = "chip";
    if (chipKind) els.progressChip.classList.add(chipKind);
  } else {
    els.progressChip.style.display = "none";
  }
}

export function setCardValue(id, text, rawValue) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.dataset.rawValue = String(Number(rawValue ?? 0) || 0);
}

export function updateZeroCardVisibility() {
  els.statsSection.querySelectorAll(".card[data-hide-zero]").forEach(card => {
    const valueEl = card.querySelector(".cv");
    const value = Number(valueEl?.dataset.rawValue ?? 0) || 0;
    card.hidden = Math.abs(value) < 0.000001;
  });
}

export function clearEl(el) {
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function makeRow({ title, meta, value, valueSub }) {
  const row = document.createElement("div");
  row.className = "row";

  const left = document.createElement("div");
  left.className = "rowLeft";

  const t = document.createElement("div");
  t.className = "rowTitle";
  t.textContent = title || "—";

  left.appendChild(t);

  if (meta) {
    const m = document.createElement("div");
    m.className = "rowMeta";
    m.textContent = meta;
    left.appendChild(m);
  }

  const right = document.createElement("div");
  right.className = "rowRight";

  const v = document.createElement("div");
  v.className = "rowValue";
  v.textContent = value || "";
  right.appendChild(v);

  if (valueSub) {
    const vs = document.createElement("div");
    vs.className = "rowValueSub";
    vs.textContent = valueSub;
    right.appendChild(vs);
  }

  row.appendChild(left);
  row.appendChild(right);
  return row;
}
