// A PIN for /admin (Arnav, 2026-10-19: Cloudflare Access's emailed codes did not arrive, "can we use a pin instead").
// The PIN is a Worker secret (`wrangler secret put ADMIN_PIN`); a correct PIN earns a signed, HttpOnly, SameSite=Strict
// cookie for twelve hours. It is meant to be a passphrase-length secret, so it fails closed below six characters, and
// guessing is slowed hard: five wrong tries per connection per fifteen minutes and thirty for everyone per hour, then a
// lock. The cookie is an HMAC over its expiry keyed from the PIN, so changing the PIN signs everybody out.
const enc = new TextEncoder();

export const SESSION_COOKIE = 'admin_session';
export const SESSION_S = 12 * 60 * 60;
export const MIN_PIN = 6;
export const IP_FAILS = 5;
export const IP_WINDOW_S = 15 * 60;
export const ALL_FAILS = 30;
export const ALL_WINDOW_S = 60 * 60;

const hex = (bytes: ArrayBuffer): string =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

const sha256 = (text: string): Promise<ArrayBuffer> =>
  crypto.subtle.digest('SHA-256', enc.encode(text));

/** Whether a PIN is set and long enough to be used at all. */
export const pinConfigured = (pin: string | undefined): pin is string =>
  typeof pin === 'string' && pin.length >= MIN_PIN;

/** Compares two strings without leaking where they differ (both are hashed first, so lengths do not matter). */
export async function samePin(expected: string, attempt: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(expected), sha256(attempt)]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const hmacKey = async (pin: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    'raw',
    await sha256(`admin-session-v1:${pin}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

const mac = async (pin: string, payload: string): Promise<string> =>
  hex(await crypto.subtle.sign('HMAC', await hmacKey(pin), enc.encode(payload)));

/** A cookie value that is good until `expiresAt` (ms since the epoch). */
export async function signSession(pin: string, expiresAt: number): Promise<string> {
  const payload = String(expiresAt);
  return `${payload}.${await mac(pin, payload)}`;
}

export async function verifySession(
  pin: string,
  value: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!value) return false;
  const [payload = '', sig = ''] = value.split('.');
  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;
  return samePin(await mac(pin, payload), sig);
}

export function readCookie(header: string | null | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return undefined;
}

const ipKey = async (ip: string): Promise<string> =>
  `pin:ip:${hex(await sha256(`pin|${ip}`)).slice(0, 24)}`;
const ALL_KEY = 'pin:all';

const count = async (kv: KVNamespace, key: string): Promise<number> =>
  Number((await kv.get(key)) ?? 0);

/** True while this connection, or everyone together, has used up its wrong tries. */
export async function locked(kv: KVNamespace, ip: string): Promise<boolean> {
  const [mine, all] = await Promise.all([count(kv, await ipKey(ip)), count(kv, ALL_KEY)]);
  return mine >= IP_FAILS || all >= ALL_FAILS;
}

export async function recordFailure(kv: KVNamespace, ip: string): Promise<void> {
  const key = await ipKey(ip);
  const [mine, all] = await Promise.all([count(kv, key), count(kv, ALL_KEY)]);
  await Promise.all([
    kv.put(key, String(mine + 1), { expirationTtl: IP_WINDOW_S }),
    kv.put(ALL_KEY, String(all + 1), { expirationTtl: ALL_WINDOW_S }),
  ]);
}

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The sign-in page. Plain, dark, no scripts; the page that opens after it has its own style and script. */
export function loginHtml(message = ''): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Admin</title><style>
:root{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1012;color:#f2f3f5;font:16px/1.5 system-ui,sans-serif}
form{width:min(340px,86vw);display:grid;gap:14px}h1{margin:0;font:600 13px/1 ui-monospace,monospace;letter-spacing:.18em;text-transform:uppercase;color:#e8a24a}
input,button{font:inherit;padding:13px 14px;border-radius:10px;border:1px solid #2d3036;background:#17181b;color:#f2f3f5}input:focus{outline:2px solid #e8a24a;outline-offset:2px}
button{background:#e8a24a;color:#0f1012;border-color:#e8a24a;font-weight:600;cursor:pointer}p{margin:0;min-height:1.5em;color:#ff5a3c;font-size:14px}</style></head><body>
<form method="post" action="/admin/login"><h1>Admin</h1><label for="pin" class="v" style="position:absolute;left:-9999px">PIN</label>
<input id="pin" name="pin" type="password" inputmode="text" autocomplete="current-password" autofocus required minlength="${MIN_PIN}" placeholder="PIN">
<p role="alert">${esc(message)}</p><button type="submit">Enter</button></form></body></html>`;
}
