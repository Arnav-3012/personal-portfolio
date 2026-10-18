// Field rules for every form, shared by the browser (src/lib/forms.ts) and the Worker (worker/forms.ts) so the
// limits cannot drift. Pure: no DOM, no Worker APIs.

export const FORM_KINDS = ['contact', 'freelance', 'notebook'] as const;
export type FormKind = (typeof FORM_KINDS)[number];

/** What a notebook message is about (SPEC "Study table + notebook"). */
export const NOTEBOOK_TOPICS = ['Freelance', 'Job', 'Collab', 'Hello'] as const;

export interface Rule {
  label: string;
  required: boolean;
  min?: number;
  max: number;
  email?: boolean;
}

// No whitespace or address punctuation: the Worker puts this value in a Reply-To header, where a comma or angle
// bracket would add recipients.
const PART = String.raw`[^\s@<>(),;:"\\[\]]+`;
const EMAIL = new RegExp(`^${PART}@${PART}\\.${PART}$`);
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
  notebook: {
    name,
    email,
    topic: { label: 'Topic', required: true, max: 20 },
    message: { label: 'Message', required: true, min: 10, max: 2000 },
  },
};

export const isFormKind = (kind: string): kind is FormKind =>
  (FORM_KINDS as readonly string[]).includes(kind);

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
