// The entry sequence (task 2.3): a press on the brain dives into it, pulls back to a dot-matrix globe, turns to
// Mumbai, drops a pin, dives in and arrives on /workshop. Canvas 2D, loaded on demand (workshop-entry.ts warms it when
// the pointer comes near the brain), skippable at any moment. Colours come from the theme tokens at run time, so it
// is ink on paper in Day and light on dark in Night. The timeline and maths are in globe.ts and are unit-tested.
import { BEATS, frameAt, landCells, project, type Frame, type LatLon } from './globe';
import { mountLoader } from './loader';

export interface EntryContent {
  city: string;
  lat: number;
  lon: number;
  locking: string;
  status: string;
  skip: string;
}

export interface PlayOptions {
  content: EntryContent;
  brainUrl: string;
  /** Where the hovering brain sits on the page, so the dive starts exactly there. */
  from: DOMRect;
  destination?: string;
  doc?: Document;
}

/** Set before leaving so /workshop can rise from the page colour instead of cutting in. */
export const ARRIVE_KEY = 'arnav:arrive';

const CSS = `.ent{position:fixed;inset:0;z-index:1100;overflow:hidden;color:var(--text);cursor:pointer}
.ent canvas{position:absolute;inset:0;width:100%;height:100%}
.ent__hud,.ent__pin{position:absolute;margin:0;font:500 var(--type-hud)/1.2 var(--font-mono);letter-spacing:var(--track-hud);text-transform:uppercase;pointer-events:none}
.ent__hud{left:var(--space-5);bottom:var(--space-5);color:var(--text-2);padding:8px 12px;border-radius:var(--radius-chip);background:color-mix(in srgb,var(--bg) 78%,transparent);backdrop-filter:blur(6px)}
.ent__hud:empty{display:none}
.ent__hud b{color:var(--time);font-weight:500}
.ent__pin{left:calc(50% + 34px);top:50%;display:grid;gap:4px;padding:8px 12px;border:1px solid color-mix(in srgb,var(--text) 22%,transparent);border-radius:var(--radius-chip);background:color-mix(in srgb,var(--bg) 82%,transparent);backdrop-filter:blur(6px);transform:translateY(-50%);opacity:0;color:var(--text)}
.ent__pin span{color:var(--time)}
.ent__skip{position:absolute;top:var(--space-5);right:var(--space-5);min-height:44px;padding:0 var(--space-4);border:1px solid color-mix(in srgb,var(--text) 35%,transparent);border-radius:var(--radius-chip);background:color-mix(in srgb,var(--text) 10%,transparent);color:var(--text);font:500 var(--type-hud)/1 var(--font-mono);letter-spacing:var(--track-hud);text-transform:uppercase;cursor:pointer;transition:border-color var(--dur-hover) var(--ease-out),background var(--dur-hover) var(--ease-out)}
.ent__skip:hover{border-color:var(--text);background:color-mix(in srgb,var(--text) 16%,transparent)}
.ent__sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}`;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** The brain, mirrored to face the same way as the portrait and tinted with the accent, on an offscreen canvas. */
async function tintedBrain(url: string, accent: string, size: number): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (!g) return c;
  g.translate(size, 0);
  g.scale(-1, 1);
  g.drawImage(img, 0, 0, size, size);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = accent;
  g.fillRect(0, 0, size, size);
  return c;
}

/** Neuron nodes sampled from the brain's own lines (unit coordinates), each joined to its two nearest neighbours. */
function neurons(brain: HTMLCanvasElement): { pts: [number, number][]; links: [number, number][] } {
  const probe = document.createElement('canvas');
  probe.width = probe.height = 160;
  const g = probe.getContext('2d', { willReadFrequently: true });
  if (!g) return { pts: [], links: [] };
  g.drawImage(brain, 0, 0, 160, 160);
  const px = g.getImageData(0, 0, 160, 160).data;
  const pts: [number, number][] = [];
  for (let y = 4; y < 160; y += 9)
    for (let x = 4; x < 160; x += 9)
      if ((px[(y * 160 + x) * 4 + 3] ?? 0) > 90) pts.push([(x + ((y * 7) % 5)) / 160, y / 160]);
  const links: [number, number][] = [];
  pts.forEach(([ax, ay], i) => {
    const near = pts
      .map(([bx, by], j) => ({ j, d: (ax - bx) ** 2 + (ay - by) ** 2 }))
      .filter((n) => n.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2);
    for (const n of near) if (n.d < 0.02) links.push([i, n.j]);
  });
  return { pts, links };
}

