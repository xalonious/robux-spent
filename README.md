# Robux Spent

An Electron app that scans your Roblox transaction history to show how your Robux
**comes in**, **goes out**, and how your spending changes over time.

The app uses your `.ROBLOSECURITY` cookie to authenticate and fetch Roblox economy data,
with automatic handling for rate limits.

---

## Core features

- Scan **all-time Roblox transactions**
- **Current Robux balance**
- **Robux inflow**
  - Total inflow
  - Robux bought
  - Premium stipends
  - Engagement payouts
  - Group payouts
  - Sales
  - Trade gains 
- **Robux outflow**
  - Total spent
  - In-game vs other purchases
  - Purchase count
- **Insights**
  - Average spend per month
  - Average spend per year
  - Average spend per purchase
  - Peak spending month (with purchase count)
- **Spending over time chart**
  - Monthly / yearly view
  - Robux / USD toggle
  - Hover points for exact values
- Live log with **rate-limit detection and retry countdown**
- Cookie file **validation before scanning**
- Results exported as JSON:
  - `purchases_raw.json`
  - `spend_totals.json`

> USD values are estimates using a fixed conversion: **1000 Robux = $10**.

---

## Run

```bash
npm install
npm start
