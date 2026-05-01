import { state } from "./state.js";
import { els, clearEl, makeRow } from "./dom.js";
import { showLeaderboards } from "./lists.js";
import { fmt, fmtRobux, fmtUSD, periodToPretty } from "./format.js";

export function showRegretSimulatorFromTotals(totals) {
  if (!els.regretTotalUsdEl || !els.regretListEl || !els.regretEmptyEl) return;

  const b = totals?.inflow?.breakdown || {};
  const usdRobux = Number(b?.CurrencyPurchase?.usdEstimate ?? 0) || 0;
  const usdPrem = Number(b?.PremiumStipend?.usdEstimate ?? 0) || 0;
  const totalUsd = Math.round((usdRobux + usdPrem) * 100) / 100;

  els.regretTotalUsdEl.textContent = fmtUSD(totalUsd);

  if (els.regretMetaEl) {
    const bits = [];
    bits.push(`Robux: ${fmtUSD(usdRobux)}`);
    bits.push(`Premium: ${fmtUSD(usdPrem)}`);
    els.regretMetaEl.textContent = bits.join(" - ");
  }

  const ideas = [
    { label: "Big Mac meals", unitCost: 12.0, unit: "meals", note: "avg fast food combo" },
    { label: "Movie tickets", unitCost: 15.0, unit: "tickets", note: "evening ticket" },
    { label: "Steam games", unitCost: 20.0, unit: "games", note: "mid-price pick" },
    { label: "Fancy coffee", unitCost: 6.0, unit: "coffees", note: "latte/cappuccino" },
    { label: "AirPods (base)", unitCost: 129.0, unit: "pairs", note: "approx MSRP" },
    { label: "PS5 games", unitCost: 70.0, unit: "games", note: "new release" },
  ];

  clearEl(els.regretListEl);

  if (!(totalUsd > 0)) {
    els.regretEmptyEl.style.display = "block";
    els.regretListEl.appendChild(els.regretEmptyEl);
    return;
  }

  els.regretEmptyEl.style.display = "none";

  const rows = ideas
    .map((x) => {
      const count = Math.floor(totalUsd / x.unitCost);
      return { ...x, count };
    })
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  if (!rows.length) {
    els.regretEmptyEl.style.display = "block";
    els.regretListEl.appendChild(els.regretEmptyEl);
    return;
  }

  for (const r of rows) {
    els.regretListEl.appendChild(
      makeRow({
        title: r.label,
        meta: r.note,
        value: `${fmt(r.count)} ${r.unit}`,
        valueSub: `@ ${fmtUSD(r.unitCost)} each`,
      })
    );
  }
}

export function showInsights(ins) {
  state.insights = ins || null;

  const avg = ins?.averages || {};
  els.avgPerMonthEl.textContent = fmtRobux(avg.robuxPerMonth ?? 0);
  els.avgPerYearEl.textContent = fmtRobux(avg.robuxPerYear ?? 0);
  els.avgPerPurchaseEl.textContent = fmtRobux(avg.robuxPerPurchase ?? 0);

  const peak = ins?.peakMonth || null;
  if (!peak) {
    els.peakMonthLabelEl.textContent = "-";
    els.peakMonthRobuxEl.textContent = "R$0";
  } else {
    els.peakMonthLabelEl.textContent = `${periodToPretty(peak.period)} - ${fmt(peak.purchaseCount)} purchase${
      peak.purchaseCount === 1 ? "" : "s"
    }`;
    els.peakMonthRobuxEl.textContent = fmtRobux(peak.robux ?? 0);
  }

  showLeaderboards(ins);
}
