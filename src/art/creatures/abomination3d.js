import * as THREE from "three";
import { merge, skin, surfaceMaterial } from "./kit.js";

// The Abomination: not a body but a heap of them.
//
// Ported from `docs/reference/abomination.html`. Everything else on this board
// is built outward from a spine, and this is the one unit where that would be
// wrong: a mass of the dead rolled together, hauling itself along on whichever
// limbs happen to reach the ground. There is no skeleton anywhere in it.
//
// That suits the overhead camera better than a body does. Limbs radiating from
// a central heap break the outline in every direction at once, which is a
// silhouette nothing else in the game makes.
//
// The previous rig was sculpted outward from corpses — torsos, ribcages,
// shoulder blades — at a scale where a limb came out under 3 px across on the
// stand. It read as a pale knot. The reference gets its read from three things
// this port keeps, and nothing else:
//
//   One lumpy mass, with no axis of symmetry and no body in it.
//   Long thin limbs, sprouting where the corpses happened to land, the five
//   that reach the ground planted flat and the rest reaching.
//   Heads half swallowed by the heap, whose dark sockets and open mouths are
//   the only detail on it that carries at any size.
//
// What it deliberately does not take, per `docs/reference/README.md`:
//
//   The footprint. The reference heap is nearly round, 3.7 by 3.2, with limbs
//   out in every direction. A stand wants about 2.4:1, and a round rig fits its
//   depth and wastes two thirds of its width. So the layout is squeezed along
//   Z — lump positions, the anchor ellipsoid, the feet and the reach of every
//   loose limb — while the parts themselves keep their shape. A squashed head
//   is an oval; a head placed closer to its neighbour is still a head.
//   Where the faces point. The reference turns each head straight out from
//   the heap, which from directly above is a face the camera never sees. Here
//   they are tipped up toward it.
//   The palette. The reference heap is a mid grey-brown, the same value as the
//   turf once ACES has lifted it. The confirmed brief is pale dead flesh against
//   a dark rotten core, so the heap goes dark and the limbs and faces stay pale.
//   The lean. The reference tilts the whole heap and pre-compensates the feet;
//   `CreatureLayer` owns the root, so the roll lives on the mass in the poser.

const ABOMINATION = {
  // The heap: dark, so the pale limbs read against it and it reads against the
  // turf. Measured against 0x3f6420 these sit near 1.6–1.9:1, darker than the
  // field rather than the same value as it.
  rot: 0x4a3c39,
  rotBruise: 0x3f3037,
  rotPale: 0x5d4c46,
  gore: 0x5e2a27,
  goreDark: 0x3d1614,
  // The limbs and faces: pale, and spread so no two neighbours are the same
  flesh: 0xb3a493,
  fleshGrey: 0x9b8d84,
  fleshLivid: 0x8f777b,
  bone: 0xd6c9ae,
  sinew: 0xa1706a,
  socket: 0x1c1618,
  eye: 0xc4b8a4,
  tooth: 0xe2d9c2,
};

const LIMB_TONES = [ABOMINATION.flesh, ABOMINATION.fleshGrey, ABOMINATION.fleshLivid];
const HEAD_TONES = [ABOMINATION.flesh, ABOMINATION.fleshGrey, ABOMINATION.flesh, ABOMINATION.fleshLivid];

// `mottleScale` is sampled in model units, so each size of part gets its own:
// a lump a unit across wants the blotches broad, a limb a third of a unit across
// wants them fine, or the whole part lands inside one lobe and just shifts tone.
const HEAP = { roughness: 0.88, mottle: 0.2, mottleScale: 2.4 };
const LIMB = { roughness: 0.84, mottle: 0.18, mottleScale: 7 };
const FACE = { roughness: 0.84, mottle: 0.16, mottleScale: 6 };
const GORE = { metalness: 0.1, roughness: 0.55, mottle: 0.15, mottleScale: 8 };
const BONE = { metalness: 0.05, roughness: 0.6 };
const DARK = { roughness: 0.95 };

// The layout squeeze along Z. See the header: positions, not shapes.
const SQUEEZE = 0.45;

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

