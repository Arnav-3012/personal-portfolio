import { describe, expect, it } from 'vitest';
import { failureMessage, submitForm } from '../../../src/lib/forms';

const contact = { name: 'Asha', email: 'asha@example.com', message: 'Hello there, nice site.' };
const freelance = {
  name: 'Asha',
  email: 'asha@example.com',
  company: '',
  service: 'rag-assistants',
  timeline: 'ASAP',
  message: 'We need a chatbot over our policy documents.',
};

const status = (code: number): typeof fetch =>
  (() => Promise.resolve(new Response('{}', { status: code }))) as typeof fetch;

describe('submitForm', () => {
  it('posts JSON to /api/forms/<kind>', async () => {
    let seen: { url: string; init?: RequestInit } | undefined;
    const spy = ((url: string, init?: RequestInit) => {
      seen = init ? { url, init } : { url };
      return Promise.resolve(new Response('{}', { status: 200 }));
    }) as typeof fetch;
    expect(await submitForm('freelance', freelance, spy)).toEqual({ ok: true });
    expect(seen?.url).toBe('/api/forms/freelance');
    expect(seen?.init?.method).toBe('POST');
    expect(JSON.parse(String(seen?.init?.body))).toEqual(freelance);
  });

  it.each([
    [404, 'unavailable'],
    [500, 'unavailable'],
    [503, 'unavailable'],
    [429, 'limited'],
    [400, 'rejected'],
    [403, 'verification'],
    [422, 'rejected'],
    [413, 'rejected'],
  ])('maps HTTP %i to %s', async (code, reason) => {
    expect(await submitForm('contact', contact, status(code))).toEqual({ ok: false, reason });
  });

  it('maps a thrown fetch to network', async () => {
    const offline = (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch;
    expect(await submitForm('contact', contact, offline)).toEqual({ ok: false, reason: 'network' });
  });
});

describe('failureMessage', () => {
  it('always offers the direct email', () => {
    for (const r of ['unavailable', 'limited', 'rejected', 'verification', 'network'] as const)
      expect(failureMessage(r, 'me@example.com'), r).toContain('me@example.com');
  });
});
