// Applies the live overrides from /admin (SPEC "Content model", Live values). The page is static, so the freelance switch and
// "currently building" are patched in after load, and only when an override differs from what was built: in the
// normal case nothing changes and nothing moves. An override can close freelance work on a page built open; to
// reopen after a build as booked, the form has to exist, so that needs `open` in freelance.json and a deploy.

export interface Live {
  freelance: { open: boolean; label: string; note: string | null } | null;
  building: { id: string; name: string } | null;
}

/** Replaces everything after the status dot with the label and, when set, a note in a span of `noteClass`. */
function setStatus(
  host: Element,
  label: string,
  note: string | null,
  noteClass: string | null,
): void {
  const dot = host.firstElementChild;
  while (dot?.nextSibling) dot.nextSibling.remove();
  host.append(` ${label}`);
  if (note) {
    const span = document.createElement('span');
    if (noteClass) span.className = noteClass;
    span.textContent = ` · ${note}`;
    host.append(span);
  }
}

export function applyLive(live: Live, doc: Document = document): void {
  const free = doc.querySelector<HTMLElement>('#freelance.free');
  const builtOpen = free?.dataset['open'] === 'true';
  const f = live.freelance;
  if (f && free && (builtOpen || !f.open)) {
    const state = String(f.open);
    for (const pill of doc.querySelectorAll<HTMLElement>('.status-pill')) {
      pill.dataset['open'] = state;
      const text = pill.lastElementChild;
      if (!text) continue;
      text.textContent = f.label;
      if (f.note) {
        const span = doc.createElement('span');
        span.className = 'status-pill__note';
        span.textContent = ` · ${f.note}`;
        text.append(span);
      }
    }
    free.dataset['open'] = state;
    const status = free.querySelector('.free__status');
    if (status) setStatus(status, f.label, f.note, 'free__note');
    const title = free.querySelector('#freelance-title');
    if (title) title.textContent = f.open ? 'Start a project' : f.label;
    if (!f.open) free.querySelector('form[data-form="freelance"]')?.remove();

    const foot = doc.querySelector<HTMLElement>('.foot__status');
    if (foot) {
      foot.dataset['open'] = state;
      setStatus(foot, f.label, f.note, null);
    }
    const big = doc.querySelector<HTMLAnchorElement>('.foot__big');
    const mail = doc.querySelector<HTMLAnchorElement>('.foot__mail');
    if (big && mail) {
      big.href = f.open ? '#freelance' : mail.href;
      const label = [...big.childNodes].find((n) => n.nodeType === Node.TEXT_NODE);
      if (label) label.textContent = f.open ? 'Start a project' : 'Say hello';
    }
  }

  if (live.building) {
    const key = [...doc.querySelectorAll('.chip__key')].find((k) => k.textContent === 'Building');
    const chip = key?.parentElement;
    if (key && chip) {
      while (key.nextSibling) key.nextSibling.remove();
      chip.append(` ${live.building.name}`);
    }
  }
}