// The reference's own generator and seed. A fixed sequence rather than
// `Math.random`, so the heap is the same heap every time it is built and the
// board does not reshuffle it on every mount.
const random = (seed) => {
  let s = seed;
  const next = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return { next, range: (a, b) => a + next() * (b - a) };
};

// --- baking parts ------------------------------------------------------------
//
// The reference hangs every piece on its own mesh — 455 of them. Here each
// thing that moves is one merged buffer, so the same pieces are baked into the
// geometry through a matrix instead of carried on a transform.

const matrixOf = (position, quaternion = new THREE.Quaternion(), scale = V(1, 1, 1)) =>
  new THREE.Matrix4().compose(position, quaternion, scale);

const baked = (geometry, color, surface, matrix) => {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  if (matrix) g.applyMatrix4(matrix);
  return skin(g, color, surface);
};

/** A buffer's worth of parts, each baked through the frame it was built in. */
const bin = () => {
  const parts = [];
  const add = (geometry, color, surface, local, frame) => {
    const m = frame ? frame.clone() : new THREE.Matrix4();
    if (local) m.multiply(local);
    parts.push(baked(geometry, color, surface, m));
  };
  return { parts, add };
};

const mergeBin = ({ parts }) => {
  const g = merge(parts);
  g.computeBoundingSphere();
  return g;
};

/**
 * Push every vertex along its normal by a smooth pseudo-noise field.
 *
 * The reference's own function, unchanged: nothing on this creature is a clean
 * surface, and because the field is continuous in position a sphere's seam
 * stays welded.
 */
const lumpy = (geometry, amp, freq, s) => {
  const p = geometry.attributes.position;
  const n = geometry.attributes.normal;
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const d =
      amp *
      (Math.sin(x * freq + s) * Math.sin(y * freq * 1.37 + s * 2.1) * Math.sin(z * freq * 0.83 + s * 3.7) +
        0.45 * Math.sin(x * freq * 2.3 + s * 1.7) * Math.sin(z * freq * 2.9 + s * 0.6));
    p.setXYZ(i, x + n.getX(i) * d, y + n.getY(i) * d, z + n.getZ(i) * d);
  }
  geometry.computeVertexNormals();
  return geometry;
};

const blob = (r, amp, s, seg = 22) =>
  lumpy(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)), amp, 2.2 / r, s);

