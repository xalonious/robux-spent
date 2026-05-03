import { state } from "./state.js";
import { els, ctx } from "./dom.js";
import { fmtRobux, fmtUSD, periodToPretty } from "./format.js";

let _padL = 52;

const C = {
  line:    "#c8902a",
  fill0:   "rgba(200,144,42,.14)",
  fill1:   "rgba(200,144,42,.01)",
  grid:    "rgba(255,248,230,.04)",
  axis:    "rgba(255,248,230,.06)",
  label:   "rgba(97,94,88,.95)",
  dot:     "#c8902a",
  hover_bg:"rgba(20,19,17,.93)",
  hover_bd:"rgba(255,248,230,.1)",
  cross:   "rgba(255,248,230,.05)",
};

function series() {
  return state.chartGranularity === "year"
    ? (state.spendSeries.yearly || [])
    : (state.spendSeries.monthly || []);
}

function val(p) {
  return state.chartMetric === "usd" ? Number(p?.usd ?? 0) : Number(p?.robux ?? 0);
}

function lbl(p) {
  return state.chartGranularity === "year"
    ? String(p.period)
    : periodToPretty(p.period);
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const r = els.canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(r.width  || els.canvas.offsetWidth  || els.canvas.parentElement?.offsetWidth  || 900));
  const h = Math.max(1, Math.floor(r.height || els.canvas.offsetHeight || els.canvas.parentElement?.offsetHeight || 240));
  const tw = Math.floor(w * dpr);
  const th = Math.floor(h * dpr);
  if (els.canvas.width !== tw || els.canvas.height !== th) {
    els.canvas.width = tw;
    els.canvas.height = th;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}

