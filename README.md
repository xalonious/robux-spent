# Robux Spent

Robux Spent is a small Electron app for scanning your Roblox transaction history and summarizing how your Robux comes in, goes out, and changes over time.

It uses your `.ROBLOSECURITY` cookie to fetch Roblox economy data, handles rate limits automatically, and exports the scan results as JSON for later inspection.

Built with Electron and plain JavaScript.

## Features

- All-time Roblox transaction scanning
- Cookie validation before scanning
- Automatic rate-limit retry handling
- Robux inflow breakdowns for purchases, stipends, payouts, sales, transfers, and trade gains
- Robux outflow breakdowns for game spending, avatar items, developer products, gamepasses, private servers, username changes, group ranks, trades, and transfers
- Spending insights for monthly averages, yearly averages, average purchase size, and peak spending month
- Leaderboards for most expensive purchases, top funded games, and biggest spending day
- Monthly and yearly spending chart with Robux and USD views
- JSON exports for raw purchases, USD source transactions, and computed totals

## Output Files

After a scan, the app writes these files to Electron's user data directory:

- `purchases_raw.json`
- `usd_source_tx.json`
- `spend_totals.json`

## Notes

USD values are estimates using a fixed conversion of 1000 Robux = $10.

Keep your `.ROBLOSECURITY` cookie private. Anyone with access to it can access your Roblox account.

## Run

```bash
npm install
npm start
```
