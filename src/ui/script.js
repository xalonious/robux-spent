let cookiePath = null;
let scanning = false;
let cookieValidated = false;

let spendSeries = { monthly: [], yearly: [], usdPerRobux: 0.01 };
let insights = null;

let chartGranularity = "month";
let chartMetric = "robux";
let hoverIndex = -1;

let lastPadL = 56;

const canvas = document.getElementById("spendChart");
const ctx = canvas.getContext("2d", { alpha: true });

const pickBtn = document.getElementById("pick");
const scanBtn = document.getElementById("scan");
const fileName = document.getElementById("fileName");

const statusText = document.getElementById("statusText");
const statusDot = document.getElementById("statusDot");

const progressSection = document.getElementById("progressSection");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");
const progressChip = document.getElementById("progressChip");

const statsSection = document.getElementById("statsSection");

const logEl = document.getElementById("log");
const logCountEl = document.getElementById("logCount");
const clearLogBtn = document.getElementById("clearLog");

const granMonthBtn = document.getElementById("granMonth");
const granYearBtn = document.getElementById("granYear");
const metricRobux = document.getElementById("metricRobux");
const metricUSD = document.getElementById("metricUSD");
const chartEmpty = document.getElementById("chartEmpty");
const chartLegendLabel = document.getElementById("chartLegendLabel");
const chartHint = document.getElementById("chartHint");

const avgPerMonthEl = document.getElementById("avgPerMonth");
const avgPerYearEl = document.getElementById("avgPerYear");
const avgPerPurchaseEl = document.getElementById("avgPerPurchase");

const peakMonthLabelEl = document.getElementById("peakMonthLabel");
const peakMonthRobuxEl = document.getElementById("peakMonthRobux");

const topPurchasesListEl = document.getElementById("topPurchasesList");
const topPurchasesEmptyEl = document.getElementById("topPurchasesEmpty");

const topGamesListEl = document.getElementById("topGamesList");
const topGamesEmptyEl = document.getElementById("topGamesEmpty");

const bigDayLabelEl = document.getElementById("bigDayLabel");
const bigDayRobuxEl = document.getElementById("bigDayRobux");
const bigDayTopListEl = document.getElementById("bigDayTopList");
const bigDayTopEmptyEl = document.getElementById("bigDayTopEmpty");

const regretTotalUsdEl = document.getElementById("regretTotalUsd");
const regretMetaEl = document.getElementById("regretMeta");
const regretListEl = document.getElementById("regretList");
const regretEmptyEl = document.getElementById("regretEmpty");

function fmt(n) {
  return (n ?? 0).toLocaleString();
}
function fmtRobux(n) {
  return `R$${fmt(Math.round((Number(n) || 0) * 100) / 100)}`;
}
function fmtUSD(n) {
  const v = Number(n ?? 0);
  return `$${v.toFixed(2)}`;
}

function setStatus(text, mode) {
  statusText.textContent = text;
  statusDot.classList.remove("working", "error");
  if (mode === "working") statusDot.classList.add("working");
  if (mode === "error") statusDot.classList.add("error");
}

function setProgress(pct, text, chipText = null, chipKind = null) {
  progressFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  progressText.textContent = text;

  if (chipText) {
    progressChip.style.display = "inline-flex";
    progressChip.textContent = chipText;
    progressChip.classList.remove("warn", "good", "bad");
    if (chipKind) progressChip.classList.add(chipKind);
  } else {
    progressChip.style.display = "none";
  }
}

