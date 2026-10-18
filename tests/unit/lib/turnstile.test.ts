import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTurnstile } from '../../../src/lib/turnstile';

interface Api {
  render: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
}

const fakeApi = (): Api => ({ render: vi.fn(() => 'widget-1'), reset: vi.fn() });
const slot = {} as HTMLElement;
const ready = (api: Api) => () => Promise.resolve(api as never);

/** Options passed to render() on the nth call. */
const renderOptions = (api: Api, n = 0) =>
  api.render.mock.calls[n]?.[1] as {
    sitekey: string;
    appearance: string;
    callback: (t: string) => void;
    'error-callback': () => void;
    'expired-callback': () => void;
  };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createTurnstile', () => {
  it('loads nothing until started, then renders an interaction-only widget with the site key', async () => {
    const api = fakeApi();
    const load = vi.fn(ready(api));
    const challenge = createTurnstile(slot, 'site-key', { load });
    expect(load).not.toHaveBeenCalled();
    challenge.start();
    challenge.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(1);
    expect(api.render).toHaveBeenCalledTimes(1);
    expect(renderOptions(api)).toMatchObject({
      sitekey: 'site-key',
      appearance: 'interaction-only',
    });
  });

  it('resolves token() with the token the widget delivers', async () => {
    const api = fakeApi();
    const challenge = createTurnstile(slot, 'k', { load: ready(api) });
    const pending = challenge.token();
    await vi.advanceTimersByTimeAsync(0);
    renderOptions(api).callback('tok-1');
    await expect(pending).resolves.toBe('tok-1');
    await expect(challenge.token()).resolves.toBe('tok-1');
  });

  it('resolves null when the widget reports an error', async () => {
    const api = fakeApi();
    const challenge = createTurnstile(slot, 'k', { load: ready(api) });
    const pending = challenge.token();
    await vi.advanceTimersByTimeAsync(0);
    renderOptions(api)['error-callback']();
    await expect(pending).resolves.toBeNull();
  });

  it('resolves null when the script cannot load', async () => {
    const challenge = createTurnstile(slot, 'k', {
      load: () => Promise.reject(new Error('blocked')),
    });
    await expect(challenge.token()).resolves.toBeNull();
  });

  it('gives up after the timeout when no token arrives', async () => {
    const api = fakeApi();
    const challenge = createTurnstile(slot, 'k', { load: ready(api), timeoutMs: 5000 });
    const pending = challenge.token();
    await vi.advanceTimersByTimeAsync(4999);
    let settled = false;
    void pending.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBeNull();
  });

  it('forgets an expired token and waits for the next one', async () => {
    const api = fakeApi();
    const challenge = createTurnstile(slot, 'k', { load: ready(api) });
    const first = challenge.token();
    await vi.advanceTimersByTimeAsync(0);
    renderOptions(api).callback('old');
    await first;
    renderOptions(api)['expired-callback']();
    const next = challenge.token();
    renderOptions(api).callback('new');
    await expect(next).resolves.toBe('new');
  });

  it('reset() drops the used token and resets the widget', async () => {
    const api = fakeApi();
    const challenge = createTurnstile(slot, 'k', { load: ready(api), timeoutMs: 1000 });
    const first = challenge.token();
    await vi.advanceTimersByTimeAsync(0);
    renderOptions(api).callback('used');
    await first;
    challenge.reset();
    expect(api.reset).toHaveBeenCalledWith('widget-1');
    const next = challenge.token();
    await vi.advanceTimersByTimeAsync(1000);
    await expect(next).resolves.toBeNull();
  });

  it('reset() after a failed script load lets the next attempt load it again', async () => {
    const api = fakeApi();
    const load = vi
      .fn<() => Promise<never>>()
      .mockRejectedValueOnce(new Error('blocked'))
      .mockImplementation(ready(api));
    const challenge = createTurnstile(slot, 'k', { load });
    await expect(challenge.token()).resolves.toBeNull();
    challenge.reset();
    const retry = challenge.token();
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(2);
    renderOptions(api).callback('ok');
    await expect(retry).resolves.toBe('ok');
  });
});
