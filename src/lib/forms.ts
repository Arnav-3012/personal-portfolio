// Contact and freelance forms (SPEC "Open to freelance", row 11). Client side: validate with the same rules the
// Worker enforces (form-rules.ts), get a Turnstile token, POST JSON to `/api/forms/<kind>`, and report honestly
// when it can't be reached.
import { FORM_KINDS, validate, type FormKind } from './form-rules';
import { createTurnstile } from './turnstile';
import { toast } from './toast';

export type SubmitResult =
  | { ok: true }
  | { ok: false; reason: 'unavailable' | 'limited' | 'rejected' | 'verification' | 'network' };

/**
 * Posts the form (the Turnstile token travels in `values.turnstile`). 403 is the bot check refusing,
 * 429 the rate limit, a 404 or 5xx "unavailable"; a throw is "network".
 */
export async function submitForm(
  kind: FormKind,
  values: Readonly<Record<string, string>>,
  fetchImpl: typeof fetch = fetch,
): Promise<SubmitResult> {
  let res: Response;
  try {
    res = await fetchImpl(`/api/forms/${kind}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (res.ok) return { ok: true };
  if (res.status === 403) return { ok: false, reason: 'verification' };
  if (res.status === 429) return { ok: false, reason: 'limited' };
  if (res.status === 404 || res.status >= 500) return { ok: false, reason: 'unavailable' };
  return { ok: false, reason: 'rejected' };
}

/** The toast text for a failed send; always offers the direct email so the visitor is never stuck. */
export function failureMessage(
  reason: Extract<SubmitResult, { ok: false }>['reason'],
  address: string,
): string {
  const fallback = `Email me at ${address} instead.`;
  switch (reason) {
    case 'limited':
      return `Too many messages from this connection. Try again later, or email ${address}.`;
    case 'rejected':
      return `That didn't go through. Check the fields, or email ${address}.`;
    case 'verification':
      return `The bot check didn't pass. Reload the page and try again, or email ${address}.`;
    case 'network':
      return `You look offline. ${fallback}`;
    case 'unavailable':
      return `Couldn't send that. ${fallback}`;
  }
}

const KINDS = new Set<string>(FORM_KINDS);

function showErrors(form: HTMLFormElement, errors: Readonly<Record<string, string>>): void {
  for (const control of form.querySelectorAll<HTMLElement>('[name]')) {
    const field = control.getAttribute('name') ?? '';
    const slot = form.querySelector<HTMLElement>(`[data-error-for="${field}"]`);
    if (!slot) continue;
    const message = errors[field];
    slot.textContent = message ?? '';
    slot.hidden = !message;
    if (message) control.setAttribute('aria-invalid', 'true');
    else control.removeAttribute('aria-invalid');
  }
}

export function initForms(doc: Document = document, fetchImpl: typeof fetch = fetch): void {
  for (const form of doc.querySelectorAll<HTMLFormElement>('form[data-form]')) {
    const kind = form.dataset['form'] ?? '';
    if (!KINDS.has(kind)) continue;
    const button = form.querySelector<HTMLButtonElement>('[data-submit]');
    const done = form.querySelector<HTMLElement>('[data-done]');
    const slot = form.querySelector<HTMLElement>('[data-turnstile]');
    const siteKey = form.dataset['turnstileKey'];
    const idle = button?.textContent ?? 'Send';
    // The Cloudflare script is fetched when the visitor first touches the form, never with the page.
    const challenge = slot && siteKey ? createTurnstile(slot, siteKey) : null;
    if (challenge) form.addEventListener('focusin', challenge.start, { once: true });

    const finish = (result: SubmitResult): void => {
      if (button) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = idle;
      }
      challenge?.reset();
      if (result.ok) {
        form.reset();
        const confirmation = form.dataset['confirmation'] ?? 'Sent.';
        if (done) {
          done.textContent = confirmation;
          done.hidden = false;
        }
        toast({ kind: 'ok', message: confirmation });
      } else {
        if (done) done.hidden = true;
        toast({
          kind: 'error',
          message: failureMessage(result.reason, form.dataset['email'] ?? ''),
        });
      }
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (button?.disabled) return;
      const values = Object.fromEntries(
        [...new FormData(form).entries()].filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      );
      const errors = validate(kind as FormKind, values);
      showErrors(form, errors);
      const first = Object.keys(errors)[0];
      if (first) {
        form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
        return;
      }
      if (button) {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        button.textContent = 'Sending…';
      }
      void (async () => {
        const token = challenge ? await challenge.token() : null;
        if (challenge && !token) return finish({ ok: false, reason: 'verification' });
        finish(
          await submitForm(
            kind as FormKind,
            token ? { ...values, turnstile: token } : values,
            fetchImpl,
          ),
        );
      })();
    });
  }
}
