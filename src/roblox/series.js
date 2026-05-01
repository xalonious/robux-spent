const { USD_PER_ROBUX } = require("./constants");
const { spendForTx } = require("./totals");

function computeRobuxSpendOverTime(purchases, granularity = "month") {
  const map = new Map();

  for (const tx of purchases) {
    if (tx?.currency?.type !== "Robux") continue;

    const created = tx?.created;
    const d = created ? new Date(created) : null;
    if (!d || Number.isNaN(d.getTime())) continue;

    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const key = granularity === "year" ? String(y) : `${y}-${String(m).padStart(2, "0")}`;

    const spent = spendForTx(tx);

    const cur = map.get(key) || { robuxSpent: 0, purchaseCount: 0 };
    cur.robuxSpent += spent;
    cur.purchaseCount += 1;
    map.set(key, cur);
  }

  return [...map.entries()]
    .map(([period, v]) => ({ period, ...v }))
    .sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
}

function computeUsdSpendOverTimeFromInflow(usdTx, granularity = "month") {
  const map = new Map();

  for (const tx of usdTx || []) {
    if (tx?.currency?.type !== "Robux") continue;

    const created = tx?.created;
    const d = created ? new Date(created) : null;
    if (!d || Number.isNaN(d.getTime())) continue;

    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const key = granularity === "year" ? String(y) : `${y}-${String(m).padStart(2, "0")}`;

    const amt = Number(tx.currency?.amount ?? 0) || 0;
    const robuxIn = amt > 0 ? amt : 0;

    const cur = map.get(key) || { robuxBoughtOrValued: 0, usdSpent: 0, txCount: 0 };
    cur.robuxBoughtOrValued += robuxIn;
    cur.usdSpent += robuxIn * USD_PER_ROBUX;
    cur.txCount += 1;
    map.set(key, cur);
  }

  return [...map.entries()]
    .map(([period, v]) => ({
      period,
      ...v,
      usdSpent: Math.round(v.usdSpent * 100) / 100,
    }))
    .sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
}

function mergeRobuxAndUsdSeries(robuxSeries, usdSeries) {
  const map = new Map();

  for (const p of robuxSeries || []) {
    map.set(p.period, {
      period: p.period,
      robux: p.robuxSpent ?? 0,
      purchaseCount: p.purchaseCount ?? 0,
      usd: 0,
    });
  }

  for (const u of usdSeries || []) {
    const cur = map.get(u.period) || { period: u.period, robux: 0, purchaseCount: 0, usd: 0 };
    cur.usd = u.usdSpent ?? 0;
    map.set(u.period, cur);
  }

  return [...map.values()].sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
}

function computeSpendOverTime(purchases, granularity = "month") {
  const robuxSeries = computeRobuxSpendOverTime(purchases, granularity);
  return robuxSeries.map((p) => ({
    period: p.period,
    robux: p.robuxSpent,
    usd: 0,
    purchaseCount: p.purchaseCount,
  }));
}

exports.computeRobuxSpendOverTime = computeRobuxSpendOverTime;
exports.computeUsdSpendOverTimeFromInflow = computeUsdSpendOverTimeFromInflow;
exports.mergeRobuxAndUsdSeries = mergeRobuxAndUsdSeries;
exports.computeSpendOverTime = computeSpendOverTime;
