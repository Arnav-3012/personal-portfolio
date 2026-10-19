// Hero background (Arnav, 2026-10-18: "neurons and a neural network around me, moving towards me"): layered nodes
// left and right of the portrait, joined by faint edges, with amber signals travelling inward and being absorbed at
// the head. After the NVIDIA reference in awesome-design-md: one disciplined accent (the amber token), a soft colour
// wash behind the subject and nothing louder than the portrait. Colours are read from the tokens at run time, the
// canvas is made by JavaScript after the LCP paint (see motion.ts), and with reduced motion it draws one still frame.

export interface Node {
  x: number;
  y: number;
  layer: number;
  /** Phase offset for the idle drift and breathing. */
  phase: number;
  /** 0–1, set to 1 when a signal arrives and decays. */
  energy: number;
}
export interface Edge {
  a: number;
  b: number;
}
export interface Focus {
  /** Where the signals converge (the head), in canvas pixels. */
  x: number;
  y: number;
  /** Half the width of the portrait, so the layers stay clear of it. */
  halfWidth: number;
}
export interface Net {
  nodes: Node[];
  edges: Edge[];
  /** Edge indices leaving each node (towards the portrait). Empty for the innermost layer. */
  out: number[][];
  /** Indices of nodes in the layer closest to the portrait. */
  inner: number[];
  /** Indices of nodes in the outermost layer, where signals start. */
  outer: number[];
  focus: Focus;
}

/** Small seeded generator (mulberry32): the same seed always builds the same network. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Nodes per layer, outermost first. Phones get one thin layer pair at the margins. */
export const layersFor = (width: number): number[] => (width < 640 ? [4, 5] : [5, 7, 7, 5]);

/**
 * Builds the network: the same layers mirrored on both sides of the focus, narrowing towards the portrait, each node
 * joined to its two nearest neighbours in the next layer in (and now and then a third).
 */
export function buildNetwork(width: number, height: number, focus: Focus, seed = 7): Net {
  const rand = rng(seed);
  const counts = layersFor(width);
  const layers = counts.length;
  const half = width / 2;
  const phone = width < 640;
  const outerOffset = half * (phone ? 0.97 : 0.94);
  const innerOffset = phone ? half * 0.86 : Math.min(half * 0.86, focus.halfWidth * 1.35 + 24);
  const nodes: Node[] = [];
  const byLayer: number[][][] = [[], []]; // [side][layer] -> node indices, side 0 = left
  for (const side of [0, 1] as const) {
    counts.forEach((count, layer) => {
      const t = layers === 1 ? 0 : layer / (layers - 1);
      const offset = outerOffset + (innerOffset - outerOffset) * t;
      const x = focus.x + (side === 0 ? -offset : offset);
      const reach = height * (0.4 - 0.12 * t);
      const ids: number[] = [];
      for (let i = 0; i < count; i++) {
        const step = (2 * reach) / Math.max(1, count - 1);
        const y = focus.y - reach + i * step + (rand() - 0.5) * step * 0.5;
        const jitterX = (rand() - 0.5) * 18;
        nodes.push({ x: x + jitterX, y, layer, phase: rand() * Math.PI * 2, energy: 0 });
        ids.push(nodes.length - 1);
      }
      byLayer[side]?.push(ids);
    });
  }
  const edges: Edge[] = [];
  const out: number[][] = nodes.map(() => []);
  for (const side of [0, 1] as const) {
    for (let layer = 0; layer < layers - 1; layer++) {
      const from = byLayer[side]?.[layer] ?? [];
      const to = byLayer[side]?.[layer + 1] ?? [];
      for (const a of from) {
        const ay = nodes[a]?.y ?? 0;
        const nearest = [...to].sort(
          (p, q) => Math.abs((nodes[p]?.y ?? 0) - ay) - Math.abs((nodes[q]?.y ?? 0) - ay),
        );
        const picks = nearest.slice(0, 2);
        const extra = nearest[2];
        if (extra !== undefined && rand() < 0.35) picks.push(extra);
        for (const b of picks) {
          out[a]?.push(edges.length);
          edges.push({ a, b });
        }
      }
    }
  }
  const inner = [0, 1].flatMap((side) => byLayer[side]?.[layers - 1] ?? []);
  const outer = [0, 1].flatMap((side) => byLayer[side]?.[0] ?? []);
  return { nodes, edges, out, inner, outer, focus };
}

