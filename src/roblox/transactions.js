const { cookieHeader } = require("./auth");
const { fetchWithRetry, sleep } = require("./http");

async function fetchTransactionsByTypeAllTime(
  roblosec,
  userId,
  transactionType,
  progress = () => {},
  { label = transactionType } = {}
) {
  const pageLimit = 100;
  const pageGapMin = 1400;
  const pageGapMax = 2600;

  let cursor = null;
  const out = [];
  let page = 0;

  while (true) {
    const qp = new URLSearchParams();
    qp.set("transactionType", transactionType);
    qp.set("limit", String(pageLimit));
    qp.set("sortOrder", "Asc");
    if (cursor) qp.set("cursor", cursor);

    const url = `https://economy.roblox.com/v2/users/${userId}/transactions?${qp.toString()}`;

    const res = await fetchWithRetry(
      url,
      {
        method: "GET",
        headers: {
          ...cookieHeader(roblosec),
          "User-Agent": "robux-spend-app/3.0",
          Accept: "application/json",
        },
      },
      { onLog: (m, meta) => progress(m, meta) }
    );

    const body = await res.json();
    const data = body?.data ?? [];
    const nextCursor = body?.nextPageCursor ?? null;

    out.push(...data);
    page++;

    progress(`Fetched ${out.length.toLocaleString()} ${label} tx (page ${page})`, {
      level: "ok",
      kind: "fetched",
      page,
      count: out.length,
    });

    if (!nextCursor || data.length === 0) break;

    cursor = nextCursor;

    const gap = pageGapMin + Math.floor(Math.random() * (pageGapMax - pageGapMin + 1));
    await sleep(gap);
  }

  return out;
}

async function fetchPurchasesAllTime(roblosec, userId, progress = () => {}) {
  return fetchTransactionsByTypeAllTime(roblosec, userId, "Purchase", progress, {
    label: "Purchase",
  });
}

exports.fetchTransactionsByTypeAllTime = fetchTransactionsByTypeAllTime;
exports.fetchPurchasesAllTime = fetchPurchasesAllTime;
