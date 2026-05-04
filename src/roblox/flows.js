const { USD_PER_ROBUX } = require("./constants");
const { fetchTransactionsByTypeAllTime } = require("./transactions");
const { sumRobux } = require("./totals");

function statusText(tx) {
  return [
    tx?.status,
    tx?.state,
    tx?.transactionStatus,
    tx?.details?.status,
    tx?.details?.state,
    tx?.details?.transactionStatus,
  ]
    .filter((v) => v != null)
    .map((v) => String(v).trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function isCanceledOrFailedDevEx(tx) {
  const status = statusText(tx);
  return /\b(cancelled|canceled|declined|denied|rejected|failed|expired|voided|refunded)\b/i.test(status);
}

function isCompletedDevEx(tx) {
  const status = statusText(tx);
  if (!status) return true;
  if (isCanceledOrFailedDevEx(tx)) return false;
  return /\b(completed|complete|paid|processed|succeeded|success|approved)\b/i.test(status);
}

function applyScanMeta(card, tx) {
  const meta = tx?.scanMeta;
  if (!meta?.incomplete) return card;
  card.incomplete = true;
  card.incompleteReason = meta.reason;
  return card;
}

async function computeRobuxFlows(roblosec, userId, progress = () => {}) {
  const TYPES = {
    CurrencyPurchase: "CurrencyPurchase",
    PremiumStipend: "PremiumStipend",
    EngagementPayout: "EngagementPayout",
    GroupPayout: "GroupPayout",
    Sale: "Sale",
    TradeRobux: "TradeRobux",
    CurrencyTransfer: "CurrencyTransfer",
    DevEx: "DevEx",
    Purchase: "Purchase",
  };

  const flowDefinitions = [
    { key: "CurrencyPurchase", label: "Robux bought (money)", flowKind: "inflow" },
    { key: "PremiumStipend", label: "Premium stipend", flowKind: "inflow" },
    { key: "EngagementPayout", label: "Engagement payout", flowKind: "inflow" },
    { key: "GroupPayout", label: "Group payout", flowKind: "inflow" },
    { key: "Sale", label: "Sales", flowKind: "inflow" },
    { key: "TradeRobux", label: "Trades", flowKind: "both" },
    { key: "CurrencyTransfer", label: "Currency transfers", flowKind: "both" },
    { key: "DevEx", label: "DevEx", flowKind: "outflow" },
  ];

  const inflow = {
    totalRobux: 0,
    usdEstimate: 0,
    breakdown: {},
  };
  const outflow = {
    totalRobux: 0,
    usdEstimate: 0,
    breakdown: {},
  };

  const usdTx = [];

  for (const { key, label, flowKind, optional = false } of flowDefinitions) {
    const progressKind = flowKind === "both" ? "inflow/outflow" : flowKind;
    progress(`Fetching ${progressKind}: ${label} (${TYPES[key]})...`, { level: "muted", kind: flowKind });

    let tx = [];

    try {
      tx = await fetchTransactionsByTypeAllTime(roblosec, userId, TYPES[key], progress, {
        label: TYPES[key],
      });
    } catch (e) {
      const message = e?.message ?? String(e);

      if (!optional || !/HTTP 400:/i.test(message) || !/transactionType/i.test(message)) {
        throw e;
      }

      progress(`Skipping ${progressKind}: ${label} (${TYPES[key]}) is not supported by Roblox API.`, {
        level: "muted",
        kind: flowKind,
      });
    }

    if (key === "CurrencyPurchase" || key === "PremiumStipend") {
      usdTx.push(...tx);
    }

    const effectiveTx = key === "DevEx" ? tx.filter(isCompletedDevEx) : tx;
    const skippedTx = tx.length - effectiveTx.length;

    if (key === "DevEx" && skippedTx > 0) {
      progress(`Ignored ${skippedTx.toLocaleString()} canceled/rejected DevEx tx.`, {
        level: "muted",
        kind: "outflow",
      });
    }

    const robux = key === "DevEx" ? 0 : sumRobux(effectiveTx, { mode: "positiveOnly" });
    const sentRobux =
      key === "CurrencyTransfer" || key === "TradeRobux" || key === "DevEx"
        ? sumRobux(effectiveTx, { mode: "negativeOnlyAbs" })
        : 0;
    const inflowTransactionCount =
      key === "CurrencyTransfer"
        ? effectiveTx.filter((t) => t?.currency?.type === "Robux" && Number(t.currency?.amount ?? 0) > 0).length
        : tx.length;

    if (key !== "DevEx") {
      inflow.breakdown[key] = applyScanMeta({
        transactionType: TYPES[key],
        label,
        robux,
        usdEstimate: Math.round(robux * USD_PER_ROBUX * 100) / 100,
        transactionCount: inflowTransactionCount,
      }, tx);

      inflow.totalRobux += robux;
    }

    if (key === "TradeRobux") {
      outflow.breakdown[key] = applyScanMeta({
        transactionType: TYPES[key],
        label: "Trade losses",
        robux: sentRobux,
        usdEstimate: Math.round(sentRobux * USD_PER_ROBUX * 100) / 100,
        transactionCount: effectiveTx.filter(
          (t) => t?.currency?.type === "Robux" && Number(t.currency?.amount ?? 0) < 0
        ).length,
      }, tx);

      outflow.totalRobux += sentRobux;
    }

    if (key === "CurrencyTransfer") {
      outflow.breakdown[key] = applyScanMeta({
        transactionType: TYPES[key],
        label: "Currency transfers sent",
        robux: sentRobux,
        usdEstimate: Math.round(sentRobux * USD_PER_ROBUX * 100) / 100,
        transactionCount: effectiveTx.filter(
          (t) => t?.currency?.type === "Robux" && Number(t.currency?.amount ?? 0) < 0
        ).length,
      }, tx);

      outflow.totalRobux += sentRobux;
    }

    if (key === "DevEx") {
      outflow.breakdown[key] = applyScanMeta({
        transactionType: TYPES[key],
        label: "Converted via DevEx",
        robux: sentRobux,
        usdEstimate: Math.round(sentRobux * USD_PER_ROBUX * 100) / 100,
        transactionCount: effectiveTx.filter(
          (t) => t?.currency?.type === "Robux" && Number(t.currency?.amount ?? 0) < 0
        ).length,
      }, tx);

      outflow.totalRobux += sentRobux;
    }
  }

  inflow.usdEstimate = Math.round(inflow.totalRobux * USD_PER_ROBUX * 100) / 100;
  outflow.usdEstimate = Math.round(outflow.totalRobux * USD_PER_ROBUX * 100) / 100;
  inflow.incomplete = Object.values(inflow.breakdown).some((card) => card?.incomplete);
  outflow.incomplete = Object.values(outflow.breakdown).some((card) => card?.incomplete);

  return { inflow, outflow, usdTx };
}

exports.computeRobuxFlows = computeRobuxFlows;