function parseLocaleNumber(s) {
  const cleaned = String(s).replace(/[^\d]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function periodToPretty(period) {
  if (!period) return "—";
  if (/^\d{4}$/.test(period)) return period;
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = new Date(Date.UTC(y, mo - 1, 1));
  const month = d.toLocaleString(undefined, { month: "short" });
  return `${month} ${y}`;
}

function dayToPretty(day) {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return day || "—";
  const [y, m, d] = day.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.toLocaleString(undefined, { weekday: "short" });
  const mon = dt.toLocaleString(undefined, { month: "short" });
  return `${dow}, ${mon} ${d}, ${y}`;
}

let logLines = 0;
let rlTimer = null;
let rlUntil = 0;
let inRateLimitMode = false;

function appendLog(msg, meta = {}, ts = Date.now()) {
  const t = new Date(ts);
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  const ss = String(t.getSeconds()).padStart(2, "0");

  const line = document.createElement("div");
  line.className = "logLine";

  const lvl = (meta.level || "").toLowerCase();
  if (lvl) line.classList.add(lvl);

  if (meta.kind === "ratelimit") line.classList.add("warn");
  if (meta.kind === "retry") line.classList.add("warn");
  if (meta.kind === "checkpoint" || meta.kind === "checkpoint-resume") line.classList.add("muted");

  line.textContent = `[${hh}:${mm}:${ss}] ${msg}`;
  logEl.appendChild(line);

  logLines++;
  logCountEl.textContent = `${logLines} line${logLines === 1 ? "" : "s"}`;

  const nearBottom = logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 120;
  if (nearBottom) logEl.scrollTop = logEl.scrollHeight;
}

function stopRateLimitCountdown() {
  if (rlTimer) clearInterval(rlTimer);
  rlTimer = null;
  rlUntil = 0;
  inRateLimitMode = false;
}

function startRateLimitCountdown(delayMs) {
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
      Math.max(5, parseFloat(progressFill.style.width) || 5),
      `Ratelimited. Retrying in ${ms.toLocaleString()} ms…`,
      "429",
      "warn"
    );
  };

  tick();
  rlTimer = setInterval(tick, 120);
}

function hardClearRateLimit() {
  stopRateLimitCountdown();
  if (scanning) setStatus("Scanning…", "working");
}

clearLogBtn.addEventListener("click", () => {
  logEl.innerHTML = "";
  logLines = 0;
  logCountEl.textContent = "0 lines";
});

function showStats(totals, purchaseCount) {
  document.getElementById("totalSpent").textContent = fmtRobux(totals.totalSpentAllPurchases);
  document.getElementById("purchaseCount").textContent = fmt(purchaseCount);
  document.getElementById("gameSpent").textContent = fmtRobux(totals.totalSpentInGames);
  document.getElementById("otherSpent").textContent = fmtRobux(totals.totalSpentOutsideGames);

  const bal = totals.balance || {};
  document.getElementById("robuxBalance").textContent = fmtRobux(bal.robux ?? 0);

  const inflow = totals.inflow || {};
  document.getElementById("inflowTotal").textContent = fmtRobux(inflow.totalRobux ?? 0);

  const b = inflow.breakdown || {};
  const getR = (k) => b?.[k]?.robux ?? 0;

  document.getElementById("inflowCurrencyPurchase").textContent = fmtRobux(getR("CurrencyPurchase"));
  document.getElementById("inflowPremiumStipend").textContent = fmtRobux(getR("PremiumStipend"));
  document.getElementById("inflowEngagementPayout").textContent = fmtRobux(getR("EngagementPayout"));
  document.getElementById("inflowGroupPayout").textContent = fmtRobux(getR("GroupPayout"));
  document.getElementById("inflowSale").textContent = fmtRobux(getR("Sale"));
  document.getElementById("inflowTradeRobux").textContent = fmtRobux(getR("TradeRobux"));

  const getUSD = (k) => b?.[k]?.usdEstimate ?? 0;
  document.getElementById("usdSpentOnRobux").textContent = fmtUSD(getUSD("CurrencyPurchase"));
  document.getElementById("usdSpentOnPremium").textContent = fmtUSD(getUSD("PremiumStipend"));

  statsSection.style.display = "block";
}

function clearEl(el) {
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
}

