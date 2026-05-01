const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
