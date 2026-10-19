// Static JSON for the Beyond code decoration (stickers, the pinned photo, the reel cards), built from content/cricket.json and
// content/discipline.json and fetched when a visitor nears the section. It keeps decoration out of the landing HTML.
import { cricket, discipline } from '../lib/content';

export function GET(): Response {
  return Response.json({
    cricket: {
      stickers: cricket.stickers,
      firstCaption: cricket.teaser.caption,
      slides: cricket.slides.map((s) => ({ src: `/${s.file}`, alt: s.alt, caption: s.caption })),
    },
    hard: {
      reels: [...discipline.reels]
        .sort((a, b) => a.day - b.day)
        .map((r) => ({ poster: `/${r.poster}`, day: r.day, caption: r.caption })),
    },
  });
}