function makeRow({ title, meta, value, valueSub }) {
  const row = document.createElement("div");
  row.className = "row";

  const left = document.createElement("div");
  left.className = "rowLeft";

  const t = document.createElement("div");
  t.className = "rowTitle";
  t.textContent = title || "—";

  const m = document.createElement("div");
  m.className = "rowMeta";
  m.textContent = meta || "";

  left.appendChild(t);
  if (meta) left.appendChild(m);

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

function showLeaderboards(ins) {
  const lb = ins?.leaderboards || null;

  clearEl(topPurchasesListEl);

  const topExp = lb?.topExpensivePurchases || [];
  if (!topExp.length) {
    if (topPurchasesEmptyEl) topPurchasesEmptyEl.style.display = "block";
    if (topPurchasesListEl && topPurchasesEmptyEl) topPurchasesListEl.appendChild(topPurchasesEmptyEl);
  } else {
    if (topPurchasesEmptyEl) topPurchasesEmptyEl.style.display = "none";

    for (const p of topExp) {
      const title = p.name || p.itemType || "Purchase";
      const metaBits = [];
      if (p.itemType) metaBits.push(p.itemType);
      if (p.placeName) metaBits.push(p.placeName);
      const meta = metaBits.join(" • ");

      const day = p.created ? String(p.created).slice(0, 10) : null;

      topPurchasesListEl.appendChild(
        makeRow({
          title,
          meta,
          value: fmtRobux(p.robux ?? 0),
          valueSub: day ? dayToPretty(day) : "",
        })
      );
    }
  }

  clearEl(topGamesListEl);

  const topGames = lb?.topGamesFunded || [];
  if (!topGames.length) {
    if (topGamesEmptyEl) topGamesEmptyEl.style.display = "block";
    if (topGamesListEl && topGamesEmptyEl) topGamesListEl.appendChild(topGamesEmptyEl);
  } else {
    if (topGamesEmptyEl) topGamesEmptyEl.style.display = "none";

    for (const g of topGames) {
      topGamesListEl.appendChild(
        makeRow({
          title: g.placeName || "Unknown game",
          meta: g.universeId != null ? `Universe ${g.universeId}` : g.placeId != null ? `Place ${g.placeId}` : "",
          value: fmtRobux(g.robux ?? 0),
          valueSub: `${fmt(g.purchaseCount ?? 0)} purchase${(g.purchaseCount ?? 0) === 1 ? "" : "s"}`,
        })
      );
    }
  }

  const bd = lb?.biggestSpendingDayEver || null;

  if (!bd) {
    bigDayLabelEl.textContent = "—";
    bigDayRobuxEl.textContent = "R$0";
    clearEl(bigDayTopListEl);
    if (bigDayTopEmptyEl) {
      bigDayTopEmptyEl.style.display = "block";
      bigDayTopListEl.appendChild(bigDayTopEmptyEl);
    }
    return;
  }

  bigDayLabelEl.textContent = `${dayToPretty(bd.day)} • ${fmt(bd.purchaseCount ?? 0)} purchase${
    (bd.purchaseCount ?? 0) === 1 ? "" : "s"
  }`;

  bigDayRobuxEl.textContent = fmtRobux(bd.robux ?? 0);

  clearEl(bigDayTopListEl);

  const top = bd.topPurchases || [];
  if (!top.length) {
    if (bigDayTopEmptyEl) {
      bigDayTopEmptyEl.style.display = "block";
      bigDayTopListEl.appendChild(bigDayTopEmptyEl);
    }
  } else {
    if (bigDayTopEmptyEl) bigDayTopEmptyEl.style.display = "none";

    for (const p of top) {
      const title = p.name || p.itemType || "Purchase";
      const metaBits = [];
      if (p.itemType) metaBits.push(p.itemType);
      if (p.placeName) metaBits.push(p.placeName);
      const meta = metaBits.join(" • ");

      bigDayTopListEl.appendChild(
        makeRow({
          title,
          meta,
          value: fmtRobux(p.robux ?? 0),
          valueSub: p.created ? new Date(p.created).toLocaleString() : "",
        })
      );
    }
  }
}

function showRegretSimulatorFromTotals(totals) {
  if (!regretTotalUsdEl || !regretListEl || !regretEmptyEl) return;

  const b = totals?.inflow?.breakdown || {};
  const usdRobux = Number(b?.CurrencyPurchase?.usdEstimate ?? 0) || 0;
  const usdPrem = Number(b?.PremiumStipend?.usdEstimate ?? 0) || 0;
  const totalUsd = Math.round((usdRobux + usdPrem) * 100) / 100;

  regretTotalUsdEl.textContent = fmtUSD(totalUsd);

  if (regretMetaEl) {
    const bits = [];
    bits.push(`Robux: ${fmtUSD(usdRobux)}`);
    bits.push(`Premium: ${fmtUSD(usdPrem)}`);
    regretMetaEl.textContent = bits.join(" • ");
  }

  const ideas = [
    { label: "Big Mac meals", unitCost: 12.0, unit: "meals", note: "avg fast food combo" },
    { label: "Movie tickets", unitCost: 15.0, unit: "tickets", note: "evening ticket" },
    { label: "Steam games", unitCost: 20.0, unit: "games", note: "mid-price pick" },
    { label: "Fancy coffee", unitCost: 6.0, unit: "coffees", note: "latte/cappuccino" },
    { label: "AirPods (base)", unitCost: 129.0, unit: "pairs", note: "approx MSRP" },
    { label: "PS5 games", unitCost: 70.0, unit: "games", note: "new release" },
  ];

  clearEl(regretListEl);

  if (!(totalUsd > 0)) {
    regretEmptyEl.style.display = "block";
    regretListEl.appendChild(regretEmptyEl);
    return;
  }

  regretEmptyEl.style.display = "none";

  const rows = ideas
    .map((x) => {
      const count = Math.floor(totalUsd / x.unitCost);
      return { ...x, count };
    })
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  if (!rows.length) {
    regretEmptyEl.style.display = "block";
    regretListEl.appendChild(regretEmptyEl);
    return;
  }

  for (const r of rows) {
    regretListEl.appendChild(
      makeRow({
        title: r.label,
        meta: r.note,
        value: `${fmt(r.count)} ${r.unit}`,
        valueSub: `@ ${fmtUSD(r.unitCost)} each`,
      })
    );
  }
}

function showInsights(ins) {
  insights = ins || null;

  const avg = ins?.averages || {};
  avgPerMonthEl.textContent = fmtRobux(avg.robuxPerMonth ?? 0);
  avgPerYearEl.textContent = fmtRobux(avg.robuxPerYear ?? 0);
  avgPerPurchaseEl.textContent = fmtRobux(avg.robuxPerPurchase ?? 0);

  const peak = ins?.peakMonth || null;
  if (!peak) {
    peakMonthLabelEl.textContent = "—";
    peakMonthRobuxEl.textContent = "R$0";
  } else {
    peakMonthLabelEl.textContent = `${periodToPretty(peak.period)} • ${fmt(peak.purchaseCount)} purchase${
      peak.purchaseCount === 1 ? "" : "s"
    }`;
    peakMonthRobuxEl.textContent = fmtRobux(peak.robux ?? 0);
  }

  showLeaderboards(ins);
}

function getActiveSeries() {
  return chartGranularity === "year" ? spendSeries.yearly || [] : spendSeries.monthly || [];
}

function valueForPoint(p) {
  if (!p) return 0;
  return chartMetric === "usd" ? Number(p.usd ?? 0) : Number(p.robux ?? 0);
}

function labelForPoint(p) {
  if (!p) return "";
  return chartGranularity === "year" ? String(p.period) : periodToPretty(p.period);
}

function metricLabel() {
  return chartMetric === "usd" ? "Estimated USD spent" : "Robux spent";
}

function resizeCanvasToCSS() {
  const dpr = window.devicePixelRatio || 1;

  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));

  const targetW = Math.floor(w * dpr);
  const targetH = Math.floor(h * dpr);

  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h, dpr };
}

