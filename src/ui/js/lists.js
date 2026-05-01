import { els, clearEl, makeRow } from "./dom.js";
import { dayToPretty, fmt, fmtRobux } from "./format.js";

export function showLeaderboards(ins) {
  const lb = ins?.leaderboards || null;

  clearEl(els.topPurchasesListEl);

  const topExp = lb?.topExpensivePurchases || [];
  if (!topExp.length) {
    if (els.topPurchasesEmptyEl) els.topPurchasesEmptyEl.style.display = "block";
    if (els.topPurchasesListEl && els.topPurchasesEmptyEl) {
      els.topPurchasesListEl.appendChild(els.topPurchasesEmptyEl);
    }
  } else {
    if (els.topPurchasesEmptyEl) els.topPurchasesEmptyEl.style.display = "none";

    for (const p of topExp) {
      const title = p.name || p.itemType || "Purchase";
      const metaBits = [];
      if (p.itemType) metaBits.push(p.itemType);
      if (p.placeName) metaBits.push(p.placeName);
      const meta = metaBits.join(" - ");

      const day = p.created ? String(p.created).slice(0, 10) : null;

      els.topPurchasesListEl.appendChild(
        makeRow({
          title,
          meta,
          value: fmtRobux(p.robux ?? 0),
          valueSub: day ? dayToPretty(day) : "",
        })
      );
    }
  }

  clearEl(els.topGamesListEl);

  const topGames = lb?.topGamesFunded || [];
  if (!topGames.length) {
    if (els.topGamesEmptyEl) els.topGamesEmptyEl.style.display = "block";
    if (els.topGamesListEl && els.topGamesEmptyEl) els.topGamesListEl.appendChild(els.topGamesEmptyEl);
  } else {
    if (els.topGamesEmptyEl) els.topGamesEmptyEl.style.display = "none";

    for (const g of topGames) {
      els.topGamesListEl.appendChild(
        makeRow({
          title: g.placeName || "Unknown game",
          meta: g.universeId != null ? `Universe ${g.universeId}` : g.placeId != null ? `Place ${g.placeId}` : "",
          value: fmtRobux(g.robux ?? 0),
          valueSub: `${fmt(g.purchaseCount ?? 0)} purchase${(g.purchaseCount ?? 0) === 1 ? "" : "s"}`,
        })
      );
    }
  }

  const bd = lb?.biggestSpendingDayEver || null;

  if (!bd) {
    els.bigDayLabelEl.textContent = "-";
    els.bigDayRobuxEl.textContent = "R$0";
    clearEl(els.bigDayTopListEl);
    if (els.bigDayTopEmptyEl) {
      els.bigDayTopEmptyEl.style.display = "block";
      els.bigDayTopListEl.appendChild(els.bigDayTopEmptyEl);
    }
    return;
  }

  els.bigDayLabelEl.textContent = `${dayToPretty(bd.day)} - ${fmt(bd.purchaseCount ?? 0)} purchase${
    (bd.purchaseCount ?? 0) === 1 ? "" : "s"
  }`;

  els.bigDayRobuxEl.textContent = fmtRobux(bd.robux ?? 0);

  clearEl(els.bigDayTopListEl);

  const top = bd.topPurchases || [];
  if (!top.length) {
    if (els.bigDayTopEmptyEl) {
      els.bigDayTopEmptyEl.style.display = "block";
      els.bigDayTopListEl.appendChild(els.bigDayTopEmptyEl);
    }
  } else {
    if (els.bigDayTopEmptyEl) els.bigDayTopEmptyEl.style.display = "none";

    for (const p of top) {
      const title = p.name || p.itemType || "Purchase";
      const metaBits = [];
      if (p.itemType) metaBits.push(p.itemType);
      if (p.placeName) metaBits.push(p.placeName);
      const meta = metaBits.join(" - ");

      els.bigDayTopListEl.appendChild(
        makeRow({
          title,
          meta,
          value: fmtRobux(p.robux ?? 0),
          valueSub: p.created ? new Date(p.created).toLocaleString() : "",
        })
      );
    }
  }
}
