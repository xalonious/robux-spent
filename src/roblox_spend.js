const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const USD_PER_ROBUX = 0.01;

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

async function fetchWithRetry(
  url,
  init,
  {
    maxRetries = 25,
    baseDelayMs = 1500,
    maxDelayMs = 30_000,
    retryStatuses = new Set([429, 500, 502, 503, 504]),
    onLog = null,
  } = {}
) {
  let attempt = 0;
  let last429At = 0;

  while (true) {
    const res = await fetch(url, init);

    if (res.ok) return res;

    const status = res.status;
    const text = await res.text().catch(() => "");
    const preview = text.slice(0, 160);

    if (!retryStatuses.has(status) || attempt >= maxRetries) {
      throw new Error(`HTTP ${status}: ${text.slice(0, 600)}`);
    }

    let delayMs = baseDelayMs;

    if (status === 429) {
      const ra = res.headers.get("retry-after");
      const sec = ra ? Number(ra) : NaN;

      if (!Number.isNaN(sec) && sec > 0) {
        delayMs = clamp(sec * 1000 + Math.floor(Math.random() * 600), 2000, maxDelayMs);
      } else {
        delayMs = clamp(4000 + attempt * 2500 + Math.floor(Math.random() * 900), 2000, maxDelayMs);
      }

      const now = Date.now();
      if (last429At && now - last429At < 2000) {
        delayMs = clamp(delayMs + 2000, 2000, maxDelayMs);
      }
      last429At = now;

      onLog?.(`Rate limited. Retrying in ${delayMs} ms…`, {
        level: "warn",
        kind: "ratelimit",
        status: 429,
        delayMs,
        preview,
      });
    } else {
      delayMs = clamp(baseDelayMs * 1.8 ** attempt + Math.floor(Math.random() * 700), baseDelayMs, maxDelayMs);
      onLog?.(`Server error (HTTP ${status}). Retrying in ${delayMs} ms…`, {
        level: "warn",
        kind: "retry",
        status,
        delayMs,
        preview,
      });
    }

    await sleep(delayMs);
    attempt++;
  }
}

function cookieHeader(roblosec) {
  return { Cookie: `.ROBLOSECURITY=${roblosec}` };
}

async function getCsrfToken(roblosec, progress) {
  const res = await fetch("https://auth.roblox.com/v2/logout", {
    method: "POST",
    headers: {
      ...cookieHeader(roblosec),
      "User-Agent": "robux-spend-app/3.0",
    },
  });

  const token = res.headers.get("x-csrf-token");
  if (!token) throw new Error("Failed to obtain x-csrf-token (cookie may be invalid).");
  progress?.("CSRF token acquired.");
  return token;
}

