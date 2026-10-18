// Mail to Arnav through the Email Routing `send_email` binding (free to a verified address, SPEC "Integrations").
// The MIME message is built by hand: it is plain text, and every header value is stripped of CR/LF so a visitor
// can't inject headers.
import { EmailMessage } from 'cloudflare:email';

export interface Mail {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  text: string;
}

const encoder = new TextEncoder();

const base64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const oneLine = (value: string): string => value.replace(/[\r\n\u2028\u2029]+/g, ' ').trim();

/** RFC 2047 encoded words (<= 75 chars each) for a header value that isn't plain ASCII. */
export function encodeHeader(value: string): string {
  const clean = oneLine(value);
  if (/^[\x20-\x7e]*$/.test(clean)) return clean;
  const words: string[] = [];
  let chunk = '';
  for (const char of clean) {
    // 45 bytes -> 60 base64 chars + 12 for "=?UTF-8?B??=" stays under 75.
    if (encoder.encode(chunk + char).length > 45) {
      words.push(chunk);
      chunk = '';
    }
    chunk += char;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${base64(encoder.encode(w))}?=`).join('\r\n ');
}

/** The raw message. `id` and `date` are parameters so tests are exact. */
export function buildMime(mail: Mail, id: string, date: Date): string {
  const domain = mail.from.split('@')[1] ?? 'localhost';
  const body = base64(encoder.encode(mail.text)).replace(/.{1,76}/g, '$&\r\n');
  return [
    `From: ${oneLine(mail.from)}`,
    `To: ${oneLine(mail.to)}`,
    `Reply-To: ${oneLine(mail.replyTo)}`,
    `Subject: ${encodeHeader(mail.subject)}`,
    `Message-ID: <${id}@${domain}>`,
    `Date: ${date.toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    body,
  ].join('\r\n');
}

/** Sends the mail; throws if the binding refuses it. */
export async function sendMail(binding: SendEmail, mail: Mail): Promise<void> {
  const raw = buildMime(mail, crypto.randomUUID(), new Date());
  await binding.send(new EmailMessage(mail.from, mail.to, raw));
}