function drawChart() {
  const { w, h } = resizeCanvasToCSS();
  ctx.clearRect(0, 0, w, h);

  const series = getActiveSeries();
  const hasData = Array.isArray(series) && series.length > 0;

  chartEmpty.style.display = hasData ? "none" : "flex";
  chartLegendLabel.textContent = metricLabel();

  if (!hasData) return;

  const padR = 16;
  const padT = 14;
  const padB = 34;

  const vals = series.map(valueForPoint);
  let vMin = 0;
  let vMax = Math.max(...vals, 0);

  const head = vMax > 0 ? vMax * 0.08 : 1;
  vMax = vMax + head;

  const gridN = 4;

  ctx.save();
  ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace";
  let maxLabelW = 0;

  for (let g = 0; g <= gridN; g++) {
    const t = 1 - g / gridN;
    const v = vMin + t * (vMax - vMin);
    const label =
      chartMetric === "usd" ? `$${v.toFixed(vMax < 10 ? 2 : 0)}` : `R$${Math.round(v).toLocaleString()}`;
    maxLabelW = Math.max(maxLabelW, ctx.measureText(label).width);
  }
  ctx.restore();

  const padL = Math.ceil(maxLabelW + 18);
  lastPadL = padL;

  const plotW = Math.max(1, w - padL - padR);
  const plotH = Math.max(1, h - padT - padB);

  const xFor = (i) => padL + (series.length === 1 ? plotW / 2 : (i / (series.length - 1)) * plotW);
  const yFor = (v) => padT + (1 - (v - vMin) / Math.max(1e-9, vMax - vMin)) * plotH;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;

  for (let g = 0; g <= gridN; g++) {
    const yy = padT + (g / gridN) * plotH;
    ctx.strokeStyle = "rgba(255,255,255,.06)";
    ctx.beginPath();
    ctx.moveTo(padL, yy);
    ctx.lineTo(padL + plotW, yy);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,.10)";
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + plotH);
  ctx.lineTo(padL + plotW, padT + plotH);
  ctx.stroke();

  ctx.fillStyle = "rgba(169,178,221,.92)";
  ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let g = 0; g <= gridN; g++) {
    const t = 1 - g / gridN;
    const v = vMin + t * (vMax - vMin);
    const yy = padT + (g / gridN) * plotH;
    const label =
      chartMetric === "usd" ? `$${v.toFixed(vMax < 10 ? 2 : 0)}` : `R$${Math.round(v).toLocaleString()}`;
    ctx.fillText(label, padL - 8, yy);
  }
  ctx.restore();

  const points = series.map((p, i) => ({
    x: xFor(i),
    y: yFor(valueForPoint(p)),
    v: valueForPoint(p),
  }));

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.strokeStyle = "rgba(124,92,255,.35)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (i === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  }
  ctx.stroke();

  ctx.strokeStyle = "rgba(34,211,238,.85)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (i === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  }
  ctx.stroke();

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    ctx.fillStyle = "rgba(232,236,255,.95)";
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  if (hoverIndex >= 0 && hoverIndex < points.length) {
    const pt = points[hoverIndex];

    ctx.strokeStyle = "rgba(255,255,255,.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pt.x, padT);
    ctx.lineTo(pt.x, padT + plotH);
    ctx.stroke();

    ctx.fillStyle = "rgba(232,236,255,.95)";
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4.2, 0, Math.PI * 2);
    ctx.fill();

    const p = series[hoverIndex];
    const label = labelForPoint(p);
    const v = valueForPoint(p);
    const vText = chartMetric === "usd" ? fmtUSD(v) : fmtRobux(v);

    const tx = pt.x + 10;
    const ty = pt.y - 10;

    ctx.font =
      "12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif";
    const line1 = label;
    const line2 = vText;

    const w1 = ctx.measureText(line1).width;
    const w2 = ctx.measureText(line2).width;
    const bw = Math.ceil(Math.max(w1, w2) + 18);
    const bh = 44;

    let bx = tx;
    let by = ty - bh;

    if (bx + bw > padL + plotW) bx = padL + plotW - bw;
    if (bx < padL) bx = padL;
    if (by < padT) by = padT;

    ctx.fillStyle = "rgba(15,20,35,.92)";
    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.lineWidth = 1;
    roundRect(ctx, bx, by, bw, bh, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(232,236,255,.96)";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(line1, bx + 9, by + 8);

    ctx.fillStyle = "rgba(169,178,221,.96)";
    ctx.fillText(line2, bx + 9, by + 24);

    chartHint.textContent = `${label} • ${vText}`;
  } else {
    chartHint.textContent = "Tip: hover points for exact values";
  }

  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(169,178,221,.92)";
  ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const maxLabels = Math.min(6, series.length);
  const step = series.length <= maxLabels ? 1 : Math.ceil(series.length / maxLabels);

  for (let i = 0; i < series.length; i += step) {
    const x = xFor(i);
    const text = chartGranularity === "year" ? String(series[i].period) : String(series[i].period).slice(2);
    ctx.fillText(text, x, padT + plotH + 8);
  }

  if (series.length > 1) {
    const last = series.length - 1;
    const x = xFor(last);
    const text = chartGranularity === "year" ? String(series[last].period) : String(series[last].period).slice(2);
    ctx.fillText(text, x, padT + plotH + 8);
  }

  ctx.restore();
}

