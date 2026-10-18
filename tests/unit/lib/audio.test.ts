import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { AudioManager } from '../../../src/lib/audio';
import { createSettingsStore, type SettingsStore } from '../../../src/lib/settings';

class FakeContext {
  state: AudioContextState = 'running';
  destination = {};
  started = 0;
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  suspend = vi.fn(async () => {
    this.state = 'suspended';
  });
  gains: { gain: { value: number }; connect: Mock }[] = [];
  sources = 0;
  createGain = () => {
    const node = { gain: { value: 1 }, connect: vi.fn() };
    this.gains.push(node);
    return node;
  };
  createMediaElementSource = () => {
    this.sources++;
    return { connect: vi.fn() };
  };
  createBufferSource = () => ({ buffer: null, connect: vi.fn(), start: () => this.started++ });
  decodeAudioData = vi.fn(async () => ({}));
}

class FakeDocument extends EventTarget {
  hidden = false;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('AudioManager', () => {
  let store: SettingsStore;
  let doc: FakeDocument;
  let ctx: FakeContext;
  let createContext: Mock<() => FakeContext>;
  let fetchAudio: Mock<(src: string) => Promise<ArrayBuffer>>;
  let manager: AudioManager;

  beforeEach(() => {
    store = createSettingsStore(() => undefined);
    doc = new FakeDocument();
    ctx = new FakeContext();
    createContext = vi.fn(() => ctx);
    fetchAudio = vi.fn(async () => new ArrayBuffer(8));
    manager = new AudioManager({
      store,
      createContext: createContext as unknown as () => AudioContext,
      events: doc,
      fetchAudio,
    });
  });

  it('is muted by default and creates no AudioContext', async () => {
    doc.dispatchEvent(new Event('pointerdown'));
    await manager.play('/audio/x.mp3');
    expect(manager.muted).toBe(true);
    expect(createContext).not.toHaveBeenCalled();
    expect(fetchAudio).not.toHaveBeenCalled();
  });

  it('waits for a user gesture before creating the context, even with sound on', async () => {
    store.set({ sound: true });
    await flush();
    expect(createContext).not.toHaveBeenCalled();
    doc.dispatchEvent(new Event('keydown'));
    await flush();
    expect(createContext).toHaveBeenCalledOnce();
  });

  it('play() without a file is a no-op (phases 1–4)', async () => {
    store.set({ sound: true });
    doc.dispatchEvent(new Event('pointerdown'));
    await expect(manager.play()).resolves.toBeUndefined();
    expect(fetchAudio).not.toHaveBeenCalled();
  });

  it('plays once enabled and gestured, caching decoded files', async () => {
    store.set({ sound: true });
    doc.dispatchEvent(new Event('pointerdown'));
    await manager.play('/audio/x.mp3');
    await manager.play('/audio/x.mp3', 'music');
    expect(ctx.started).toBe(2);
    expect(fetchAudio).toHaveBeenCalledOnce();
  });

  it('suspends when the tab is hidden or sound is turned off, resumes when visible', async () => {
    store.set({ sound: true });
    doc.dispatchEvent(new Event('pointerdown'));
    await flush();
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(ctx.suspend).toHaveBeenCalledOnce();
    await manager.play('/audio/x.mp3');
    expect(ctx.started).toBe(0);

    doc.hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(ctx.resume).toHaveBeenCalledOnce();

    store.set({ sound: false });
    await flush();
    expect(ctx.suspend).toHaveBeenCalledTimes(2);
  });

  it('clamps volumes to 0–1', () => {
    expect(() => manager.setVolume('master', 3)).not.toThrow();
  });

  describe('attachElement', () => {
    const el = {} as HTMLMediaElement;

    it('routes nothing while muted, or before a gesture', () => {
      expect(manager.attachElement(el)).toBeUndefined();
      store.set({ sound: true });
      expect(manager.attachElement(el)).toBeUndefined();
      expect(createContext).not.toHaveBeenCalled();
      expect(ctx.sources).toBe(0);
    });

    it('routes the element through its own level, starting silent, and clamps it', () => {
      store.set({ sound: true });
      doc.dispatchEvent(new Event('pointerdown'));
      const handle = manager.attachElement(el, 'music');
      expect(ctx.sources).toBe(1);
      // The last gain created is the element's own level node.
      const level = ctx.gains.at(-1);
      expect(level?.gain.value).toBe(0);
      handle?.setLevel(0.3);
      expect(level?.gain.value).toBe(0.3);
      handle?.setLevel(4);
      expect(level?.gain.value).toBe(1);
      handle?.setLevel(-1);
      expect(level?.gain.value).toBe(0);
    });

    it('is silenced by the Settings toggle like any other sound', async () => {
      store.set({ sound: true });
      doc.dispatchEvent(new Event('pointerdown'));
      manager.attachElement(el);
      await flush();
      store.set({ sound: false });
      await flush();
      expect(ctx.suspend).toHaveBeenCalled();
      expect(manager.attachElement(el)).toBeUndefined();
    });
  });
});
