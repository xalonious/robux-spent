import { state } from "./state.js";
import { els, ctx } from "./dom.js";
import { fmtRobux, fmtUSD, periodToPretty } from "./format.js";

let lastPadL = 56;

function getActiveSeries() {
  return state.chartGranularity === "year" ? state.spendSeries.yearly || [] : state.spendSeries.monthly || [];
}

function valueForPoint(p) {
  if (!p) return 0;
  return state.chartMetric === "usd" ? Number(p.usd ?? 0) : Number(p.robux ?? 0);
}

function labelForPoint(p) {
  if (!p) return "";
  return state.chartGranularity === "year" ? String(p.period) : periodToPretty(p.period);
}

function metricLabel() {
  return state.chartMetric === "usd" ? "Estimated USD spent" : "Robux spent";
}

function resizeCanvasToCSS() {
  const dpr = window.devicePixelRatio || 1;

  const rect = els.canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));

  const targetW = Math.floor(w * dpr);
  const targetH = Math.floor(h * dpr);

  if (els.canvas.width !== targetW || els.canvas.height !== targetH) {
    els.canvas.width = targetW;
    els.canvas.height = targetH;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h, dpr };
}

export function drawChart() {
  const { w, h } = resizeCanvasToCSS();
  ctx.clearRect(0, 0, w, h);

  const series = getActiveSeries();
  const hasData = Array.isArray(series) && series.length > 0;

  els.chartEmpty.style.display = hasData ? "none" : "flex";
  els.chartLegendLabel.textContent = metricLabel();

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
      state.chartMetric === "usd" ? `$${v.toFixed(vMax < 10 ? 2 : 0)}` : `R$${Math.round(v).toLocaleString()}`;
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
      state.chartMetric === "usd" ? `$${v.toFixed(vMax < 10 ? 2 : 0)}` : `R$${Math.round(v).toLocaleString()}`;
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

  if (state.hoverIndex >= 0 && state.hoverIndex < points.length) {
    const pt = points[state.hoverIndex];

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

    const p = series[state.hoverIndex];
    const label = labelForPoint(p);
    const v = valueForPoint(p);
    const vText = state.chartMetric === "usd" ? fmtUSD(v) : fmtRobux(v);

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

    els.chartHint.textContent = `${label} - ${vText}`;
  } else {
    els.chartHint.textContent = "Tip: hover points for exact values";
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
    const text = state.chartGranularity === "year" ? String(series[i].period) : String(series[i].period).slice(2);
    ctx.fillText(text, x, padT + plotH + 8);
  }

  if (series.length > 1) {
    const last = series.length - 1;
    const x = xFor(last);
    const text =
      state.chartGranularity === "year" ? String(series[last].period) : String(series[last].period).slice(2);
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

  const rect = els.canvas.getBoundingClientRect();
  const mx = evt.clientX - rect.left;
  const my = evt.clientY - rect.top;

  const w = rect.width;
  const padL = lastPadL;
  const padR = 16;
  const padT = 14;
  const padB = 34;

  const plotW = Math.max(1, w - padL - padR);
  const plotH = Math.max(1, rect.height - padT - padB);

  if (mx < padL || mx > padL + plotW || my < padT || my > padT + plotH) return -1;

  if (series.length === 1) return 0;
  const t = (mx - padL) / plotW;
  const idx = Math.round(t * (series.length - 1));
  return Math.max(0, Math.min(series.length - 1, idx));
}

export function setGranularity(g) {
  state.chartGranularity = g;
  els.granMonthBtn.setAttribute("aria-selected", g === "month" ? "true" : "false");
  els.granYearBtn.setAttribute("aria-selected", g === "year" ? "true" : "false");
  state.hoverIndex = -1;
  drawChart();
}

export function setMetric(m) {
  state.chartMetric = m;
  state.hoverIndex = -1;
  drawChart();
}

export function bindChartEvents() {
  els.canvas.addEventListener("mousemove", (evt) => {
    const idx = pickHoverIndexFromEvent(evt);
    if (idx !== state.hoverIndex) {
      state.hoverIndex = idx;
      drawChart();
    }
  });

  els.canvas.addEventListener("mouseleave", () => {
    if (state.hoverIndex !== -1) {
      state.hoverIndex = -1;
      drawChart();
    }
  });

  window.addEventListener("resize", () => {
    drawChart();
  });

  els.granMonthBtn.addEventListener("click", () => setGranularity("month"));
  els.granYearBtn.addEventListener("click", () => setGranularity("year"));

  els.metricRobux.addEventListener("change", () => {
    if (els.metricRobux.checked) setMetric("robux");
  });
  els.metricUSD.addEventListener("change", () => {
    if (els.metricUSD.checked) setMetric("usd");
  });
}
