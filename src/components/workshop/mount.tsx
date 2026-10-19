// Mounts the room into the page. This module (and with it three.js, React Three Fiber and the whole scene) is only
// imported by /workshop, after the visitor is allowed 3D (desktop, or "try anyway" on a phone): see workshop.astro.
import { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import roomCss from './room.css?inline';
import Room, { type RoomData, type RoomHooks } from './Room';

class Guard extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override componentDidCatch(): void {
    this.props.onFail();
  }
  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

export function mountRoom(
  container: HTMLElement,
  data: RoomData,
  hooks: RoomHooks & { onFail: () => void },
): () => void {
  const style = document.createElement('style');
  style.textContent = roomCss;
  document.head.append(style);
  const root = createRoot(container);
  root.render(
    <Guard onFail={hooks.onFail}>
      <Room data={data} hooks={hooks} />
    </Guard>,
  );
  return () => {
    root.unmount();
    style.remove();
  };
}
