const { USD_PER_ROBUX } = require("./constants");
const { isGameLinkedPurchase, spendForTx, txDateUTCKey } = require("./totals");

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

exports.computeTopExpensivePurchases = computeTopExpensivePurchases;
exports.computeTopGamesFunded = computeTopGamesFunded;
exports.computeBiggestSpendingDayEver = computeBiggestSpendingDayEver;
exports.computeLeaderboards = computeLeaderboards;
