// The EDITH chat panel (loaded on demand by edith.ts). A non-modal dialog on desktop, so the page can scroll
// behind it when EDITH acts; a modal sheet on phones. Answers stream into an aria-live log.
// ?inline keeps the panel CSS out of the landing HTML (Astro would inline a plain import into the page).
import panelCss from '../styles/edith.css?inline';
import {
  FAILURE_TEXT,
  actionFor,
  ask,
  type ChatFailure,
  type PageAction,
  type ReplyMeta,
  type ToolCall,
  type Turn,
} from './edith-core';
import { iconSvg } from './icons';

// Lucide "send" (ISC), only used here.
const SEND =
  '<svg class="icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>';
import { toast } from './toast';
import { createTurnstile, type Challenge } from './turnstile';

interface Config {
  chips: string[];
  placeholder: string;
  intro: string;
  turnstileSiteKey: string;
}

const SESSION_KEY = 'edith-session';
const TOOL_LABEL: Record<ToolCall['name'], string> = {
  scrollTo: 'Scrolled the page',
  openProject: 'Took you to the project',
  openResume: 'Opened the resume',
  enterWorkshop: 'Opening the workshop',
  startFreelanceForm: 'Opened the freelance form',
};

let config: Promise<Config | null> | undefined;
const loadConfig = (): Promise<Config | null> =>
  (config ??= fetch('/edith.json')
    .then((r) => (r.ok ? (r.json() as Promise<Config>) : null))
    .catch(() => null));

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function readSession(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}
function writeSession(value: string | null): void {
  try {
    if (value) sessionStorage.setItem(SESSION_KEY, value);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage blocked: the bot check simply runs again next time.
  }
}

let dialog: HTMLDialogElement | undefined;
let returnTo: HTMLElement | undefined;

export async function openEdith(launcher: HTMLElement): Promise<void> {
  returnTo = launcher;
  if (!dialog) {
    const cfg = await loadConfig();
    if (!cfg) {
      toast({
        kind: 'error',
        message: "EDITH can't load right now. Use the contact form instead.",
      });
      return;
    }
    dialog = build(cfg);
  }
  const phone = matchMedia('(max-width: 640px)').matches;
  if (dialog.open) dialog.close();
  if (phone) dialog.showModal();
  else dialog.show();
  launcher.setAttribute('aria-expanded', 'true');
  dialog.querySelector<HTMLInputElement>('.edith__input')?.focus();
}

