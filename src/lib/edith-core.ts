// EDITH-lite client logic (SPEC "EDITH tab", Agent), kept free of DOM building so it is unit-tested:
// the request, the SSE reader, how failures map to messages, and what each tool call does to the page.

export const MAX_MESSAGE_CHARS = 500;

export interface ToolCall {
  name: 'scrollTo' | 'openProject' | 'openResume' | 'enterWorkshop' | 'startFreelanceForm';
  arg?: string;
}
export interface Source {
  label: string;
  url?: string;
}
export interface ReplyMeta {
  spoken: string;
  markdown: string;
  sources: Source[];
  tools: ToolCall[];
  session?: string;
  resting?: boolean;
}
export interface Turn {
  role: 'user' | 'assistant';
  text: string;
}

export type ChatFailure = 'limited' | 'verification' | 'unavailable' | 'network' | 'invalid';

export type ChatEvent =
  { type: 'token'; text: string } | { type: 'meta'; meta: ReplyMeta } | { type: 'error' };

/** Parses `event:` / `data:` blocks from a text stream as they arrive. */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const parse = (block: string): ChatEvent | null => {
    const event = /^event: (\w+)/m.exec(block)?.[1];
    const data = /^data: (.*)$/m.exec(block)?.[1];
    if (!event || data === undefined) return null;
    try {
      const parsed = JSON.parse(data) as Record<string, unknown>;
      if (event === 'token' && typeof parsed['t'] === 'string')
        return { type: 'token', text: parsed['t'] };
      if (event === 'meta') return { type: 'meta', meta: parsed as unknown as ReplyMeta };
      if (event === 'error') return { type: 'error' };
    } catch {
      // A damaged block is skipped.
    }
    return null;
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let cut: number;
      while ((cut = buffer.indexOf('\n\n')) !== -1) {
        const event = parse(buffer.slice(0, cut));
        buffer = buffer.slice(cut + 2);
        if (event) yield event;
      }
    }
    const last = parse(buffer);
    if (last) yield last;
  } finally {
    reader.releaseLock();
  }
}

export interface AskInput {
  message: string;
  history: readonly Turn[];
  session: string | null;
  /** Fetches a Turnstile token; only called when there is no session. */
  turnstile: () => Promise<string | null>;
}

export type AskResult =
  { ok: true; events: AsyncGenerator<ChatEvent> } | { ok: false; reason: ChatFailure };

/** Sends the question. 403 = bot check, 429 = hourly limit, 422 = rejected text, anything else = unavailable. */
export async function ask(
  { message, history, session, turnstile }: AskInput,
  fetchImpl: typeof fetch = fetch,
): Promise<AskResult> {
  const body: Record<string, unknown> = { message, history };
  if (session) body['session'] = session;
  else {
    const token = await turnstile();
    if (!token) return { ok: false, reason: 'verification' };
    body['turnstile'] = token;
  }
  let res: Response;
  try {
    res = await fetchImpl('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (res.ok && res.body) return { ok: true, events: readEvents(res.body) };
  if (res.status === 403) return { ok: false, reason: 'verification' };
  if (res.status === 429) return { ok: false, reason: 'limited' };
  if (res.status === 422 || res.status === 413) return { ok: false, reason: 'invalid' };
  return { ok: false, reason: 'unavailable' };
}

/** What the visitor reads, per failure. Always points to the contact form so they are never stuck. */
export const FAILURE_TEXT: Record<ChatFailure, string> = {
  limited: "You've asked a lot this hour. Try again later, or use the contact form.",
  verification: "The bot check didn't pass. Reload the page and try again.",
  unavailable: "EDITH can't answer right now. Use the contact form and Arnav will reply.",
  network: 'You look offline. Your question is still in the box.',
  invalid: "That message didn't go through. Keep it under 500 characters.",
};

export type PageAction =
  | { kind: 'scroll'; target: string }
  | { kind: 'click'; target: string; missing: string }
  | { kind: 'form'; target: string };

/** Where each tool call goes. The page is the allowlist: an element that is not there means "not available". */
export function actionFor(call: ToolCall, has: (id: string) => boolean): PageAction | null {
  switch (call.name) {
    case 'scrollTo':
      return call.arg && has(call.arg) ? { kind: 'scroll', target: call.arg } : null;
    case 'openProject': {
      if (!call.arg) return null;
      return { kind: 'scroll', target: has(`work-${call.arg}`) ? `work-${call.arg}` : 'projects' };
    }
    case 'startFreelanceForm':
      return { kind: 'form', target: 'freelance' };
    case 'openResume':
      return {
        kind: 'click',
        target: 'a[href$=".pdf"]',
        missing: "The resume isn't available just yet.",
      };
    case 'enterWorkshop':
      return {
        kind: 'click',
        target: 'a[href="/workshop"]',
        missing: "The workshop isn't open yet.",
      };
  }
}
