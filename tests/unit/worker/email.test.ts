import { describe, expect, it } from 'vitest';
import { buildMime, encodeHeader } from '../../../worker/email';

const mail = {
  from: 'portfolio@example.test',
  to: 'inbox@example.test',
  replyTo: 'asha@example.com',
  subject: '[portfolio] contact: Asha Rao',
  text: 'New contact message.\n\nName: Asha Rao\n\nHello there.\n',
};
const date = new Date('2026-10-18T12:00:00Z');

const split = (raw: string) => {
  const at = raw.indexOf('\r\n\r\n');
  return { head: raw.slice(0, at).split('\r\n'), body: raw.slice(at + 4) };
};
const decodeBody = (body: string) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(body.replace(/\r\n/g, '')), (c) => c.charCodeAt(0)),
  );
const decodeWord = (word: string) => {
  const m = /^=\?UTF-8\?B\?(.+)\?=$/.exec(word);
  return new TextDecoder().decode(Uint8Array.from(atob(m?.[1] ?? ''), (c) => c.charCodeAt(0)));
};

describe('buildMime', () => {
  it('writes the headers, a base64 UTF-8 body that decodes to the text, and CRLF line ends', () => {
    const { head, body } = split(buildMime(mail, 'abc-123', date));
    expect(head).toEqual([
      'From: portfolio@example.test',
      'To: inbox@example.test',
      'Reply-To: asha@example.com',
      'Subject: [portfolio] contact: Asha Rao',
      'Message-ID: <abc-123@example.test>',
      'Date: Sun, 18 Oct 2026 12:00:00 GMT',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
    ]);
    expect(decodeBody(body)).toBe(mail.text);
  });

  it('wraps the body at 76 characters and keeps non-ASCII text intact', () => {
    const text = `${'héllo wörld 你好 '.repeat(40)}\n`;
    const { body } = split(buildMime({ ...mail, text }, 'id', date));
    for (const line of body.split('\r\n')) expect(line.length).toBeLessThanOrEqual(76);
    expect(decodeBody(body)).toBe(text);
  });

  it('cannot be made to add a header through the subject, reply-to, or names', () => {
    const evil = 'x\r\nBcc: evil@example.org\nX-Injected: 1 Cc: a@b.co';
    const { head } = split(buildMime({ ...mail, subject: evil, replyTo: evil }, 'id', date));
    expect(head.filter((line) => /^(Bcc|X-Injected|Cc):/i.test(line))).toEqual([]);
    expect(head.filter((line) => line.startsWith('Subject:'))).toHaveLength(1);
    expect(head.filter((line) => line.startsWith('Reply-To:'))).toHaveLength(1);
    expect(head).toHaveLength(9);
  });
});

describe('encodeHeader', () => {
  it('leaves printable ASCII alone', () => {
    expect(encodeHeader('[portfolio] freelance: Asha')).toBe('[portfolio] freelance: Asha');
  });

  it('encodes non-ASCII as RFC 2047 words of at most 75 characters that decode back', () => {
    const subject = '[portfolio] contact: Zoë Łukasiewicz 李小龙 — a very long name indeed, ok?';
    const words = encodeHeader(subject).split('\r\n ');
    expect(words.length).toBeGreaterThan(1);
    for (const w of words) expect(w.length).toBeLessThanOrEqual(75);
    expect(words.map(decodeWord).join('')).toBe(subject);
  });

  it('never splits a surrogate pair', () => {
    const subject = '😀'.repeat(30);
    expect(encodeHeader(subject).split('\r\n ').map(decodeWord).join('')).toBe(subject);
  });
});
