// src/cli/commands/discover.ts
import { Command } from "commander";
import { discoverPools, type PoolInfo } from '../../core/dlmm';

export function registerDiscoverCommand(program: Command) {
  program
    .command("discover")
    .description("List active DLMM pools")
    .option("--limit <n>", "max number of pools", "50")
    .option("--min-tvl <n>", "minimum TVL (USD)", "0")
    .option("--min-apr <n>", "minimum APR (%)", "0")
    .action(async (opts) => {
      const rows = await discoverPools(
        Number(opts.limit),
        Number(opts.minTvl ?? opts["min-tvl"]),
        Number(opts.minApr ?? opts["min-apr"])
      );

      console.table(
        rows.map((r) => ({
          name: r.name,
          tvlUsd: r.tvlUsd,
          apr24h: r.apr24h,
          feeTier: r.feeTier,
          binStep: r.binStep,
        }))
      );
    });
}

