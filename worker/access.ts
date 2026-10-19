// Cloudflare Access gate for /admin (SPEC "Architecture", step 6). Access sits in front of the route, and the Worker
// checks the signed JWT Access adds anyway, so a mistake in the Access application (a wrong path, a policy left
// open) cannot expose the inbox. Fails closed: with no team domain or audience configured, /admin answers 503.
const SKEW_S = 30;
const JWKS_TTL_MS = 60 * 60 * 1000;
const JWKS_RETRY_MS = 60 * 1000;

export type AccessResult =
  { ok: true; email: string } | { ok: false; reason: 'not_configured' | 'missing' | 'invalid' };

interface Jwk extends JsonWebKey {
  kid?: string;
}
type Deps = { fetchImpl?: typeof fetch; now?: () => number; keys?: Map<string, CryptoKey> };

const b64url = (s: string): Uint8Array => {
  const padded = s
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(s.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};
const json = (s: string): unknown => JSON.parse(new TextDecoder().decode(b64url(s)));

let cache: { at: number; tried: number; keys: Map<string, CryptoKey> } | undefined;

/** Clears the signing-key cache; tests use it between cases. */
export const resetAccessCache = (): void => {
  cache = undefined;
};

async function loadKeys(
  team: string,
  fetchImpl: typeof fetch,
  now: number,
): Promise<Map<string, CryptoKey>> {
  const res = await fetchImpl(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`certs ${res.status}`);
  const body = (await res.json()) as { keys?: Jwk[] };
  const keys = new Map<string, CryptoKey>();
  for (const jwk of body.keys ?? []) {
    const { kid, n, e } = jwk;
    if (jwk.kty !== 'RSA' || !kid || !n || !e) continue;
    keys.set(
      kid,
      await crypto.subtle.importKey(
        'jwk',
        { kty: 'RSA', n, e, alg: 'RS256', ext: true },
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      ),
    );
  }
  cache = { at: now, tried: now, keys };
  return keys;
}

async function keyFor(
  kid: string,
  team: string,
  deps: Deps,
  now: number,
): Promise<CryptoKey | undefined> {
  if (deps.keys) return deps.keys.get(kid);
  const fetchImpl = deps.fetchImpl ?? fetch;
  if (cache && now - cache.at < JWKS_TTL_MS) {
    const hit = cache.keys.get(kid);
    if (hit) return hit;
    // Unknown kid: Cloudflare may have rotated keys. Refetch, but at most once a minute.
    if (now - cache.tried < JWKS_RETRY_MS) return undefined;
    cache.tried = now;
  }
  return (await loadKeys(team, fetchImpl, now)).get(kid);
}

export async function verifyAccess(
  request: Request,
  env: Env,
  deps: Deps = {},
): Promise<AccessResult> {
  const { hostname } = new URL(request.url);
  // Local development only: both the flag and a loopback host are required.
  if (env.ADMIN_DEV === '1' && (hostname === 'localhost' || hostname === '127.0.0.1'))
    return { ok: true, email: 'dev@localhost' };

  const team = env.ACCESS_TEAM_DOMAIN;
  const aud = env.ACCESS_AUD;
  const allowed = (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!team || !aud || allowed.length === 0) return { ok: false, reason: 'not_configured' };

  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return { ok: false, reason: 'missing' };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'invalid' };
  const [h = '', p = '', s = ''] = parts;
  try {
    const header = json(h) as { alg?: string; kid?: string };
    if (header.alg !== 'RS256' || !header.kid) return { ok: false, reason: 'invalid' };
    const now = (deps.now ?? Date.now)();
    const key = await keyFor(header.kid, team, deps, now);
    if (!key) return { ok: false, reason: 'invalid' };
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      b64url(s),
      new TextEncoder().encode(`${h}.${p}`),
    );
    if (!valid) return { ok: false, reason: 'invalid' };
    const claims = json(p) as {
      iss?: string;
      aud?: string | string[];
      exp?: number;
      nbf?: number;
      email?: string;
    };
    const seconds = Math.floor(now / 1000);
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const email = claims.email?.toLowerCase();
    if (
      claims.iss !== `https://${team}` ||
      !audiences.includes(aud) ||
      typeof claims.exp !== 'number' ||
      claims.exp + SKEW_S < seconds ||
      (typeof claims.nbf === 'number' && claims.nbf - SKEW_S > seconds) ||
      !email ||
      !allowed.includes(email)
    )
      return { ok: false, reason: 'invalid' };
    return { ok: true, email };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}
