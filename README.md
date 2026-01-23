# Robux Spent

A simple Electron app that scans your Roblox transaction history to calculate
**how much Robux you’ve spent** and **an approximate USD value of Robux acquired**.

The app uses your `.ROBLOSECURITY` cookie to authenticate and fetch your purchase data,
with automatic handling for Roblox rate limits.

---

## Core features

- Scan **all-time Roblox purchases**
- Robux totals:
  - **Total spent**
  - **In-game** vs **other** purchases
  - **Purchase count**
- Approximate USD estimates:
  - **Robux bought**
  - **Premium stipend**
  - Uses a fixed rate: **1000 Robux = $10**
- Live log with **rate-limit detection and retry countdown**
- Cookie file **validation before scanning**
- Results exported as JSON (`purchases_raw.json`, `spend_totals.json`)

---

## Run

```bash
npm install
npm start
