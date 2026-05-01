const { USD_PER_ROBUX } = require("./constants");
const { computeLeaderboards } = require("./leaderboards");

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

exports.computeRegretSimulatorFromInflow = computeRegretSimulatorFromInflow;
exports.computeInsightsFromSeries = computeInsightsFromSeries;