/** A tapering bar between two points — kit's `spanning`, taking vectors. */
const bar = (a, b, r0, r1, seg = 12) => {
  const g = new THREE.CylinderGeometry(r1, r0, a.distanceTo(b), seg, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
};

const ball = (r, seg = 12) => new THREE.SphereGeometry(r, seg, Math.round(seg * 0.8));

// --- the heap ------------------------------------------------------------------

// Where the heap is, and the ellipsoid limbs and heads are anchored on
const CX = V(0, 1.72, 0);
const EX = 2.05;
const EY = 1.08;
const EZ = 1.58 * SQUEEZE;

const anchor = (theta, phi, out = 1) => {
  const st = Math.sin(theta);
  return CX.clone().add(
    V(EX * st * Math.cos(phi) * out, EY * Math.cos(theta) * out, EZ * st * Math.sin(phi) * out)
  );
};
// Pull an angle round the heap toward the wide axis. `a - k sin 2a` crowds
// placements near 0 and PI and thins them where a head or a limb would sit on
// the shallow flank and spend depth the stand does not have.
const toWide = (a) => a - Math.sin(2 * a) * 0.45;

const outward = (p) => p.clone().sub(CX).divide(V(EX, EY, EZ)).normalize();

// The reference's lumps, spread 1.3x along X and squeezed along Z
const LUMPS = [
  [0.0, 0.0, 0.0, 1.3], [0.86, 0.16, -0.36, 0.98], [-0.82, -0.06, 0.3, 1.04],
  [0.24, 0.52, 0.62, 0.86], [-0.3, 0.46, -0.66, 0.8], [0.62, -0.48, 0.58, 0.82],
  [-0.66, -0.46, -0.5, 0.78], [1.12, -0.26, 0.42, 0.66], [-1.16, 0.22, -0.18, 0.62],
  [0.1, 0.84, -0.1, 0.7], [0.44, -0.72, -0.28, 0.6], [-0.34, -0.74, 0.4, 0.58],
  [1.02, 0.54, 0.1, 0.54], [-0.92, 0.56, 0.46, 0.5],
].map(([x, y, z, r]) => [x * 1.3, y * 0.9, z * SQUEEZE, r]);

/**
 * Where the heap's surface actually is, looking in from a direction.
 *
 * The reference places ribs, bones and sinew on the ideal ellipsoid, and on a
 * heap of noise-displaced lumps that is inside the flesh as often as not. The
 * first render of this port had every rib and most of the gore buried — the
 * trap the skill describes as detail sunk inside its own parent, which looks
 * exactly like code that never ran. So cast a ray at the lumps and put the
 * detail where the ray lands.
 */
const surfaceOf = (lumps) => {
  const mesh = new THREE.Mesh(lumps);
  const ray = new THREE.Raycaster();
  return (theta, phi) => {
    const dir = outward(anchor(theta, phi));
    ray.set(CX.clone().add(dir.clone().multiplyScalar(8)), dir.clone().negate());
    const hit = ray.intersectObject(mesh, false)[0];
    return { point: hit ? hit.point : anchor(theta, phi), dir };
  };
};

const heapBuffer = (rng) => {
  const b = bin();
  const tones = [ABOMINATION.rot, ABOMINATION.rotBruise, ABOMINATION.rotPale];

  LUMPS.forEach(([x, y, z, r], i) => {
    const q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rng.range(0, 3), rng.range(0, 3), rng.range(0, 3))
    );
    // Wider than deep, lump by lump as well as in where they sit
    const s = V(rng.range(1.05, 1.3), rng.range(0.72, 0.88), rng.range(0.6, 0.72));
    b.add(blob(r, r * 0.2, i * 1.7 + 0.4, 26), tones[i % 3], HEAP, matrixOf(CX.clone().add(V(x, y, z)), q, s));
  });
  const surface = surfaceOf(merge(b.parts.slice()));

  // Fused gore packed into the valleys. This is the dark in the gaps, and on a
  // heap this dark it is also the one wet thing on it.
  for (let i = 0; i < 14; i += 1) {
    // Sunk most of the way in and pressed flat. Sitting on the skin, the first
    // pass rendered as a scatter of glossy red balls the size of the heads.
    const { point, dir } = surface(rng.range(0.2, 1.7), rng.range(0, 6.28));
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
    const s = V(rng.range(1, 1.5), rng.range(0.3, 0.4), rng.range(1, 1.5));
    b.add(blob(rng.range(0.16, 0.24), 0.04, i * 2.3, 14), i % 2 ? ABOMINATION.gore : ABOMINATION.goreDark, GORE,
      matrixOf(point.clone().sub(dir.clone().multiplyScalar(0.05)), q, s));
  }

  // Ribs that never found a chest to belong to, breaking the surface. Kept to
  // the upper half of the heap: one on the flank is one the camera never sees.
  for (let i = 0; i < 9; i += 1) {
    const { point, dir } = surface(rng.range(0.2, 1.3), rng.range(0, 6.28));
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), dir);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), rng.range(0, 6.28)));
    const rib = new THREE.TorusGeometry(rng.range(0.26, 0.42), 0.05, 7, 18, Math.PI * rng.range(0.5, 0.95));
    b.add(rib, ABOMINATION.bone, BONE, matrixOf(point.clone().add(dir.clone().multiplyScalar(0.03)), q));
  }

  // Snapped long bones jutting out, rooted a little below the skin
  for (let i = 0; i < 7; i += 1) {
    const { point, dir } = surface(rng.range(0.3, 1.4), rng.range(0, 6.28));
    const base = point.clone().sub(dir.clone().multiplyScalar(0.12));
    const along = dir.clone().add(V(rng.range(-0.4, 0.4), rng.range(0, 0.5), rng.range(-0.4, 0.4)));
    along.z *= 0.4;
    along.normalize();
    const tip = point.clone().add(along.multiplyScalar(rng.range(0.35, 0.65)));
    b.add(bar(base, tip, 0.07, 0.05, 10), ABOMINATION.bone, BONE);
    b.add(ball(0.08, 10), ABOMINATION.bone, BONE, matrixOf(tip));
  }

  // Sinew stretched across the gaps as the mass shifts. Thicker than the
  // reference's, which at 0.02 would be half a pixel on the stand; these are
  // for the tilted portrait in the combat panel more than for the board.
  for (let i = 0; i < 16; i += 1) {
    const a = surface(rng.range(0.3, 1.5), rng.range(0, 6.28));
    const c = surface(rng.range(0.3, 1.5), rng.range(0, 6.28));
    const d = a.point.distanceTo(c.point);
    if (d > 2.4 || d < 0.5) continue;
    // Taut over the top rather than through the heap between the two ends
    const lifted = (e) => e.point.clone().add(e.dir.clone().multiplyScalar(0.04));
    b.add(bar(lifted(a), lifted(c), rng.range(0.03, 0.045), rng.range(0.03, 0.045), 6), ABOMINATION.sinew, GORE);
  }

  return { geometry: mergeBin(b), surface };
};