function build(cfg: Config): HTMLDialogElement {
  const style = el('style');
  style.textContent = panelCss;
  document.head.append(style);

  const root = el('dialog', 'edith');
  root.setAttribute('aria-labelledby', 'edith-title');
  root.setAttribute('aria-modal', 'false');

  const head = el('div', 'edith__head');
  const title = el('p', 'hud edith__title', 'EDITH');
  title.id = 'edith-title';
  const status = el('span', 'hud edith__status', 'online');
  const close = el('button', 'icon-button edith__close');
  close.type = 'button';
  close.innerHTML = `${iconSvg('x')}<span class="visually-hidden">Close EDITH</span>`;
  head.append(title, status, close);

  const log = el('div', 'edith__log');
  log.setAttribute('role', 'log');
  log.setAttribute('aria-live', 'polite');
  log.setAttribute('aria-label', 'Conversation with EDITH');
  log.tabIndex = 0;

  const chips = el('ul', 'edith__chips');
  chips.setAttribute('aria-label', 'Starter questions');
  for (const text of cfg.chips) {
    const li = el('li');
    const b = el('button', 'edith__chip', text);
    b.type = 'button';
    b.addEventListener('click', () => void send(text));
    li.append(b);
    chips.append(li);
  }

  const form = el('form', 'edith__form');
  form.noValidate = true;
  const label = el('label', 'visually-hidden', 'Ask EDITH');
  label.htmlFor = 'edith-input';
  const input = el('input', 'field__control edith__input');
  input.id = 'edith-input';
  input.type = 'text';
  input.maxLength = 500;
  input.autocomplete = 'off';
  input.placeholder = cfg.placeholder;
  const sendButton = el('button', 'button edith__send');
  sendButton.type = 'submit';
  sendButton.innerHTML = `${SEND}<span class="visually-hidden">Send</span>`;
  const slot = el('div');
  slot.dataset['turnstile'] = '';
  form.append(label, input, sendButton);

  root.append(head, log, chips, form, slot);
  document.body.append(root);

  const challenge: Challenge = createTurnstile(slot, cfg.turnstileSiteKey);
  input.addEventListener('focus', () => challenge.start(), { once: true });

  const history: Turn[] = [];
  let session = readSession();
  let busy = false;

  const bubble = (who: 'user' | 'bot', text: string): HTMLElement => {
    const wrap = el('div', `edith__msg edith__msg--${who}`);
    wrap.append(el('p', 'edith__text', text));
    log.append(wrap);
    log.scrollTop = log.scrollHeight;
    return wrap;
  };

  bubble('bot', cfg.intro);

  const closePanel = (): void => {
    root.close();
    launcherState(false);
    returnTo?.focus();
  };
  const launcherState = (open: boolean): void =>
    returnTo?.setAttribute('aria-expanded', String(open));
  close.addEventListener('click', closePanel);
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePanel();
    }
  });
  root.addEventListener('close', () => launcherState(false));

  const fail = (reason: ChatFailure, wrap: HTMLElement): void => {
    wrap.classList.remove('is-thinking');
    const text = wrap.querySelector('.edith__text');
    if (text) text.textContent = FAILURE_TEXT[reason];
    status.textContent = 'offline';
    if (reason === 'verification') challenge.reset();
    toast({
      kind: reason === 'limited' ? 'warn' : 'error',
      message: FAILURE_TEXT[reason],
    });
  };

  function perform(call: ToolCall): string | null {
    const action: PageAction | null = actionFor(call, (id) => document.getElementById(id) !== null);
    if (!action) return null;
    const reduced = document.documentElement.dataset['motion'] === 'reduced';
    // On a phone the sheet would hide the result, so it closes; the toast says how to get back to the chat.
    const phone = matchMedia('(max-width: 640px)').matches;
    if (phone) closePanel();
    if (action.kind === 'click') {
      const target = document.querySelector<HTMLElement>(action.target);
      if (!target) {
        toast({ kind: 'warn', message: action.missing });
        return null;
      }
      target.click();
      if (phone)
        toast({ kind: 'ok', message: `${TOOL_LABEL[call.name]}. Tap Ask EDITH to keep chatting.` });
      return TOOL_LABEL[call.name];
    }
    const target = document.getElementById(action.target);
    if (!target) return null;
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    if (action.kind === 'form')
      target.querySelector<HTMLElement>('input, textarea, select')?.focus({ preventScroll: true });
    else {
      if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
    if (phone)
      toast({ kind: 'ok', message: `${TOOL_LABEL[call.name]}. Tap Ask EDITH to keep chatting.` });
    return TOOL_LABEL[call.name];
  }

  function finish(wrap: HTMLElement, meta: ReplyMeta): void {
    wrap.classList.remove('is-thinking');
    const text = wrap.querySelector('.edith__text');
    if (text) text.textContent = meta.spoken;
    if (meta.sources.length) {
      const list = el('ul', 'edith__sources');
      list.setAttribute('aria-label', 'Sources');
      for (const s of meta.sources) {
        const li = el('li', 'hud edith__source');
        if (s.url) {
          const a = el('a', undefined, s.label);
          a.href = s.url;
          a.target = '_blank';
          a.rel = 'noopener';
          li.append(a);
        } else li.textContent = s.label;
        list.append(li);
      }
      wrap.append(list);
    }
    for (const call of meta.tools) {
      const done = perform(call);
      if (done) wrap.append(el('p', 'hud edith__action', done));
    }
    if (meta.session) {
      session = meta.session;
      writeSession(session);
    }
    if (meta.resting) {
      status.textContent = 'resting';
      toast({ kind: 'warn', message: 'EDITH is resting for today. Use the contact form.' });
    } else status.textContent = 'online';
    history.push({ role: 'assistant', text: meta.spoken });
    log.scrollTop = log.scrollHeight;
  }

  async function send(raw: string): Promise<void> {
    const message = raw.trim();
    if (!message || busy) return;
    busy = true;
    sendButton.disabled = true;
    input.disabled = true;
    chips.hidden = true;
    bubble('user', message);
    const wrap = bubble('bot', 'thinking…');
    wrap.classList.add('is-thinking');
    status.textContent = 'thinking';
    const result = await ask({
      message,
      history: history.slice(-8),
      session,
      turnstile: () => challenge.token(),
    });
    history.push({ role: 'user', text: message });
    if (!result.ok) {
      if (result.reason === 'network') input.value = message;
      fail(result.reason, wrap);
    } else {
      const text = wrap.querySelector('.edith__text');
      let streamed = '';
      let ended = false;
      try {
        for await (const event of result.events) {
          if (event.type === 'token') {
            streamed += event.text;
            wrap.classList.remove('is-thinking');
            status.textContent = 'answering';
            if (text) text.textContent = streamed;
            log.scrollTop = log.scrollHeight;
          } else if (event.type === 'meta') {
            finish(wrap, event.meta);
            ended = true;
          } else fail('unavailable', wrap);
        }
        if (!ended && !streamed) fail('unavailable', wrap);
      } catch {
        fail('network', wrap);
      }
      // A used token is single-use; the session now covers further questions.
      if (!session) challenge.reset();
    }
    busy = false;
    sendButton.disabled = false;
    input.disabled = false;
    // Hand focus back to the box only if nothing else took it (a tool call may have moved it to a form).
    const active = document.activeElement;
    if (!input.value && (active === document.body || root.contains(active))) input.focus();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input.value;
    input.value = '';
    void send(value);
  });
  return root;
}
