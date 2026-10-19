// A room-only copy of the "is this key press text input?" check (the site's own is in lib/theme.ts). The room is a lazy chunk;
// importing from theme.ts would turn that module into a file shared with the landing page, which would then have to fetch it
// before its first script runs and push the landing page's LCP out by about 150 ms.
export function isTypingTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