// --- heads ---------------------------------------------------------------------
//
// Each one half swallowed by the heap. Built in its own frame, looking down +Z
// with the jaw hung below, and split in two so the jaw can drop on its own
// hinge — every face screams at its own moment.

const headBuffers = (r, tone, seed) => {
  const skull = bin();
  const jaw = bin();
  const s = seed;

  skull.add(blob(r, r * 0.12, s, 18), tone, FACE, matrixOf(V(0, 0, 0), undefined, V(0.92, 1.08, 1)));
  [1, -1].forEach((side) => {
    skull.add(blob(r * 0.26, r * 0.06, s + side * 3, 10), tone, FACE,
      matrixOf(V(side * r * 0.38, r * 0.44, r * 0.8), undefined, V(1.25, 0.5, 0.7)));
    // The sockets are the one feature that survives at stand scale, so they
    // are a touch larger than the reference's and nearly black
    skull.add(ball(r * 0.34, 14), ABOMINATION.socket, DARK,
      matrixOf(V(side * r * 0.38, r * 0.12, r * 0.95), undefined, V(1, 0.9, 0.7)));
    skull.add(ball(r * 0.13, 10), ABOMINATION.eye, FACE, matrixOf(V(side * r * 0.38, r * 0.12, r * 1.07)));
  });
  skull.add(ball(r * 0.44, 14), ABOMINATION.socket, DARK,
    matrixOf(V(0, -r * 0.44, r * 0.95), undefined, V(0.95, 0.8, 0.6)));
  for (let i = 0; i < 3; i += 1) {
    const q = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI);
    skull.add(new THREE.ConeGeometry(r * 0.06, r * 0.22, 6), ABOMINATION.tooth, BONE,
      matrixOf(V((i - 1) * r * 0.24, -r * 0.2, r * 1.04), q));
  }

  // The jaw, in the frame of its hinge at (0, -0.4r, 0.3r)
  jaw.add(blob(r * 0.58, r * 0.1, s + 7, 12), tone, FACE,
    matrixOf(V(0, -r * 0.38, r * 0.42), new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), 0.45), V(0.95, 0.5, 0.95)));
  for (let i = 0; i < 3; i += 1) {
    jaw.add(new THREE.ConeGeometry(r * 0.06, r * 0.2, 6), ABOMINATION.tooth, BONE,
      matrixOf(V((i - 1) * r * 0.24, -r * 0.22, r * 0.76)));
  }

  return { skull: mergeBin(skull), jaw: mergeBin(jaw), hinge: V(0, -r * 0.4, r * 0.3) };
};

// theta from the top of the heap, phi round it — the reference's placements,
// lifted a little so fewer of them sit on the flanks
const HEAD_AT = [
  [0.62, 0.35], [0.95, 2.05], [0.5, 3.55], [0.7, 4.3], [0.3, 5.6],
  [1.2, 0.75], [1.3, 3.05], [0.85, 5.1], [1.25, 4.05],
];

