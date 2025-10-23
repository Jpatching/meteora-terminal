# Repository Guidelines

## Project Structure & Module Organization
- `src/cli/` contains the Commander entry point `index.ts` plus command modules (for example `commands/lp-manage.ts`). Add new subcommands here and keep the CLI surface thin.
- `src/core/` wraps Meteora DLMM and Solana primitives (`dlmm.ts`, `wallet.ts`). Centralize network I/O and blockchain integration work in this layer.
- `src/alerts/` implements outbound notifications (Telegram today); extend with new transports inside this directory to reuse shared helpers.
- `src/strategies/` hosts liquidity management logic and scheduling primitives. Collocate data models, configs, and scenario scripts with each strategy.
- Shared helpers live in `src/utils/`; keep these pure to avoid circular dependencies. Runtime configuration loads from `.env` in the project root.

## Build, Test, and Development Commands
- `pnpm install` bootstraps dependencies; run after pulling lockfile updates.
- `pnpm dev` (alias `pnpm start`) executes the CLI through `tsx`. Pass CLI flags, e.g., `pnpm dev watch --min-apr 10`.
- `pnpm lint` runs ESLint; resolve every warning before opening a PR.
- `pnpm format` applies Prettier 3 in write mode. Run it prior to committing.

## Coding Style & Naming Conventions
- TypeScript project targeting Node 20 ESM; use 2-space indentation, single quotes, and explicit exports.
- Keep file names kebab-case (`lp-manage.ts`). Group related types alongside their modules.
- Command handlers should be async and return `Promise<void>`; share cross-cutting logic via `src/core` or `src/utils`.
- Always run `pnpm lint` and `pnpm format` before committing to keep style consistent.

## Testing Guidelines
- No automated suite ships yet; new features must introduce targeted coverage. Place unit specs alongside source as `*.test.ts` or under a sibling `__tests__` directory.
- Use `pnpm exec tsx path/to/test.ts` to execute TypeScript test harnesses until a dedicated `pnpm test` script is added.
- Document manual verification steps in PR descriptions when automation cannot cover a change.

## Commit & Pull Request Guidelines
- Follow conventional commit prefixes (`feat:`, `fix:`, `chore:`, `docs:`) with imperative summaries, e.g., `feat: add dlmm rebalance strategy`.
- Open PRs against `main` with context, bullet-point change summary, test or verification notes, and screenshots/log snippets for CLI output when relevant.
- Reference linked issues in the PR body and call out any `.env` or secret handling updates explicitly.

## Environment & Security
- Load secrets via `.env`; never commit credential values. Update a shared `.env.example` whenever new variables are required.
- Audit third-party keys before enabling alert transports, and avoid logging raw wallet addresses or private keys.
