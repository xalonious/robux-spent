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

const GAME_PURCHASE_TYPES = new Set(["DeveloperProduct", "GamePass", "PrivateServer"]);
const AVATAR_PURCHASE_TYPES = new Set(["Asset", "Bundle"]);
const GROUP_ROBLOX_PRODUCT_NAMES = new Set(["Group", "GroupRoleSet"]);

function detailsTypeForTx(tx) {
  const type = tx?.details?.type;
  return typeof type === "string" && type.trim() ? type.trim() : "Unknown";
}

function detailsNameForTx(tx) {
  const name = tx?.details?.name;
  return typeof name === "string" && name.trim() ? name.trim() : "Unknown";
}

function getTypeSummary(breakdown, type) {
  return breakdown[type] || { robux: 0, purchaseCount: 0 };
}

function sumTypeRobux(breakdown, types) {
  let total = 0;
  for (const type of types) total += getTypeSummary(breakdown, type).robux;
  return total;
}

function sumNameRobux(breakdown, names) {
  let total = 0;
  for (const name of names) total += getTypeSummary(breakdown, name).robux;
  return total;
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
  const scanMeta = purchases?.scanMeta || null;
  const incomplete = Boolean(scanMeta?.incomplete);
  let totalSpentAllPurchases = 0;
  const purchaseTypeBreakdown = {};
  const robloxProductBreakdown = {};

  for (const tx of purchases) {
    if (tx?.currency?.type !== "Robux") continue;

    const spent = spendForTx(tx);
    totalSpentAllPurchases += spent;

    const detailsType = detailsTypeForTx(tx);
    const typeSummary = getTypeSummary(purchaseTypeBreakdown, detailsType);
    typeSummary.robux += spent;
    typeSummary.purchaseCount += 1;
    purchaseTypeBreakdown[detailsType] = typeSummary;

    if (detailsType === "RobloxProduct") {
      const detailsName = detailsNameForTx(tx);
      const productSummary = getTypeSummary(robloxProductBreakdown, detailsName);
      productSummary.robux += spent;
      productSummary.purchaseCount += 1;
      robloxProductBreakdown[detailsName] = productSummary;
    }
  }

  const totalSpentInGames = sumTypeRobux(purchaseTypeBreakdown, GAME_PURCHASE_TYPES);
  const totalSpentOnAvatarItems = sumTypeRobux(purchaseTypeBreakdown, AVATAR_PURCHASE_TYPES);
  const totalSpentOnDeveloperProducts = getTypeSummary(purchaseTypeBreakdown, "DeveloperProduct").robux;
  const totalSpentOnGamePasses = getTypeSummary(purchaseTypeBreakdown, "GamePass").robux;
  const totalSpentOnPrivateServers = getTypeSummary(purchaseTypeBreakdown, "PrivateServer").robux;
  const totalSpentOnUsernameChanges = getTypeSummary(robloxProductBreakdown, "Username Change").robux;
  const totalSpentOnGroupRanks = sumNameRobux(robloxProductBreakdown, GROUP_ROBLOX_PRODUCT_NAMES);

  return {
    totalSpentAllPurchases,
    totalSpentInGames,
    totalSpentOnAvatarItems,
    totalSpentOnDeveloperProducts,
    totalSpentOnGamePasses,
    totalSpentOnPrivateServers,
    totalSpentOnUsernameChanges,
    totalSpentOnGroupRanks,
    totalSpentOutsideGames: totalSpentAllPurchases - totalSpentInGames,
    incomplete,
    incompleteReason: scanMeta?.reason || null,
    purchaseTypeBreakdown,
    robloxProductBreakdown,
  };
}

exports.sumRobux = sumRobux;
exports.isGameLinkedPurchase = isGameLinkedPurchase;
exports.detailsTypeForTx = detailsTypeForTx;
exports.detailsNameForTx = detailsNameForTx;
exports.spendForTx = spendForTx;
exports.txDateUTCKey = txDateUTCKey;
exports.computeTotals = computeTotals;
