import * as THREE from "three";

// Goblin Wolf Riders, built from primitives — the same technique as
// trex3d.js, but asking a different question of it.
//
// The tyrannosaur showed that one large body made of capsules reads as a blob
// from directly overhead. A unit is not one body. Six small figures in a
// formation carry their read in the pattern they make — the spacing, the
// staggered ranks, the spears all pointing one way — and a pattern survives
// the overhead camera in a way a single silhouette does not. That is the
// thing worth finding out, and it is not answered by the monster.
//
// Six riders because the card rolls six attack dice. The count is a visual
// choice, not a rule: Battleground does not track individual models.

const WOLF_FUR = 0x7d7264;
const WOLF_FUR_DARK = 0x3f3a32;
const WOLF_MAW = 0x2a2621;
const GOBLIN_SKIN = 0x6f8f3c;
const LEATHER = 0x3d3128;
const STEEL = 0x9aa2aa;
const EYE = 0xd8b23a;

const matte = (color, roughness = 0.85) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

const MATERIALS = {
  fur: matte(WOLF_FUR),
  furDark: matte(WOLF_FUR_DARK),
  maw: matte(WOLF_MAW),
  skin: matte(GOBLIN_SKIN),
  leather: matte(LEATHER),
  steel: matte(STEEL, 0.4),
  eye: new THREE.MeshStandardMaterial({ color: EYE, roughness: 0.3, emissive: 0x2a2000 }),
};

// Geometry is shared across all six riders — six copies of one wolf costs the
// same in memory as one, and the GPU batches them the same way
const GEOMETRY = {
  body: new THREE.CapsuleGeometry(0.34, 0.95, 4, 10),
  chest: new THREE.CapsuleGeometry(0.3, 0.3, 4, 8),
  skull: new THREE.BoxGeometry(0.3, 0.26, 0.46),
  snout: new THREE.BoxGeometry(0.17, 0.15, 0.28),
  ear: new THREE.ConeGeometry(0.08, 0.18, 4),
  eye: new THREE.SphereGeometry(0.045, 8, 6),
  limb: new THREE.CapsuleGeometry(0.075, 0.3, 3, 6),
  paw: new THREE.BoxGeometry(0.14, 0.09, 0.2),
  tailSeg: new THREE.CapsuleGeometry(0.09, 0.22, 3, 6),
  torso: new THREE.CapsuleGeometry(0.17, 0.24, 4, 8),
  head: new THREE.SphereGeometry(0.16, 10, 8),
  cap: new THREE.ConeGeometry(0.17, 0.2, 7),
  arm: new THREE.CapsuleGeometry(0.055, 0.2, 3, 6),
  haft: new THREE.CylinderGeometry(0.042, 0.036, 1.75, 6),
  point: new THREE.ConeGeometry(0.085, 0.26, 5),
};

const add = (geometry, material, parent, position, rotation) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

// One wolf and the goblin on its back. Faces -Z, stands on y = 0.
const makeRider = () => {
  const group = new THREE.Group();

  // --- wolf ---------------------------------------------------------------
  const spine = new THREE.Group();
  spine.position.y = 0.62;
  group.add(spine);

  const body = add(GEOMETRY.body, MATERIALS.fur, spine, [0, 0, 0.05]);
  body.rotation.x = Math.PI / 2;
  add(GEOMETRY.chest, MATERIALS.furDark, spine, [0, -0.04, -0.4], [Math.PI / 2, 0, 0]);

  const neck = new THREE.Group();
  neck.position.set(0, 0.02, -0.62);
  spine.add(neck);
  add(GEOMETRY.skull, MATERIALS.fur, neck, [0, 0, -0.16]);
  add(GEOMETRY.snout, MATERIALS.maw, neck, [0, -0.05, -0.48]);
  add(GEOMETRY.ear, MATERIALS.furDark, neck, [0.11, 0.17, -0.06]);
  add(GEOMETRY.ear, MATERIALS.furDark, neck, [-0.11, 0.17, -0.06]);
  add(GEOMETRY.eye, MATERIALS.eye, neck, [0.11, 0.06, -0.34]);
  add(GEOMETRY.eye, MATERIALS.eye, neck, [-0.11, 0.06, -0.34]);

  // Four legs, corners of the body. Each is a hip group with a shin under it,
  // so a trot is two rotations rather than a translation.
  const legs = [];
  [
    [0.24, -0.42, "front"],
    [-0.24, -0.42, "front"],
    [0.26, 0.42, "rear"],
    [-0.26, 0.42, "rear"],
  ].forEach(([x, z, kind]) => {
    const hip = new THREE.Group();
    hip.position.set(x, -0.12, z);
    spine.add(hip);
    add(GEOMETRY.limb, MATERIALS.fur, hip, [0, -0.18, 0]);
    const shin = new THREE.Group();
    shin.position.y = -0.34;
    hip.add(shin);
    add(GEOMETRY.limb, MATERIALS.furDark, shin, [0, -0.13, 0]);
    add(GEOMETRY.paw, MATERIALS.furDark, shin, [0, -0.28, -0.02]);
    legs.push({ hip, shin, kind });
  });

  // Tail, two segments so it can flick rather than swing rigidly
  const tail = [];
  let attach = spine;
  for (let i = 0; i < 2; i += 1) {
    const seg = new THREE.Group();
    seg.position.set(0, i === 0 ? 0.06 : 0, i === 0 ? 0.62 : 0.24);
    attach.add(seg);
    add(GEOMETRY.tailSeg, MATERIALS.furDark, seg, [0, 0, 0.12], [Math.PI / 2.2, 0, 0]);
    tail.push(seg);
    attach = seg;
  }

  // --- goblin -------------------------------------------------------------
  const rider = new THREE.Group();
  rider.position.set(0, 0.34, -0.12);
  spine.add(rider);
  add(GEOMETRY.torso, MATERIALS.leather, rider, [0, 0, 0]);
  add(GEOMETRY.head, MATERIALS.skin, rider, [0, 0.3, -0.03]);
  add(GEOMETRY.cap, MATERIALS.leather, rider, [0, 0.42, -0.03]);
  add(GEOMETRY.arm, MATERIALS.skin, rider, [0.19, 0.06, -0.06], [0, 0, -0.7]);
  add(GEOMETRY.arm, MATERIALS.skin, rider, [-0.19, 0.06, -0.06], [0, 0, 0.7]);

  // The spear is what makes a formation read from above: six of them pointing
  // the same way is a stronger cue than any single figure
  const spear = new THREE.Group();
  spear.position.set(0.22, 0.12, -0.1);
  rider.add(spear);
  add(GEOMETRY.haft, MATERIALS.leather, spear, [0, 0, 0], [Math.PI / 2, 0, 0]);
  add(GEOMETRY.point, MATERIALS.steel, spear, [0, 0, -0.95], [-Math.PI / 2, 0, 0]);

  return { group, spine, neck, legs, tail, rider, spear };
};