export async function playEnter({
  content,
  brainUrl,
  from,
  destination = '/workshop',
  doc = document,
}: PlayOptions): Promise<void> {
  const root = doc.documentElement;
  const css = getComputedStyle(root);
  const token = (name: string): string => css.getPropertyValue(name).trim();
  const bg = token('--bg') || 'black';
  const accent = token('--time') || 'orange';
  const ink = token('--text') || 'white';
  // Ink on paper (Day) needs a heavier hand than light on dark (Night): a body for the sphere, darker edge, bolder dots.
  const day = root.dataset['theme'] === 'day';
  const target: LatLon = { lat: content.lat, lon: content.lon };

  // Start fetching the next page now, so by the time the sequence ends it is usually already there.
  if (!doc.querySelector(`link[rel="prefetch"][href="${destination}"]`)) {
    const hint = doc.createElement('link');
    hint.rel = 'prefetch';
    hint.href = destination;
    doc.head.append(hint);
  }

  let brain: HTMLCanvasElement;
  try {
    brain = await tintedBrain(brainUrl, accent, 900);
  } catch {
    location.assign(destination);
    return;
  }
  const net = neurons(brain);

  const style = doc.createElement('style');
  style.textContent = CSS;
  doc.head.append(style);
  const overlay = doc.createElement('div');
  overlay.className = 'ent';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', content.status);
  const canvas = doc.createElement('canvas');
  const hud = doc.createElement('p');
  hud.className = 'ent__hud';
  const pin = doc.createElement('p');
  pin.className = 'ent__pin';
  pin.innerHTML = '<strong></strong><span></span>';
  const strong = pin.querySelector('strong');
  const coords = pin.querySelector('span');
  if (strong) strong.textContent = content.city;
  if (coords) coords.textContent = `${content.lat.toFixed(2)}° N · ${content.lon.toFixed(2)}° E`;
  const skip = doc.createElement('button');
  skip.type = 'button';
  skip.className = 'ent__skip';
  skip.textContent = content.skip;
  const sr = doc.createElement('p');
  sr.className = 'ent__sr';
  sr.setAttribute('role', 'status');
  sr.textContent = content.status;
  overlay.append(canvas, hud, pin, skip, sr);
  doc.body.append(overlay);
  skip.focus();

  const phone = innerWidth < 640;
  const dpr = phone ? 1 : Math.min(devicePixelRatio || 1, 1.5);
  const W = innerWidth;
  const H = innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    overlay.remove();
    location.assign(destination);
    return;
  }
  ctx.scale(dpr, dpr);
  const cells = landCells();
  const half = Math.min(W, H) / 2;
  const cx = W / 2;
  const cy = H / 2;
  const from0 = { x: from.left + from.width / 2, y: from.top + from.height / 2, side: from.width };

  // Texture for the ground the globe sits on, made once: a dot grid, a fine film grain, and a few faint orbit rings. All of it
  // is in the page's own ink at very low strength, so it reads as paper or graphite with a grain, not as decoration.
  const ground = document.createElement('canvas');
  ground.width = Math.round(W * dpr);
  ground.height = Math.round(H * dpr);
  {
    const g = ground.getContext('2d');
    if (g) {
      g.scale(dpr, dpr);
      g.fillStyle = ink;
      const step = phone ? 22 : 28;
      for (let gy = step / 2; gy < H; gy += step)
        for (let gx = step / 2; gx < W; gx += step) {
          const d = Math.hypot(gx - W / 2, gy - H / 2) / Math.hypot(W / 2, H / 2);
          g.globalAlpha = (day ? 0.26 : 0.24) * (1 - Math.min(1, d) * 0.7);
          g.fillRect(gx - 0.6, gy - 0.6, 1.2, 1.2);
        }
      // Orbit rings round the centre, very faint, with a tick at the cardinal points.
      g.strokeStyle = ink;
      g.lineWidth = 1;
      for (const k of [1.45, 1.9, 2.5]) {
        g.globalAlpha = day ? 0.16 : 0.15;
        g.beginPath();
        g.arc(W / 2, H / 2, half * k, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = day ? 0.4 : 0.35;
        g.beginPath();
        for (let q = 0; q < 4; q++) {
          const a = (q * Math.PI) / 2;
          g.moveTo(W / 2 + Math.cos(a) * half * k, H / 2 + Math.sin(a) * half * k);
          g.lineTo(W / 2 + Math.cos(a) * (half * k + 8), H / 2 + Math.sin(a) * (half * k + 8));
        }
        g.stroke();
      }
      // Grain.
      g.globalAlpha = 1;
      const n = Math.round((W * H) / 260);
      for (let i = 0; i < n; i++) {
        g.globalAlpha = 0.05 + (0.1 * ((i * 2654435761) % 997)) / 997;
        g.fillRect(
          ((i * 7919) % W) + ((i * 31) % 7) / 7,
          ((i * 104729) % H) + ((i * 17) % 5) / 5,
          1,
          1,
        );
      }
      // A vignette, so the edges fall away and the globe is lit from the middle.
      const v = g.createRadialGradient(
        W / 2,
        H / 2,
        half * 0.9,
        W / 2,
        H / 2,
        Math.hypot(W, H) / 2,
      );
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, day ? 'rgba(23,23,26,0.1)' : 'rgba(0,0,0,0.5)');
      g.globalAlpha = 1;
      g.fillStyle = v;
      g.fillRect(0, 0, W, H);
    }
  }

  const drawBrain = (f: Frame, ms: number): void => {
    if (f.brainAlpha <= 0) return;
    const side = lerp(from0.side, Math.min(W, H) * 0.92, f.brainTravel) * f.brainScale;
    const x = lerp(from0.x, cx, f.brainTravel);
    const y = lerp(from0.y, cy, f.brainTravel);
    ctx.save();
    ctx.globalAlpha = f.brainAlpha * 0.95;
    ctx.drawImage(brain, x - side / 2, y - side / 2, side, side);
    if (f.nodes > 0.01) {
      ctx.strokeStyle = accent;
      ctx.fillStyle = accent;
      ctx.lineWidth = Math.max(1, side / 520);
      ctx.globalAlpha = f.brainAlpha * f.nodes * 0.55;
      ctx.beginPath();
      for (const [a, b] of net.links) {
        const p = net.pts[a];
        const q = net.pts[b];
        if (!p || !q) continue;
        ctx.moveTo(x + (p[0] - 0.5) * side, y + (p[1] - 0.5) * side);
        ctx.lineTo(x + (q[0] - 0.5) * side, y + (q[1] - 0.5) * side);
      }
      ctx.stroke();
      net.pts.forEach((p, i) => {
        const pulse = 0.5 + 0.5 * Math.sin(ms * 0.012 + i * 1.7);
        ctx.globalAlpha = f.brainAlpha * f.nodes * (0.35 + 0.65 * pulse);
        ctx.beginPath();
        ctx.arc(
          x + (p[0] - 0.5) * side,
          y + (p[1] - 0.5) * side,
          Math.max(1.5, side / 190) * (0.7 + pulse),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      });
    }
    ctx.restore();
  };

  const drawGlobe = (f: Frame): void => {
    if (f.globeAlpha <= 0.01) return;
    const R = f.radius * half;
    ctx.save();
    ctx.globalAlpha = f.globeAlpha;
    // A soft glow behind the globe, its body and its edge, while the whole globe is in view.
    if (R < half * 3) {
      const glow = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.25);
      glow.addColorStop(0, accent);
      glow.addColorStop(1, 'transparent');
      ctx.globalAlpha = f.globeAlpha * (day ? 0.14 : 0.1);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      // The sphere itself: a faint tint of the ink inside the edge, so the Earth reads as a solid body, not loose dots.
      ctx.globalAlpha = f.globeAlpha * (day ? 0.09 : 0.03);
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = f.globeAlpha * (day ? 0.75 : 0.35);
      ctx.strokeStyle = day ? ink : accent;
      ctx.lineWidth = day ? 1.6 : 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Graticule: a line every 30°, drawn only where it faces us.
    if (R < half * 2.5) {
      ctx.globalAlpha = f.globeAlpha * (day ? 0.3 : 0.14);
      ctx.strokeStyle = ink;
      ctx.beginPath();
      const trace = (pts: LatLon[]): void => {
        let pen = false;
        for (const pt of pts) {
          const p = project(pt, f.centre);
          if (p.z <= 0) {
            pen = false;
            continue;
          }
          const px = cx + p.x * R;
          const py = cy - p.y * R;
          if (pen) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
          pen = true;
        }
      };
      for (let lon = -180; lon < 180; lon += 30) {
        const line: LatLon[] = [];
        for (let lat = -90; lat <= 90; lat += 5) line.push({ lat, lon });
        trace(line);
      }
      for (let lat = -60; lat <= 60; lat += 30) {
        const line: LatLon[] = [];
        for (let lon = -180; lon <= 180; lon += 5) line.push({ lat, lon });
        trace(line);
      }
      ctx.stroke();
    }
    // The land, as dots; nearer the edge they thin out and dim, as on a real sphere.
    ctx.fillStyle = ink;
    for (const cell of cells) {
      const p = project(cell, f.centre);
      if (p.z <= 0.02) continue;
      const px = cx + p.x * R;
      const py = cy - p.y * R;
      if (px < -40 || px > W + 40 || py < -40 || py > H + 40) continue;
      ctx.globalAlpha =
        f.globeAlpha * (day ? 0.55 + 0.45 * Math.sqrt(p.z) : 0.25 + 0.75 * Math.sqrt(p.z));
      const r = Math.max(0.8, R * (day ? 0.0118 : 0.0105) * (0.35 + 0.65 * p.z));
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const drawPin = (f: Frame): void => {
    if (f.pin <= 0) return;
    const r = 6 + 10 * f.pin;
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = f.pin;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // A ring that opens from the pin, and a leader line up to the label.
    const ping = (performance.now() % 1400) / 1400;
    ctx.globalAlpha = f.pin * (1 - ping) * 0.7;
    ctx.beginPath();
    ctx.arc(cx, cy, r + ping * 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = f.pin * 0.8;
    ctx.beginPath();
    ctx.moveTo(cx + r, cy);
    ctx.lineTo(cx + 26, cy);
    ctx.stroke();
    ctx.restore();
    pin.style.opacity = String(f.pin * (1 - f.fade));
  };

  const readout = (f: Frame): string => {
    if (f.stage === 'dive') return '';
    if (f.stage === 'lock') {
      const n = f.lock;
      return `${content.locking} · <b>${(content.lat * n).toFixed(2)}° N · ${(content.lon * n).toFixed(2)}° E</b>`;
    }
    if (f.stage === 'point')
      return `${content.locking} · <b>${content.lat.toFixed(2)}° N · ${content.lon.toFixed(2)}° E</b>`;
    return `<b>${content.status}</b>`;
  };

  let raf = 0;
  let left = false;
  const leave = (): void => {
    if (left) return;
    left = true;
    cancelAnimationFrame(raf);
    // The next page may still be on its way. Cover the wait with the site's loader (same page colour as the fade, so
    // nothing flashes) instead of leaving the last frame of the sequence on screen.
    mountLoader({ label: content.status, doc });
    try {
      sessionStorage.setItem(ARRIVE_KEY, '1');
    } catch {
      // Storage blocked: /workshop simply opens without the fade.
    }
    location.assign(destination);
  };
  // If the visitor comes back with the browser's back button, the page must not still be covered.
  addEventListener('pagehide', () => {
    overlay.remove();
    style.remove();
  });
  overlay.addEventListener('click', leave);
  skip.addEventListener('click', (e) => {
    e.stopPropagation();
    leave();
  });
  doc.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') leave();
  });

  const start = performance.now();
  const frame = (now: number): void => {
    const ms = now - start;
    const f = frameAt(ms, target);
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = f.wash;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // The textured ground comes in with the wash, and slowly turns with the globe's own drift.
    ctx.globalAlpha = f.wash * (1 - f.fade);
    ctx.drawImage(ground, 0, 0, W, H);
    ctx.globalAlpha = 1;
    drawBrain(f, ms);
    drawGlobe(f);
    drawPin(f);
    if (f.fade > 0) {
      ctx.globalAlpha = f.fade;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    hud.style.opacity = String(1 - f.fade);
    const text = readout(f);
    if (hud.dataset['t'] !== text) {
      hud.dataset['t'] = text;
      hud.innerHTML = text;
    }
    if (ms >= BEATS.total) leave();
    else raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}
