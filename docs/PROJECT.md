# meteora-terminal

## 1. Overview
`meteora-terminal` is a Node.js + TypeScript CLI for interacting with **Meteora DLMM liquidity pools** on Solana.  
It allows liquidity providers and token project operators to discover pools, open positions, claim fees, and send broadcast alerts — all from the terminal.

The project is structured as a reusable toolkit and a production-ready CLI.

---

## 2. Core User Flows (v1)

### 🧩 A. Discover & Watch Pools
- Discover all active DLMM pools with details like **TVL**, **APR**, **fee tier**, and **active bin**.  
- Filter and sort by metrics (APR / TVL).  
- Use `discover` for one-shot queries, or `watch` for live refreshing.

### 💧 B. LP Lifecycle
- Resolve pool symbols (e.g., `SOL-USDC`) into on-chain addresses.  
- Open new LP positions in custom price ranges via the DLMM SDK.  
- Claim fees from existing positions using wallet credentials.

### 📢 C. Alerts / Broadcasting
- Send Telegram alerts directly from the CLI using bot credentials.
- Useful for liquidity announcements, operator alerts, or monitoring triggers.

---

## 3. Commands Shipped in v1

| Command | Description |
|----------|--------------|
| `discover` | One-off fetch of all pools with TVL/APR data. |
| `watch` | Continuously refreshes pool data every N seconds. |
| `lp resolve` | Resolves pair symbols like `SOL-USDC` to actual on-chain addresses. |
| `lp open` | Opens an LP position using a local wallet, amount, and range. |
| `lp claim` | Claims accrued fees for all positions in a pool. |
| `alert` | Sends a Telegram message via configured bot credentials. |

---

## 4. Architecture Summary

| Directory | Purpose |
|------------|----------|
| `src/core` | Business logic layer. Talks to Meteora DLMM SDK and Solana RPC. |
| `src/cli` | Command definitions, argument parsing, and user interaction. |
| `src/alerts` | Notification transports (Telegram now, Discord later). |
| `src/utils` | Config loading, logging, and other helpers. |
| `src/strategies` | Placeholder for future auto-rebalance & strategy logic. |

---

## 5. Requirements

### Environment
You must define the following in `.env`:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_chat_id
WALLET_PRIVATE_KEY=your_base58_key_or
WALLET_KEYPAIR_PATH=/path/to/id.json
SOLANA_RPC=https://api.mainnet-beta.solana.com