function roundRect(ctx2, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx2.beginPath();
  ctx2.moveTo(x + rr, y);
  ctx2.arcTo(x + w, y, x + w, y + h, rr);
  ctx2.arcTo(x + w, y + h, x, y + h, rr);
  ctx2.arcTo(x, y + h, x, y, rr);
  ctx2.arcTo(x, y, x + w, y, rr);
  ctx2.closePath();
}

function pickHoverIndexFromEvent(evt) {
  const series = getActiveSeries();
  if (!series || series.length === 0) return -1;

  const rect = canvas.getBoundingClientRect();
  const mx = evt.clientX - rect.left;
  const my = evt.clientY - rect.top;

  const w = rect.width;
  const padL = lastPadL;
  const padR = 16,
    padT = 14,
    padB = 34;

  const plotW = Math.max(1, w - padL - padR);
  const plotH = Math.max(1, rect.height - padT - padB);

  if (mx < padL || mx > padL + plotW || my < padT || my > padT + plotH) return -1;

  if (series.length === 1) return 0;
  const t = (mx - padL) / plotW;
  const idx = Math.round(t * (series.length - 1));
  return Math.max(0, Math.min(series.length - 1, idx));
}

canvas.addEventListener("mousemove", (evt) => {
  const idx = pickHoverIndexFromEvent(evt);
  if (idx !== hoverIndex) {
    hoverIndex = idx;
    drawChart();
  }
});
canvas.addEventListener("mouseleave", () => {
  if (hoverIndex !== -1) {
    hoverIndex = -1;
    drawChart();
  }
});

