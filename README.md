# Robux Spent

An Electron app that scans your Roblox transaction history to show how your Robux  
**comes in**, **goes out**, and how your spending evolves over time — with detailed breakdowns and “damage reports”.

The app uses your `.ROBLOSECURITY` cookie to authenticate and fetch Roblox economy data,  
with automatic handling for rate limits.

---

## 🚀 Full Account Scan

- Scan **all-time Roblox transactions**
- Automatic rate-limit handling with retry + countdown
- Cookie validation before scanning
- Results exported as JSON:
  - `purchases_raw.json`
  - `usd_source_tx.json`
  - `spend_totals.json`

---

## 💰 Robux Inflow

- Total inflow
- Current Robux balance
- Robux bought
- Premium stipends
- Engagement payouts
- Group payouts
- Sales
- Trade gains
- Estimated USD spent on:
  - Robux purchases
  - Premium

> USD values are estimates using a fixed conversion: **1000 Robux = $10**.

---

## 📉 Robux Outflow

- Total Robux spent
- In-game vs other purchases
- Total purchase count

---

## 📊 Insights

- Average spend per month
- Average spend per year
- Average spend per purchase
- Peak spending month (with purchase count)

### Breakdown Highlights

- Top 5 most expensive purchases
- Top 5 games funded (grouped by universe)
- Biggest spending day ever  
  - Includes the top purchases made that day

---

## 💸 Regret Simulator

Calculates your **actual USD spent** (from Robux purchases + Premium transactions)  
and shows what you could’ve bought instead.

Examples:
- Game consoles
- GPUs
- iPhones
- Fast food meals
- etc.

Based on real USD transactions — not Robux-to-USD estimates from spending.

---

## 📈 Spending Over Time Chart

- Monthly / yearly toggle
- Robux / USD view
- Hover points for exact values
- Auto-scaled axes

---

## ▶️ Run

```bash
npm install
npm start
