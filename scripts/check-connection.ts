import { Connection } from "@solana/web3.js";

const RPC = process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com";

async function main() {
  const conn = new Connection(RPC);
  const slot = await conn.getSlot();
  const ver = await conn.getVersion();
  console.log(`✅ HTTP still OK`, slot, ` version`, ver["solana-core"]);
}
main().catch((e) => {
  console.error("❌ HTTP issue:", e?.message ?? e);
  process.exit(1);
});
