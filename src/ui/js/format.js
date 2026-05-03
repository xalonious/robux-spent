export function fmt(n) {
  return (Number(n) || 0).toLocaleString("en-US");
}

export function fmtRobux(n) {
  return `R$${fmt(Math.round((Number(n) || 0) * 100) / 100)}`;
}

export function fmtUSD(n) {
  const v = Number(n ?? 0);
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function parseLocaleNumber(s) {
  const cleaned = String(s).replace(/[^\d]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function periodToPretty(period) {
  if (!period) return "-";
  if (/^\d{4}$/.test(period)) return period;
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = new Date(Date.UTC(y, mo - 1, 1));
  const month = d.toLocaleString(undefined, { month: "short" });
  return `${month} ${y}`;
}

export function dayToPretty(day) {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return day || "-";
  const [y, m, d] = day.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.toLocaleString(undefined, { weekday: "short" });
  const mon = dt.toLocaleString(undefined, { month: "short" });
  return `${dow}, ${mon} ${d}, ${y}`;
}
