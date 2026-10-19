// The EDITH launcher's presence mark: a small sphere of dots that turns slowly, looks towards the pointer when it comes near,
// spins up on hover and sends out a ripple now and then. It is drawn on a 34 px canvas with about seventy dots lit by depth
// (near dots large and bright, far dots small and dim), in the hologram colour. It stops while the launcher is out of view or
// the panel is open, and with reduced motion it is one still frame.

export interface Pt {
  x: number;
  y: number;
  z: number;
}

/** `n` points spread evenly over a unit sphere (a Fibonacci spiral). */
export function fibonacciSphere(n: number): Pt[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const a = i * golden;
    return { x: Math.cos(a) * r, y, z: Math.sin(a) * r };
  });
}

/** A point turned by `yaw` about the vertical axis, then `pitch` about the horizontal one. */
export function turn(p: Pt, yaw: number, pitch: number): Pt {
  const x1 = p.x * Math.cos(yaw) + p.z * Math.sin(yaw);
  const z1 = -p.x * Math.sin(yaw) + p.z * Math.cos(yaw);
  const y2 = p.y * Math.cos(pitch) - z1 * Math.sin(pitch);
  const z2 = p.y * Math.sin(pitch) + z1 * Math.cos(pitch);
  return { x: x1, y: y2, z: z2 };
}

/** How far the pointer is "looking": its offset from the orb, in the −1 … 1 range, falling to 0 beyond `reach` px. */
export function lookAt(dx: number, dy: number, reach = 320): { x: number; y: number } {
  const d = Math.hypot(dx, dy);
  if (d > reach * 2) return { x: 0, y: 0 };
  const k = Math.min(1, d / reach);
  const f = d === 0 ? 0 : k / d;
  return { x: dx * f, y: dy * f };
}

export interface Orb {
  hover(on: boolean): void;
  ping(): void;
  stop(): void;
}

export function startOrb(canvas: HTMLCanvasElement, host: HTMLElement, reduced: boolean): Orb {
  const size = 34;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = canvas.height = Math.round(size * dpr);
  const ctx = canvas.getContext('2d');
  const pts = fibonacciSphere(72);
  let hovered = false;
  let yaw = 0.6;
  let lx = 0;
  let ly = 0;
  let tx = 0;
  let ty = 0;
  let ripple = -1;
  let raf = 0;
  let last = performance.now();
  let colour = '';
  let hot = '';
  const read = (): void => {
    const cs = getComputedStyle(document.documentElement);
    colour = cs.getPropertyValue('--holo').trim() || 'cyan';
    hot = cs.getPropertyValue('--text').trim() || 'white';
  };
  read();
  const watch = new MutationObserver(() => {
    read();
    draw(performance.now());
  });
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const move = (e: PointerEvent): void => {
    const r = canvas.getBoundingClientRect();
    const look = lookAt(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    tx = look.x;
    ty = look.y;
  };

  function draw(now: number): void {
    if (!ctx) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!reduced) {
      yaw += dt * (0.32 + (hovered ? 1.5 : 0));
      lx += (tx - lx) * Math.min(1, dt * 5);
      ly += (ty - ly) * Math.min(1, dt * 5);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const c = size / 2;
    const R = size * 0.34;
    const turned = pts
      .map((p) => turn(p, yaw + lx * 0.9, 0.38 + ly * 0.5))
      .sort((a, b) => a.z - b.z);
    for (const p of turned) {
      const depth = (p.z + 1) / 2;
      const front = depth > 0.82;
      ctx.globalAlpha = 0.16 + 0.84 * depth ** 1.6;
      ctx.fillStyle = front ? hot : colour;
      ctx.beginPath();
      ctx.arc(c + p.x * R, c + p.y * R, 0.45 + 1.05 * depth, 0, Math.PI * 2);
      ctx.fill();
    }
    if (ripple >= 0) {
      const k = (now - ripple) / 900;
      if (k >= 1) ripple = -1;
      else {
        ctx.globalAlpha = (1 - k) * 0.7;
        ctx.strokeStyle = colour;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(c, c, R * (1 + 0.5 * k), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
  const loop = (now: number): void => {
    // Idle while it cannot be seen: out of view (the hero is on screen), the panel is open, or the tab is hidden.
    const quiet =
      document.hidden ||
      host.classList.contains('is-away') ||
      host.getAttribute('aria-expanded') === 'true';
    if (quiet) last = now;
    else draw(now);
    raf = requestAnimationFrame(loop);
  };
  draw(performance.now());
  if (!reduced) {
    document.addEventListener('pointermove', move, { passive: true });
    raf = requestAnimationFrame(loop);
  }
  return {
    hover(on) {
      hovered = on;
    },
    ping() {
      ripple = performance.now();
      if (reduced) draw(ripple);
    },
    stop() {
      cancelAnimationFrame(raf);
      document.removeEventListener('pointermove', move);
      watch.disconnect();
    },
  };
}
