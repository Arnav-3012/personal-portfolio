import { describe, expect, it } from 'vitest';
import {
  FORM_KINDS,
  NOTEBOOK_TOPICS,
  RULES,
  isFormKind,
  validate,
} from '../../../src/lib/form-rules';

const contact = { name: 'Asha', email: 'asha@example.com', message: 'Hello there, nice site.' };
const freelance = {
  name: 'Asha',
  email: 'asha@example.com',
  company: '',
  service: 'rag-assistants',
  timeline: 'ASAP',
  message: 'We need a chatbot over our policy documents.',
};

const notebook = {
  name: 'Asha',
  email: 'asha@example.com',
  topic: 'Hello',
  message: 'Lovely notebook, thanks!',
};

describe('validate', () => {
  it('passes valid contact and freelance values; company is optional', () => {
    expect(validate('contact', contact)).toEqual({});
    expect(validate('freelance', freelance)).toEqual({});
  });

  it('flags every missing required field', () => {
    expect(Object.keys(validate('contact', {})).toSorted()).toEqual(['email', 'message', 'name']);
    expect(Object.keys(validate('freelance', {})).toSorted()).toEqual([
      'email',
      'message',
      'name',
      'service',
      'timeline',
    ]);
  });

  it('treats whitespace as empty and trims before measuring', () => {
    expect(validate('contact', { ...contact, name: '   ' })['name']).toBe('Name is required.');
    expect(validate('contact', { ...contact, message: '  short  ' })['message']).toMatch(
      /at least 10/,
    );
  });

  it('rejects a malformed email and over-long text', () => {
    expect(validate('contact', { ...contact, email: 'asha@' })['email']).toBe(
      'Enter a valid email address.',
    );
    expect(validate('contact', { ...contact, message: 'x'.repeat(2001) })['message']).toMatch(
      /2000 characters or fewer/,
    );
    expect(validate('freelance', { ...freelance, company: 'c'.repeat(81) })['company']).toMatch(
      /80 characters or fewer/,
    );
  });

  it('accepts exactly the maximum length', () => {
    expect(validate('contact', { ...contact, message: 'x'.repeat(2000) })).toEqual({});
  });
});

describe('notebook', () => {
  it('validates name, email, topic and message', () => {
    expect(validate('notebook', notebook)).toEqual({});
    expect(Object.keys(validate('notebook', {})).toSorted()).toEqual([
      'email',
      'message',
      'name',
      'topic',
    ]);
  });

  it('lists the four topics from the SPEC', () => {
    expect(NOTEBOOK_TOPICS).toEqual(['Freelance', 'Job', 'Collab', 'Hello']);
  });
});

describe('email rule', () => {
  it.each(['a@b.co', 'first.last+tag@sub.example.com'])('accepts %s', (email) => {
    expect(validate('contact', { ...contact, email })).toEqual({});
  });

  // These would add recipients or break out of a Reply-To header.
  it.each(['a@b.co,evil@x.io', 'a@b.co;x@y.io', 'Name <a@b.co>', '"a"@b.co', 'a b@c.io', 'a@b'])(
    'rejects %s',
    (email) => {
      expect(validate('contact', { ...contact, email })['email']).toBe(
        'Enter a valid email address.',
      );
    },
  );
});

describe('form kinds', () => {
  it('every kind has rules and isFormKind agrees', () => {
    for (const kind of FORM_KINDS) {
      expect(isFormKind(kind)).toBe(true);
      expect(Object.keys(RULES[kind]).length).toBeGreaterThan(2);
    }
    expect(isFormKind('admin')).toBe(false);
  });
});
