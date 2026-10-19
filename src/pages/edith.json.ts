// Static JSON for the chat widget (built from content/site.json), fetched only when a visitor opens EDITH. It keeps
// the widget's copy and Turnstile key out of the landing HTML, which has almost no byte budget left.
import { site } from '../lib/content';

export function GET(): Response {
  return Response.json({ ...site.edith, turnstileSiteKey: site.turnstileSiteKey });
}
