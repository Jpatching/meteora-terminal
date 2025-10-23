#!/usr/bin/env tsx
import 'dotenv/config';
import { Command } from 'commander';
import { discoverPools, type PoolInfo } from '../core/dlmm';
import { sendAlert } from '../alerts/telegram';
import { setTimeout as delay } from 'node:timers/promises';
import { registerLpCommand } from './commands/lp-manage';


const program = new Command();
registerLpCommand(program);

program
  .name('meteora-terminal')
  .description('CLI for Meteora liquidity management')
  .version('0.1.0');

// ── WATCH COMMAND ───────────────────────────────────────────────
program
  .command('watch')
  .description('Continuously watch for new pools')
  .option('--interval <sec>', 'seconds between refreshes', (v) => Number(v), 30)
  .option('--min-tvl <usd>', 'Min TVL (USD)', (v) => Number(v), 0)
  .option('--min-apr <pct>', 'Min APR %', (v) => Number(v), 0)
  .action(async (opts) => {
    while (true) {
      console.clear();
      console.log(`Refreshing every ${opts.interval}s...\n`);
      const pools = await discoverPools(50, opts.minTvl, opts.minApr);
      console.table(
        pools.map((p) => ({
          name: p.name,
          tvl: `$${Math.round(p.tvlUsd).toLocaleString()}`,
          apr: `${p.apr24h.toFixed(2)}%`,
          fee: p.feeTier,
          bin: p.binStep,
        }))
      );
      await delay(opts.interval * 1000);
    }
  });

// ── DISCOVER COMMAND ────────────────────────────────────────────
program
  .command('discover')
  .description('List active DLMM pools (default)')
  .option('--limit <n>', 'Max rows', (v) => Number(v), 50)
  .option('--min-tvl <usd>', 'Min TVL (USD)', (v) => Number(v), 0)
  .option('--min-apr <pct>', 'Min APR % filter', (v) => Number(v), 0)
  .option('--sort <key>', 'sort by apr|tvl', 'apr')
  .option('--order <dir>', 'asc|desc', 'desc')
  .option('--json', 'Output as JSON', false)
  .option('--token <symbol>', 'Filter by token name (e.g., SOL or USDC)')
  .option('--active-only', 'Only show pools with TVL > 0')
  .action(async (opts) => {
    const pools = await discoverPools(opts.limit, opts.minTvl, opts.minApr);

    // ── Filtering ───────────────────────────────────────────────
    let filtered = pools;
    if (opts.token)
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(opts.token.toLowerCase())
      );
    if (opts.activeOnly)
      filtered = filtered.filter((p) => p.tvlUsd && p.tvlUsd > 0);
    if (opts.minTvl)
      filtered = filtered.filter((p) => (p.tvlUsd || 0) >= opts.minTvl);
    if (opts.minApr)
      filtered = filtered.filter((p) => (p.apr24h || 0) >= opts.minApr);

    // ── Sorting ─────────────────────────────────────────────────
    const key = opts.sort?.toLowerCase() === 'apr' ? 'apr24h' : 'tvlUsd';
    const desc = (opts.order?.toLowerCase?.() || 'desc') === 'desc';
    filtered.sort((a, b) => {
      const av = a[key] ?? 0,
        bv = b[key] ?? 0;
      return desc ? bv - av : av - bv;
    });

    // ── Output ──────────────────────────────────────────────────
    if (opts.json) {
      console.log(JSON.stringify(filtered, null, 2));
      return;
    }

    console.table(
      filtered.map((p) => ({
        name: p.name,
        tvl: p.tvlUsd ? `$${Math.round(p.tvlUsd).toLocaleString()}` : '-',
        apr: Number.isFinite(p.apr24h) ? `${p.apr24h.toFixed(2)}%` : '-',
        fee: p.feeTier,
        bin: p.binStep,
      }))
    );
    console.log(`\nSource: RocketScan DLMM • ${new Date().toISOString()}`);
  });

// ── ALERT COMMAND ───────────────────────────────────────────────
program
  .command('alert')
  .argument('<message...>', 'message to send')
  .description('Send a Telegram alert')
  .action(async (message: string[]) => {
    try {
      await sendAlert(message.join(' '));
      console.log('Alert sent');
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  });

// ── PARSE ARGS ─────────────────────────────────────────────────
program.parseAsync(process.argv);

