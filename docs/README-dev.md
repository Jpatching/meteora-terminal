# meteora-terminal — Developer Guide

This doc is for you (and future you) when you're working on the codebase locally.

It covers:
- setup
- environment variables
- sanity / smoke testing
- how to safely add new features without creating refactor hell


## 1. Requirements

- Node.js >= 20
- pnpm installed
- Access to a Solana RPC (public or custom)
- A Solana wallet (either a base58 private key string or a `id.json` style keypair file)
- A Telegram bot token + chat ID (for the `alert` command)

> You do **not** need Redis, Drizzle ORM, BullMQ, etc. for v1. Those are future-facing.


## 2. Install

```bash
pnpm install