window.addEventListener("resize", () => {
  drawChart();
});

function setGranularity(g) {
  chartGranularity = g;
  granMonthBtn.setAttribute("aria-selected", g === "month" ? "true" : "false");
  granYearBtn.setAttribute("aria-selected", g === "year" ? "true" : "false");
  hoverIndex = -1;
  drawChart();
}

function setMetric(m) {
  chartMetric = m;
  hoverIndex = -1;
  drawChart();
}

granMonthBtn.addEventListener("click", () => setGranularity("month"));
granYearBtn.addEventListener("click", () => setGranularity("year"));

metricRobux.addEventListener("change", () => {
  if (metricRobux.checked) setMetric("robux");
});
metricUSD.addEventListener("change", () => {
  if (metricUSD.checked) setMetric("usd");
});

window.api.onProgress(({ msg, meta, ts }) => {
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

  const friendlyKind = (rawLabel) => {
    const l = String(rawLabel || "").trim().toLowerCase();

    if (l === "purchase") return { noun: "purchase", chip: "Purchases" };
    if (l === "currencypurchase") return { noun: "robux bought", chip: "Bought" };
    if (l === "premiumstipend") return { noun: "premium stipend", chip: "Premium" };
    if (l === "engagementpayout") return { noun: "engagement payout", chip: "Engagement" };
    if (l === "grouppayout") return { noun: "group payout", chip: "Group" };
    if (l === "sale") return { noun: "sale", chip: "Sales" };
    if (l === "traderobux") return { noun: "trade", chip: "Trades" };

    if (l.includes("premium")) return { noun: "premium transaction", chip: "Premium" };
    if (l.includes("currency") || l.includes("robux")) return { noun: "robux transaction", chip: "Robux" };
    return { noun: "transaction", chip: rawLabel };
  };

  const pluralize = (noun, n) => (n === 1 ? noun : `${noun}s`);

  const rules = [
    {
      re: /^Fetched\s([\d.,\s]+)\s+(.+?)\s+tx\s+\(page\s+(\d+)\)/i,
      run: (m) => {
        const count = parseLocaleNumber(m[1]);
        const rawLabel = m[2].trim();
        const { noun, chip } = friendlyKind(rawLabel);
        const label = pluralize(noun, count);
        const pct = Math.min(95, 10 + Math.log10(1 + count) * 18);
        setStatus("Scanning…", "working");
        setProgress(pct, `Scanned ${count.toLocaleString()} ${label}`, chip ? String(chip) : null, "good");
      },
    },

    { re: /Authenticating/i, run: () => { hardClearRateLimit(); setStatus("Scanning…", "working"); setProgress(3, "Authenticating…"); } },
    { re: /Authenticated/i, run: () => { hardClearRateLimit(); setStatus("Scanning…", "working"); setProgress(6, "Authenticated. Scanning…"); } },

    { re: /Computing totals/i, run: () => { hardClearRateLimit(); setStatus("Scanning…", "working"); setProgress(95, "Computing totals…", "finalizing", null); } },
    { re: /Computing leaderboards/i, run: () => { hardClearRateLimit(); setStatus("Scanning…", "working"); setProgress(96, "Computing leaderboards…", "leaderboards", null); } },

    { re: /Computing spend over time/i, run: () => { hardClearRateLimit(); setStatus("Scanning…", "working"); setProgress(96, "Computing spend over time…", "series", null); } },
    { re: /Computing Robux spend over time/i, run: () => { hardClearRateLimit(); setStatus("Scanning…", "working"); setProgress(96, "Computing spend over time…", "series", null); } },
    { re: /Computing USD spend over time/i, run: () => { hardClearRateLimit(); setStatus("Scanning…", "working"); setProgress(96, "Computing spend over time…", "series", null); } },

    { re: /Fetching current Robux balance/i, run: () => { hardClearRateLimit(); setStatus("Scanning…", "working"); setProgress(97, "Fetching current balance…", "balance", null); } },
    { re: /Scanning Robux inflow/i, run: () => { hardClearRateLimit(); setStatus("Scanning…", "working"); setProgress(98, "Scanning Robux inflow…", "inflow", null); } },
    { re: /Fetching inflow:/i, run: () => { hardClearRateLimit(); setStatus("Scanning…", "working"); setProgress(98, "Fetching inflow transactions…", "inflow", "good"); } },

    { re: /Done/i, run: () => { stopRateLimitCountdown(); setStatus("Complete"); setProgress(100, "Complete", "done", "good"); } },
    { re: /Error:/i, run: () => { stopRateLimitCountdown(); setStatus("Error", "error"); setProgress(0, "Failed", "error", "bad"); } },
  ];

  for (const r of rules) {
    const m = r.re.exec(msg);
    if (m) { r.run(m); break; }
  }
});

