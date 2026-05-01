const { fetchWithRetry } = require("./http");

function cookieHeader(roblosec) {
  return { Cookie: `.ROBLOSECURITY=${roblosec}` };
}

async function getCsrfToken(roblosec, progress) {
  const res = await fetch("https://auth.roblox.com/v2/logout", {
    method: "POST",
    headers: {
      ...cookieHeader(roblosec),
      "User-Agent": "robux-spend-app/3.0",
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
      "User-Agent": "robux-spend-app/3.0",
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

async function getRobuxBalance(roblosec, progress = () => {}) {
  const url = "https://economy.roblox.com/v1/user/currency";

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

  const body = await res.json().catch(() => ({}));
  const robux = Number(body?.robux ?? 0) || 0;

  progress(`Fetched current Robux balance: R$${robux.toLocaleString()}`, {
    level: "ok",
    kind: "balance",
  });

  return { robux };
}

exports.cookieHeader = cookieHeader;
exports.getCsrfToken = getCsrfToken;
exports.getUserId = getUserId;
exports.getRobuxBalance = getRobuxBalance;
