// Contact and freelance forms (SPEC "Open to freelance", row 11). Client side only: validate, POST JSON to
// `/api/forms/<kind>` (task 1.6 builds that endpoint, with Turnstile, D1 and email), and report honestly when it
// can't be reached. Limits here mirror what the Worker will enforce.
import { toast } from './toast';

export type FormKind = 'contact' | 'freelance';

interface Rule {
  label: string;
  required: boolean;
  min?: number;
  max: number;
  email?: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const name: Rule = { label: 'Name', required: true, max: 80 };
const email: Rule = { label: 'Email', required: true, max: 120, email: true };

export const RULES: Record<FormKind, Record<string, Rule>> = {
  contact: {
    name,
    email,
    message: { label: 'Message', required: true, min: 10, max: 2000 },
  },
  freelance: {
    name,
    email,
    company: { label: 'Company', required: false, max: 80 },
    service: { label: 'Service', required: true, max: 40 },
    timeline: { label: 'Timeline', required: true, max: 40 },
    message: { label: 'Project description', required: true, min: 20, max: 2000 },
  },
};

/** Field name → message for each broken rule; empty when the form is fine. */
export function validate(kind: FormKind, values: Readonly<Record<string, string>>) {
  const errors: Record<string, string> = {};
  for (const [field, rule] of Object.entries(RULES[kind])) {
    const value = (values[field] ?? '').trim();
    if (!value) {
      if (rule.required) errors[field] = `${rule.label} is required.`;
    } else if (value.length > rule.max) {
      errors[field] = `${rule.label} must be ${rule.max} characters or fewer.`;
    } else if (rule.min && value.length < rule.min) {
      errors[field] = `${rule.label} needs at least ${rule.min} characters.`;
    } else if (rule.email && !EMAIL.test(value)) {
      errors[field] = 'Enter a valid email address.';
    }
  }
  return errors;
}

export type SubmitResult =
  { ok: true } | { ok: false; reason: 'unavailable' | 'limited' | 'rejected' | 'network' };

/** Posts the form. A 404 or 5xx is "unavailable" (the endpoint isn't there yet or is down); a throw is "network". */
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
    case 'network':
      return `You look offline. ${fallback}`;
    case 'unavailable':
      return `Couldn't send that. ${fallback}`;
  }
}

const KINDS = new Set<string>(Object.keys(RULES));

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
    const idle = button?.textContent ?? 'Send';

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
      void submitForm(kind as FormKind, values, fetchImpl).then((result) => {
        if (button) {
          button.disabled = false;
          button.removeAttribute('aria-busy');
          button.textContent = idle;
        }
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
      });
    });
  }
}