/**
 * Six riders in two staggered ranks, the way the card's art arranges them.
 * Each carries its own phase so the formation moves together without moving
 * as one animal.
 */
export const buildWolfRiders = ({ files = 3, ranks = 2 } = {}) => {
  const root = new THREE.Group();
  const riders = [];

  const spanX = 6.4;
  const stepX = spanX / files;
  const stepZ = 2.6;

  for (let rank = 0; rank < ranks; rank += 1) {
    for (let file = 0; file < files; file += 1) {
      const rider = makeRider();
      // The rear rank steps half a file across, closing the gaps in the front
      const stagger = rank % 2 === 1 ? stepX / 2 : 0;
      rider.group.position.set(
        -spanX / 2 + stepX / 2 + file * stepX + stagger,
        0,
        -1.3 + rank * stepZ
      );
      // A hand's width of drift so the ranks are not machined
      rider.group.rotation.y = (((file * 7 + rank * 13) % 5) - 2) * 0.035;
      rider.phase = (file * 1.9 + rank * 2.7) % (Math.PI * 2);
      root.add(rider.group);
      riders.push(rider);
    }
  }

  return { root, riders };
};

const GAITS = {
  // Standing, shifting weight, heads turning, tails moving
  idle: { rate: 1.6, stride: 0.12, bob: 0.35, lean: 0, spear: 0.0, spread: 0 },
  // A working trot
  march: { rate: 5.2, stride: 1, bob: 1, lean: 0.06, spear: 0.15, spread: 0 },
  // Charging: bodies stretched forward, spears levelled, ranks opening out
  attack: { rate: 7.6, stride: 1.25, bob: 1.5, lean: 0.2, spear: 1, spread: 0.5 },
};

/**
 * Pose the whole formation for a moment in time.
 *
 * A wolf trots on diagonal pairs — front-left with rear-right — which is what
 * separates it from the tyrannosaur's two-legged stride and is the only part
 * of this that had to be got right for it to look like an animal at all.
 */
export const poseWolfRiders = (rig, time, state = "idle") => {
  const gait = GAITS[state] ?? GAITS.idle;

  rig.riders.forEach((mount) => {
    const t = time * gait.rate + mount.phase;

    mount.legs.forEach(({ hip, shin, kind }, index) => {
      // Diagonal pairs: legs 0 (front-right) and 3 (rear-left) swing
      // together, 1 and 2 together
      const diagonal = index === 0 || index === 3 ? 0 : Math.PI;
      const swing = t + diagonal;
      hip.rotation.x = Math.sin(swing) * 0.7 * gait.stride;
      // The shin trails the hip and only folds on the recovery stroke
      shin.rotation.x = Math.max(-Math.sin(swing - 0.8), 0) * 0.9 * gait.stride;
      // Front legs reach a little further than the rear push
      if (kind === "front") hip.rotation.x *= 1.15;
    });

    // The body rises twice per stride cycle and pitches into the run
    mount.spine.position.y = 0.62 + Math.sin(t * 2) * 0.055 * gait.bob;
    mount.spine.rotation.x = -gait.lean + Math.sin(t * 2 + 0.6) * 0.04 * gait.bob;

    // Head steadies against the body's bob, the way a running animal's does
    mount.neck.rotation.x = gait.lean * 0.8 - Math.sin(t * 2 + 0.6) * 0.05 * gait.bob;
    mount.neck.rotation.y = Math.sin(time * 0.7 + mount.phase) * 0.22;

    mount.tail.forEach((seg, i) => {
      seg.rotation.y = Math.sin(t * 0.8 - i * 0.7) * 0.3;
      seg.rotation.x = 0.2 + Math.sin(t - i * 0.5) * 0.12;
    });

    // The rider absorbs the bob rather than riding it rigidly
    mount.rider.rotation.x = gait.lean * 1.4 + Math.sin(t * 2 + 1.1) * 0.07 * gait.bob;
    mount.rider.position.y = 0.34 - Math.sin(t * 2) * 0.02 * gait.bob;

    // Spears ride upright at rest and come down level for the charge
    // Shouldered at rest, levelled for the charge — and never so upright
    // that the overhead camera loses it
    mount.spear.rotation.x =
      -0.5 + gait.spear * 0.5 + Math.sin(t + mount.phase) * 0.05;
  });

  // Charging, the formation opens out; at rest it closes back up
  rig.root.scale.x = 1 + gait.spread * 0.12;
};
