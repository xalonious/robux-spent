import { setCardIncomplete, setCardValue, updateZeroCardVisibility } from "./dom.js";
import { fmt, fmtRobux, fmtUSD } from "./format.js";

function setIncompleteCards(ids, incomplete) {
  for (const id of ids) setCardIncomplete(id, incomplete);
}

export function showStats(totals, purchaseCount) {
  setCardValue("totalSpent", fmtRobux(totals.totalSpentAllPurchases), totals.totalSpentAllPurchases);
  setCardValue("purchaseCount", fmt(purchaseCount), purchaseCount);
  setCardValue("gameSpent", fmtRobux(totals.totalSpentInGames), totals.totalSpentInGames);
  setCardValue("avatarSpent", fmtRobux(totals.totalSpentOnAvatarItems), totals.totalSpentOnAvatarItems);
  setCardValue("devProductsSpent", fmtRobux(totals.totalSpentOnDeveloperProducts), totals.totalSpentOnDeveloperProducts);
  setCardValue("gamePassesSpent", fmtRobux(totals.totalSpentOnGamePasses), totals.totalSpentOnGamePasses);
  setCardValue("privateServersSpent", fmtRobux(totals.totalSpentOnPrivateServers), totals.totalSpentOnPrivateServers);
  setCardValue("usernameChangesSpent", fmtRobux(totals.totalSpentOnUsernameChanges), totals.totalSpentOnUsernameChanges);
  setCardValue("groupRanksSpent", fmtRobux(totals.totalSpentOnGroupRanks), totals.totalSpentOnGroupRanks);
  setIncompleteCards(
    [
      "totalSpent",
      "purchaseCount",
      "gameSpent",
      "avatarSpent",
      "devProductsSpent",
      "gamePassesSpent",
      "privateServersSpent",
      "usernameChangesSpent",
      "groupRanksSpent",
    ],
    Boolean(totals.incomplete)
  );

  const bal = totals.balance || {};
  setCardValue("robuxBalance", fmtRobux(bal.robux ?? 0), bal.robux ?? 0);

  const inflow = totals.inflow || {};
  setCardValue("inflowTotal", fmtRobux(inflow.totalRobux ?? 0), inflow.totalRobux ?? 0);
  setCardIncomplete("inflowTotal", Boolean(inflow.incomplete));

  const b = inflow.breakdown || {};
  const getR = (k) => b?.[k]?.robux ?? 0;
  const isIncomplete = (k) => Boolean(b?.[k]?.incomplete);

  setCardValue("inflowCurrencyPurchase", fmtRobux(getR("CurrencyPurchase")), getR("CurrencyPurchase"));
  setCardIncomplete("inflowCurrencyPurchase", isIncomplete("CurrencyPurchase"));
  setCardValue("inflowPremiumStipend", fmtRobux(getR("PremiumStipend")), getR("PremiumStipend"));
  setCardIncomplete("inflowPremiumStipend", isIncomplete("PremiumStipend"));
  setCardValue("inflowEngagementPayout", fmtRobux(getR("EngagementPayout")), getR("EngagementPayout"));
  setCardIncomplete("inflowEngagementPayout", isIncomplete("EngagementPayout"));
  setCardValue("inflowGroupPayout", fmtRobux(getR("GroupPayout")), getR("GroupPayout"));
  setCardIncomplete("inflowGroupPayout", isIncomplete("GroupPayout"));
  setCardValue("inflowSale", fmtRobux(getR("Sale")), getR("Sale"));
  setCardIncomplete("inflowSale", isIncomplete("Sale"));
  setCardValue("inflowTradeRobux", fmtRobux(getR("TradeRobux")), getR("TradeRobux"));
  setCardIncomplete("inflowTradeRobux", isIncomplete("TradeRobux"));
  setCardValue("inflowRobuxTransfers", fmtRobux(getR("CurrencyTransfer")), getR("CurrencyTransfer"));
  setCardIncomplete("inflowRobuxTransfers", isIncomplete("CurrencyTransfer"));

  const getUSD = (k) => b?.[k]?.usdEstimate ?? 0;
  setCardValue("usdSpentOnRobux", fmtUSD(getUSD("CurrencyPurchase")), getUSD("CurrencyPurchase"));
  setCardIncomplete("usdSpentOnRobux", isIncomplete("CurrencyPurchase"));
  setCardValue("usdSpentOnPremium", fmtUSD(getUSD("PremiumStipend")), getUSD("PremiumStipend"));
  setCardIncomplete("usdSpentOnPremium", isIncomplete("PremiumStipend"));

  const outflow = totals.outflow || {};
  const outB = outflow.breakdown || {};
  const getOutR = (k) => outB?.[k]?.robux ?? 0;
  const isOutIncomplete = (k) => Boolean(outB?.[k]?.incomplete);
  setCardValue("outflowTradeRobux", fmtRobux(getOutR("TradeRobux")), getOutR("TradeRobux"));
  setCardIncomplete("outflowTradeRobux", isOutIncomplete("TradeRobux"));
  setCardValue("outflowRobuxTransfers", fmtRobux(getOutR("CurrencyTransfer")), getOutR("CurrencyTransfer"));
  setCardIncomplete("outflowRobuxTransfers", isOutIncomplete("CurrencyTransfer"));
  setCardValue("outflowDevEx", fmtRobux(getOutR("DevEx")), getOutR("DevEx"));
  setCardIncomplete("outflowDevEx", isOutIncomplete("DevEx"));

  updateZeroCardVisibility();
}
