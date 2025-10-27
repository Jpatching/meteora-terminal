import DLMM from '@meteora-ag/dlmm'
import { Connection, PublicKey } from '@solana/web3.js';


// Shape of what comes back from the api 
type RemotePoolInfo = {
  address: string;
  name: string;
  tvlUsd?: number;
  apr24h?: number;
  binStep?: number;
};

async function fetchPoolsForCluster(cluster: string): Promise<RemotePoolInfo[]> {
  const url = `https://dlmm-api.meteora.ag/pair/all?cluster=${cluster}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetchPoolsForCluster: HTTP ${res.status} from ${url}`);
  }
  // The API returns a JSON array of objects, each object representing a pool
  const data = (await res.json()) as any[];

  //Light Sanaitze / normalize keys:
  // We'll map the raw objects to just { address, name ... }
  return data.map((p: any) => ({
    address: p.address ?? p.lb_pair_address ?? p.lbPairAddress,
    name: p.name ?? p.symbol ?? 'unknown',
    tvlUsd: p.tvlUsd ?? p.tvlUsd,
    apr24h: p.apr24h ?? p.apr,
    binStep: p.binStep ?? p.bin_step ?? p.binStepBps,
  }));
}

async function tryCreateDlmm(
  cluster: 'devnet' | 'mainnet-beta',
  poolAddr: string,
) {
  const rpcurl =
    cluster === 'devnet'
      ? 'https://https://api.devnet.solana.com'
      : 'https://api.mainnet-beta.solana.com';

  const connection = new Connection(rpcurl, 'confirmed');
  const pubkey = new PublicKey(poolAddr);

  try {
    const dlmmPool = await DLMM.create(connection, pubkey, { cluster });
    return dlmmPool;
  } catch (err) {
    return null;
  }
}

// Given a human-friendly pair name (liek 'SOL-USDC')
// find the matching pool in that cluster and return it as { address, name }

async function resolvePoolbyName(
  cluster: string,
  targetName: string,
): Promise<{ address: string; name: string } | null> {
  const pools = await fetchPoolsForCluster(cluster);

  // case insensitive match, because users will type lowercase etc.
  const match = pools.find(
    (p) => p.name && p.name.toLowerCase() === targetName.toLowerCase(),
  );


  if (!match) {
    return null;
  }

  if (!match.address) {
    throw new Error(
      `resolvePoolbyName: pool "${match.name}" had no address in API`,
    );
  }

  return {
    address: match.address,
    name: match.name,
  };
}

async function main() {
  const cluster = 'devnet';


  const pools = await fetchPoolsForCluster(cluster);


  // console.log(`Found ${pools.length} pools on ${cluster}`);
  //  console.log(pools.slice(0, 5)); // print the firs pools



  const preferredNames = ['SOL-USDC', 'SOL-USDT', 'SOL-UST'];
  let chosen = pools.find(p => {
    const lower = (p.name || "").toUpperCase();
    return preferredNames.includes(lower)
  });
  if (!chosen) {
    chosen = pools[0];
  }

  let workingPool = null;
  if (chosen) {
    workingPool = await tryCreateDlmm(cluster, chosen.address);
  }

  if (!workingPool) {
    for (const p of pools.slice(0, 30)) {
      const maybe = await tryCreateDlmm(cluster, p.address);
      if (maybe) {
        chosen = p;
        workingPool = maybe;
        break;
      }
    }
  }
}
main().catch((err) => {
  console.error("main() error:", err);
});

