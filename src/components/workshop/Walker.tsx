// Free-roam (SPEC "Camera and navigation"): the walking figure and its controls. WASD or the arrow keys walk relative to the
// camera, Shift runs, dragging turns the camera round the figure, clicking the floor walks there, and E opens the zone the
// figure stands beside. Collision is in lib/workshop/collision.ts; this component only reads input and moves the figure.
import { useEffect, useMemo, useRef } from 'react';
import { MathUtils, type Group } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { isTypingTarget } from '../../lib/workshop/typing';
import {
  AVATAR_RADIUS,
  AVATAR_START,
  OBSTACLES,
  WALK_BOUNDS,
  nearestZone,
} from '../../lib/workshop/layout';
import {
  ARRIVE_DISTANCE,
  clampPitch,
  NO_KEYS,
  keyFor,
  stepWalker,
  towards,
  wishDirection,
  type Keys,
  type Walker as WalkerState,
} from '../../lib/workshop/movement';
import type { Vec2 } from '../../lib/workshop/collision';
import { Avatar, type AvatarHandle } from './Avatar';
import { Hands } from './Hands';
import type { FollowState } from './context';

const TURN_PER_PIXEL = 0.005;
/** Radians per pixel of mouse movement while the pointer is captured. */
const LOOK_PER_PIXEL = 0.0022;
const DRAG_PIXELS = 5;
const SUB_STEP = 1 / 30;

