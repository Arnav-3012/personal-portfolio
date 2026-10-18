// HUD toasts (SPEC "Alerts and toasts"). The single entry point for alerts; markup lives in Toaster.astro.

export type ToastKind = 'ok' | 'warn' | 'error';

export interface ToastOptions {
  kind: ToastKind;
  message: string;
  /** Mono HUD label; defaults per kind. */
  label?: string;
}

export const TOAST_MS = 4000;
const MAX_VISIBLE = 3;
const LABELS: Record<ToastKind, string> = { ok: 'OK', warn: '!!', error: 'ERR' };

export function toast({ kind, message, label = LABELS[kind] }: ToastOptions): void {
  // Errors interrupt (role="alert"); everything else is polite.
  const region = document.querySelector<HTMLElement>(
    `[data-toast-region="${kind === 'error' ? 'assertive' : 'polite'}"]`,
  );
  const icon = document.querySelector<HTMLTemplateElement>(`template[data-toast-icon="${kind}"]`);
  const closeIcon = document.querySelector<HTMLTemplateElement>(
    'template[data-toast-icon="close"]',
  );
  if (!region) return;

  const item = document.createElement('div');
  item.className = 'toast';
  item.dataset['kind'] = kind;

  const tag = document.createElement('span');
  tag.className = 'toast__label';
  tag.textContent = `[ ${label} ]`;

  const text = document.createElement('p');
  text.className = 'toast__message';
  text.textContent = message;

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'toast__close';
  close.setAttribute('aria-label', 'Dismiss');
  if (closeIcon) close.append(closeIcon.content.cloneNode(true));

  if (icon) item.append(icon.content.cloneNode(true));
  item.append(tag, text, close);

  let remaining = TOAST_MS;
  let startedAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const dismiss = (): void => {
    clearTimeout(timer);
    item.remove();
  };
  const resume = (): void => {
    startedAt = Date.now();
    timer = setTimeout(dismiss, remaining);
  };
  const pause = (): void => {
    clearTimeout(timer);
    remaining -= Date.now() - startedAt;
  };

  close.addEventListener('click', dismiss);
  item.addEventListener('mouseenter', pause);
  item.addEventListener('mouseleave', resume);
  item.addEventListener('focusin', pause);
  item.addEventListener('focusout', resume);

  region.append(item);
  while (region.children.length > MAX_VISIBLE) region.firstElementChild?.remove();
  resume();
}
