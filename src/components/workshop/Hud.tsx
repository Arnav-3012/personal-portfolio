// The HUD over the room, after SpaceX (awesome-design-md): the interface disappears behind the scene. Text sits on the room
// with no panels or cards (a soft scrim keeps it readable), mono uppercase labels with wide tracking, one ghost pill
// button. Top left: the way back, the walk toggle and the Mumbai readout. Bottom left: the zone list (SPEC: every hotspot
// reachable by keyboard and screen reader). Bottom right: the chosen object's name, or the walking hints.
import type { ZoneInfo } from './Markers';

export interface RoomCopy {
  /** The page's name, for the heading screen readers use (the room itself has no visible title). */
  title: string;
  loading: string;
  backToSite: string;
  unavailable: string;
  listLabel: string;
  overview: string;
  hint: string;
  openOnSite: string;
  lowPower: string;
  day: string;
  night: string;
  rain: string;
  clockLabel: string;
  walk: string;
  keepWalking: string;
  stopWalking: string;
  walkHint: string;
  openPrompt: string;
}

export function Hud({
  copy,
  zones,
  active,
  onSelect,
  onBack,
  phase,
  clock,
  raining,
  canWalk,
  walking,
  near,
  onToggleWalk,
}: {
  copy: RoomCopy;
  zones: readonly ZoneInfo[];
  active: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
  phase: 'day' | 'night';
  clock: string;
  raining: boolean;
  /** Free-roam is offered (desktop, fine pointer). */
  canWalk: boolean;
  walking: boolean;
  /** The zone the walking figure stands beside. */
  near: ZoneInfo | null;
  onToggleWalk: () => void;
}) {
  const zone = zones.find((z) => z.id === active);
  return (
    <div className="rm-hud">
      <h1 className="rm-sr">{copy.title}</h1>
      <div className="rm-hud__top">
        {zone ? (
          <button type="button" className="rm-ghost" onClick={onBack}>
            <span aria-hidden="true">←</span> {walking ? copy.keepWalking : copy.overview}{' '}
            <kbd>Esc</kbd>
          </button>
        ) : (
          <a className="rm-ghost" href="/">
            <span aria-hidden="true">←</span> {copy.backToSite}
          </a>
        )}
        {canWalk && !zone && (
          <button type="button" className="rm-ghost" aria-pressed={walking} onClick={onToggleWalk}>
            {walking ? copy.stopWalking : copy.walk} <kbd>{walking ? 'Esc' : 'F'}</kbd>
          </button>
        )}
        <p className="rm-readout">
          {copy.clockLabel} {clock} · {phase === 'day' ? copy.day : copy.night}
          {raining ? ` · ${copy.rain}` : ''}
        </p>
      </div>

      <nav className="rm-list" aria-label={copy.listLabel}>
        <ul>
          {zones.map((z, i) => (
            <li key={z.id}>
              <button
                type="button"
                className="rm-item"
                aria-current={z.id === active ? 'true' : undefined}
                onClick={() => onSelect(z.id)}
              >
                <span className="rm-item__n" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {z.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <section className="rm-focus" aria-live="polite">
        {zone ? (
          <>
            <h2 className="rm-focus__title">{zone.title}</h2>
            <p className="rm-focus__blurb">{zone.blurb}</p>
            <a className="rm-ghost" href={zone.href}>
              {copy.openOnSite} <span aria-hidden="true">↗</span>
            </a>
          </>
        ) : walking ? (
          <>
            {near && (
              <button
                type="button"
                className="rm-ghost rm-ghost--lit"
                onClick={() => onSelect(near.id)}
              >
                {copy.openPrompt} {near.title} <kbd>E</kbd>
              </button>
            )}
            <p className="rm-focus__hint">{copy.walkHint}</p>
          </>
        ) : (
          <p className="rm-focus__hint">{copy.hint}</p>
        )}
      </section>
    </div>
  );
}
