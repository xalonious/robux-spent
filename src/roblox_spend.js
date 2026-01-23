const fs = require("fs");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const USD_PER_ROBUX = 0.01; 

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

async function fetchWithRetry(
  url,
  init,
  {
    maxRetries = 25,
    baseDelayMs = 1500,
    maxDelayMs = 30_000,
    retryStatuses = new Set([429, 500, 502, 503, 504]),
    onLog = null,
  } = {}
) {
  let attempt = 0;
  let last429At = 0;

  while (true) {
    const res = await fetch(url, init);

    if (res.ok) return res;

    const status = res.status;
    const text = await res.text().catch(() => "");
    const preview = text.slice(0, 160);

    if (!retryStatuses.has(status) || attempt >= maxRetries) {
      throw new Error(`HTTP ${status}: ${text.slice(0, 600)}`);
    }

    let delayMs = baseDelayMs;

    if (status === 429) {
      const ra = res.headers.get("retry-after");
      const sec = ra ? Number(ra) : NaN;

      if (!Number.isNaN(sec) && sec > 0) {
        delayMs = clamp(sec * 1000 + Math.floor(Math.random() * 600), 2000, maxDelayMs);
      } else {
        delayMs = clamp(4000 + attempt * 2500 + Math.floor(Math.random() * 900), 2000, maxDelayMs);
      }

      const now = Date.now();
      if (last429At && now - last429At < 2000) {
        delayMs = clamp(delayMs + 2000, 2000, maxDelayMs);
      }
      last429At = now;

      onLog?.(`Rate limited. Retrying in ${delayMs} ms…`, {
        level: "warn",
        kind: "ratelimit",
        status: 429,
        delayMs,
        preview,
      });
    } else {
      delayMs = clamp(baseDelayMs * 1.8 ** attempt + Math.floor(Math.random() * 700), baseDelayMs, maxDelayMs);
      onLog?.(`Server error (HTTP ${status}). Retrying in ${delayMs} ms…`, {
        level: "warn",
        kind: "retry",
        status,
        delayMs,
        preview,
      });
    }

    await sleep(delayMs);
    attempt++;
  }
}

function cookieHeader(roblosec) {
  return { Cookie: `.ROBLOSECURITY=${roblosec}` };
}

async function getCsrfToken(roblosec, progress) {
  const res = await fetch("https://auth.roblox.com/v2/logout", {
    method: "POST",
    headers: {
      ...cookieHeader(roblosec),
      "User-Agent": "robux-spend-app/2.3",
    },
  });

  const token = res.headers.get("x-csrf-token");
  if (!token) throw new Error("Failed to obtain x-csrf-token (cookie may be invalid).");
  progress?.("CSRF token acquired.");
  return token;
}