export interface Signal {
  edge: number;
  /** Progress along the edge, 0–1. */
  t: number;
  /** Pixels per second. */
  speed: number;
}

/** Where a signal goes after reaching `node`: a random onward edge, or null at the innermost layer (the head). */
export function nextEdge(net: Net, node: number, rand: () => number): number | null {
  const options = net.out[node] ?? [];
  if (options.length === 0) return null;
  return options[Math.floor(rand() * options.length)] ?? null;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

interface Colours {
  accent: string;
  dim: string;
  /** Day (ink on paper) needs stronger strokes than Night (light on dark). */
  gain: number;
}

const readColours = (root: HTMLElement): Colours => {
  const css = getComputedStyle(root);
  return {
    accent: css.getPropertyValue('--time').trim() || 'orange',
    dim: css.getPropertyValue('--text-2').trim() || 'gray',
    gain: root.dataset['theme'] === 'day' ? 1.5 : 1,
  };
};

export interface Neural {
  stop(): void;
}

/** Mounts the canvas behind the hero content and starts it. Returns null if there is no hero. */
export function startNeural(doc: Document = document): Neural | null {
  const hero = doc.querySelector<HTMLElement>('[data-hero]');
  const stage = hero?.querySelector<HTMLElement>('.hero__stage');
  if (!hero || !stage) return null;
  const root = doc.documentElement;
  const reduced = root.dataset['motion'] === 'reduced';
  const canvas = doc.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  // Inline styles, not CSS: nothing here may add to the render-blocking stylesheet. The hero becomes its own
  // stacking context so z-index -1 sits above its background and below its content.
  canvas.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none';
  hero.style.isolation = 'isolate';
  hero.prepend(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return null;
  }
  if (!reduced)
    canvas.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 1600,
      easing: 'ease-out',
      fill: 'backwards',
    });

  let net: Net | null = null;
  let colours = readColours(root);
  let w = 0;
  let h = 0;
  const rand = rng(99);
  const signals: Signal[] = [];
  let nextSpawn = 0;

  const build = (): void => {
    const hr = hero.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    w = Math.max(1, Math.round(hr.width));
    h = Math.max(1, Math.round(hr.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const focus: Focus = {
      x: sr.left - hr.left + sr.width / 2,
      y: sr.top - hr.top + sr.height * 0.42,
      halfWidth: sr.width * 0.3,
    };
    net = buildNetwork(w, h, focus);
    signals.length = 0;
  };

  const nodePos = (n: Node, time: number): [number, number] => [
    n.x + Math.sin(time * 0.0006 + n.phase) * 3,
    n.y + Math.cos(time * 0.0005 + n.phase * 1.3) * 3,
  ];

  const draw = (time: number): void => {
    if (!net) return;
    const { nodes, edges, focus } = net;
    const { accent, dim, gain } = colours;
    ctx.clearRect(0, 0, w, h);

    // Wash behind the subject: a soft pool of the accent, strongest at the head.
    const wash = ctx.createRadialGradient(
      focus.x,
      focus.y,
      0,
      focus.x,
      focus.y,
      Math.max(w, h) * 0.5,
    );
    ctx.globalAlpha = 0.1 * gain;
    wash.addColorStop(0, accent);
    wash.addColorStop(1, 'transparent');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);

    const pos = nodes.map((n) => nodePos(n, time));
    ctx.lineWidth = 1;
    ctx.strokeStyle = dim;
    ctx.globalAlpha = 0.16 * gain;
    ctx.beginPath();
    for (const e of edges) {
      const a = pos[e.a];
      const b = pos[e.b];
      if (!a || !b) continue;
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
    // The innermost layer is joined to the head by fainter lines that run behind the portrait.
    for (const i of net.inner) {
      const p = pos[i];
      if (!p) continue;
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(focus.x, focus.y);
    }
    ctx.stroke();

    for (const [i, n] of nodes.entries()) {
      const p = pos[i];
      if (!p) continue;
      const breathe = 0.5 + 0.5 * Math.sin(time * 0.0012 + n.phase);
      ctx.globalAlpha = Math.min(1, (0.28 + 0.2 * breathe) * gain + n.energy * 0.6);
      ctx.fillStyle = n.energy > 0.05 ? accent : dim;
      ctx.beginPath();
      ctx.arc(p[0], p[1], 2 + breathe * 0.8 + n.energy * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Signals: a short fading trail and a bright head.
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    for (const s of signals) {
      const e = edges[s.edge];
      const a = e && pos[e.a];
      const b = e && pos[e.b];
      if (!a || !b) continue;
      const x = lerp(a[0], b[0], s.t);
      const y = lerp(a[1], b[1], s.t);
      const t0 = Math.max(0, s.t - 0.22);
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(lerp(a[0], b[0], t0), lerp(a[1], b[1], t0));
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  };

  const step = (dt: number, time: number): void => {
    if (!net) return;
    for (const n of net.nodes) n.energy = Math.max(0, n.energy - dt * 1.6);
    const max = w < 640 ? 10 : 26;
    if (time >= nextSpawn && signals.length < max && net.outer.length > 0) {
      const start = net.outer[Math.floor(rand() * net.outer.length)] ?? 0;
      const edge = nextEdge(net, start, rand);
      if (edge !== null) signals.push({ edge, t: 0, speed: 90 + rand() * 90 });
      nextSpawn = time + 260 + rand() * 380;
    }
    for (let i = signals.length - 1; i >= 0; i--) {
      const s = signals[i];
      const e = s && net.edges[s.edge];
      if (!s || !e) {
        signals.splice(i, 1);
        continue;
      }
      const a = net.nodes[e.a];
      const b = net.nodes[e.b];
      const len = Math.max(1, Math.hypot((b?.x ?? 0) - (a?.x ?? 0), (b?.y ?? 0) - (a?.y ?? 0)));
      s.t += (s.speed * dt) / len;
      if (s.t < 1) continue;
      if (b) b.energy = 1;
      const next = nextEdge(net, e.b, rand);
      if (next === null) {
        signals.splice(i, 1);
      } else {
        s.edge = next;
        s.t = 0;
      }
    }
  };

  build();
  if (reduced) {
    draw(0);
  }

  let raf = 0;
  let last = 0;
  let visible = true;
  const frame = (time: number): void => {
    raf = requestAnimationFrame(frame);
    // 30 fps is plenty for a background, and halves the cost.
    if (time - last < 33) return;
    const dt = Math.min(0.1, (time - last) / 1000);
    last = time;
    step(dt, time);
    draw(time);
  };
  const run = (): void => {
    if (reduced || raf || !visible || doc.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const pause = (): void => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const io = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
    if (visible) run();
    else pause();
  });
  io.observe(hero);
  const onVisibility = (): void => (doc.hidden ? pause() : run());
  doc.addEventListener('visibilitychange', onVisibility);

  const ro = new ResizeObserver(() => {
    build();
    if (reduced) draw(0);
  });
  ro.observe(hero);

  const theme = new MutationObserver(() => {
    colours = readColours(root);
    if (reduced) draw(0);
  });
  theme.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  run();
  return {
    stop(): void {
      pause();
      io.disconnect();
      ro.disconnect();
      theme.disconnect();
      doc.removeEventListener('visibilitychange', onVisibility);
      canvas.remove();
    },
  };
}