// How far each face is tipped from pointing out of the heap toward pointing up
// at the camera. Straight out is invisible from above; straight up is a face
// lying on its back. Most of the way up reads as a face screaming skyward.
const FACE_UP = 1.35;

// --- limbs ---------------------------------------------------------------------
//
// Nothing is hinged to a skeleton. Each limb is two buffers — root to knee, and
// knee to hand or foot — hung on two groups, and the geometry of each is stated
// by its endpoints and baked relative to its own pivot, so the groups carry no
// rest rotation and the poser adds motion from zero.

/**
 * A hand, in a frame whose +Y is the way the fingers point and +Z the way the
 * back of the hand faces. Planted hands lie palm down with the curl slackened,
 * so the fingertips do not dig through the floor.
 */
const handInto = (b, frame, r, tone, planted) => {
  const curl = planted ? 0.2 : 1;
  b.add(blob(r * 1.5, r * 0.2, r * 90, 12), tone, LIMB, matrixOf(V(0, 0, 0), undefined, V(1, 0.8, 0.5)), frame);
  for (let i = 0; i < 4; i += 1) {
    const a = (i - 1.5) * 0.36;
    const base = V(Math.sin(a) * r * 1.1, r * 0.6, Math.cos(a) * r * 0.5 * curl);
    const mid = base.clone().add(V(Math.sin(a) * r * 1.2, r * 1.1, Math.cos(a) * r * 0.5 * curl));
    const tip = mid.clone().add(V(Math.sin(a) * r * 1.5, r * 0.5, Math.cos(a) * r * 0.9 * curl));
    b.add(bar(base, mid, r * 0.32, r * 0.28, 8), tone, LIMB, null, frame);
    b.add(bar(mid, tip, r * 0.28, r * 0.2, 8), tone, LIMB, null, frame);
    b.add(ball(r * 0.29, 8), tone, LIMB, matrixOf(mid), frame);
  }
  b.add(bar(V(-r * 0.8, r * 0.3, 0), V(-r * 1.3, r * 0.2, r * 0.5 * curl), r * 0.32, r * 0.22, 8), tone, LIMB, null, frame);
};

const handFrame = (position, dir, backUp) => {
  const yA = dir.clone().normalize();
  let zA = (backUp || V(0, 0, 1)).clone();
  if (Math.abs(zA.dot(yA)) > 0.94) zA = Math.abs(yA.y) > 0.9 ? V(0, 0, 1) : V(0, 1, 0);
  zA.sub(yA.clone().multiplyScalar(zA.dot(yA))).normalize();
  const xA = new THREE.Vector3().crossVectors(yA, zA).normalize();
  return new THREE.Matrix4().makeBasis(xA, yA, zA).setPosition(position);
};

/** A foot, whose +Y points back up the leg it hangs off. */
const footInto = (b, frame, r, tone) => {
  b.add(blob(r * 1.7, r * 0.18, r * 70, 12), tone, LIMB, matrixOf(V(0, r * 0.6, 0), undefined, V(0.8, 0.42, 1.25)), frame);
  b.add(blob(r * 0.9, r * 0.14, r * 51, 10), tone, LIMB, matrixOf(V(0, r * 0.7, -r * 1.2)), frame);
  for (let i = 0; i < 4; i += 1) {
    b.add(blob(r * 0.36, r * 0.08, i * 3.1, 8), tone, LIMB, matrixOf(V((i - 1.5) * r * 0.44, r * 0.34, r * 1.9)), frame);
  }
};

const footFrame = (position, into, spin) => {
  const q = new THREE.Quaternion().setFromUnitVectors(UP, into.clone().negate().normalize());
  q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, spin));
  return matrixOf(position, q);
};

/**
 * Bake one limb into its two buffers.
 *
 * `root`, `knee` and `end` are in the creature's space; each buffer is
 * translated so its pivot sits on its group's origin.
 */
