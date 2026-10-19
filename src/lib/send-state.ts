// What the visitor sees while a form is being sent (Arnav, 2026-10-19: "the mail takes 2-3 s and the user only sees a
// Sending button"). A small panel opens under the button: a hairline with three stops, VERIFY, SEND and DELIVERED, and a
// packet of dots that travels it. The stops are real moments: the bot check (client side), the request in flight, and the
// answer. The packet advances with the check, then drifts towards DELIVERED while the request is out (it can only be
// estimated, so it slows as it nears and never claims arrival), and lands only when the answer comes. A mono readout
// names the stage and counts the seconds, and says what is being sent (how many words, from whom). It never delays the
// result: the confirmation appears at once and this panel finishes beside it. Reduced motion: no travelling, the stops
// simply light in turn. The styles are injected here, never in the render-blocking stylesheet.

export type SendStage = 'verify' | 'send' | 'done' | 'fail';

export interface SendInfo {
  name: string;
  /** Words in the message, shown as the packet's size. */
  words: number;
}

export interface SendState {
  stage(stage: SendStage): void;
}

/** The readout for each stage (also what a screen reader hears when the stage changes). */
export const READOUT: Record<SendStage, string> = {
  verify: "Checking you're human",
  send: 'Sending your message',
  done: 'Delivered',
  fail: "Couldn't send",
};

export const wordCount = (text: string): number =>
  text.trim() ? text.trim().split(/\s+/).length : 0;

/**
 * Where the packet is on the rail (0 to 1) `ms` after the stage began. Verifying creeps between the first stop and just
 * past it; sending drifts from the middle stop towards the end but flattens out at 0.94, so it can never arrive early.
 */
export function packetAt(stage: SendStage, ms: number): number {
  if (stage === 'verify') return 0.015 + 0.04 * (1 - Math.exp(-ms / 900));
  if (stage === 'send') return 0.5 + 0.44 * (1 - Math.exp(-ms / 1700));
  return stage === 'done' ? 1 : 0.5;
}

export const SEND_CSS = `.send{display:grid;grid-template-rows:0fr;margin-top:var(--space-3);transition:grid-template-rows 420ms var(--ease-out)}
.send.is-open{grid-template-rows:1fr}
.send__in{overflow:hidden;min-height:0}
.send__panel{display:grid;gap:var(--space-2);padding:var(--space-3) var(--space-3) var(--space-2);border:var(--border);border-radius:var(--radius-card);background:color-mix(in srgb,var(--surface) 70%,transparent);font:500 var(--type-hud)/1.3 var(--font-mono);letter-spacing:var(--track-hud);text-transform:uppercase}
.send__rail{position:relative;height:40px;margin:0 8px}
.send__line{position:absolute;left:0;right:0;top:11px;height:1px;background:var(--line)}
.send__fill{position:absolute;left:0;top:11px;width:100%;height:1px;background:var(--time);transform:scaleX(var(--x,0));transform-origin:left;box-shadow:0 0 8px color-mix(in srgb,var(--time) 60%,transparent)}
.send__stop{position:absolute;top:6px;display:grid;justify-items:center;gap:6px;transform:translateX(-50%);color:var(--text-2);font-size:10px;white-space:nowrap}
.send__stop::before{content:'';width:11px;height:11px;border:1px solid var(--text-2);border-radius:50%;background:var(--bg);transition:background 300ms var(--ease-out),border-color 300ms var(--ease-out),box-shadow 300ms var(--ease-out)}
.send__stop.is-on{color:var(--text)}
.send__stop.is-on::before{border-color:var(--time);background:var(--time);box-shadow:0 0 10px color-mix(in srgb,var(--time) 70%,transparent)}
.send__stop:nth-of-type(1){left:0;transform:none;justify-items:start}
.send__stop:nth-of-type(1)::before{margin-left:-1px}
.send__stop:nth-of-type(2){left:50%}
.send__stop:nth-of-type(3){left:100%;transform:translateX(-100%);justify-items:end}
.send__packet{position:absolute;top:5px;left:calc(var(--x,0) * 100%);width:22px;height:13px;margin-left:-11px;background:radial-gradient(circle 1.7px,var(--time) 96%,transparent) 0 0/5.5px 6.5px;filter:drop-shadow(0 0 5px color-mix(in srgb,var(--time) 70%,transparent))}
.send__packet::after{content:'';position:absolute;right:100%;top:0;width:34px;height:100%;background:radial-gradient(circle 1.3px,color-mix(in srgb,var(--time) 70%,transparent) 96%,transparent) 0 0/5.5px 6.5px;mask-image:linear-gradient(to left,black,transparent);-webkit-mask-image:linear-gradient(to left,black,transparent)}
.send.is-fail .send__fill{background:var(--action);box-shadow:none}
.send.is-fail .send__packet{filter:none;opacity:.5}
.send__read{display:flex;justify-content:space-between;gap:var(--space-3);color:var(--text)}
.send__read b{font-weight:500;color:var(--time)}
.send.is-fail .send__read b{color:var(--action)}
.send__meta{color:var(--text-2);font-size:10px}
:root[data-motion='reduced'] .send,:root[data-motion='reduced'] .send__stop::before{transition:none}`;

