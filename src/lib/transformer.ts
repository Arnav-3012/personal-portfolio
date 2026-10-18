// ARNAV-OS boot as a transformer forward pass (SPEC "Loading states", first visit): input tokens embed at the
// bottom, signals climb the residual stream through attention + FFN blocks as real loading progresses, the
// output row decodes site.boot.output letter by letter, then the letters fly into the hero name.
// Pure layout/timing helpers are exported for tests; drawing is Canvas 2D (no library).

export const T = {
  /** The forward pass never finishes faster than this, so the animation reads. */
  MIN_FORWARD: 1400,
  /** Past this, the pass completes even if assets are still loading. */
  MAX_WAIT: 3200,
  DECODE: 170,
  HOLD: 200,
  HANDOFF: 450,
} as const;

/** Small deterministic PRNG so attention patterns (and screenshots) are stable. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One attention matrix per layer: rows are softmax distributions over the token columns. */
export function attentionWeights(n: number, seed: number, temperature = 0.35): number[][] {
  const rand = mulberry32(seed);
  return Array.from({ length: n }, () => {
    const logits = Array.from({ length: n }, () => rand() / temperature);
    const max = Math.max(...logits);
    const exp = logits.map((l) => Math.exp(l - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map((e) => e / sum);
  });
}

export interface BootLayout {
  cols: number[];
  inputY: number;
  outputY: number;
  /** Per block: attention band centre and FFN band centre (attention sits below FFN, as data flows up). */
  layers: { attnY: number; ffnY: number }[];
  band: number;
}

export function bootLayout(
  width: number,
  height: number,
  tokens: number,
  layers: number,
): BootLayout {
  const span = Math.min(width * 0.72, 760);
  const left = (width - span) / 2;
  const step = tokens > 1 ? span / (tokens - 1) : 0;
  const cols = Array.from({ length: tokens }, (_, i) => left + i * step);
  const inputY = height * 0.84;
  const outputY = height * 0.2;
  const block = (inputY - outputY) / (layers + 1);
  return {
    cols,
    inputY,
    outputY,
    band: block * 0.22,
    layers: Array.from({ length: layers }, (_, i) => {
      const base = inputY - block * (i + 1);
      return { attnY: base + block * 0.22, ffnY: base - block * 0.22 };
    }),
  };
}

export type BootPhase = 'forward' | 'decode' | 'handoff' | 'done';

export interface BootState {
  /** When the forward pass reached the top (ms since start), or null while still climbing. */
  forwardDoneAt: number | null;
}

/**
 * Where the boot is at time t, given real loading progress (0–1). Displayed progress is the lower of real
 * progress and elapsed/MIN_FORWARD; after MAX_WAIT real progress is treated as complete.
 */
export function bootStep(
  state: BootState,
  t: number,
  real: number,
  letters: number,
): { state: BootState; phase: BootPhase; progress: number; decoded: number; handoff: number } {
  const effective = t >= T.MAX_WAIT ? 1 : Math.max(0, Math.min(1, real));
  const progress = Math.min(effective, t / T.MIN_FORWARD, 1);
  const forwardDoneAt = state.forwardDoneAt ?? (progress >= 1 ? t : null);
  const next = { forwardDoneAt };
  if (forwardDoneAt === null)
    return { state: next, phase: 'forward', progress, decoded: 0, handoff: 0 };

  const since = t - forwardDoneAt;
  const decodeEnd = letters * T.DECODE + T.HOLD;
  if (since < decodeEnd)
    return {
      state: next,
      phase: 'decode',
      progress: 1,
      decoded: Math.min(letters, Math.floor(since / T.DECODE) + 1),
      handoff: 0,
    };
  const handoff = Math.min(1, (since - decodeEnd) / T.HANDOFF);
  return {
    state: next,
    phase: handoff >= 1 ? 'done' : 'handoff',
    progress: 1,
    decoded: letters,
    handoff,
  };
}

/** Total boot length when assets are already loaded (used for the SPEC "~2.5–3 s" check). */
export const fastestBoot = (letters: number): number =>
  T.MIN_FORWARD + letters * T.DECODE + T.HOLD + T.HANDOFF;

/** Top-k softmax for one decode step: the target letter leads with `confidence`, k−1 seeded distractors share
 * part of the rest (the tail of the vocabulary holds the remainder, so the shown bars sum to ≤ 1). */
export function softmaxTopK(
  target: string,
  k: number,
  confidence: number,
  seed: number,
): { ch: string; p: number }[] {
  const rand = mulberry32(seed);
  const pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter((c) => c !== target);
  const picks: string[] = [];
  while (picks.length < k - 1 && pool.length)
    picks.push(...pool.splice(Math.floor(rand() * pool.length), 1));
  const raw = picks.map(() => 0.2 + rand());
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  const rest = (1 - confidence) * 0.8;
  return [
    { ch: target, p: confidence },
    ...picks.map((ch, i) => ({ ch, p: ((raw[i] ?? 0) / sum) * rest })),
  ].sort((a, b) => b.p - a.p);
}

// ——— Drawing ———————————————————————————————————————————————————————————————————————————————

interface Palette {
  bg: string;
  line: string;
  text: string;
  text2: string;
  amber: string;
  mono: string;
  display: string;
}

function readPalette(root: HTMLElement): Palette {
  const cs = getComputedStyle(root);
  const v = (name: string): string => cs.getPropertyValue(name).trim();
  return {
    bg: v('--bg'),
    line: v('--line'),
    text: v('--text'),
    text2: v('--text-2'),
    amber: v('--time'),
    mono: v('--font-mono') || 'monospace',
    display: v('--font-display') || 'sans-serif',
  };
}

const easeOut = (x: number): number => 1 - (1 - x) ** 3;
const HIDDEN = 4;

export interface TransformerOptions {
  tokens: readonly string[];
  output: string;
  log: readonly string[];
  /** Live 0–1 progress of real assets (fonts, portrait). */
  progress: () => number;
  /** Where each decoded letter should fly to (the hero name letters). */
  targets: () => DOMRect[];
  onHandoff: () => void;
  onDone: () => void;
}

interface Pulse {
  /** Row it leaves from (0 = embedding row), source and destination neuron index, progress 0–1. */
  row: number;
  from: number;
  to: number;
  t: number;
  speed: number;
}

/** Runs the animation on the canvas; returns a stop function (used by skip). */
export function runTransformer(canvas: HTMLCanvasElement, opts: TransformerOptions): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    opts.onHandoff();
    opts.onDone();
    return () => undefined;
  }
  const pal = readPalette(document.documentElement);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const n = opts.tokens.length;
  let w = 0;
  let h = 0;
  let lay: BootLayout;
  let narrow = false;
  /** Neuron rows: embedding row then one FFN row per block; each row holds n × HIDDEN neuron x positions. */
  let rows: { y: number; xs: number[] }[] = [];
  const grid = document.createElement('canvas');

  const resize = (): void => {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    narrow = w < 600;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lay = bootLayout(w, h, n, narrow ? 3 : 4);
    const gap = Math.min(16, w / 64);
    const xsFor = (): number[] =>
      lay.cols.flatMap((x) => Array.from({ length: HIDDEN }, (_, k) => x + (k - 1.5) * gap));
    rows = [
      { y: lay.inputY - 26, xs: xsFor() },
      ...lay.layers.map((L) => ({ y: L.ffnY, xs: xsFor() })),
    ];
    // Faint dot grid, drawn once per size: ties the boot to the dithered portrait.
    grid.width = canvas.width;
    grid.height = canvas.height;
    const g = grid.getContext('2d');
    if (g) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = pal.line;
      for (let y = 12; y < h; y += 24) for (let x = 12; x < w; x += 24) g.fillRect(x, y, 1.5, 1.5);
    }
  };
  resize();
  addEventListener('resize', resize);

  const attn = Array.from({ length: 4 }, (_, i) => attentionWeights(n, 7 + i * 13));
  const rand = mulberry32(42);
  const embed = Array.from({ length: n }, () =>
    Array.from({ length: 8 }, () => 0.2 + rand() * 0.8),
  );
  const pulses: Pulse[] = Array.from({ length: narrow ? 40 : 80 }, () => ({
    row: 0,
    from: Math.floor(rand() * n * HIDDEN),
    to: Math.floor(rand() * n * HIDDEN),
    t: rand(),
    speed: 1.6 + rand() * 1.4,
  }));
  const letters = [...opts.output];
  const start = performance.now();
  let prev = start;
  let state: BootState = { forwardDoneAt: null };
  let handedOff = false;
  let frame = 0;
  let stopped = false;
  let flights: { sx: number; sy: number; tx: number; ty: number; d: number }[] | null = null;

  const draw = (now: number): void => {
    if (stopped) return;
    const t = now - start;
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    const step = bootStep(state, t, opts.progress(), letters.length);
    state = step.state;
    const fade = 1 - easeOut(step.handoff);
    const front = lay.inputY - (lay.inputY - lay.outputY) * step.progress;
    const left = (lay.cols[0] ?? 0) - 48;
    const right = (lay.cols[n - 1] ?? 0) + 48;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = fade * 0.55;
    ctx.drawImage(grid, 0, 0, w, h);

    // Activation front: a soft amber band rising with real progress.
    if (step.phase === 'forward') {
      // An ellipse (unit radial gradient, scaled), so the glow has no hard ends.
      const band = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      band.addColorStop(0, pal.amber);
      band.addColorStop(1, 'transparent');
      ctx.save();
      ctx.translate((left + right) / 2, front);
      ctx.scale((right - left) / 2 + 60, 40);
      ctx.globalAlpha = 0.16 * fade;
      ctx.fillStyle = band;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }

    // Fully connected edges between consecutive neuron rows (one path per gap, very faint).
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = pal.line;
    for (let r = 0; r + 1 < rows.length; r++) {
      const a = rows[r];
      const b = rows[r + 1];
      if (!a || !b) continue;
      ctx.globalAlpha = (front <= b.y ? 0.55 : 0.25) * fade;
      ctx.beginPath();
      for (let i = 0; i < a.xs.length; i += 2)
        for (let j = 0; j < b.xs.length; j += 3) {
          ctx.moveTo(a.xs[i] ?? 0, a.y);
          ctx.lineTo(b.xs[j] ?? 0, b.y);
        }
      ctx.stroke();
    }

    // Attention: weighted arcs between token columns, plus a small heatmap of the current head.
    ctx.font = `500 10px ${pal.mono}`;
    ctx.textAlign = 'left';
    lay.layers.forEach((L, li) => {
      const lit = front <= L.attnY;
      const weights = attn[li % attn.length] ?? [];
      ctx.fillStyle = lit ? pal.amber : pal.text2;
      ctx.globalAlpha = fade;
      ctx.fillText(`BLOCK ${li + 1} · ATTN ×8 · FFN ×${HIDDEN}`, left, L.attnY + lay.band + 16);
      if (lit) {
        const pulse = 0.6 + 0.4 * Math.sin(t / 200 + li);
        weights.forEach((row, i) =>
          row.forEach((wgt, j) => {
            if (wgt < 1 / n || i === j) return;
            const xi = lay.cols[i] ?? 0;
            const xj = lay.cols[j] ?? 0;
            ctx.strokeStyle = pal.amber;
            ctx.globalAlpha = Math.min(1, wgt * 1.6 * pulse) * fade;
            ctx.lineWidth = 0.6 + wgt * 2.6;
            ctx.beginPath();
            ctx.moveTo(xi, L.attnY + lay.band * 0.5);
            ctx.bezierCurveTo(
              xi,
              L.attnY - lay.band * 1.1,
              xj,
              L.attnY - lay.band * 1.1,
              xj,
              L.attnY + lay.band * 0.5,
            );
            ctx.stroke();
          }),
        );
      }
      if (!narrow) {
        const cell = 7;
        const hx = right + 22;
        const hy = L.attnY - (n * cell) / 2;
        const head = (Math.floor(t / 420) + li) % 8;
        const hw = attentionWeights(n, 101 + li * 17 + head);
        hw.forEach((row, i) =>
          row.forEach((wgt, j) => {
            ctx.fillStyle = lit ? pal.amber : pal.line;
            ctx.globalAlpha = (lit ? 0.15 + wgt * 1.6 : 0.5) * fade;
            ctx.fillRect(hx + j * cell, hy + i * cell, cell - 1, cell - 1);
          }),
        );
        ctx.globalAlpha = fade;
        ctx.fillStyle = pal.text2;
        ctx.fillText(`HEAD ${head + 1}/8`, hx, hy + n * cell + 12);
      }
    });
    ctx.lineWidth = 1;

    // Neurons: rings, filled amber once the front has passed their row.
    rows.forEach((row, r) => {
      const lit = front <= row.y;
      row.xs.forEach((x, i) => {
        const glow = lit ? 0.55 + 0.45 * Math.abs(Math.sin(t / 260 + i * 0.7 + r)) : 0;
        ctx.globalAlpha = fade * (lit ? glow : 0.9);
        ctx.beginPath();
        ctx.arc(x, row.y, 2.6, 0, Math.PI * 2);
        if (lit) {
          ctx.fillStyle = pal.amber;
          ctx.fill();
        } else {
          ctx.strokeStyle = pal.line;
          ctx.stroke();
        }
      });
    });

    // Signal pulses: travel edge to edge up through the rows below the front, with a short trail.
    for (const p of pulses) {
      const a = rows[p.row];
      const b = rows[p.row + 1];
      if (!a || !b || front > b.y + 2) {
        p.row = 0;
        p.t = 0;
        continue;
      }
      p.t += dt * p.speed;
      if (p.t >= 1) {
        p.row = p.row + 2 < rows.length && front <= (rows[p.row + 2]?.y ?? 0) ? p.row + 1 : 0;
        p.from = p.to;
        p.to = Math.floor(rand() * n * HIDDEN);
        p.t = 0;
        continue;
      }
      const ax = a.xs[p.from] ?? 0;
      const bx = b.xs[p.to] ?? 0;
      ctx.strokeStyle = pal.amber;
      ctx.globalAlpha = 0.25 * fade;
      ctx.beginPath();
      ctx.moveTo(ax, a.y);
      ctx.lineTo(bx, b.y);
      ctx.stroke();
      ctx.fillStyle = pal.amber;
      for (let k = 0; k < 5; k++) {
        const tt = Math.max(0, p.t - k * 0.05);
        ctx.globalAlpha = (1 - k / 5) * fade;
        const s = k === 0 ? 3.5 : 2.5;
        ctx.fillRect(ax + (bx - ax) * tt - s / 2, a.y + (b.y - a.y) * tt - s / 2, s, s);
      }
    }

    // Input tokens with their embedding vectors.
    ctx.textAlign = 'center';
    ctx.font = `500 12px ${pal.mono}`;
    opts.tokens.forEach((tok, i) => {
      const x = lay.cols[i] ?? 0;
      const bw = Math.max(48, ctx.measureText(tok).width + 18);
      ctx.globalAlpha = fade;
      ctx.strokeStyle = pal.line;
      ctx.strokeRect(x - bw / 2, lay.inputY + 14, bw, 26);
      ctx.fillStyle = pal.text;
      ctx.fillText(tok, x, lay.inputY + 31);
      (embed[i] ?? []).forEach((v, k) => {
        const bh = 3 + v * 11;
        ctx.fillStyle = pal.amber;
        ctx.globalAlpha = (0.35 + v * 0.65) * fade;
        ctx.fillRect(x - 14 + k * 4, lay.inputY + 8 - bh, 2.5, bh);
      });
    });

    // Output: decoded string with a cursor, and the live top-5 softmax for the current step.
    const size = Math.min(76, w / (letters.length + 3));
    ctx.font = `700 ${size}px ${pal.display}`;
    ctx.textAlign = 'left';
    const glyphW = letters.map((ch) => ctx.measureText(ch).width);
    const total = glyphW.reduce((a, b) => a + b, 0) + (letters.length - 1) * size * 0.12;
    let gx = w / 2 - total / 2;
    const gy = lay.outputY - 30;
    const origins = letters.map((_, i) => {
      const x = gx;
      gx += (glyphW[i] ?? 0) + size * 0.12;
      return x;
    });
    if (step.phase === 'forward' || step.phase === 'decode') {
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal.text;
      letters.slice(0, step.decoded).forEach((ch, i) => ctx.fillText(ch, origins[i] ?? 0, gy));
      if (Math.floor(t / 420) % 2 === 0) {
        const cx = step.decoded < letters.length ? (origins[step.decoded] ?? 0) : gx;
        ctx.fillStyle = pal.amber;
        ctx.fillRect(cx, gy - size * 0.72, size * 0.09, size * 0.78);
      }
    }
    if (!narrow && step.phase !== 'handoff' && step.phase !== 'done') {
      const idx = Math.min(
        letters.length - 1,
        Math.max(0, step.decoded - (step.phase === 'decode' ? 1 : 0)),
      );
      const conf =
        step.phase === 'decode' ? 0.82 + 0.1 * Math.sin(idx) : 0.18 + 0.1 * Math.sin(t / 150);
      const top = softmaxTopK(letters[idx] ?? 'A', 5, conf, Math.floor(t / 140) + idx);
      const sx = right + 22;
      const sy = lay.outputY - 70;
      ctx.font = `500 10px ${pal.mono}`;
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal.text2;
      ctx.fillText('SOFTMAX · TOP 5', sx, sy - 10);
      top.forEach((c, i) => {
        const y = sy + i * 14;
        const best = i === 0 && step.phase === 'decode';
        ctx.fillStyle = best ? pal.text : pal.text2;
        ctx.fillText(c.ch, sx, y + 8);
        ctx.fillStyle = best ? pal.amber : pal.line;
        ctx.fillRect(sx + 14, y, Math.max(2, c.p * 90), 9);
        ctx.fillStyle = pal.text2;
        ctx.fillText(c.p.toFixed(2), sx + 110, y + 8);
      });
    }

    // HUD: progress with a thin bar, and the SPEC log lines revealed with progress.
    ctx.globalAlpha = fade;
    ctx.font = `500 11px ${pal.mono}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = pal.amber;
    const pct = Math.round(step.progress * 100);
    ctx.fillText(
      step.phase === 'forward'
        ? `FORWARD PASS · ${pct}%`
        : `DECODING · ${Math.min(step.decoded, letters.length)}/${letters.length}`,
      24,
      40,
    );
    ctx.fillStyle = pal.line;
    ctx.fillRect(24, 50, 140, 2);
    ctx.fillStyle = pal.amber;
    ctx.fillRect(24, 50, 140 * step.progress, 2);
    const shown = Math.ceil(step.progress * opts.log.length);
    opts.log.slice(0, shown).forEach((line, i) => {
      ctx.fillStyle = line.startsWith('[ !! ]') ? pal.amber : pal.text2;
      ctx.fillText(line, 24, h - 24 - (shown - 1 - i) * 16);
    });

    // Hand-off: decoded letters fly to the hero name while the overlay clears (data-boot="out").
    if (step.phase === 'handoff' || step.phase === 'done') {
      if (!handedOff) {
        handedOff = true;
        opts.onHandoff();
        const targets = opts.targets();
        const r = mulberry32(99);
        flights = letters.flatMap((_, i) => {
          const tr = targets[i];
          if (!tr) return [];
          return Array.from({ length: 30 }, () => ({
            sx: (origins[i] ?? 0) + r() * (glyphW[i] ?? size),
            sy: gy - r() * size * 0.75,
            tx: tr.left + r() * tr.width,
            ty: tr.top + r() * tr.height,
            d: r() * 0.25,
          }));
        });
      }
      ctx.fillStyle = pal.amber;
      for (const f of flights ?? []) {
        const e = easeOut(Math.max(0, Math.min(1, (step.handoff - f.d) / (1 - f.d))));
        ctx.globalAlpha = 1 - e * 0.8;
        ctx.fillRect(f.sx + (f.tx - f.sx) * e - 1.5, f.sy + (f.ty - f.sy) * e - 1.5, 3, 3);
      }
    }
    ctx.globalAlpha = 1;

    if (step.phase === 'done') {
      stop();
      opts.onDone();
      return;
    }
    frame = requestAnimationFrame(draw);
  };

  const stop = (): void => {
    stopped = true;
    cancelAnimationFrame(frame);
    removeEventListener('resize', resize);
  };
  frame = requestAnimationFrame(draw);
  return stop;
}
