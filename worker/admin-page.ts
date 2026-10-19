// The /admin page: one static shell plus a script that loads /admin/api/state and renders it. Every visitor-supplied
// string (names, emails, messages) is written with textContent, never innerHTML, so a hostile form submission
// cannot run script in Arnav's browser. Colours are system colours, so it follows the OS light/dark setting.
export function adminHtml(nonce: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Admin</title>
<style>
  :root { color-scheme: light dark; font: 16px/1.5 system-ui, sans-serif; }
  body { margin: 0; padding: 24px 16px 64px; background: Canvas; color: CanvasText; }
  main { max-width: 860px; margin: 0 auto; display: grid; gap: 32px; }
  h1, h2 { margin: 0; line-height: 1.2; }
  h2 { font-size: 1.1rem; }
  section { display: grid; gap: 12px; padding: 16px; border: 1px solid GrayText; border-radius: 12px; }
  label { display: grid; gap: 4px; align-content: end; font-weight: 600; }
  #inbox { display: grid; gap: 12px; }
  input, select, textarea, button { font: inherit; padding: 8px 12px; border-radius: 6px; border: 1px solid GrayText; background: Field; color: FieldText; min-height: 44px; }
  button { cursor: pointer; font-weight: 600; }
  button:focus-visible, input:focus-visible, select:focus-visible, a:focus-visible, summary:focus-visible { outline: 2px solid Highlight; outline-offset: 2px; }
  .row { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; }
  .muted { color: color-mix(in srgb, CanvasText 72%, Canvas); font-size: 0.9rem; margin: 0; }
  .msg { padding: 12px; border: 1px solid GrayText; border-radius: 8px; display: grid; gap: 8px; }
  .msg[data-handled="true"] { opacity: 0.65; }
  .msg header { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: baseline; }
  .tag { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; padding: 0 8px; border: 1px solid GrayText; border-radius: 999px; }
  .warn { color: LinkText; font-weight: 600; }
  pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; }
  #status { min-height: 1.5em; }
</style>
</head>
<body>
<main>
  <h1>Admin</h1>
  <p id="status" class="muted" role="status"></p>

  <section aria-labelledby="free-h">
    <h2 id="free-h">Open to freelance</h2>
    <p class="muted">Takes effect on the site within a minute. Closing hides the form. To <em>reopen</em> after a deploy that was built as booked, set <code>open</code> in content/freelance.json and redeploy.</p>
    <div class="row">
      <label>Status
        <select id="free-open"><option value="true">Open</option><option value="false">Booked</option></select>
      </label>
      <label>Note when booked (optional)
        <input id="free-note" maxlength="120" size="36">
      </label>
      <button id="free-save" type="button">Save</button>
      <button id="free-reset" type="button">Use site default</button>
    </div>
    <p class="muted" id="free-now"></p>
  </section>

  <section aria-labelledby="build-h">
    <h2 id="build-h">Currently building</h2>
    <div class="row">
      <label>Project
        <select id="build-id"></select>
      </label>
      <button id="build-save" type="button">Save</button>
      <button id="build-reset" type="button">Use site default</button>
    </div>
    <p class="muted" id="build-now"></p>
  </section>

  <section aria-labelledby="inbox-h">
    <h2 id="inbox-h">Inbox</h2>
    <div class="row">
      <label>Show
        <select id="inbox-filter"><option value="open">Not handled</option><option value="all">All</option></select>
      </label>
      <p class="muted" id="inbox-count"></p>
    </div>
    <div id="inbox" aria-live="polite"></div>
    <button id="more" type="button" hidden>Load more</button>
  </section>