const limbBuffers = ({ root, knee, end, r, tone, finish }) => {
  const upper = bin();
  const lower = bin();
  const toRoot = new THREE.Matrix4().makeTranslation(-root.x, -root.y, -root.z);
  const toKnee = new THREE.Matrix4().makeTranslation(-knee.x, -knee.y, -knee.z);

  const rKnee = r * 0.78;
  const rEnd = r * 0.56;
  upper.add(bar(root, knee, r, rKnee, 14), tone, LIMB, null, toRoot);
  upper.add(ball(r * 1.25, 14), tone, LIMB, matrixOf(root), toRoot);
  upper.add(ball(rKnee * 1.2, 12), tone, LIMB, matrixOf(knee), toRoot);
  lower.add(bar(knee, end, rKnee, rEnd, 14), tone, LIMB, null, toKnee);
  finish(lower, toKnee);

  return { upper: mergeBin(upper), lower: mergeBin(lower) };
};

// The five that currently reach the ground: the heap's legs, for this moment
// only. The reference's, turned so they splay along the wide axis — a planted
// foot straight out in front is depth the stand does not have.
const STANCE = [
  { theta: 2.3, phi: 0.35, kind: "leg", foot: V(2.55, 0, 0.78), knee: V(2.35, 1.0, 0.36) },
  { theta: 2.45, phi: 2.75, kind: "leg", foot: V(-2.45, 0, 0.9), knee: V(-2.1, 0.92, 0.42) },
  { theta: 2.4, phi: 3.75, kind: "leg", foot: V(-2.2, 0, -0.95), knee: V(-1.95, 1.08, -0.5) },
  { theta: 2.2, phi: 5.5, kind: "arm", foot: V(2.05, 0, -0.92), knee: V(1.55, 1.15, -0.72) },
  { theta: 1.9, phi: 1.2, kind: "arm", foot: V(0.8, 0, 0.95), knee: V(0.22, 1.2, 0.8) },
];

// And the rest: limbs that reach, clutch at the mass, or hang dead.
// [theta, phi, kind]
const LOOSE = [
  [0.55, 0.3, "arm"], [0.8, 2.9, "arm"], [1.2, 1.0, "arm"], [1.35, 5.9, "arm"],
  [1.7, 2.4, "arm"], [0.4, 3.6, "arm"], [1.95, 0.2, "leg"], [2.05, 4.9, "leg"],
  [1.15, 3.35, "arm"], [1.55, 4.3, "leg"], [0.95, 0.1, "arm"], [2.1, 2.95, "arm"],
];

// How much of a loose limb's reach along Z it keeps. Squeezing the direction
// rather than the geometry bends each limb toward the wide axis and leaves its
// length and thickness alone.
const REACH_Z = 0.3;

