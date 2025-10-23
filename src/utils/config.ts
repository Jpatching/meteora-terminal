import 'dotenv/config';

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

export const CONFIG = {
  SOLANA_RPC: process.env.SOLANA_RPC ?? '', //optional
  TELEGRAM_BOT_TOKEN: req('TELEGRAM_BOT_TOKEN'),
  TELEGRAM_CHAT_ID: req('TELEGRAM_CHAT_ID'),
};
