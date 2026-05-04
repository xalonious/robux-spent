const { cookieHeader } = require("./auth");
const { fetchWithRetry, sleep } = require("./http");

const PAGE_LIMIT = 100;
const DEEP_PAGE_FALLBACK_AFTER = 90;

function transactionKey(tx) {
  const id = tx?.transactionId ?? null;
  if (id != null) return `id:${id}`;
  return `json:${JSON.stringify(tx)}`;
}

function mergeTransactions(primary, secondary) {
  const seen = new Set();
  const merged = [];

  for (const tx of [...(primary || []), ...(secondary || [])]) {
    const key = transactionKey(tx);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(tx);
  }

  return merged;
}

function isLikelyDeepPaginationWall(e) {
  const message = e?.message ?? String(e);
  return e?.sortOrder === "Asc" && e?.cursor && e?.page >= DEEP_PAGE_FALLBACK_AFTER && /HTTP 500:/i.test(message);
}

async function fetchTransactionPages(
  roblosec,
  userId,
  transactionType,
  progress,
  { label, sortOrder, stopKeys = null } = {}
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
    qp.set("sortOrder", sortOrder);
    if (cursor) qp.set("cursor", cursor);

    const url = `https://economy.roblox.com/v2/users/${userId}/transactions?${qp.toString()}`;
    const isDeepPage = sortOrder === "Asc" && cursor && page >= DEEP_PAGE_FALLBACK_AFTER;

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
      e.sortOrder = sortOrder;
      throw e;
    }

    const body = await res.json();
    const data = body?.data ?? [];
    const nextCursor = body?.nextPageCursor ?? null;
    let hitKnownTransaction = false;

    for (const tx of data) {
      const key = transactionKey(tx);
      if (stopKeys?.has(key)) {
        hitKnownTransaction = true;
        continue;
      }
      out.push(tx);
    }

    page++;

    progress(`Fetched ${out.length.toLocaleString()} ${label} tx (page ${page})`, {
      level: "ok",
      kind: "fetched",
      page,
      count: out.length,
      sortOrder,
    });

    if (hitKnownTransaction) {
      progress(`Reverse scan for ${label} reached transactions already fetched from the start.`, {
        level: "ok",
        kind: "fetched",
      });
      break;
    }

    if (!nextCursor || data.length === 0) break;

    cursor = nextCursor;

    const gap = pageGapMin + Math.floor(Math.random() * (pageGapMax - pageGapMin + 1));
    await sleep(gap);
  }

  return { transactions: out, page };
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
      sortOrder: "Asc",
    });
    return result.transactions;
  } catch (e) {
    if (!isLikelyDeepPaginationWall(e)) throw e;

    const ascTx = e.partial || [];
    progress(
      `Hit Roblox pagination wall after ${ascTx.length.toLocaleString()} ${label} tx. Trying reverse scan...`,
      {
        level: "warn",
        kind: "retry",
        page: e.page,
        count: ascTx.length,
      }
    );

    const knownKeys = new Set(ascTx.map(transactionKey));
    let descTx = [];

    try {
      const descResult = await fetchTransactionPages(roblosec, userId, transactionType, progress, {
        label,
        sortOrder: "Desc",
        stopKeys: knownKeys,
      });
      descTx = descResult.transactions;
    } catch (reverseError) {
      if (!/HTTP 500:/i.test(reverseError?.message ?? String(reverseError))) throw reverseError;

      descTx = reverseError.partial || [];
      progress(`Reverse scan for ${label} also hit Roblox pagination wall; using merged partial data.`, {
        level: "warn",
        kind: "retry",
        count: ascTx.length + descTx.length,
      });
    }

    const merged = mergeTransactions(ascTx, descTx);
    progress(`Merged ${merged.length.toLocaleString()} unique ${label} tx from forward and reverse scans.`, {
      level: "ok",
      kind: "fetched",
      count: merged.length,
    });

    return merged;
  }
}

async function fetchPurchasesAllTime(roblosec, userId, progress = () => {}) {
  return fetchTransactionsByTypeAllTime(roblosec, userId, "Purchase", progress, {
    label: "Purchase",
  });
}

exports.fetchTransactionsByTypeAllTime = fetchTransactionsByTypeAllTime;
exports.fetchPurchasesAllTime = fetchPurchasesAllTime;