const makeLimb = (spec, rng, limbs, material) => {
  const { root, knee, end, r, tone, finish, stance } = spec;
  const { upper: upperGeometry, lower: lowerGeometry } = limbBuffers({ root, knee, end, r, tone, finish });

  const upper = new THREE.Group();
  upper.position.copy(root);
  limbs.add(upper);
  const mesh = new THREE.Mesh(upperGeometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  upper.add(mesh);

  const lower = new THREE.Group();
  lower.position.copy(knee).sub(root);
  upper.add(lower);
  const lowerMesh = new THREE.Mesh(lowerGeometry, material);
  lowerMesh.castShadow = true;
  lowerMesh.receiveShadow = true;
  lower.add(lowerMesh);

  // The axis that lifts this limb: horizontal, square to where it reaches.
  // `reach × up` is the one whose positive rotation raises the far end.
  const reach = end.clone().sub(root).setY(0);
  if (reach.lengthSq() < 1e-6) reach.set(1, 0, 0);
  reach.normalize();
  const lift = new THREE.Vector3().crossVectors(reach, UP).normalize();

  return {
    upper,
    lower,
    lift,
    stance,
    // Every limb on its own clock and at its own rate, so no two ever fall
    // into step. Anything synchronised implies one animal underneath.
    phase: rng.range(0, Math.PI * 2),
    rate: rng.range(0.78, 1.26),
  };
};

const makeAbomination = (material) => {
  const rng = random(20260914);
  const group = new THREE.Group();

  const mass = new THREE.Group();
  group.add(mass);
  const { geometry: heapGeometry, surface } = heapBuffer(rng);
  const heap = new THREE.Mesh(heapGeometry, material);
  heap.castShadow = true;
  heap.receiveShadow = true;
  mass.add(heap);

  // Heads ride on the mass, so they heave with it
  const heads = HEAD_AT.map(([theta, even], i) => {
    const phi = toWide(even);
    const r = rng.range(0.3, 0.4);
    // Half swallowed: the centre of the skull a little way out of the skin
    const { point: p, dir: out } = surface(theta, phi);
    const look = out.clone().add(UP.clone().multiplyScalar(FACE_UP)).normalize();
    const tone = HEAD_TONES[i % HEAD_TONES.length];
    const { skull, jaw, hinge } = headBuffers(r, tone, r * 40 + i);

    const head = new THREE.Group();
    head.position.copy(p).add(out.multiplyScalar(r * 0.25));
    head.quaternion.setFromUnitVectors(V(0, 0, 1), look);
    head.rotateZ(rng.range(-0.5, 0.5));
    mass.add(head);
    const skullMesh = new THREE.Mesh(skull, material);
    skullMesh.castShadow = true;
    head.add(skullMesh);

    const hingeGroup = new THREE.Group();
    hingeGroup.position.copy(hinge);
    head.add(hingeGroup);
    const jawMesh = new THREE.Mesh(jaw.translate(-hinge.x, -hinge.y, -hinge.z), material);
    jawMesh.castShadow = true;
    hingeGroup.add(jawMesh);

    return { head, jaw: hingeGroup, rest: head.quaternion.clone(), phase: rng.range(0, 6.28), gape: rng.range(0.25, 0.5) };
  });

  // Limbs hang off the creature rather than the mass. Their roots are buried
  // inside the heap, so it can heave and roll over them without a planted foot
  // lifting off the ground or sinking through it.
  const limbGroup = new THREE.Group();
  group.add(limbGroup);
  const limbs = [];

  STANCE.forEach((s) => {
    const leg = s.kind === "leg";
    const tone = LIMB_TONES[Math.floor(rng.next() * LIMB_TONES.length)];
    const r = leg ? rng.range(0.19, 0.23) : rng.range(0.14, 0.17);
    const root = anchor(s.theta, s.phi, 0.88);
    const reach = s.foot.clone().sub(s.knee).setY(0).normalize();
    const palm = s.foot.clone().setY(r * 0.3);
    const end = leg
      ? s.foot.clone().setY(r * 1.7)
      : palm.clone().add(V(0, r * 0.7, 0)).sub(reach.clone().multiplyScalar(r * 0.9));
    const finish = leg
      ? (b, frame) => footInto(b, frame.clone().multiply(footFrame(s.foot, V(0, -1, 0), rng.range(0, 6.28))), r * 0.95, tone)
      : (b, frame) => handInto(b, frame.clone().multiply(handFrame(palm, reach, UP)), r * 0.95, tone, true);
    limbs.push(makeLimb({ root, knee: s.knee, end, r, tone, finish, stance: true }, rng, limbGroup, material));
  });

  LOOSE.forEach(([theta, even, kind]) => {
    const phi = toWide(even);
    const leg = kind === "leg";
    const tone = LIMB_TONES[Math.floor(rng.next() * LIMB_TONES.length)];
    const root = anchor(theta, phi, 0.88);
    const dir = outward(root);
    dir.z *= REACH_Z;
    dir.normalize();
    const r = leg ? rng.range(0.16, 0.2) : rng.range(0.12, 0.15);
    const l1 = leg ? rng.range(0.75, 1.0) : rng.range(0.6, 0.85);
    const l2 = leg ? rng.range(0.65, 0.9) : rng.range(0.55, 0.8);
    const bend = V(rng.range(-0.5, 0.5), rng.range(-0.6, 0.4), rng.range(-0.15, 0.15));
    const knee = root.clone().add(dir.clone().multiplyScalar(l1)).add(bend);
    const end = knee
      .clone()
      .add(dir.clone().multiplyScalar(l2 * 0.7))
      .add(V(rng.range(-0.4, 0.4), rng.range(-0.5, 0.6), rng.range(-0.1, 0.1)).multiplyScalar(l2));
    // Only the stance limbs take weight. Clear of the ground by enough that
    // the poser's reach never swings one through it.
    if (knee.y < 1.0) knee.y = 1.0 + rng.next() * 0.3;
    if (end.y < 1.0) end.y = 1.0 + rng.next() * 0.35;
    const into = end.clone().sub(knee).normalize();
    const finish = leg
      ? (b, frame) => footInto(b, frame.clone().multiply(footFrame(end, into, rng.range(0, 6.28))), r * 0.85, tone)
      : (b, frame) => handInto(b, frame.clone().multiply(handFrame(end, into)), r * 0.9, tone, false);
    limbs.push(makeLimb({ root, knee, end, r, tone, finish, stance: false }, rng, limbGroup, material));
  });

  return { group, mass, heads, limbs };
};

/**
 * The Abomination — one mass, alone on its stand.
 */
export const buildAbomination = () => {
  const root = new THREE.Group();
  const mass = makeAbomination(surfaceMaterial());
  root.add(mass.group);
  return { root, mass, count: 1 };
};

const GAITS = {
  // Never still. A heap of corpses that stopped moving would read as terrain.
  idle: { rate: 0.7, reach: 0.55, step: 0.35, heave: 0.35, roll: 0.3 },
  march: { rate: 1.5, reach: 0.85, step: 1, heave: 1, roll: 1 },
  attack: { rate: 2.3, reach: 1.4, step: 0.7, heave: 1.2, roll: 0.6 },
};

const qLift = new THREE.Quaternion();
const qSwing = new THREE.Quaternion();
const X = V(1, 0, 0);

/**
 * Pose the Abomination.
 *
 * There is no gait to get right because there is no skeleton — it hauls rather
 * than walks. Planted limbs take turns lifting and dragging the heap on; the
 * rest grope. Each runs on its own clock at its own rate, and so does every
 * jaw.
 */
export const poseAbomination = (rig, time, state = "idle") => {
  const gait = GAITS[state] ?? GAITS.idle;
  const t = time * gait.rate;
  const { mass, heads, limbs } = rig.mass;

  // The heap heaves and rolls as it drags itself along. Upward only, so it
  // never sinks into the turf.
  mass.position.y = (0.5 + 0.5 * Math.sin(t * 1.3)) * 0.07 * gait.heave;
  mass.rotation.z = Math.sin(t * 0.7) * 0.045 * gait.roll;
  mass.rotation.x = Math.sin(t * 0.9 + 1) * 0.03 * gait.heave;

  limbs.forEach(({ upper, lower, lift, stance, phase, rate }) => {
    const own = t * rate + phase;
    if (stance) {
      // Lift, reach, plant, drag. Only ever up from the planted pose, so a
      // hand never pushes through the ground.
      const step = Math.max(0, Math.sin(own * 1.2));
      qLift.setFromAxisAngle(lift, step * 0.32 * gait.step);
      qSwing.setFromAxisAngle(UP, Math.sin(own * 1.2 - 1.2) * 0.12 * gait.step);
      upper.quaternion.multiplyQuaternions(qSwing, qLift);
      lower.quaternion.setFromAxisAngle(lift, -step * 0.3 * gait.step);
    } else {
      // Grasping at nothing
      qLift.setFromAxisAngle(lift, Math.sin(own) * 0.34 * gait.reach);
      qSwing.setFromAxisAngle(UP, Math.sin(own * 0.63 + 1.1) * 0.2 * gait.reach);
      upper.quaternion.multiplyQuaternions(qSwing, qLift);
      lower.quaternion.setFromAxisAngle(lift, Math.sin(own * 1.7 + 0.4) * 0.5 * gait.reach);
    }
  });

  heads.forEach(({ head, jaw, rest, phase, gape }) => {
    qSwing.setFromAxisAngle(UP, Math.sin(time * 0.5 + phase) * 0.25);
    head.quaternion.multiplyQuaternions(qSwing, rest);
    jaw.quaternion.setFromAxisAngle(X, gape * (0.4 + 0.6 * Math.abs(Math.sin(time * 1.6 + phase))));
  });
};
