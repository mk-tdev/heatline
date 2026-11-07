import { describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handler } from '../server/http';

async function request(url: string, body?: unknown, raw?: string) {
  const req = Object.assign(Readable.from(raw === undefined ? [] : [Buffer.from(raw)]), {
    url, method: body === undefined && raw === undefined ? 'GET' : 'POST',
    ...(body === undefined ? {} : { body }),
  }) as IncomingMessage;
  let status = 0, output = '';
  const res = {
    headersSent: false,
    writeHead(code: number) { status = code; },
    end(value?: string) { output += value ?? ''; },
  } as unknown as ServerResponse;
  await handler(req, res);
  return { status, json: JSON.parse(output) };
}

describe('shared local and serverless HTTP handler', () => {
  it('serves health without opening a listening socket', async () => {
    const result = await request('/api/health');
    expect(result.status).toBe(200);
    expect(typeof result.json.ai).toBe('boolean');
  });
  it('handles both parsed serverless JSON and a raw local request body', async () => {
    const input = { clock: '15:00', crews: [] };
    const parsed = await request('/api/safety', input);
    const raw = await request('/api/safety', undefined, JSON.stringify(input));
    expect(parsed.status).toBe(200);
    expect(raw.status).toBe(200);
    expect(parsed.json.summary).toBe('Nothing extra needed right now.');
    expect(parsed.json.requests).toEqual([]);
    expect(raw.json.summary).toEqual(parsed.json.summary);
  });
  it('rejects malformed and oversized parsed JSON', async () => {
    expect((await request('/api/safety', '{broken')).status).toBe(400);
    expect((await request('/api/safety', { data: 'x'.repeat(33 * 1024) })).status).toBe(413);
  });
  it('keeps unknown routes as JSON errors', async () => {
    expect(await request('/api/unknown')).toEqual({ status: 404, json: { error: 'not found' } });
  });
});
