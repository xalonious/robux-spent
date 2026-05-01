export const state = {
  cookiePath: null,
  scanning: false,
  cookieValidated: false,
  spendSeries: { monthly: [], yearly: [], usdPerRobux: 0.01 },
  insights: null,
  chartGranularity: "month",
  chartMetric: "robux",
  hoverIndex: -1,
};
