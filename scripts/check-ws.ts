import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

const RPC = process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com";
const c = new Connection(RPC, { commitment: "processed" });

(async () => {
  const slot = await c.getSlot();
  console.log("✅ HTTP still OK. Latest slot:", slot);

  const pk = new PublicKey("11111111111111111111111111111111");
  const sub = c.onAccountChange(pk, () => {});
  setTimeout(async () => {
    await c.removeAccountChangeListener(sub);
    console.log("✅ WS subscribe/unsubscribe OK");
    process.exit(0);
  }, 1000);
})().catch((e) => {
  console.error("❌ WS issue:", e);
  process.exit(1);
});
