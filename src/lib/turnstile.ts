// Cloudflare Turnstile for the forms. The script is injected by JS the first time a visitor touches a form, so it
// never counts against the landing HTML budget or the first paint. The widget is `interaction-only`: invisible
// unless Cloudflare wants a human to click. A token is single-use, so every send resets the widget.

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      appearance: 'interaction-only';
      theme: 'auto';
      callback: (token: string) => void;
      'error-callback': () => void;
      'expired-callback': () => void;
    },
  ): string;
  reset(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export interface Challenge {
  /** Loads the script and renders the widget; safe to call more than once. */
  start(): void;
  /** The current token, waiting for one if needed; null when the check errors or `timeoutMs` passes. */
  token(): Promise<string | null>;
  /** Discards the used token and asks for a fresh one. */
  reset(): void;
}

export interface TurnstileOptions {
  timeoutMs?: number;
  /** Resolves the Turnstile API; replaced in tests. */
  load?: () => Promise<TurnstileApi>;
}

export function loadTurnstile(doc: Document = document): Promise<TurnstileApi> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const script = doc.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile'));
    script.onerror = () => reject(new Error('turnstile'));
    doc.head.append(script);
  });
}

export function createTurnstile(
  slot: HTMLElement,
  siteKey: string,
  { timeoutMs = 10_000, load = loadTurnstile }: TurnstileOptions = {},
): Challenge {
  let started = false;
  let api: TurnstileApi | undefined;
  let widget: string | undefined;
  let current: string | null = null;
  let failed = false;
  const waiting = new Set<(token: string | null) => void>();

  const settle = (token: string | null): void => {
    current = token;
    failed = token === null;
    for (const resolve of [...waiting]) resolve(token);
  };

  const start = (): void => {
    if (started) return;
    started = true;
    load().then(
      (loaded) => {
        api = loaded;
        widget = loaded.render(slot, {
          sitekey: siteKey,
          appearance: 'interaction-only',
          theme: 'auto',
          callback: (token) => settle(token),
          'error-callback': () => settle(null),
          'expired-callback': () => {
            current = null;
          },
        });
      },
      () => settle(null),
    );
  };

  return {
    start,
    token() {
      start();
      if (current) return Promise.resolve(current);
      if (failed) return Promise.resolve(null);
      return new Promise((resolve) => {
        const done = (token: string | null): void => {
          clearTimeout(timer);
          waiting.delete(done);
          resolve(token);
        };
        const timer = setTimeout(() => done(null), timeoutMs);
        waiting.add(done);
      });
    },
    reset() {
      current = null;
      failed = false;
      if (api && widget !== undefined) api.reset(widget);
      // The script never arrived (blocked, offline): let the next attempt try to load it again.
      else if (!api) started = false;
    },
  };
}