export function Walker({
  visible,
  enabled,
  follow,
  onNearby,
  onOpen,
}: {
  /** The figure is shown (walk mode). */
  visible: boolean;
  /** Input is live: walk mode and no zone open. */
  enabled: boolean;
  follow: FollowState;
  onNearby: (id: string | null) => void;
  onOpen: (id: string) => void;
}) {
  const avatar = useRef<AvatarHandle>(null);
  const frame = useRef({ dt: 1 / 60 });
  const wrap = useRef<Group>(null);
  const gl = useThree((s) => s.gl);
  const walker = useMemo<WalkerState>(
    () => ({ x: AVATAR_START[0], z: AVATAR_START[1], vx: 0, vz: 0, heading: Math.PI }),
    [],
  );
  const keys = useRef<Keys>({ ...NO_KEYS });
  const target = useRef<Vec2 | null>(null);
  const drag = useRef({ down: false, lastX: 0, lastY: 0, startX: 0, startY: 0, moved: false });
  const nearby = useRef<string | null>(null);
  const timers = useRef({ near: 0, mirror: 0, stalled: 0 });

  useEffect(() => {
    if (!enabled) {
      keys.current = { ...NO_KEYS };
      target.current = null;
      return;
    }
    const down = (e: KeyboardEvent): void => {
      if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = keyFor(e.code);
      if (key) {
        keys.current = { ...keys.current, [key]: true };
        if (key !== 'run') target.current = null;
        if (e.code.startsWith('Arrow')) e.preventDefault();
      } else if (e.code === 'KeyE' && !e.repeat && nearby.current) {
        onOpen(nearby.current);
      }
    };
    const up = (e: KeyboardEvent): void => {
      const key = keyFor(e.code);
      if (key) keys.current = { ...keys.current, [key]: false };
    };
    const blur = (): void => {
      keys.current = { ...NO_KEYS };
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [enabled, onOpen]);

  // Dragging turns the camera round the figure; a drag is not a click on the floor.
  useEffect(() => {
    if (!enabled) return;
    const el = gl.domElement;
    const d = drag.current;
    // Pointer captured: every movement of the mouse turns the head.
    const look = (e: MouseEvent): void => {
      if (document.pointerLockElement !== el) return;
      // A browser can report one huge jump when the lock begins; ignore those.
      if (Math.abs(e.movementX) > 240 || Math.abs(e.movementY) > 240) return;
      follow.yaw -= e.movementX * LOOK_PER_PIXEL;
      follow.pitch = clampPitch(follow.pitch - e.movementY * LOOK_PER_PIXEL);
    };
    const down = (e: PointerEvent): void => {
      d.down = true;
      d.lastX = d.startX = e.clientX;
      d.lastY = d.startY = e.clientY;
      d.moved = false;
    };
    const move = (e: PointerEvent): void => {
      if (!d.down) return;
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > DRAG_PIXELS) d.moved = true;
      // First person: dragging right looks right, dragging up looks up.
      if (d.moved) {
        follow.yaw -= (e.clientX - d.lastX) * TURN_PER_PIXEL;
        follow.pitch = clampPitch(follow.pitch - (e.clientY - d.lastY) * TURN_PER_PIXEL);
      }
      d.lastX = e.clientX;
      d.lastY = e.clientY;
    };
    const up = (): void => {
      // A plain click on the view captures the mouse again after Esc freed it.
      if (d.down && !d.moved && !document.pointerLockElement && 'requestPointerLock' in el)
        void Promise.resolve(el.requestPointerLock()).catch(() => undefined);
      d.down = false;
    };
    document.addEventListener('mousemove', look);
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      document.removeEventListener('mousemove', look);
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [enabled, gl, follow]);

  // Runs before the camera (priority -5), so the view always shows this frame's position, not the last one's.
  useFrame((_, rawDt) => {
    // Frame times wobble by a millisecond or two (and spike when the browser is busy); stepping by a smoothed time turns that
    // wobble into an even glide. Over a second it covers the same distance.
    const f = frame.current;
    f.dt = MathUtils.lerp(f.dt, Math.min(rawDt, 0.1), 0.35);
    const dt = rawDt > 0.1 ? Math.min(rawDt, 0.5) : f.dt;
    let speed = 0;
    if (enabled) {
      let wish = wishDirection(keys.current, follow.yaw);
      if (wish[0] === 0 && wish[1] === 0 && target.current) {
        const { dir, dist } = towards(walker, target.current);
        if (dist < ARRIVE_DISTANCE) target.current = null;
        else wish = dir;
      }
      // A slow frame is split into short steps, so a busy or weak device still covers the right distance.
      for (let left = dt; left > 0; left -= SUB_STEP)
        speed = stepWalker(
          walker,
          wish,
          keys.current.run,
          Math.min(left, SUB_STEP),
          OBSTACLES,
          WALK_BOUNDS,
          AVATAR_RADIUS,
        );
      // A click target the figure cannot reach (a chair in the way) is dropped after half a second of no progress.
      if (target.current && speed < 0.1) {
        timers.current.stalled += dt;
        if (timers.current.stalled > 0.5) target.current = null;
      } else timers.current.stalled = 0;
    } else {
      walker.vx = walker.vz = 0;
    }
    // The body and hands appear as the view arrives in the figure's eyes, not while it is still flying in from the tour, and
    // are hidden whenever a zone is open: the object, not the figure, fills the frame.
    if (wrap.current) wrap.current.visible = visible && enabled && follow.arrive > 0.55;
    follow.x = walker.x;
    follow.z = walker.z;
    follow.heading = walker.heading;
    // The stride swells and fades with the speed (no sudden starts), and its pace follows the ground covered.
    follow.bob = MathUtils.damp(follow.bob, MathUtils.clamp(speed / 1.9, 0, 1.4), 9, dt);
    follow.phase += speed * dt * 4.6;
    // The body faces where the eyes look.
    avatar.current?.set(walker.x, walker.z, follow.yaw, follow.phase, follow.bob);

    timers.current.near += dt;
    if (timers.current.near > 0.12) {
      timers.current.near = 0;
      const id = visible ? nearestZone(walker.x, walker.z) : null;
      if (id !== nearby.current) {
        nearby.current = id;
        onNearby(id);
      }
    }
    timers.current.mirror += dt;
    if (timers.current.mirror > 0.25 && visible) {
      timers.current.mirror = 0;
      gl.domElement
        .closest('.rm')
        ?.setAttribute('data-avatar', `${walker.x.toFixed(2)},${walker.z.toFixed(2)}`);
    }
  }, -5);

  return (
    <group ref={wrap} visible={visible}>
      <Avatar ref={avatar} />
      <Hands visible={visible} follow={follow} />
      <mesh
        visible={false}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        onClick={(e) => {
          // With the mouse captured a click is not a destination; it only counts where the browser cannot capture the mouse.
          if (!enabled || drag.current.moved || 'requestPointerLock' in gl.domElement) return;
          e.stopPropagation();
          target.current = [e.point.x, e.point.z];
        }}
      >
        <planeGeometry args={[10, 8.4]} />
      </mesh>
    </group>
  );
}