async function getUserId(roblosec, progress) {
  const csrf = await getCsrfToken(roblosec, progress);

  const res = await fetch("https://users.roblox.com/v1/users/authenticated", {
    method: "GET",
    headers: {
      ...cookieHeader(roblosec),
      "X-CSRF-TOKEN": csrf,
      "User-Agent": "robux-spend-app/2.3",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Failed to get authenticated user: HTTP ${res.status} ${txt.slice(0, 200)}`);
  }

  const body = await res.json();
  return { userId: body.id };
}

async function fetchTransactionsByTypeAllTime(
  roblosec,
  userId,
  transactionType,
  progress = () => {},
  {
    checkpointPath = null,
    enableCheckpoint = false,
    label = transactionType,
  } = {}
) {
  const pageLimit = 50;
  const pageGapMin = 1400;
  const pageGapMax = 2600;

  let cursor = null;
  let out = [];
  let page = 0;

  if (enableCheckpoint && checkpointPath && fs.existsSync(checkpointPath)) {
    try {
      const ck = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
      if (ck?.transactionType === transactionType) {
        cursor = ck.cursor ?? null;
        out = ck.data ?? [];
        page = ck.page ?? 0;
        progress(`Resuming checkpoint: ${label} page=${page}, items=${out.length.toLocaleString()}`, {
          level: "warn",
          kind: "checkpoint-resume",
        });
      }
    } catch {}
  }

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
          "User-Agent": "robux-spend-app/2.3",
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

    if (enableCheckpoint && checkpointPath && page % 2 === 0) {
      try {
        fs.writeFileSync(
          checkpointPath,
          JSON.stringify({ transactionType, cursor: nextCursor, data: out, page }, null, 2)
        );
      } catch {}
    }

    if (!nextCursor || data.length === 0) break;

    cursor = nextCursor;

    const gap = pageGapMin + Math.floor(Math.random() * (pageGapMax - pageGapMin + 1));
    await sleep(gap);
  }

  if (enableCheckpoint && checkpointPath) {
    try { fs.unlinkSync(checkpointPath); } catch {}
  }

  return out;
}

async function probeTransactionType(roblosec, userId, transactionType) {
  const qp = new URLSearchParams();
  qp.set("transactionType", transactionType);
  qp.set("limit", "10");
  qp.set("sortOrder", "Desc");

  const url = `https://economy.roblox.com/v2/users/${userId}/transactions?${qp.toString()}`;

  const res = await fetchWithRetry(url, {
    method: "GET",
    headers: {
      ...cookieHeader(roblosec),
      "User-Agent": "robux-spend-app/2.3",
      Accept: "application/json",
    },
  });

  const body = await res.json().catch(() => ({}));
  const data = body?.data ?? [];
  return Array.isArray(data) ? data.length : 0;
}

async function pickFirstWorkingType(roblosec, userId, candidates, progress, label) {
  for (const t of candidates) {
    try {
      progress(`Probing ${label}: ${t}…`, { level: "muted" });
      const count = await probeTransactionType(roblosec, userId, t);
      if (count > 0) {
        progress(`Detected ${label} type: ${t}`, { level: "ok" });
        return t;
      }
    } catch {}
  }
  progress(`No ${label} transaction type detected (will show 0).`, { level: "warn" });
  return null;
}

async function fetchPurchasesAllTime(roblosec, userId, progress = () => {}, opts = {}) {
  return fetchTransactionsByTypeAllTime(roblosec, userId, "Purchase", progress, {
    checkpointPath: opts.checkpointPath,
    enableCheckpoint: true,
    label: "Purchase",
  });
}

function computeTotals(purchases) {
  let totalSpentAllPurchases = 0;
  let totalSpentInGames = 0;
  let gameLinkedPurchaseCount = 0;
  let nonGamePurchaseCount = 0;

  for (const tx of purchases) {
    if (tx?.currency?.type !== "Robux") continue;

    const amt = Number(tx.currency?.amount ?? 0) || 0;
    const spent = Math.abs(amt);
    totalSpentAllPurchases += spent;

    const d = tx.details || {};
    const place = d.place || null;

    const isGameLinked =
      !!place &&
      (place.universeId ||
        place.placeId ||
        (typeof place.name === "string" && place.name.trim().length > 0));

    if (isGameLinked) {
      totalSpentInGames += spent;
      gameLinkedPurchaseCount++;
    } else {
      nonGamePurchaseCount++;
    }
  }

  return {
    totalSpentAllPurchases,
    totalSpentInGames,
    totalSpentOutsideGames: totalSpentAllPurchases - totalSpentInGames,
    gameLinkedPurchaseCount,
    nonGamePurchaseCount,
  };
}

function sumRobuxAbs(txList) {
  let total = 0;
  for (const tx of txList) {
    if (tx?.currency?.type !== "Robux") continue;
    const amt = Number(tx.currency?.amount ?? 0) || 0;
    total += Math.abs(amt);
  }
  return total;
}

async function computeRobuxAcquisitionEstimates(roblosec, userId, progress = () => {}) {
  const premiumCandidates = [
    "PremiumStipend",
    "PremiumStipendCredit",
    "PremiumStipendPayout",
    "Premium",
    "PremiumPayout",
  ];

  const purchaseCandidates = [
    "CurrencyPurchase",
    "RobuxPurchase",
    "PurchaseCredit",
    "Credit",
    "Deposit",
  ];

  const premiumType = await pickFirstWorkingType(roblosec, userId, premiumCandidates, progress, "Premium stipend");
  const robuxBuyType = await pickFirstWorkingType(roblosec, userId, purchaseCandidates, progress, "Robux purchase credits");

  let premiumTx = [];
  let robuxBuyTx = [];

  if (premiumType) {
    progress(`Fetching all Premium stipend transactions (${premiumType})…`);
    premiumTx = await fetchTransactionsByTypeAllTime(roblosec, userId, premiumType, progress, {
      enableCheckpoint: false,
      label: "Premium",
    });
  }

  if (robuxBuyType) {
    progress(`Fetching all Robux purchase credit transactions (${robuxBuyType})…`);
    robuxBuyTx = await fetchTransactionsByTypeAllTime(roblosec, userId, robuxBuyType, progress, {
      enableCheckpoint: false,
      label: "CurrencyPurchase",
    });
  }

  const premiumRobux = sumRobuxAbs(premiumTx);
  const boughtRobux = sumRobuxAbs(robuxBuyTx);

  const premiumUSD = Math.round(premiumRobux * USD_PER_ROBUX * 100) / 100;
  const boughtUSD = Math.round(boughtRobux * USD_PER_ROBUX * 100) / 100;

  const totalRobux = premiumRobux + boughtRobux;
  const totalUSD = Math.round((premiumUSD + boughtUSD) * 100) / 100;

  return {
    usdPerRobux: USD_PER_ROBUX,
    rateNote: "Using 1000 Robux = $10 (USD)",
    premium: {
      detectedType: premiumType,
      robux: premiumRobux,
      usdEstimate: premiumUSD,
      transactionCount: premiumTx.length,
    },
    robuxPurchases: {
      detectedType: robuxBuyType,
      robux: boughtRobux,
      usdEstimate: boughtUSD,
      transactionCount: robuxBuyTx.length,
    },
    total: {
      robux: totalRobux,
      usdEstimate: totalUSD,
    },
  };
}

exports.fetchAllPurchases = { getUserId, fetchPurchasesAllTime };
exports.computeTotals = computeTotals;
exports.computeRobuxAcquisitionEstimates = computeRobuxAcquisitionEstimates;
