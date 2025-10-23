import {
  Connection,
  PublicKey,
  Keypair,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import DLMM, { StrategyType } from "@meteora-ag/dlmm";
import BN from "bn.js";
import { getMint } from "@solana/spl-token";
import dotenv from "dotenv";
dotenv.config();

// ─── Types ──────────────────────────────────────────────────────────────────────
export type PoolInfo = {
  address: string;
  name: string;
  tvlUsd: number;
  apr24h: number;
  feeTier: string; // e.g. "0.20%"
  binStep: number;
  mints: { x: string; y: string };
};

const BASE = process.env.DLMM_API_BASE || "https://dlmm-api.meteora.ag";
const RPC = process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com";

// Expect wallet.ts to provide a Keypair
import { loadKeypair } from "./wallet";

// ─── Utils ──────────────────────────────────────────────────────────────────────
function toNumber(x: unknown): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") return Number(x.replace(/[,%\s,$_]/g, ""));
  return NaN;
}
function normUsd(anyUsd: unknown): number {
  const n = toNumber(anyUsd);
  return Number.isFinite(n) ? n : 0;
}
function normPercent(anyApr: unknown): number {
  const n = toNumber(anyApr);
  if (!Number.isFinite(n)) return 0;
  if (n > 0 && n <= 1) return n * 100; // 0.025 -> 2.5
  if (n > 1000) return 0;
  return n;
}

// ─── DLMM loader (correct for v1.6.x) ───────────────────────────────────────────
async function loadDlmmInstance(connection: Connection, poolPk: PublicKey) {
  return DLMM.create(connection, poolPk);
}

// ─── Pool resolution ────────────────────────────────────────────────────────────
export async function resolvePoolAddress(
  pairOrAddress: string
): Promise<{ address: PublicKey; name: string }> {
  try {
    return { address: new PublicKey(pairOrAddress), name: pairOrAddress };
  } catch { /* not a pubkey, fall through */ }

  const res = await fetch(`${BASE}/pair/all`, { cache: "no-store" });
  if (!res.ok) throw new Error(`DLMM API error ${res.status}`);
  const rows: any[] = await res.json();

  const map = new Map<string, { addr: string; name: string }>();
  const norm = (s: unknown) => String(s ?? "").replace(/[\s_/|-]+/g, "").toUpperCase();
  const add = (k: string, a: string, n: string) => { if (k && a) map.set(k, { addr: a, name: n }); };

  for (const p of rows) {
    const addr = p.lb_pair || p.address || p.lbPair || "";
    const name = p.name || p.pair_symbol || p.symbol || "";
    const base = (p.base_symbol || p.baseToken?.symbol || "").toUpperCase();
    const quote = (p.quote_symbol || p.quoteToken?.symbol || "").toUpperCase();

    const bases = new Set([base, base === "WSOL" ? "SOL" : ""]);
    const quotes = new Set([quote, quote === "WSOL" ? "SOL" : ""]);

    const variants = new Set<string>();
    if (name) variants.add(norm(name));
    if (p.symbol) variants.add(norm(p.symbol));
    if (p.pair_symbol) variants.add(norm(p.pair_symbol));

    const combos: string[] = [];
    for (const b of bases) for (const q of quotes) {
      if (!b || !q) continue;
      combos.push(`${b}/${q}`, `${q}/${b}`, `${b}-${q}`, `${q}-${b}`, `${b}${q}`, `${q}${b}`);
    }
    combos.forEach(c => variants.add(norm(c)));
    for (const v of variants) add(v, addr, name || `${base}/${quote}`);
  }

  const key = norm(pairOrAddress);
  const hit = map.get(key);
  if (hit) return { address: new PublicKey(hit.addr), name: hit.name || pairOrAddress };

  const near = [...map.keys()].filter(k => k.includes(key.replace(/SOL/g, "WSOL")) || key.includes(k)).slice(0, 5);
  throw new Error(`Could not resolve pool for "${pairOrAddress}" via DLMM API. Near: ${near.join(", ")}`);
}

// % range -> number of bins around active bin
function pctToBins(minPct: number, maxPct: number, binStep: number): number {
  const step = 1 + binStep / 10_000; // binStep in bps per bin
  const width = Math.max(maxPct, 1 / Math.max(minPct, 1e-9));
  const bins = Math.round(Math.log(width) / Math.log(step));
  return Math.max(1, bins);
}

