// AudioManager (SPEC "Build phases": built now so Phase 5 is drop-in). One AudioContext, master/music/sfx
// gains, muted by default, follows the Settings sound toggle, suspends while the tab is hidden.
// Phases 1–4 call play() with no files, which is a no-op.
import { settings, type SettingsStore } from './settings';

export type Channel = 'music' | 'sfx';

interface Env {
  store: SettingsStore;
  createContext: () => AudioContext;
  /** Gesture and visibility events come from here (document in the browser). */
  events: EventTarget & { readonly hidden: boolean };
  fetchAudio: (src: string) => Promise<ArrayBuffer>;
}

type Gains = Record<'master' | Channel, GainNode>;

const GESTURES = ['pointerdown', 'keydown'] as const;

export class AudioManager {
  private ctx: AudioContext | undefined;
  private gains: Gains | undefined;
  private readonly volumes: Record<'master' | Channel, number> = {
    master: 1,
    music: 0.6,
    sfx: 0.8,
  };
  private readonly buffers = new Map<string, Promise<AudioBuffer>>();
  private enabled: boolean;
  private gestured = false;

  constructor(private readonly env: Env) {
    this.enabled = env.store.get().sound;
    env.store.subscribe((s) => this.setEnabled(s.sound));
    env.events.addEventListener('visibilitychange', () => void this.syncState());
    const onGesture = (): void => {
      this.gestured = true;
      for (const g of GESTURES) env.events.removeEventListener(g, onGesture);
      void this.syncState();
    };
    for (const g of GESTURES) env.events.addEventListener(g, onGesture);
  }

  get muted(): boolean {
    return !this.enabled;
  }

  get hasContext(): boolean {
    return this.ctx !== undefined;
  }

  setVolume(channel: 'master' | Channel, value: number): void {
    this.volumes[channel] = Math.min(1, Math.max(0, value));
    if (this.gains) this.gains[channel].gain.value = this.volumes[channel];
  }

  /** Plays a file on a channel. Silently does nothing when muted, before a gesture, or with no file. */
  async play(src?: string, channel: Channel = 'sfx'): Promise<void> {
    if (!src || !this.enabled || !this.gestured || this.env.events.hidden) return;
    const { ctx, gains } = this.graph();
    const buffer = await this.load(src, ctx);
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(gains[channel]);
    node.start();
  }

  private setEnabled(on: boolean): void {
    this.enabled = on;
    void this.syncState();
  }

  /** Creates the context lazily (browsers require a gesture) and keeps it running only when audible. */
  private async syncState(): Promise<void> {
    const audible = this.enabled && this.gestured && !this.env.events.hidden;
    if (audible) {
      const { ctx } = this.graph();
      if (ctx.state === 'suspended') await ctx.resume();
    } else if (this.ctx?.state === 'running') {
      await this.ctx.suspend();
    }
  }

  private graph(): { ctx: AudioContext; gains: Gains } {
    if (this.ctx && this.gains) return { ctx: this.ctx, gains: this.gains };
    const ctx = this.env.createContext();
    const make = (key: 'master' | Channel): GainNode => {
      const node = ctx.createGain();
      node.gain.value = this.volumes[key];
      return node;
    };
    const master = make('master');
    master.connect(ctx.destination);
    const music = make('music');
    const sfx = make('sfx');
    music.connect(master);
    sfx.connect(master);
    this.gains = { master, music, sfx };
    this.ctx = ctx;
    return { ctx, gains: this.gains };
  }

  private load(src: string, ctx: AudioContext): Promise<AudioBuffer> {
    let buffer = this.buffers.get(src);
    if (!buffer) {
      buffer = this.env.fetchAudio(src).then((data) => ctx.decodeAudioData(data));
      this.buffers.set(src, buffer);
    }
    return buffer;
  }
}

let shared: AudioManager | undefined;

/** The page-wide manager, created on first use in the browser. */
export const audio = (): AudioManager =>
  (shared ??= new AudioManager({
    store: settings(),
    createContext: () => new AudioContext(),
    events: document,
    fetchAudio: (src) => fetch(src).then((r) => r.arrayBuffer()),
  }));
