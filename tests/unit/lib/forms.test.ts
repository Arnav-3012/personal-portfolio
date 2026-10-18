import { describe, expect, it } from 'vitest';
import { failureMessage, submitForm, validate } from '../../../src/lib/forms';

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

describe('validate', () => {
  it('passes valid contact and freelance values; company is optional', () => {
    expect(validate('contact', contact)).toEqual({});
    expect(validate('freelance', freelance)).toEqual({});
  });

  it('flags every missing required field', () => {
    expect(Object.keys(validate('contact', {})).toSorted()).toEqual(['email', 'message', 'name']);
    expect(Object.keys(validate('freelance', {})).toSorted()).toEqual([
      'email',
      'message',
      'name',
      'service',
      'timeline',
    ]);
  });

  it('treats whitespace as empty and trims before measuring', () => {
    expect(validate('contact', { ...contact, name: '   ' })['name']).toBe('Name is required.');
    expect(validate('contact', { ...contact, message: '  short  ' })['message']).toMatch(
      /at least 10/,
    );
  });

  it('rejects a malformed email and over-long text', () => {
    expect(validate('contact', { ...contact, email: 'asha@' })['email']).toBe(
      'Enter a valid email address.',
    );
    expect(validate('contact', { ...contact, message: 'x'.repeat(2001) })['message']).toMatch(
      /2000 characters or fewer/,
    );
    expect(validate('freelance', { ...freelance, company: 'c'.repeat(81) })['company']).toMatch(
      /80 characters or fewer/,
    );
  });

  it('accepts exactly the maximum length', () => {
    expect(validate('contact', { ...contact, message: 'x'.repeat(2000) })).toEqual({});
  });
});

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
    [403, 'rejected'],
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
    for (const r of ['unavailable', 'limited', 'rejected', 'network'] as const)
      expect(failureMessage(r, 'me@example.com'), r).toContain('me@example.com');
  });
});