// ─── Discovery ─────────────────────────────────────────────────────────────────
export async function discoverPools(
  limit = 50,
  minTvl = 0,
  minApr = 0
): Promise<PoolInfo[]> {
  const res = await fetch(`${BASE}/pair/all`);
  if (!res.ok) throw new Error(`DLMM API error ${res.status}`);
  const allPairs: any[] = await res.json();

  const pools: PoolInfo[] = allPairs.map((p) => {
    const tvlUsd = normUsd(
      p.tvl_usd ?? p.liquidity_usd ?? p.tvl ?? p.liquidity ?? p.total_liquidity_usd
    );

    const feeNum = toNumber(p.base_fee_percentage ?? p.fee ?? p.base_fee);
    const feePct = Number.isFinite(feeNum) ? feeNum / 100 : NaN;

    const vol24h = toNumber(p.volume_24h ?? p.volume24h ?? p.volume ?? 0);
    const fees24h = toNumber(
      p.fees_24h ?? p.fees24h ?? (Number.isFinite(feePct) ? vol24h * feePct : 0)
    );

    let apr24h = normPercent(p.apr ?? p.apr24h ?? p.apr1d ?? p.apr_daily);
    if ((!apr24h || apr24h === 0) && tvlUsd > 0 && fees24h > 0) {
      apr24h = (fees24h / tvlUsd) * 365 * 100;
      if (!Number.isFinite(apr24h) || apr24h > 5000) apr24h = 0;
    }

    const feeTier = Number.isFinite(feeNum) ? `${feeNum}%` : "";
    const binStep = Number(p.bin_step ?? p.binStep ?? p.bin ?? 0) || 0;

    const name =
      p.name ??
      p.pair_symbol ??
      [p.base_symbol || p.baseToken?.symbol, p.quote_symbol || p.quoteToken?.symbol]
        .filter(Boolean)
        .join("/");

    return {
      address: p.address ?? p.lb_pair ?? "",
      name,
      tvlUsd,
      apr24h,
      feeTier,
      binStep,
      mints: {
        x: p.mint_x ?? p.base_mint ?? "",
        y: p.mint_y ?? p.quote_mint ?? "",
      },
    };
  });

  return pools
    .filter((p) => p.tvlUsd >= minTvl && p.apr24h >= minApr)
    .slice(0, limit);
}

// ─── Actions: open position ────────────────────────────────────────────────────
export async function openPosition(
  pair: string,
  amount: number,
  min: number,
  max: number
) {
  if (!(amount > 0)) throw new Error("amount must be > 0");
  if (!(min > 0 && max > 1)) throw new Error("range must straddle 1.0, e.g. 0.98–1.02");

  const connection = new Connection(RPC, "confirmed");
  const user = loadKeypair();

  const { address: poolPk, name } = await resolvePoolAddress(pair);
  const dlmmPool = await loadDlmmInstance(connection, poolPk);

  const activeBin = await dlmmPool.getActiveBin();
  const binStep = dlmmPool.lbPair.binStep ?? 1;

  const widthBins = pctToBins(min, max, binStep);
  const minBinId = activeBin.binId - Math.floor(widthBins / 2);
  const maxBinId = activeBin.binId + Math.ceil(widthBins / 2);

  // On-chain decimals for token X
  const xMint = dlmmPool.tokenX.publicKey;
  const xMintInfo = await getMint(connection, xMint);
  const xDecimals = xMintInfo.decimals;
  const scaled = (amount * Math.pow(10, xDecimals)).toFixed(0);
  const totalXAmount = new BN(scaled);
  const totalYAmount = new BN(0); // one-sided X for now

  const positionKp = new Keypair();
  const tx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
    positionPubKey: positionKp.publicKey,
    user: user.publicKey,
    totalXAmount,
    totalYAmount,
    strategy: { minBinId, maxBinId, strategyType: StrategyType.Spot },
  });

  // priority fees
  tx.instructions.unshift(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 2_000 }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 })
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [user, positionKp], {
    skipPreflight: false,
    commitment: "confirmed",
  });

  console.log(`[DLMM] openPosition ✓ pool=${name} bins=${minBinId}-${maxBinId} tx=${sig}`);
  return { txid: sig, pool: name, minBinId, maxBinId };
}

// ─── Actions: claim fees ───────────────────────────────────────────────────────
export async function claimFees(pair: string) {
  const connection = new Connection(RPC);
  const user = loadKeypair();

  const { address: poolPk, name } = await resolvePoolAddress(pair);
  const dlmmPool = await loadDlmmInstance(connection, poolPk);

  const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(user.publicKey);
  if (!userPositions || userPositions.length === 0) {
    console.log(`[DLMM] claimFees -> no positions found for pool=${name}`);
    return { txids: [] as string[], pool: name };
  }

  const claimTxs = await dlmmPool.claimAllSwapFee({
    owner: user.publicKey,
    positions: userPositions,
  });

  const sigs: string[] = [];
  for (const tx of claimTxs) {
    const sig = await sendAndConfirmTransaction(connection, tx, [user]);
    sigs.push(sig);
  }
  console.log(`[DLMM] claimFees ✓ pool=${name} count=${sigs.length}`);
  return { txids: sigs, pool: name };
}

