const { USD_PER_ROBUX } = require("./constants");
const { getRobuxBalance, getUserId } = require("./auth");
const { fetchPurchasesAllTime } = require("./transactions");
const { computeTotals } = require("./totals");
const { computeRobuxFlows } = require("./flows");
const {
  computeRobuxSpendOverTime,
  computeUsdSpendOverTimeFromInflow,
  mergeRobuxAndUsdSeries,
  computeSpendOverTime,
} = require("./series");
const {
  computeTopExpensivePurchases,
  computeTopGamesFunded,
  computeBiggestSpendingDayEver,
  computeLeaderboards,
} = require("./leaderboards");
const { computeInsightsFromSeries, computeRegretSimulatorFromInflow } = require("./insights");

exports.fetchAllPurchases = { getUserId, fetchPurchasesAllTime, getRobuxBalance };

exports.computeTotals = computeTotals;
exports.computeRobuxFlows = computeRobuxFlows;

exports.computeRobuxSpendOverTime = computeRobuxSpendOverTime;
exports.computeUsdSpendOverTimeFromInflow = computeUsdSpendOverTimeFromInflow;
exports.mergeRobuxAndUsdSeries = mergeRobuxAndUsdSeries;

exports.computeSpendOverTime = computeSpendOverTime;

exports.computeInsightsFromSeries = computeInsightsFromSeries;

exports.computeTopExpensivePurchases = computeTopExpensivePurchases;
exports.computeTopGamesFunded = computeTopGamesFunded;
exports.computeBiggestSpendingDayEver = computeBiggestSpendingDayEver;
exports.computeLeaderboards = computeLeaderboards;

exports.computeRegretSimulatorFromInflow = computeRegretSimulatorFromInflow;

exports.constants = { USD_PER_ROBUX };