pickBtn.addEventListener("click", async () => {
  const res = await window.api.pickCookieFile();

  cookieValidated = false;
  scanBtn.disabled = true;

  if (!res.ok) {
    fileName.textContent = "No file selected";
    cookiePath = null;
    setStatus("Ready");
    return;
  }

  cookiePath = res.path;
  fileName.textContent = cookiePath.split(/[\\/]/).pop();
  appendLog(`Selected cookie file: ${fileName.textContent}`, { level: "muted" });

  setStatus("Validating…", "working");
  progressSection.style.display = "block";
  setProgress(2, "Validating cookie…");

  const v = await window.api.validateCookie({ cookiePath });

  if (!v.ok) {
    cookieValidated = false;
    scanBtn.disabled = true;
    setStatus("Invalid cookie", "error");
    setProgress(0, `Invalid cookie: ${v.error}`, "invalid", "bad");
    appendLog(`Cookie invalid: ${v.error}`, { level: "error" });
    return;
  }

  cookieValidated = true;
  scanBtn.disabled = false;
  setStatus("Cookie OK");
  setProgress(0, "Ready to scan", "ok", "good");
});

scanBtn.addEventListener("click", async () => {
  if (!cookiePath || scanning || !cookieValidated) return;

  scanning = true;
  pickBtn.disabled = true;
  scanBtn.disabled = true;

  statsSection.style.display = "none";
  progressSection.style.display = "block";
  stopRateLimitCountdown();
  setStatus("Scanning…", "working");
  setProgress(0, "Starting…");
  appendLog("Scan started.", { level: "muted" });

  spendSeries = { monthly: [], yearly: [], usdPerRobux: spendSeries.usdPerRobux ?? 0.01 };
  insights = null;
  hoverIndex = -1;
  drawChart();

  const res = await window.api.scanSpend({ cookiePath });

  scanning = false;
  pickBtn.disabled = false;
  scanBtn.disabled = false;

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

  spendSeries = res.series || { monthly: [], yearly: [], usdPerRobux: 0.01 };
  showInsights(res.insights || null);

  setGranularity("month");
  setMetric("robux");

  appendLog(`Saved results to: ${res.dataDir}`, { level: "ok" });
});

drawChart();
