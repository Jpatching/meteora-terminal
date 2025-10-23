import { CONFIG } from '../utils/config';

const API_BASE = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}`;
const MIN_INTERVAL_MS = 1500
let LastSent = 0;

async function tgFetch(method: string, params: Record<string, string>, timeoutMs = 10000) {
  const body = new URLSearchParams(params);

  const url = `${API_BASE}/${method}`;
  const res = await fetch(url, {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },

  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok || data.ok === false) {
    const retryAfter = data.parameters?.retry_after as number | undefined;
    if (res.status === 429 && retryAfter && retryAfter <= 10) {
      await new Promise(r => setTimeout(r, (retryAfter + 0.25) * 1000));
      return tgFetch(method, params, timeoutMs);
    }
    throw new Error(`Telegram error ${res.status}: ${JSON.stringify(data)}`);
  }
  return data as { ok: true; result: any }
}
/** Basic text alert (no formatting) */
export async function sendAlert(text: string) {
  // simple local pacing
  const wait = MIN_INTERVAL_MS - (Date.now() - LastSent);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  LastSent = Date.now();

  // sendAlert()
  const payload = {
    chat_id: CONFIG.TELEGRAM_CHAT_ID,
    text,
    disable_web_page_preview: 'true',
  };
  const data = await tgFetch('sendMessage', payload);
  return data.result?.message_id as number | undefined;
}

/** MarkdownV2 alert (use when you need bold/links/code) */
export async function sendMarkdownAlert(mdText: string) {
  return tgFetch('sendMessage', {
    chat_id: CONFIG.TELEGRAM_CHAT_ID,
    text: mdText,
    parse_mode: 'MarkdownV2',
    disable_web_page_preview: 'true',
  });
}