async function getUserId(roblosec, progress) {
  const csrf = await getCsrfToken(roblosec, progress);

  const res = await fetch("https://users.roblox.com/v1/users/authenticated", {
    method: "GET",
    headers: {
      ...cookieHeader(roblosec),
      "X-CSRF-TOKEN": csrf,
      "User-Agent": "robux-spend-app/3.0",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Failed to get authenticated user: HTTP ${res.status} ${txt.slice(0, 200)}`);
  }

  const body = await res.json();
  return { userId: body.id };
}

async function getRobuxBalance(roblosec, progress = () => {}) {
  const url = "https://economy.roblox.com/v1/user/currency";

  const res = await fetchWithRetry(
    url,
    {
      method: "GET",
      headers: {
        ...cookieHeader(roblosec),
        "User-Agent": "robux-spend-app/3.0",
        Accept: "application/json",
      },
    },
    { onLog: (m, meta) => progress(m, meta) }
  );

  const body = await res.json().catch(() => ({}));
  const robux = Number(body?.robux ?? 0) || 0;

  progress(`Fetched current Robux balance: R$${robux.toLocaleString()}`, {
    level: "ok",
    kind: "balance",
  });

  return { robux };
}

async function fetchTransactionsByTypeAllTime(
  roblosec,
  userId,
  transactionType,
  progress = () => {},
  { label = transactionType } = {}
) {
  const pageLimit = 100;
  const pageGapMin = 1400;
  const pageGapMax = 2600;

  let cursor = null;
  let out = [];
  let page = 0;

  while (true) {
    const qp = new URLSearchParams();
    qp.set("transactionType", transactionType);
    qp.set("limit", String(pageLimit));
    qp.set("sortOrder", "Asc");
    if (cursor) qp.set("cursor", cursor);

    const url = `https://economy.roblox.com/v2/users/${userId}/transactions?${qp.toString()}`;

    const res = await fetchWithRetry(
      url,
      {
        method: "GET",
        headers: {
          ...cookieHeader(roblosec),
          "User-Agent": "robux-spend-app/3.0",
          Accept: "application/json",
        },
      },
      { onLog: (m, meta) => progress(m, meta) }
    );

    const body = await res.json();
    const data = body?.data ?? [];
    const nextCursor = body?.nextPageCursor ?? null;

    out.push(...data);
    page++;

    progress(`Fetched ${out.length.toLocaleString()} ${label} tx (page ${page})`, {
      level: "ok",
      kind: "fetched",
      page,
      count: out.length,
    });

    if (!nextCursor || data.length === 0) break;

    cursor = nextCursor;

    const gap = pageGapMin + Math.floor(Math.random() * (pageGapMax - pageGapMin + 1));
    await sleep(gap);
  }

  return out;
}

async function fetchPurchasesAllTime(roblosec, userId, progress = () => {}) {
  return fetchTransactionsByTypeAllTime(roblosec, userId, "Purchase", progress, {
    label: "Purchase",
  });
}

function sumRobux(txList, { mode = "positiveOnly" } = {}) {
  let total = 0;

  for (const tx of txList) {
    if (tx?.currency?.type !== "Robux") continue;

    const amt = Number(tx.currency?.amount ?? 0) || 0;

    if (mode === "positiveOnly") {
      if (amt > 0) total += amt;
    } else if (mode === "abs") {
      total += Math.abs(amt);
    } else if (mode === "raw") {
      total += amt;
    }
  }

  return total;
}

function isGameLinkedPurchase(tx) {
  const d = tx?.details || {};
  const place = d.place || null;
  return (
    !!place &&
    (place.universeId || place.placeId || (typeof place.name === "string" && place.name.trim().length > 0))
  );
}

function spendForTx(tx) {
  if (tx?.currency?.type !== "Robux") return 0;
  const amt = Number(tx.currency?.amount ?? 0) || 0;
  return Math.abs(amt);
}

function txDateUTCKey(created) {
  const d = created ? new Date(created) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computeTotals(purchases) {
  let totalSpentAllPurchases = 0;
  let totalSpentInGames = 0;
  let gameLinkedPurchaseCount = 0;
  let nonGamePurchaseCount = 0;

  for (const tx of purchases) {
    if (tx?.currency?.type !== "Robux") continue;

    const spent = spendForTx(tx);
    totalSpentAllPurchases += spent;

    const isGameLinked = isGameLinkedPurchase(tx);

    if (isGameLinked) {
      totalSpentInGames += spent;
      gameLinkedPurchaseCount++;
    } else {
      nonGamePurchaseCount++;
    }
  }

  return {
    totalSpentAllPurchases,
    totalSpentInGames,
    totalSpentOutsideGames: totalSpentAllPurchases - totalSpentInGames,
    gameLinkedPurchaseCount,
    nonGamePurchaseCount,
  };
}

async function computeRobuxFlows(roblosec, userId, progress = () => {}) {
  const TYPES = {
    CurrencyPurchase: "CurrencyPurchase",
    PremiumStipend: "PremiumStipend",
    EngagementPayout: "EngagementPayout",
    GroupPayout: "GroupPayout",
    Sale: "Sale",
    TradeRobux: "TradeRobux",
    Purchase: "Purchase",
  };

  const inflowOrder = [
    ["CurrencyPurchase", "Robux bought (money)"],
    ["PremiumStipend", "Premium stipend"],
    ["EngagementPayout", "Engagement payout"],
    ["GroupPayout", "Group payout"],
    ["Sale", "Sales"],
    ["TradeRobux", "Trade gains"],
  ];

  const inflow = {
    totalRobux: 0,
    usdEstimate: 0,
    breakdown: {},
  };

  const usdTx = [];

  for (const [key, label] of inflowOrder) {
    progress(`Fetching inflow: ${label} (${TYPES[key]})…`, { level: "muted", kind: "inflow" });

    const tx = await fetchTransactionsByTypeAllTime(roblosec, userId, TYPES[key], progress, {
      label: TYPES[key],
    });

    if (key === "CurrencyPurchase" || key === "PremiumStipend") {
      usdTx.push(...tx);
    }

    const robux = sumRobux(tx, { mode: "positiveOnly" });

    inflow.breakdown[key] = {
      transactionType: TYPES[key],
      label,
      robux,
      usdEstimate: Math.round(robux * USD_PER_ROBUX * 100) / 100,
      transactionCount: tx.length,
    };

    inflow.totalRobux += robux;
  }

  inflow.usdEstimate = Math.round(inflow.totalRobux * USD_PER_ROBUX * 100) / 100;

  return { inflow, usdTx };
}

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

function computeRegretSimulatorFromInflow(inflow) {
  const b = inflow?.breakdown || {};
  const robuxUsd = Number(b?.CurrencyPurchase?.usdEstimate ?? 0) || 0;
  const premiumUsd = Number(b?.PremiumStipend?.usdEstimate ?? 0) || 0;

  const usd = Math.round((robuxUsd + premiumUsd) * 100) / 100;

  const equivalents = [
    { label: "AAA games ($70 each)", value: Math.floor(usd / 70) },
    { label: "PS5 consoles ($500 each)", value: Math.floor(usd / 500) },
    { label: "Months of Netflix ($15/mo)", value: Math.floor(usd / 15) },
    { label: "Big Macs ($5 each)", value: Math.floor(usd / 5) },
  ];

  return {
    usd,
    breakdown: {
      robuxUsd: Math.round(robuxUsd * 100) / 100,
      premiumUsd: Math.round(premiumUsd * 100) / 100,
    },
    equivalents,
  };
}

function computeTopExpensivePurchases(purchases, topN = 5) {
  const rows = [];

  for (const tx of purchases || []) {
    if (tx?.currency?.type !== "Robux") continue;
    const spent = spendForTx(tx);
    if (!spent) continue;

    const d = tx.details || {};
    const place = d.place || null;

    rows.push({
      created: tx.created || null,
      robux: spent,
      usdEstimate: Math.round(spent * USD_PER_ROBUX * 100) / 100,

      transactionType: tx.transactionType || "Purchase",
      itemType: d.type || null,
      name: d.name || null,

      placeName: place?.name || null,
      universeId: place?.universeId ?? null,
      placeId: place?.placeId ?? null,
    });
  }

  rows.sort((a, b) => b.robux - a.robux);
  return rows.slice(0, Math.max(0, topN | 0));
}

function computeTopGamesFunded(purchases, topN = 5) {
  const map = new Map();

  for (const tx of purchases || []) {
    if (!isGameLinkedPurchase(tx)) continue;

    const spent = spendForTx(tx);
    if (!spent) continue;

    const d = tx.details || {};
    const place = d.place || {};
    const universeId = place.universeId ?? null;
    const placeId = place.placeId ?? null;
    const placeName = typeof place.name === "string" ? place.name.trim() : "";

    const key =
      universeId != null
        ? `u:${universeId}`
        : placeId != null
        ? `p:${placeId}`
        : placeName
        ? `n:${placeName.toLowerCase()}`
        : null;

    if (!key) continue;

    const cur =
      map.get(key) || {
        robux: 0,
        usdEstimate: 0,
        purchaseCount: 0,
        universeId,
        placeId,
        placeName: placeName || null,
        firstPurchaseAt: null,
        lastPurchaseAt: null,
      };

    cur.robux += spent;
    cur.usdEstimate = Math.round(cur.robux * USD_PER_ROBUX * 100) / 100;
    cur.purchaseCount += 1;

    const created = tx.created ? new Date(tx.created) : null;
    if (created && !Number.isNaN(created.getTime())) {
      const iso = created.toISOString();
      if (!cur.firstPurchaseAt || iso < cur.firstPurchaseAt) cur.firstPurchaseAt = iso;
      if (!cur.lastPurchaseAt || iso > cur.lastPurchaseAt) cur.lastPurchaseAt = iso;
    }

    if (cur.universeId == null && universeId != null) cur.universeId = universeId;
    if (cur.placeId == null && placeId != null) cur.placeId = placeId;
    if (!cur.placeName && placeName) cur.placeName = placeName;

    map.set(key, cur);
  }

  const rows = [...map.values()];
  rows.sort((a, b) => b.robux - a.robux);
  return rows.slice(0, Math.max(0, topN | 0));
}

function computeBiggestSpendingDayEver(purchases, { includeTopPurchases = true, topPurchasesN = 5 } = {}) {
  const map = new Map();

  for (const tx of purchases || []) {
    if (tx?.currency?.type !== "Robux") continue;

    const spent = spendForTx(tx);
    if (!spent) continue;

    const dayKey = txDateUTCKey(tx.created);
    if (!dayKey) continue;

    const cur = map.get(dayKey) || { robux: 0, purchaseCount: 0, purchases: [] };
    cur.robux += spent;
    cur.purchaseCount += 1;

    if (includeTopPurchases) {
      const d = tx.details || {};
      const place = d.place || null;
      cur.purchases.push({
        created: tx.created || null,
        robux: spent,
        usdEstimate: Math.round(spent * USD_PER_ROBUX * 100) / 100,
        itemType: d.type || null,
        name: d.name || null,
        placeName: place?.name || null,
        universeId: place?.universeId ?? null,
        placeId: place?.placeId ?? null,
      });
    }

    map.set(dayKey, cur);
  }

  let bestDay = null;
  for (const [day, v] of map.entries()) {
    if (!bestDay || v.robux > bestDay.robux) {
      bestDay = { day, ...v };
    }
  }

  if (!bestDay) return null;

  const out = {
    day: bestDay.day,
    robux: bestDay.robux,
    usdEstimate: Math.round(bestDay.robux * USD_PER_ROBUX * 100) / 100,
    purchaseCount: bestDay.purchaseCount,
  };

  if (includeTopPurchases) {
    const top = (bestDay.purchases || []).slice().sort((a, b) => b.robux - a.robux);
    out.topPurchases = top.slice(0, Math.max(0, topPurchasesN | 0));
  }

  return out;
}

function computeLeaderboards(purchases, { topN = 5 } = {}) {
  return {
    topExpensivePurchases: computeTopExpensivePurchases(purchases, topN),
    topGamesFunded: computeTopGamesFunded(purchases, topN),
    biggestSpendingDayEver: computeBiggestSpendingDayEver(purchases, {
      includeTopPurchases: true,
      topPurchasesN: topN,
    }),
  };
}

function computeInsightsFromSeries(monthlySeries, yearlySeries, purchasesCountTotal, purchasesMaybe = null) {
  const safe = (n) => (Number.isFinite(n) ? n : 0);

  const peakMonth = (monthlySeries || []).reduce(
    (best, p) => (!best || safe(p.robux) > safe(best.robux) ? p : best),
    null
  );

  const peakYear = (yearlySeries || []).reduce(
    (best, p) => (!best || safe(p.robux) > safe(best.robux) ? p : best),
    null
  );

  const monthsWithSpend = (monthlySeries || []).length || 0;
  const yearsWithSpend = (yearlySeries || []).length || 0;

  const totalRobux = safe((monthlySeries || []).reduce((s, p) => s + safe(p.robux), 0));
  const avgPerMonth = monthsWithSpend ? totalRobux / monthsWithSpend : 0;
  const avgPerYear = yearsWithSpend ? totalRobux / yearsWithSpend : 0;
  const avgPerPurchase = purchasesCountTotal ? totalRobux / purchasesCountTotal : 0;

  const totalUsd = safe((monthlySeries || []).reduce((s, p) => s + safe(p.usd), 0));
  const avgUsdPerMonth = monthsWithSpend ? totalUsd / monthsWithSpend : avgPerMonth * USD_PER_ROBUX;
  const avgUsdPerYear = yearsWithSpend ? totalUsd / yearsWithSpend : avgPerYear * USD_PER_ROBUX;
  const avgUsdPerPurchase = purchasesCountTotal ? totalUsd / purchasesCountTotal : avgPerPurchase * USD_PER_ROBUX;

  const out = {
    peakMonth: peakMonth
      ? {
          period: peakMonth.period,
          robux: safe(peakMonth.robux),
          usdEstimate: Math.round(safe(peakMonth.usd) * 100) / 100,
          purchaseCount: safe(peakMonth.purchaseCount),
        }
      : null,
    peakYear: peakYear
      ? {
          period: peakYear.period,
          robux: safe(peakYear.robux),
          usdEstimate: Math.round(safe(peakYear.usd) * 100) / 100,
          purchaseCount: safe(peakYear.purchaseCount),
        }
      : null,
    averages: {
      robuxPerMonth: Math.round(avgPerMonth * 100) / 100,
      usdPerMonth: Math.round(avgUsdPerMonth * 100) / 100,

      robuxPerYear: Math.round(avgPerYear * 100) / 100,
      usdPerYear: Math.round(avgUsdPerYear * 100) / 100,

      robuxPerPurchase: Math.round(avgPerPurchase * 100) / 100,
      usdPerPurchase: Math.round(avgUsdPerPurchase * 100) / 100,
    },
  };

  if (Array.isArray(purchasesMaybe) && purchasesMaybe.length) {
    out.leaderboards = computeLeaderboards(purchasesMaybe, { topN: 5 });
  }

  return out;
}

exports.fetchAllPurchases = { getUserId, fetchPurchasesAllTime, getRobuxBalance };

exports.computeTotals = computeTotals;
exports.computeRobuxFlows = computeRobuxFlows;

exports.computeRobuxSpendOverTime = computeRobuxSpendOverTime;
exports.computeUsdSpendOverTimeFromInflow = computeUsdSpendOverTimeFromInflow;
exports.mergeRobuxAndUsdSeries = mergeRobuxAndUsdSeries;

exports.computeSpendOverTime = computeSpendOverTime;

exports.computeInsightsFromSeries = computeInsightsFromSeries;

exports.computeTopExpensivePurchases = computeTopExpensivePurchases;
exports.computeTopGamesFunded = computeTopGamesFunded;
exports.computeBiggestSpendingDayEver = computeBiggestSpendingDayEver;
exports.computeLeaderboards = computeLeaderboards;

exports.computeRegretSimulatorFromInflow = computeRegretSimulatorFromInflow;

exports.constants = { USD_PER_ROBUX };
