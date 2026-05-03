import { setCardValue, updateZeroCardVisibility } from "./dom.js";
import { fmt, fmtRobux, fmtUSD } from "./format.js";

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

  const bal = totals.balance || {};
  setCardValue("robuxBalance", fmtRobux(bal.robux ?? 0), bal.robux ?? 0);

  const inflow = totals.inflow || {};
  setCardValue("inflowTotal", fmtRobux(inflow.totalRobux ?? 0), inflow.totalRobux ?? 0);

  const b = inflow.breakdown || {};
  const getR = (k) => b?.[k]?.robux ?? 0;

  setCardValue("inflowCurrencyPurchase", fmtRobux(getR("CurrencyPurchase")), getR("CurrencyPurchase"));
  setCardValue("inflowPremiumStipend", fmtRobux(getR("PremiumStipend")), getR("PremiumStipend"));
  setCardValue("inflowEngagementPayout", fmtRobux(getR("EngagementPayout")), getR("EngagementPayout"));
  setCardValue("inflowGroupPayout", fmtRobux(getR("GroupPayout")), getR("GroupPayout"));
  setCardValue("inflowSale", fmtRobux(getR("Sale")), getR("Sale"));
  setCardValue("inflowTradeRobux", fmtRobux(getR("TradeRobux")), getR("TradeRobux"));
  setCardValue("inflowRobuxTransfers", fmtRobux(getR("CurrencyTransfer")), getR("CurrencyTransfer"));

  const getUSD = (k) => b?.[k]?.usdEstimate ?? 0;
  setCardValue("usdSpentOnRobux", fmtUSD(getUSD("CurrencyPurchase")), getUSD("CurrencyPurchase"));
  setCardValue("usdSpentOnPremium", fmtUSD(getUSD("PremiumStipend")), getUSD("PremiumStipend"));

  const outflow = totals.outflow || {};
  const outB = outflow.breakdown || {};
  const getOutR = (k) => outB?.[k]?.robux ?? 0;
  setCardValue("outflowTradeRobux", fmtRobux(getOutR("TradeRobux")), getOutR("TradeRobux"));
  setCardValue("outflowRobuxTransfers", fmtRobux(getOutR("CurrencyTransfer")), getOutR("CurrencyTransfer"));

  updateZeroCardVisibility();
}