export function drawChart() {
  const { w, h } = resize();
  ctx.clearRect(0, 0, w, h);

  const s = series();
  const hasData = Array.isArray(s) && s.length > 0;
  els.chartEmpty.style.display = hasData ? "none" : "flex";
  els.chartLegendLabel.textContent = state.chartMetric === "usd" ? "Est. USD spent" : "Robux spent";
  if (!hasData) return;

  const PAD = { t: 10, r: 12, b: 30, l: 0 };

  const vmax = Math.max(...s.map(val), 0) * 1.1 || 1;
  const TICKS = 4;
  ctx.save();
  ctx.font = `11px 'Geist Mono', monospace`;
  let mw = 0;
  for (let i = 0; i <= TICKS; i++) {
    const v = vmax * (1 - i / TICKS);
    const txt = state.chartMetric === "usd"
      ? `$${v < 10 ? v.toFixed(2) : Math.round(v).toLocaleString()}`
      : `R$${Math.round(v).toLocaleString()}`;
    mw = Math.max(mw, ctx.measureText(txt).width);
  }
  ctx.restore();

  PAD.l = Math.ceil(mw + 14);
  _padL = PAD.l;

  const pw = Math.max(1, w - PAD.l - PAD.r);
  const ph = Math.max(1, h - PAD.t - PAD.b);

  const xf = i => PAD.l + (s.length === 1 ? pw / 2 : (i / (s.length - 1)) * pw);
  const yf = v => PAD.t + (1 - v / vmax) * ph;

  const pts = s.map((p, i) => ({ x: xf(i), y: yf(val(p)), v: val(p) }));

  ctx.save();

  for (let i = 0; i <= TICKS; i++) {
    const y = PAD.t + (i / TICKS) * ph;
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.l, y);
    ctx.lineTo(PAD.l + pw, y);
    ctx.stroke();
  }

  ctx.fillStyle = C.label;
  ctx.font = `11px 'Geist Mono', ui-monospace, monospace`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= TICKS; i++) {
    const v = vmax * (1 - i / TICKS);
    const y = PAD.t + (i / TICKS) * ph;
    const txt = state.chartMetric === "usd"
      ? `$${v < 10 ? v.toFixed(2) : Math.round(v).toLocaleString()}`
      : `R$${Math.round(v).toLocaleString()}`;
    ctx.fillText(txt, PAD.l - 7, y);
  }

  const grad = ctx.createLinearGradient(0, PAD.t, 0, PAD.t + ph);
  grad.addColorStop(0, C.fill0);
  grad.addColorStop(1, C.fill1);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, PAD.t + ph);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, PAD.t + ph);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.stroke();

  pts.forEach(p => {
    ctx.fillStyle = C.dot;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  if (state.hoverIndex >= 0 && state.hoverIndex < pts.length) {
    const p = pts[state.hoverIndex];

    ctx.strokeStyle = C.cross;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, PAD.t);
    ctx.lineTo(p.x, PAD.t + ph);
    ctx.stroke();

    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1.5;
    ctx.fillStyle = "#161513";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const sr = s[state.hoverIndex];
    const vStr = state.chartMetric === "usd" ? fmtUSD(p.v) : fmtRobux(p.v);
    const label = lbl(sr);

    ctx.font = `500 11.5px 'Geist Mono', monospace`;
    const tw1 = ctx.measureText(label).width;
    const tw2 = ctx.measureText(vStr).width;
    const bw = Math.ceil(Math.max(tw1, tw2) + 20);
    const bh = 40;

    let bx = p.x + 10;
    let by = p.y - bh - 6;
    if (bx + bw > PAD.l + pw) bx = PAD.l + pw - bw;
    if (bx < PAD.l) bx = PAD.l;
    if (by < PAD.t) by = PAD.t + 2;

    rrect(ctx, bx, by, bw, bh, 5);
    ctx.fillStyle = C.hover_bg;
    ctx.fill();
    ctx.strokeStyle = C.hover_bd;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(242,238,232,.55)";
    ctx.font = `400 11px 'Geist Mono', monospace`;
    ctx.fillText(label, bx + 10, by + 7);

    ctx.fillStyle = C.line;
    ctx.font = `500 11.5px 'Geist Mono', monospace`;
    ctx.fillText(vStr, bx + 10, by + 22);

    els.chartHint.textContent = `${label} — ${vStr}`;
  } else {
    els.chartHint.textContent = "Hover for values";
  }

  ctx.fillStyle = C.label;
  ctx.font = `11px 'Geist Mono', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const MAX_X = Math.min(8, s.length);
  const step = s.length <= MAX_X ? 1 : Math.ceil(s.length / MAX_X);
  for (let i = 0; i < s.length; i += step) {
    const txt = state.chartGranularity === "year" ? String(s[i].period) : String(s[i].period).slice(2);
    ctx.fillText(txt, xf(i), PAD.t + ph + 7);
  }
  if (s.length > 1) {
    const last = s.length - 1;
    const txt = state.chartGranularity === "year" ? String(s[last].period) : String(s[last].period).slice(2);
    ctx.fillText(txt, xf(last), PAD.t + ph + 7);
  }

  ctx.restore();
}

function rrect(ctx2, x, y, w, h, r) {
  ctx2.beginPath();
  ctx2.moveTo(x + r, y);
  ctx2.arcTo(x + w, y, x + w, y + h, r);
  ctx2.arcTo(x + w, y + h, x, y + h, r);
  ctx2.arcTo(x, y + h, x, y, r);
  ctx2.arcTo(x, y, x + w, y, r);
  ctx2.closePath();
}

function hoverIdx(evt) {
  const s = series();
  if (!s?.length) return -1;
  const r = els.canvas.getBoundingClientRect();
  const mx = evt.clientX - r.left;
  const my = evt.clientY - r.top;
  const pw = Math.max(1, r.width - _padL - 12);
  const ph = Math.max(1, r.height - 10 - 30);
  if (mx < _padL || mx > _padL + pw || my < 10 || my > 10 + ph) return -1;
  if (s.length === 1) return 0;
  return Math.max(0, Math.min(s.length - 1, Math.round(((mx - _padL) / pw) * (s.length - 1))));
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
  els.canvas.addEventListener("mousemove", e => {
    const i = hoverIdx(e);
    if (i !== state.hoverIndex) { state.hoverIndex = i; drawChart(); }
  });
  els.canvas.addEventListener("mouseleave", () => {
    if (state.hoverIndex !== -1) { state.hoverIndex = -1; drawChart(); }
  });
  window.addEventListener("resize", () => drawChart());
  els.granMonthBtn.addEventListener("click", () => setGranularity("month"));
  els.granYearBtn.addEventListener("click", () => setGranularity("year"));
  els.metricRobux.addEventListener("change", () => { if (els.metricRobux.checked) setMetric("robux"); });
  els.metricUSD.addEventListener("change", () => { if (els.metricUSD.checked) setMetric("usd"); });
}
