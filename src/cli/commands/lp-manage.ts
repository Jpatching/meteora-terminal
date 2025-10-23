// src/cli/commands/lp-manage.ts
import { Command } from 'commander';
import { openPosition, claimFees } from '../../core/dlmm';

function num(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Invalid number: ${v}`);
  return n;
}

function parseRange(range?: string): { min?: number; max?: number } {
  if (!range) return {};
  // normalize unicode dashes: en/em/minus → '-'
  const safe = range.replace(/[\u2012\u2013\u2014\u2212]/g, '-').trim();
  const [a, b] = safe.split('-').map((s) => Number(s));
  if (Number.isFinite(a) && Number.isFinite(b)) return { min: a, max: b };
  throw new Error(`Bad --range value: "${range}". Use e.g. 0.98-1.02`);
}

export function registerLpCommand(program: Command) {
  const lp = program.command('lp').description('Manage DLMM Liquidity Positions');

  // lp open
  lp.command('open')
    .description('Open a DLMM position')
    .option('--pair <pair>', 'e.g. SOL-USDC')
    .option('--pool <address>', 'DLMM pool address (overrides --pair)')
    .requiredOption('--amount <amount>', 'Deposit amount in token units', num)
    .option('--range <min-max>', 'Price range, e.g. 0.98-1.02')
    .option('--min <num>', 'Min of range', num)
    .option('--max <num>', 'Max of range', num)
    .action(async (opts: {
      pair?: string;
      pool?: string;
      amount: number;
      range?: string;
      min?: number;
      max?: number;
    }) => {
      if (!opts.pool && !opts.pair) {
        throw new Error('Provide either --pool <address> or --pair <SYMA-SYMB>.');
      }

      // derive min/max from --range or explicit flags
      const fromRange = parseRange(opts.range);
      let min = Number.isFinite(fromRange.min!) ? fromRange.min! : opts.min;
      let max = Number.isFinite(fromRange.max!) ? fromRange.max! : opts.max;

      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        throw new Error('Provide --range <min-max> (e.g. 0.98-1.02) OR both --min and --max.');
      }

      const target = String(opts.pool ?? opts.pair);

      console.log('[DLMM] openPosition ->', {
        target,
        amount: opts.amount,
        range: `${min}-${max}`,
      });

      await openPosition(target, Number(opts.amount), Number(min), Number(max));
    });

  // lp claim
  lp.command('claim')
    .description('Claim swap fees for positions in a pool')
    .option('--pair <pair>', 'Pool pair name (e.g. SOL-USDC)')
    .option('--pool <address>', 'DLMM pool address (overrides --pair)')
    .action(async (opts: { pair?: string; pool?: string }) => {
      const target = opts.pool ?? opts.pair;
      if (!target) throw new Error('Provide either --pool or --pair.');
      console.log('[DLMM] claimFees ->', { target });
      await claimFees(String(target));
    });

  // helper: resolve pair → pool address (uses core/dlmm.ts resolver)
  lp.command('resolve')
    .description('Resolve a pair name to its DLMM pool address')
    .requiredOption('--pair <pair>', 'e.g. SOL-USDC')
    .action(async (opts: { pair: string }) => {
      const { resolvePoolAddress } = await import('../../core/dlmm');
      const { address, name } = await resolvePoolAddress(opts.pair);
      console.log(`pair=${opts.pair} -> name="${name}" address=${address.toBase58()}`);
    });
}

