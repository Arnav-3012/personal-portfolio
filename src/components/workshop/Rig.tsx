// The camera (SPEC "Camera and navigation"): hotspot navigation, not free flight. A shot is a position and a point to look
// at; moving between shots takes 1.6 s on `--ease-cam` (a cut with reduced motion). At rest the camera drifts a hair and
// leans towards the pointer, so the room reads as space rather than a picture; both stop with reduced motion.
import { useEffect, useRef } from 'react';
import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import {
  CAMERA_MOVE_S,
  easeCam,
  stepTween,
  type Shot,
  type Tween,
} from '../../lib/workshop/camera-ease';
import { EYE_HEIGHT, lookVector } from '../../lib/workshop/movement';
import type { FollowState } from './context';

const v = (p: readonly [number, number, number]): Vector3 => new Vector3(p[0], p[1], p[2]);

/** How long the view takes to fly from the tour into the figure's eyes. */
const WALK_IN_S = 1.5;

/** Wider field of view on narrow screens, so a portrait phone still sees the room. */
export const fovFor = (aspect: number): number => (aspect < 0.7 ? 80 : aspect < 1 ? 68 : 58);

export function Rig({
  shot,
  reduced,
  follow,
}: {
  shot: Shot;
  reduced: boolean;
  follow: FollowState | null;
}) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const base = useRef({ position: v(shot.position), target: v(shot.target) });
  const tween = useRef<Tween | null>(null);
  const lean = useRef({ x: 0, y: 0 });
  const look = useRef(new Vector3());
  const first = useRef(true);
  const eye = useRef(new Vector3());
  const gaze = useRef(new Vector3());
  // Stepping into the figure: the view flies from where the camera was to the figure's eyes on the same ease as every other
  // move, then follows exactly. `t` is how far along that flight is (0 to 1).
  const walk = useRef({
    on: false,
    t: 1,
    from: new Vector3(),
    look: new Vector3(),
    pos: new Vector3(),
    aim: new Vector3(),
  });

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    tween.current = {
      from: { position: base.current.position.toArray(), target: base.current.target.toArray() },
      to: shot,
      elapsed: 0,
      duration: reduced ? 0 : CAMERA_MOVE_S,
    };
  }, [shot, reduced]);

  useEffect(() => {
    camera.fov = fovFor(size.width / size.height);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  useFrame((state, dt) => {
    const b = base.current;
    if (follow) {
      // Walking, first person: the camera is at the figure's eyes and looks where the figure looks. It glides in from the
      // overview, then follows exactly (a lagging view makes mouse-look feel loose).
      tween.current = null;
      const w = walk.current;
      if (!w.on) {
        w.on = true;
        w.t = reduced ? 1 : 0;
        follow.arrive = w.t;
        w.from.copy(camera.position);
        w.look.copy(b.target);
      }
      const [lx, ly, lz] = lookVector(follow.yaw, follow.pitch);
      // Two steps per stride, so the head dips once for each foot.
      const bob = reduced ? 0 : Math.sin(follow.phase * 2) * 0.011 * Math.min(follow.bob, 1);
      const e = eye.current.set(follow.x, EYE_HEIGHT + bob, follow.z);
      gaze.current.set(e.x + lx, e.y + ly, e.z + lz);
      if (w.t < 1) {
        // The flight tracks the live eye and gaze, so a key pressed on the way simply steers it.
        w.t = Math.min(1, w.t + dt / WALK_IN_S);
        const k = easeCam(w.t);
        w.pos.copy(w.from).lerp(e, k);
        w.aim.copy(w.look).lerp(gaze.current, k);
        follow.arrive = k;
        b.position.copy(w.pos);
        b.target.copy(w.aim);
      } else {
        follow.arrive = 1;
        b.position.copy(e);
        b.target.copy(gaze.current);
      }
      camera.position.copy(b.position);
      camera.lookAt(b.target);
      return;
    }
    if (walk.current.on) {
      // Stepping out: fly back to the shot the tour is on (a zone's, if one was just opened: that tween already started).
      walk.current.on = false;
      if (!tween.current)
        tween.current = {
          from: { position: b.position.toArray(), target: b.target.toArray() },
          to: shot,
          elapsed: 0,
          duration: reduced ? 0 : CAMERA_MOVE_S,
        };
    }
    if (tween.current) {
      const { shot: s, done } = stepTween(tween.current, dt);
      b.position.set(...s.position);
      b.target.set(...s.target);
      if (done) tween.current = null;
    }
    const resting = !tween.current && !reduced;
    lean.current.x = MathUtils.damp(lean.current.x, resting ? state.pointer.x * 0.22 : 0, 3, dt);
    lean.current.y = MathUtils.damp(lean.current.y, resting ? state.pointer.y * 0.08 : 0, 3, dt);
    const drift = resting ? Math.sin(state.clock.elapsedTime * 0.25) * 0.05 : 0;
    camera.position.set(
      b.position.x + lean.current.x + drift,
      b.position.y + lean.current.y,
      b.position.z,
    );
    look.current.set(
      b.target.x + lean.current.x * 0.35,
      b.target.y + lean.current.y * 0.2,
      b.target.z,
    );
    camera.lookAt(look.current);
  });
  return null;
}
