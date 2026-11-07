// Protects the paid model endpoints on a public deployment.
//  - A per-visitor rate limit (in memory, per server instance: a brake, not a wall; keep a spend
//    cap on the OpenAI key as well).
//  - Speech only for text this server wrote: the guardian signs each message it returns, and the
//    speech endpoint refuses anything without a valid signature. Nobody can use it as free TTS.

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

const LIMITS = {
  guardian: { max: 60, windowMs: 60_000 },
  safety: { max: 20, windowMs: 60_000 },
  speak: { max: 20, windowMs: 60_000 },
  planner: { max: 6, windowMs: 10 * 60_000 },
} as const;
export type Limited = keyof typeof LIMITS;

const hits = new Map<string, number[]>();

export function visitor(req: IncomingMessage): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || req.socket?.remoteAddress || 'unknown';
}

/** Records a call and returns false when this visitor is over the limit for the endpoint. */
export function allow(endpoint: Limited, who: string, now = Date.now()): boolean {
  const { max, windowMs } = LIMITS[endpoint];
  const key = `${endpoint}|${who}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.delete(hits.keys().next().value!);
  return true;
}

export function resetLimits() {
  hits.clear();
}

const secret = () => process.env.HEATLINE_SIGNING_KEY || createHmac('sha256', process.env.OPENAI_API_KEY ?? 'heatline-local').update('heatline-voice-v1').digest('hex');

export function signSpeech(language: string, text: string): string {
  return createHmac('sha256', secret()).update(`${language}\n${text}`).digest('base64url');
}

export function verifySpeech(language: string, text: string, token: string): boolean {
  const expected = Buffer.from(signSpeech(language, text));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