</main>
<script nonce="${nonce}">
(() => {
  const $ = (id) => document.getElementById(id);
  const status = (text) => { $('status').textContent = text; };
  const api = async (path, body) => {
    const res = await fetch('/admin/api/' + path, body === undefined ? {} : {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(path + ' ' + res.status);
    return res.json();
  };
  const el = (tag, props, ...kids) => {
    const n = document.createElement(tag);
    Object.assign(n, props || {});
    n.append(...kids);
    return n;
  };
  let lastId = null;

  function describe(state) {
    const f = state.freelance.override;
    $('free-open').value = String((f || state.freelance.default).open);
    $('free-note').value = (f && f.note) || '';
    $('free-now').textContent = f
      ? 'Override on: ' + (f.open ? 'open' : 'booked' + (f.note ? ' (' + f.note + ')' : ''))
      : 'No override. The site shows its built default (' + (state.freelance.default.open ? 'open' : 'booked') + ').';
    const select = $('build-id');
    select.replaceChildren(...state.projects.map((p) => el('option', { value: p.id, textContent: p.name })));
    select.value = state.building.override || state.building.default;
    $('build-now').textContent = state.building.override
      ? 'Override on: ' + select.selectedOptions[0].textContent
      : 'No override. The site shows its built default.';
  }

  function render(rows, append) {
    const box = $('inbox');
    if (!append) box.replaceChildren();
    if (!rows.length && !append) box.append(el('p', { className: 'muted', textContent: 'Nothing here.' }));
    for (const m of rows) {
      const handled = m.handled === 1;
      const handle = el('button', { type: 'button', textContent: handled ? 'Reopen' : 'Mark handled' });
      handle.addEventListener('click', async () => {
        try { await api('inbox/' + m.id, { handled: !handled }); await load(false); status('Saved.'); }
        catch { status('Could not save. Try again.'); }
      });
      const head = el('header', {},
        el('span', { className: 'tag', textContent: m.kind }),
        el('strong', { textContent: m.name }),
        el('a', { href: 'mailto:' + m.email, textContent: m.email }),
        el('time', { className: 'muted', dateTime: m.created_at, textContent: new Date(m.created_at).toLocaleString() }),
      );
      if (m.emailed === 0) head.append(el('span', { className: 'warn', textContent: 'Email did not send' }));
      const extra = Object.entries(m.fields).filter(([k, v]) => !['message', 'name', 'email'].includes(k) && v)
        .map(([k, v]) => k + ': ' + v).join(' · ');
      const art = el('article', { className: 'msg' }, head);
      if (extra) art.append(el('p', { className: 'muted', textContent: extra }));
      art.append(el('pre', { textContent: m.fields.message || '' }), el('div', {}, handle));
      art.dataset.handled = String(handled);
      box.append(art);
    }
  }

  async function load(append) {
    const filter = $('inbox-filter').value;
    const before = append ? lastId : null;
    const data = await api('inbox?filter=' + filter + (before ? '&before=' + before : ''));
    render(data.rows, append);
    lastId = data.rows.length ? data.rows[data.rows.length - 1].id : lastId;
    $('more').hidden = !data.more;
    $('inbox-count').textContent = data.open + ' not handled · ' + data.total + ' total';
  }

  async function init() {
    try {
      describe(await api('state'));
      await load(false);
      status('');
    } catch { status('Could not load. Reload the page.'); }
  }
  const save = (path, body) => async () => {
    try { await api(path, body()); describe(await api('state')); status('Saved. Visible on the site within a minute.'); }
    catch { status('Could not save. Check the values and try again.'); }
  };
  $('free-save').addEventListener('click', save('freelance', () => ({ open: $('free-open').value === 'true', note: $('free-note').value })));
  $('free-reset').addEventListener('click', save('freelance', () => ({ reset: true })));
  $('build-save').addEventListener('click', save('building', () => ({ id: $('build-id').value })));
  $('build-reset').addEventListener('click', save('building', () => ({ reset: true })));
  $('inbox-filter').addEventListener('change', () => { lastId = null; load(false).catch(() => status('Could not load.')); });
  $('more').addEventListener('click', () => load(true).catch(() => status('Could not load.')));
  init();
})();
</script>
</body>
</html>`;
}
