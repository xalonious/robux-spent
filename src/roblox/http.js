const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function errorMessage(error) {
  const message = error?.message ?? String(error);
  const code = error?.code ?? error?.cause?.code;
  return code ? `${message} (${code})` : message;
}

async function fetchWithRetry(
  url,
  init,
  {
    maxRetries = 25,
    baseDelayMs = 1500,
    maxDelayMs = 30_000,
    retryStatuses = new Set([429, 500, 502, 503, 504]),
    maxRetriesByStatus = {},
    onLog = null,
  } = {}
) {
  let attempt = 0;
  let last429At = 0;

  while (true) {
    let res;

    try {
      res = await fetch(url, init);
    } catch (e) {
      if (attempt >= maxRetries) throw e;

      const delayMs = clamp(baseDelayMs * 1.8 ** attempt + Math.floor(Math.random() * 700), baseDelayMs, maxDelayMs);
      onLog?.(`Network error: ${errorMessage(e)}. Retrying in ${delayMs} ms...`, {
        level: "warn",
        kind: "retry",
        delayMs,
        error: errorMessage(e),
      });

      await sleep(delayMs);
      attempt++;
      continue;
    }

    if (res.ok) return res;

    const status = res.status;
    const text = await res.text().catch(() => "");
    const preview = text.slice(0, 160);
    const statusMaxRetries = maxRetriesByStatus[status] ?? maxRetries;

    if (!retryStatuses.has(status) || attempt >= statusMaxRetries) {
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

      onLog?.(`Rate limited. Retrying in ${delayMs} ms...`, {
        level: "warn",
        kind: "ratelimit",
        status: 429,
        delayMs,
        preview,
      });
    } else {
      delayMs = clamp(baseDelayMs * 1.8 ** attempt + Math.floor(Math.random() * 700), baseDelayMs, maxDelayMs);
      onLog?.(`Server error (HTTP ${status}). Retrying in ${delayMs} ms...`, {
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

exports.sleep = sleep;
exports.fetchWithRetry = fetchWithRetry;
