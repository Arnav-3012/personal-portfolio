import { env } from 'cloudflare:workers';
import { vi } from 'vitest';
import migration from '../../../migrations/0001_forms.sql?raw';

/** Drops and recreates the table from the real migration file, so tests run against the shipped schema. */
export async function resetDb(): Promise<void> {
  await env.DB.prepare('DROP TABLE IF EXISTS submissions').run();
  const statements = migration
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) await env.DB.prepare(statement).run();
}

export interface FakeEmail {
  send: ReturnType<typeof vi.fn>;
}

/** The bindings the Worker needs, with email and secrets replaceable per test. */
export function makeEnv(overrides: Partial<Record<keyof Env, unknown>> = {}): {
  env: Env;
  email: FakeEmail;
} {
  const email: FakeEmail = { send: vi.fn(() => Promise.resolve()) };
  const merged = {
    DB: env.DB,
    KV: env.KV,
    EMAIL: email,
    MAIL_FROM: 'portfolio@example.test',
    MAIL_TO: 'inbox@example.test',
    TURNSTILE_SECRET: 'test-secret',
    ...overrides,
  };
  return { env: merged as unknown as Env, email };
}

export interface FakeCtx {
  ctx: ExecutionContext;
  settled(): Promise<void>;
}

export function makeCtx(): FakeCtx {
  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (p: Promise<unknown>) => void pending.push(p),
    passThroughOnException: () => undefined,
    props: {},
  } as unknown as ExecutionContext;
  return { ctx, settled: async () => void (await Promise.all(pending)) };
}

/** Replaces global fetch for one test; `handler` gets the URL and init and returns the response. */
export function stubFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    return Promise.resolve(handler(url, init));
  });
}
