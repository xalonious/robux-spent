const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const {
  fetchAllPurchases,
  computeTotals,
  computeRobuxAcquisitionEstimates,
  computeSpendOverTime,
  computeInsightsFromSeries,
  constants,
} = require("./roblox_spend");

function createWindow() {
  const win = new BrowserWindow({
    width: 1040,
    height: 820,
    backgroundColor: "#0b0f1a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function normalizeCookie(raw) {
  let cookie = String(raw ?? "").trim();
  cookie = cookie.replace(/^ROBLOX_COOKIE=/i, "").trim();
  cookie = cookie.replace(/^\.ROBLOSECURITY=/i, "").trim();
  cookie = cookie.replace(/^"+|"+$/g, "").trim(); // strip quotes
  return cookie;
}

function validateCookieFormat(cookie, rawText = "") {
  if (!cookie) return { ok: false, error: "Cookie file is empty." };

  if (cookie.length < 80) {
    return { ok: false, error: "Cookie looks too short to be a .ROBLOSECURITY token." };
  }

  if (/\s/.test(cookie)) {
    return { ok: false, error: "Cookie contains whitespace; file should contain only the raw value." };
  }

  if (!cookie.startsWith("_|WARNING:-DO-NOT-SHARE-THIS")) {
    return { ok: false, error: "Cookie doesn't start with the expected Roblox warning prefix." };
  }

  if (String(rawText).length > 10_000) {
    return { ok: false, error: "Cookie file is unexpectedly large. It should contain only the cookie value." };
  }

  const nonEmptyLines = String(rawText).split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (nonEmptyLines.length > 5) {
    return { ok: false, error: "Cookie file has many lines. It should contain only the cookie value." };
  }

  return { ok: true };
}

ipcMain.handle("pick-cookie-file", async () => {
  const res = await dialog.showOpenDialog({
    title: "Select cookie.txt (contains only your .ROBLOSECURITY value)",
    properties: ["openFile"],
    filters: [
      { name: "Text", extensions: ["txt"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (res.canceled || !res.filePaths?.[0]) return { ok: false, error: "Canceled" };
  return { ok: true, path: res.filePaths[0] };
});

ipcMain.handle("validate-cookie", async (event, { cookiePath }) => {
  try {
    if (!cookiePath) return { ok: false, error: "No cookie file selected." };
    if (!fs.existsSync(cookiePath)) return { ok: false, error: "Cookie file not found." };

    const raw = fs.readFileSync(cookiePath, "utf8");
    const cookie = normalizeCookie(raw);

    const v = validateCookieFormat(cookie, raw);
    if (!v.ok) return { ok: false, error: v.error };

    const progress = (msg, meta = {}) => {
      event.sender.send("scan-progress", { msg, meta, ts: Date.now() });
    };

    progress("Validating cookie…", { level: "muted", kind: "validate" });

    const { userId } = await fetchAllPurchases.getUserId(cookie, (m, meta) =>
      progress(m, { ...(meta || {}), level: "muted", kind: "validate" })
    );

    progress(`Cookie OK (userId ${userId})`, { level: "ok", kind: "validate" });
    return { ok: true, userId };
  } catch (e) {
    return { ok: false, error: e?.message ?? String(e) };
  }
});

ipcMain.handle("scan-spend", async (event, { cookiePath }) => {
  const progress = (msg, meta = {}) => {
    event.sender.send("scan-progress", { msg, meta, ts: Date.now() });
  };

  try {
    if (!cookiePath) return { ok: false, error: "No cookie file selected." };
    if (!fs.existsSync(cookiePath)) return { ok: false, error: "Cookie file not found." };

    const raw = fs.readFileSync(cookiePath, "utf8");
    const cookie = normalizeCookie(raw);

    const v = validateCookieFormat(cookie, raw);
    if (!v.ok) return { ok: false, error: v.error };

    progress("Authenticating…");
    const { userId } = await fetchAllPurchases.getUserId(cookie, progress);
    progress(`Authenticated (userId ${userId}). Starting scan…`);

    const checkpointPath = path.join(app.getPath("userData"), "checkpoint.json");

    const purchases = await fetchAllPurchases.fetchPurchasesAllTime(cookie, userId, progress, {
      checkpointPath,
    });

    progress(`Computing totals from ${purchases.length.toLocaleString()} purchases…`);
    const spendTotals = computeTotals(purchases);

    progress("Computing spend over time…");
    const monthly = computeSpendOverTime(purchases, "month");
    const yearly = computeSpendOverTime(purchases, "year");
    const insights = computeInsightsFromSeries(monthly, yearly, purchases.length);

    progress("Scanning Robux acquisition (estimates)…");
    const acquisition = await computeRobuxAcquisitionEstimates(cookie, userId, progress);

    const totals = { ...spendTotals, acquisition };
    const series = { monthly, yearly, usdPerRobux: constants.USD_PER_ROBUX };

    const dataDir = app.getPath("userData");
    fs.writeFileSync(path.join(dataDir, "purchases_raw.json"), JSON.stringify(purchases, null, 2));
    fs.writeFileSync(path.join(dataDir, "spend_totals.json"), JSON.stringify({ totals, series, insights }, null, 2));

    progress(`Saved results to userData`, { level: "ok" });
    progress(`Directory: ${dataDir}`, { level: "ok" });
    progress("Done ✅", { level: "ok" });

    return {
      ok: true,
      totals,
      purchasesCount: purchases.length,
      dataDir,
      series,
      insights,
    };
  } catch (e) {
    progress(`Error: ${e?.message ?? String(e)}`, { level: "error" });
    return { ok: false, error: e?.message ?? String(e) };
  }
});
