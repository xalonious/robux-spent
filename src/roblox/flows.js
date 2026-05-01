const { USD_PER_ROBUX } = require("./constants");
const { fetchTransactionsByTypeAllTime } = require("./transactions");
const { sumRobux } = require("./totals");

async function computeRobuxFlows(roblosec, userId, progress = () => {}) {
  const TYPES = {
    CurrencyPurchase: "CurrencyPurchase",
    PremiumStipend: "PremiumStipend",
    EngagementPayout: "EngagementPayout",
    GroupPayout: "GroupPayout",
    Sale: "Sale",
    TradeRobux: "TradeRobux",
    CurrencyTransfer: "CurrencyTransfer",
    Purchase: "Purchase",
  };

  const inflowOrder = [
    ["CurrencyPurchase", "Robux bought (money)"],
    ["PremiumStipend", "Premium stipend"],
    ["EngagementPayout", "Engagement payout"],
    ["GroupPayout", "Group payout"],
    ["Sale", "Sales"],
    ["TradeRobux", "Trade gains"],
    ["CurrencyTransfer", "Currency transfers"],
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

  for (const [key, label, options = {}] of inflowOrder) {
    progress(`Fetching inflow: ${label} (${TYPES[key]})...`, { level: "muted", kind: "inflow" });

    let tx = [];

    try {
      tx = await fetchTransactionsByTypeAllTime(roblosec, userId, TYPES[key], progress, {
        label: TYPES[key],
      });
    } catch (e) {
      const message = e?.message ?? String(e);

      if (!options.optional || !/HTTP 400:/i.test(message) || !/transactionType/i.test(message)) {
        throw e;
      }

      progress(`Skipping inflow: ${label} (${TYPES[key]}) is not supported by Roblox API.`, {
        level: "muted",
        kind: "inflow",
      });
    }

    if (key === "CurrencyPurchase" || key === "PremiumStipend") {
      usdTx.push(...tx);
    }

    const robux = sumRobux(tx, { mode: "positiveOnly" });
    const sentRobux = key === "CurrencyTransfer" ? sumRobux(tx, { mode: "negativeOnlyAbs" }) : 0;
    const inflowTransactionCount =
      key === "CurrencyTransfer"
        ? tx.filter((t) => t?.currency?.type === "Robux" && Number(t.currency?.amount ?? 0) > 0).length
        : tx.length;

    inflow.breakdown[key] = {
      transactionType: TYPES[key],
      label,
      robux,
      usdEstimate: Math.round(robux * USD_PER_ROBUX * 100) / 100,
      transactionCount: inflowTransactionCount,
    };

    inflow.totalRobux += robux;

    if (key === "CurrencyTransfer") {
      outflow.breakdown[key] = {
        transactionType: TYPES[key],
        label: "Currency transfers sent",
        robux: sentRobux,
        usdEstimate: Math.round(sentRobux * USD_PER_ROBUX * 100) / 100,
        transactionCount: tx.filter(
          (t) => t?.currency?.type === "Robux" && Number(t.currency?.amount ?? 0) < 0
        ).length,
      };

      outflow.totalRobux += sentRobux;
    }
  }

  inflow.usdEstimate = Math.round(inflow.totalRobux * USD_PER_ROBUX * 100) / 100;
  outflow.usdEstimate = Math.round(outflow.totalRobux * USD_PER_ROBUX * 100) / 100;

  return { inflow, outflow, usdTx };
}

exports.computeRobuxFlows = computeRobuxFlows;
