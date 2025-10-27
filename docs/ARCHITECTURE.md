# meteora-terminal Architecture

This document explains how the codebase is structured, what lives where, and what each layer is responsible for.  
The goal: we keep logic reusable and avoid rewriting everything later when we add an interactive menu, alerts, or automation.

---

## 1. High-Level Shape

Top-level flow looks like this:

1. **CLI (`src/cli/`)**  
   - Parses user input (flags/args)
   - Calls into core logic
   - Prints human-readable output

2. **Core (`src/core/`)**  
   - Talks to Meteora DLMM SDK + Solana RPC
   - Manages wallet interaction
   - Builds and submits transactions
   - Returns structured data (not pretty-printed)

3. **Alerts (`src/alerts/`)**  
   - Handles outbound notifications (Telegram now, Discord later)
   - Gives a single function we can call from anywhere to "send an alert"

4. **Utils (`src/utils/`)**  
   - Configuration, logging, and support helpers

5. **Strategies (`src/strategies/`) [future]**  
   - Placeholder for automation logic like rebalancing / out-of-range detection

6. **scripts/**  
   - Operational tooling (like checking RPC connections / websockets)
   - Not part of the CLI surface, more like ops/debug

7. **tests/**  
   - Place for smoke tests / minimal unit tests

---

## 2. Directory Responsibilities

### `src/cli/`
- Entry point for the command-line interface.
- This is where user-facing commands are defined (e.g. `discover`, `watch`, `lp open`, `lp claim`, `alert`, etc.).
- Uses something like Commander to register subcommands.
- Responsible for:
  - parsing flags, like `--limit 10` or `--range 0.98-1.02`
  - calling core functions with the parsed options
  - printing tables / summaries / statuses
  - exiting non-zero on failure if needed

**Important rule:**  
Business logic should NOT live here.  
If you catch yourself doing math, building tx instructions, validating price bands, etc. in `src/cli/`, move that into `src/core/`.

Why: later when we add an interactive menu UI (or scheduled jobs), we want to reuse the same logic without copying the CLI layer.

---

### `src/core/`
This is the engine.

Right now:
- `dlmm.ts`
  - Discovers pools (TVL/APR/etc)
  - Resolves human-friendly pairs (e.g. `SOL-USDC`) to pool addresses
  - Prepares and opens LP positions using the Meteora DLMM SDK
  - Claims accrued fees
  - Talks to Meteora’s REST endpoints and on-chain program
- `wallet.ts`
  - Loads a signing wallet
  - Supports `WALLET_PRIVATE_KEY` or a keypair file
  - Throws fast if the wallet config is invalid or missing

Rules for `src/core/`:
- No console logging unless it’s absolutely operational
- No user prompts
- Should return data structures / results / throw errors
- Should be callable from:
  - CLI
  - future interactive menu
  - future automation (strategies / cron jobs)
  - tests

If it touches DLMM or Solana, it belongs in `core`.

---

### `src/alerts/`
Outbound messaging / notifications.

- `telegram.ts`
  - Talks to Telegram Bot API using `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
  - Handles basic retry on rate limit
  - Returns Telegram message id or throws

- `index.ts`
  - This should expose a single high-level function like:
    ```ts
    export async function sendAlertUnified(message: string) {
      // v1: Telegram only
      // future: call Discord, etc.
    }
    ```
  - The CLI `alert` command should import from here, NOT from `telegram.ts` directly.

Why this matters:
- We only need to change `alerts/index.ts` to add Discord later.
- The rest of the code (CLI, strategies) will not change.
- This prevents a big refactor later.

---

### `src/utils/`
Support layer.

Right now:
- `config.ts`
  - Loads `.env`
  - Validates required env vars EARLY (Telegram credentials, wallet details, RPC URL)
  - Fails fast if something is missing, so we don't get weird runtime crashes 20 steps later
- `logger.ts`
  - Provides consistent, namespaced logging

There is also a nested `src/utils/db/index.ts` scaffold.  
That’s future-facing (for persistence, queues, etc.).  
For v1 we don't depend on it.

---

### `src/strategies/`
Currently just `index.ts` and empty.

This is reserved for:
- "Am I out of range?" checks
- “Should I reposition liquidity to the active bin?”
- “Should I auto-claim or auto-compound fees?”
- “Alert me if APR or TVL crosses thresholds”

This will become the “automation brain,” but none of that ships in v1.

For now, **nothing in the codebase should import from here.**

---

### `scripts/`
Example: `check-connection.ts` / `check-ws.ts`

These are small operational / diagnostic scripts.  
They are not part of the user CLI surface (`meteora-terminal ...`).  
They're there to help devs/operators sanity check environment, network access, or RPC connectivity.

---

### `tests/`
This is where you can put:
- tiny unit tests (like range parsing)
- or just helper scripts to sanity check behavior

For v1, even a “smoke test script” is enough:
- run `discover`
- run `watch` for a few seconds
- run `lp resolve`
- send a test alert

This gives us confidence after changes.

---

## 3. How layers talk to each other

Allowed:
- `cli` → `core`
- `cli` → `alerts/index.ts`
- `core` → `utils`
- `alerts` → `utils` (for config)
- `strategies` (future) → `core`, `alerts`, `utils`

NOT allowed:
- `core` importing from `cli`
- `core` importing from `alerts/*telegram.ts` directly (only if it's truly core logic; usually alerts are not core)
- anything importing `strategies` right now (it’s not live yet)

If you keep these boundaries, you will NOT have to rip the project apart when you add:
- an interactive menu UI
- Discord alerts
- automation/cron
- persistence/jobs

---

## 4. Guiding Principles

1. **Core is the source of truth.**  
   If two commands both need similar logic, that logic lives in `core`, not duplicated in each command.

2. **CLI is just a skin.**  
   CLI should feel like a “remote control,” not the actual machine.

3. **Alerts are pluggable.**  
   The rest of the project should call `sendAlertUnified()`, not care if it's Telegram vs Discord.

4. **Fail fast on config.**  
   If the wallet or RPC setup is invalid, crash up-front with a helpful error, not halfway through an LP transaction.

5. **Future automation lives in `strategies/`.**  
   Do not half-implement strategy logic in random places. Keep “robot brain” isolated.

---

## 5. Future Growth Plan

- Add Discord support by extending `alerts/index.ts`.
- Add a text-based interactive menu (TUI) that just imports and calls `core` the same way CLI does.
- Add scheduled/automatic behavior (out-of-range alerts, auto-claim recommendations) under `strategies/` and possibly a background worker.
- Add persistence (DB / Redis) to track alert rules or past positions.

Because we’re keeping a clean separation now, those can be added without rewriting the existing commands.

---

