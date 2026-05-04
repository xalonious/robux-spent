const { cookieHeader } = require("./auth");
const { fetchWithRetry, sleep } = require("./http");

const PAGE_LIMIT = 100;
const DEEP_PAGE_FALLBACK_AFTER = 90;

function isLikelyDeepPaginationWall(e) {
  const message = e?.message ?? String(e);
  return e?.sortOrder === "Asc" && e?.cursor && e?.page >= DEEP_PAGE_FALLBACK_AFTER && /HTTP 500:/i.test(message);
}

async function fetchTransactionPages(
  roblosec,
  userId,
  transactionType,
  progress,
  { label } = {}
) {
  const pageGapMin = 1400;
  const pageGapMax = 2600;

  let cursor = null;
  const out = [];
  let page = 0;

  while (true) {
    const qp = new URLSearchParams();
    qp.set("transactionType", transactionType);
    qp.set("limit", String(PAGE_LIMIT));
    qp.set("sortOrder", "Asc");
    if (cursor) qp.set("cursor", cursor);

    const url = `https://economy.roblox.com/v2/users/${userId}/transactions?${qp.toString()}`;
    const isDeepPage = cursor && page >= DEEP_PAGE_FALLBACK_AFTER;

    let res;
    try {
      res = await fetchWithRetry(
        url,
        {
          method: "GET",
          headers: {
            ...cookieHeader(roblosec),
            "User-Agent": "robux-spend-app/3.0",
            Accept: "application/json",
          },
        },
        {
          maxRetries: 25,
          maxRetriesByStatus: isDeepPage ? { 500: 4 } : {},
          onLog: (m, meta) => progress(m, meta),
        }
      );
    } catch (e) {
      e.partial = out;
      e.page = page;
      e.cursor = cursor;
      e.sortOrder = "Asc";
      throw e;
    }

    const body = await res.json();
    const data = body?.data ?? [];
    const nextCursor = body?.nextPageCursor ?? null;

    for (const tx of data) {
      out.push(tx);
    }

    page++;

    progress(`Fetched ${out.length.toLocaleString()} ${label} tx (page ${page})`, {
      level: "ok",
      kind: "fetched",
      page,
      count: out.length,
      pageCount: data.length,
      sortOrder: "Asc",
    });

    if (!nextCursor || data.length === 0) break;

    cursor = nextCursor;

    const gap = pageGapMin + Math.floor(Math.random() * (pageGapMax - pageGapMin + 1));
    await sleep(gap);
  }

  return { transactions: out, page };
}

function markIncomplete(transactions, { label, transactionType, page, reason }) {
  Object.defineProperty(transactions, "scanMeta", {
    configurable: true,
    enumerable: false,
    value: {
      incomplete: true,
      label,
      transactionType,
      page,
      fetchedCount: transactions.length,
      reason,
    },
  });
  return transactions;
}

async function fetchTransactionsByTypeAllTime(
  roblosec,
  userId,
  transactionType,
  progress = () => {},
  { label = transactionType } = {}
) {
  try {
    const result = await fetchTransactionPages(roblosec, userId, transactionType, progress, {
      label,
    });
    return result.transactions;
  } catch (e) {
    if (!isLikelyDeepPaginationWall(e)) throw e;

    const partial = e.partial || [];
    const reason = `Roblox pagination failed after ${partial.length.toLocaleString()} ${label} tx.`;
    progress(
      `${reason} Results for this type will be marked incomplete.`,
      {
        level: "warn",
        kind: "retry",
        page: e.page,
        count: partial.length,
      }
    );

    return markIncomplete(partial, { label, transactionType, page: e.page, reason });
  }
}

async function fetchPurchasesAllTime(roblosec, userId, progress = () => {}) {
  return fetchTransactionsByTypeAllTime(roblosec, userId, "Purchase", progress, {
    label: "Purchase",
  });
}

exports.fetchTransactionsByTypeAllTime = fetchTransactionsByTypeAllTime;
exports.fetchPurchasesAllTime = fetchPurchasesAllTime;
