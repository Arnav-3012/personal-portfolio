// Static JSON for the entry sequence (built from content/site.json), fetched when a visitor first comes near the brain.
// It keeps the readouts and Mumbai's coordinates out of the landing HTML and out of the sequence's code.
import { site } from '../lib/content';

export function GET(): Response {
  const { city, lat, lon } = site.location;
  return Response.json({
    city,
    lat,
    lon,
    handNote: site.workshop.handNote,
    hoverNote: site.workshop.hoverNote,
    tapNote: site.workshop.tapNote,
    ...site.workshop.sequence,
  });
}
