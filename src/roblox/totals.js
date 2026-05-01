function sumRobux(txList, { mode = "positiveOnly" } = {}) {
  let total = 0;

  for (const tx of txList) {
    if (tx?.currency?.type !== "Robux") continue;

    const amt = Number(tx.currency?.amount ?? 0) || 0;

    if (mode === "positiveOnly") {
      if (amt > 0) total += amt;
    } else if (mode === "negativeOnlyAbs") {
      if (amt < 0) total += Math.abs(amt);
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

exports.sumRobux = sumRobux;
exports.isGameLinkedPurchase = isGameLinkedPurchase;
exports.spendForTx = spendForTx;
exports.txDateUTCKey = txDateUTCKey;
exports.computeTotals = computeTotals;