let injected = false;
const inject = (doc: Document): void => {
  if (injected) return;
  injected = true;
  const style = doc.createElement('style');
  style.textContent = SEND_CSS;
  doc.head.append(style);
};

export function startSend(form: HTMLFormElement, info: SendInfo): SendState | null {
  const doc = form.ownerDocument;
  const anchor = form.querySelector<HTMLElement>('[data-submit]');
  if (!anchor) return null;
  inject(doc);
  const reduced = doc.documentElement.dataset['motion'] === 'reduced';

  const root = doc.createElement('div');
  root.className = 'send';
  const inner = doc.createElement('div');
  inner.className = 'send__in';
  const panel = doc.createElement('div');
  panel.className = 'send__panel';
  const rail = doc.createElement('div');
  rail.className = 'send__rail';
  rail.setAttribute('aria-hidden', 'true');
  const line = doc.createElement('i');
  line.className = 'send__line';
  const fill = doc.createElement('i');
  fill.className = 'send__fill';
  const stops = ['Verify', 'Send', 'Delivered'].map((label) => {
    const stop = doc.createElement('span');
    stop.className = 'send__stop';
    stop.textContent = label;
    return stop;
  });
  const packet = doc.createElement('i');
  packet.className = 'send__packet';
  rail.append(line, fill, ...stops, packet);
  const read = doc.createElement('p');
  read.className = 'send__read';
  read.setAttribute('role', 'status');
  const label = doc.createElement('b');
  const time = doc.createElement('span');
  time.setAttribute('aria-hidden', 'true');
  read.append(label, time);
  const meta = doc.createElement('p');
  meta.className = 'send__meta';
  meta.setAttribute('aria-hidden', 'true');
  const who = info.name.trim().toUpperCase().slice(0, 22);
  meta.textContent = `Packet · ${info.words} ${info.words === 1 ? 'word' : 'words'}${who ? ` · from ${who}` : ''}`;
  panel.append(rail, read, meta);
  inner.append(panel);
  root.append(inner);
  anchor.after(root);
  requestAnimationFrame(() => root.classList.add('is-open'));

  const t0 = performance.now();
  let current: SendStage = 'verify';
  let since = t0;
  let x = packetAt('verify', 0);
  let target = x;
  let raf = 0;
  let closed = false;
  const paint = (): void => {
    root.style.setProperty('--x', x.toFixed(4));
    time.textContent = `${((performance.now() - t0) / 1000).toFixed(1)}s`;
  };
  const tick = (): void => {
    const now = performance.now();
    target = packetAt(current, now - since);
    // Ease towards the target so the packet glides, and lands smoothly when the answer arrives.
    x += (target - x) * (current === 'done' ? 0.18 : 0.1);
    paint();
    if (!closed) raf = requestAnimationFrame(tick);
  };
  const close = (after: number): void => {
    setTimeout(() => {
      closed = true;
      cancelAnimationFrame(raf);
      root.classList.remove('is-open');
      setTimeout(() => root.remove(), 480);
    }, after);
  };
  const set = (stage: SendStage): void => {
    current = stage;
    since = performance.now();
    label.textContent = READOUT[stage];
    stops[0]?.classList.add('is-on');
    stops[1]?.classList.toggle('is-on', stage !== 'verify');
    stops[2]?.classList.toggle('is-on', stage === 'done');
    root.classList.toggle('is-fail', stage === 'fail');
    if (reduced) {
      x = stage === 'done' ? 1 : stage === 'verify' ? 0.02 : 0.5;
      paint();
    }
    if (stage === 'done') close(1800);
    if (stage === 'fail') close(2600);
  };
  set('verify');
  paint();
  if (!reduced) raf = requestAnimationFrame(tick);
  else {
    // No travelling: just the readout and the seconds.
    const clock = setInterval(() => {
      if (closed) return clearInterval(clock);
      time.textContent = `${((performance.now() - t0) / 1000).toFixed(1)}s`;
    }, 200);
  }
  return {
    stage(stage) {
      if (closed) return;
      set(stage);
    },
  };
}
