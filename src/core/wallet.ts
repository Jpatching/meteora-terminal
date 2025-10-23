
// src/core/wallet.ts
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import fs from "node:fs";

export function loadKeypair(): Keypair {
  const b58 = process.env.WALLET_PRIVATE_KEY?.trim();
  const file = process.env.WALLET_KEYPAIR_PATH?.trim();

  if (b58) {
    const secret = bs58.decode(b58);
    return Keypair.fromSecretKey(Uint8Array.from(secret));
  }
  if (file && fs.existsSync(file)) {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  }
  throw new Error(
    "Set WALLET_PRIVATE_KEY (base58 secret) or WALLET_KEYPAIR_PATH (keypair.json)."
  );
}

