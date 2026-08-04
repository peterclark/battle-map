import * as THREE from "three";

// The big ones that are not beasts: Trolls, Ogres, the Hill Giant, the
// Abomination, the Earth Elemental, and the undead versions of all of them.
//
// These sit awkwardly between the two problems this board has already solved.
// A rank of twenty makes its own pattern; a Triceratops has a frill. A troll
// has neither — it is one lump of roughly man-shaped meat, which is the exact
// silhouette that failed the very first test back when the Tyrannosaurus was
// built out of capsules.
//
// Three things rescue it, and all three are about width:
//
//   Hunch them. A brute carried upright is a head and two shoulders from
//   above. Bent forward it is a whole back, and the back is the biggest
//   surface it owns.
//   Hang the arms wide. Long arms held away from the body double the
//   silhouette and are unmistakably not a man's proportions.
//   Put something pale across the shoulders — hide, bone, moss, a slab of
//   stone. Whatever it is thematically, its job is to be the bright thing on
//   the widest part.
//
// Three or four to a stand, never one. Even at this size the count carries
// more than the modelling does.

const matte = (color, roughness = 0.9) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

const KINDS = {
  troll: {
    hide: 0x5c6b4a,
    hideDark: 0x3f4a33,
    back: 0x9aa87c,
    detail: 0xd8cfb4,
    scale: 1,
    count: 3,
    hunch: 0.62,
    club: true,
  },
  ogre: {
    hide: 0x8a6a4c,
    hideDark: 0x634a35,
    back: 0xc2a882,
    detail: 0xe4d9bd,
    scale: 0.94,
    count: 3,
    hunch: 0.5,
    club: true,
  },
  giant: {
    // One of him, and correspondingly huge. The exception that proves the
    // rule about counts: a Hill Giant that came three to a stand would not
    // be a giant.
    hide: 0x7d6a52,
    hideDark: 0x54473a,
    back: 0xbfae8e,
    detail: 0xe8dcc0,
    scale: 1.7,
    count: 1,
    hunch: 0.45,
    club: true,
  },
  boneBrute: {
    // Skeleton and Zombie Trolls. Bone against dark turf carries itself.
    hide: 0xb8b09a,
    hideDark: 0x847d6b,
    back: 0xd8d0b8,
    detail: 0xeee6d0,
    scale: 1,
    count: 3,
    hunch: 0.66,
    club: true,
  },
  elemental: {
    // Stone rather than meat: blockier, paler on top where the light hits
    // the slabs, and it moves like weather rather than like an animal.
    hide: 0x6b6a63,
    hideDark: 0x4a4943,
    back: 0x9c9a8c,
    detail: 0xc6c2b0,
    scale: 1.2,
    count: 2,
    hunch: 0.35,
    club: false,
  },
};

const GEOMETRY = {
  torso: new THREE.CapsuleGeometry(0.42, 0.5, 5, 10),
  // The slab across the shoulders: the widest, brightest thing on the figure
  back: new THREE.BoxGeometry(1.02, 0.16, 0.62),
  shoulder: new THREE.SphereGeometry(0.28, 9, 7),
  head: new THREE.SphereGeometry(0.24, 10, 8),
  jaw: new THREE.BoxGeometry(0.26, 0.12, 0.24),
  tusk: new THREE.ConeGeometry(0.05, 0.18, 4),
  upperArm: new THREE.CapsuleGeometry(0.15, 0.42, 4, 7),
  foreArm: new THREE.CapsuleGeometry(0.13, 0.4, 4, 7),
  fist: new THREE.SphereGeometry(0.2, 8, 6),
  thigh: new THREE.CapsuleGeometry(0.18, 0.3, 4, 7),
  shin: new THREE.CapsuleGeometry(0.15, 0.28, 4, 7),
  foot: new THREE.BoxGeometry(0.34, 0.14, 0.46),
  club: new THREE.CylinderGeometry(0.09, 0.14, 1.15, 6),

  // The Abomination is built from these rather than from the brute skeleton
  lump: new THREE.SphereGeometry(0.62, 11, 9),
  limbUpper: new THREE.CapsuleGeometry(0.1, 0.34, 4, 6),
  limbLower: new THREE.CapsuleGeometry(0.085, 0.32, 4, 6),
  hand: new THREE.SphereGeometry(0.12, 7, 6),
  spareHead: new THREE.SphereGeometry(0.17, 9, 7),
};

const add = (geometry, material, parent, position, rotation, scale) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  if (scale) mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

// One brute, facing -Z, standing on y = 0.
const makeBrute = (spec, m) => {
  const group = new THREE.Group();

  const hips = new THREE.Group();
  hips.position.y = 1.05;
  group.add(hips);

  // Hunched hard forward. This is the whole difference between a brute and a
  // very large man from directly above.
  const spine = new THREE.Group();
  spine.rotation.x = spec.hunch;
  hips.add(spine);

  add(GEOMETRY.torso, m.hide, spine, [0, 0.1, 0], [Math.PI / 2.4, 0, 0]);
  add(GEOMETRY.back, m.back, spine, [0, 0.36, 0.04], [0.24, 0, 0]);
  add(GEOMETRY.shoulder, m.hideDark, spine, [0.42, 0.3, -0.14]);
  add(GEOMETRY.shoulder, m.hideDark, spine, [-0.42, 0.3, -0.14]);

  const head = new THREE.Group();
  head.position.set(0, 0.3, -0.46);
  spine.add(head);
  add(GEOMETRY.head, m.hide, head, [0, 0, 0]);
  add(GEOMETRY.jaw, m.hideDark, head, [0, -0.16, -0.1]);
  add(GEOMETRY.tusk, m.detail, head, [0.1, -0.12, -0.18], [-2.6, 0, 0.2]);
  add(GEOMETRY.tusk, m.detail, head, [-0.1, -0.12, -0.18], [-2.6, 0, -0.2]);

  // Arms hung wide and long. Half the silhouette from above is here.
  const arms = [1, -1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.46, 0.22, -0.06);
    spine.add(shoulder);
    shoulder.rotation.z = side * 0.42;
    add(GEOMETRY.upperArm, m.hide, shoulder, [0, -0.3, 0]);
    const forearm = new THREE.Group();
    forearm.position.y = -0.6;
    shoulder.add(forearm);
    forearm.rotation.x = -0.5;
    add(GEOMETRY.foreArm, m.hide, forearm, [0, -0.26, 0]);
    add(GEOMETRY.fist, m.hideDark, forearm, [0, -0.5, 0]);

    let club = null;
    if (spec.club && side > 0) {
      club = new THREE.Group();
      club.position.set(0, -0.5, 0);
      forearm.add(club);
      // Laid back over the shoulder, like every other weapon on this board,
      // and for the same reason
      add(GEOMETRY.club, m.hideDark, club, [0, 0.4, 0.1], [0.9, 0, 0]);
    }
    return { shoulder, forearm, club, side };
  });

  const legs = [1, -1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.24, -0.08, 0);
    hips.add(hip);
    add(GEOMETRY.thigh, m.hide, hip, [0, -0.24, 0.02]);
    const shin = new THREE.Group();
    shin.position.y = -0.46;
    hip.add(shin);
    shin.rotation.x = -0.3;
    add(GEOMETRY.shin, m.hide, shin, [0, -0.22, 0]);
    const foot = new THREE.Group();
    foot.position.y = -0.44;
    shin.add(foot);
    add(GEOMETRY.foot, m.hideDark, foot, [0, -0.05, -0.1]);
    return { hip, shin, foot, side };
  });

  return { group, hips, spine, head, arms, legs };
};

// The Abomination: not a body but a heap of them.
//
// Everything else on this board is built outward from a spine, and this is
// the one unit where that would be wrong. It is a mass of the dead rolled
// together — heads, arms and legs still attached to whatever they were torn
// from — hauling itself along on whichever limbs happen to reach the ground.
//
// That turns out to suit the overhead camera better than a body does. Limbs
// radiating from a central lump break the outline in every direction at once,
// which is a silhouette nothing else in the game makes: not a formation, not
// a beast, not a man. Pale dead flesh against a dark rotten core carries the
// contrast, and the limbs are what moves — a slow, aimless grasping that
// reads as wrong from right across the table.
const ABOMINATION = {
  core: 0x4a3f3a,
  coreDark: 0x322a27,
  flesh: 0xb9a894,
  fleshDark: 0x8a7a68,
};

const makeAbomination = (m) => {
  const group = new THREE.Group();

  const mass = new THREE.Group();
  mass.position.y = 0.72;
  group.add(mass);

  // The heap: overlapping lumps, deliberately lopsided. A symmetrical blob
  // would read as a boulder.
  //
  // It is also spread far wider than it is deep, which is both what a mass
  // dragging itself along would do and what the stand demands — a rig built
  // square fits the shallow axis and then wastes two thirds of the width it
  // was given. The first pass was 1.74 by 1.58 and came out a third too
  // small.
  const lumps = [
    [0, 0, 0, 1],
    [0.78, -0.1, 0.12, 0.82],
    [-0.72, -0.06, -0.14, 0.76],
    [0.24, 0.22, -0.24, 0.66],
    [-0.3, -0.18, 0.28, 0.7],
    [1.18, -0.16, -0.06, 0.6],
    [-1.12, -0.14, 0.08, 0.62],
  ].map(([x, y, z, r], i) =>
    add(GEOMETRY.lump, i % 2 ? m.core : m.coreDark, mass, [x, y, z], null, [
      r,
      r * 0.82,
      r,
    ])
  );

  // Limbs, all round the mass and pointing every way. Some reach the ground
  // and take weight; the rest paw at the air.
  const limbs = [];
  const COUNT = 14;
  for (let i = 0; i < COUNT; i += 1) {
    // Spread by golden angle so no two sit in a line, without random
    const a = i * 2.399;
    const out = 0.42 + (i % 3) * 0.12;
    const socket = new THREE.Group();
    // Flattened: limbs reach out along the front of the stand far more than
    // they reach back through it
    socket.position.set(
      Math.cos(a) * out * 2.1,
      -0.12 + ((i * 7) % 5) * 0.14,
      Math.sin(a) * out * 0.72
    );
    socket.rotation.y = -a + Math.PI / 2;
    // Lower limbs splay down and out to carry it; upper ones reach
    const down = i % 3 === 0;
    socket.rotation.x = down ? 1.1 : 0.15 + (i % 4) * 0.12;
    mass.add(socket);

    add(GEOMETRY.limbUpper, m.flesh, socket, [0, 0, -0.26], [Math.PI / 2, 0, 0]);
    const joint = new THREE.Group();
    joint.position.z = -0.52;
    socket.add(joint);
    joint.rotation.x = down ? 0.5 : -0.4;
    add(GEOMETRY.limbLower, m.fleshDark, joint, [0, 0, -0.24], [Math.PI / 2, 0, 0]);
    add(GEOMETRY.hand, m.flesh, joint, [0, 0, -0.46]);

    limbs.push({ socket, joint, down, phase: i * 1.31 });
  }

  // Faces in the heap, looking outward
  const heads = [];
  for (let i = 0; i < 7; i += 1) {
    const a = i * 1.257 + 0.4;
    const head = new THREE.Group();
    head.position.set(
      Math.cos(a) * 0.95,
      0.24 + ((i * 3) % 4) * 0.1,
      Math.sin(a) * 0.34
    );
    mass.add(head);
    add(GEOMETRY.spareHead, m.flesh, head, [0, 0, 0], null, [1, 0.94, 1]);
    heads.push({ head, phase: i * 2.03 });
  }

  return { group, mass, lumps, limbs, heads };
};

/**
 * The Abomination — one mass, alone on its stand.
 */
export const buildAbomination = () => {
  const m = {
    core: matte(ABOMINATION.core),
    coreDark: matte(ABOMINATION.coreDark),
    flesh: matte(ABOMINATION.flesh, 0.8),
    fleshDark: matte(ABOMINATION.fleshDark, 0.85),
  };
  const root = new THREE.Group();
  const mass = makeAbomination(m);
  root.add(mass.group);
  return { root, mass, count: 1 };
};

const ABOM_GAITS = {
  // Never still. A heap of corpses that stopped moving would read as terrain.
  idle: { rate: 0.9, reach: 0.5, heave: 0.25, roll: 0 },
  march: { rate: 1.8, reach: 1, heave: 1, roll: 1 },
  attack: { rate: 2.6, reach: 1.6, heave: 1.3, roll: 0.6 },
};

/**
 * Pose the Abomination.
 *
 * There is no gait to get right because there is no skeleton — it hauls
 * rather than walks. The limbs move out of phase with each other on purpose:
 * anything synchronised would imply a single animal underneath, and the whole
 * point is that there is not one.
 */
export const poseAbomination = (rig, time, state = "idle") => {
  const gait = ABOM_GAITS[state] ?? ABOM_GAITS.idle;
  const t = time * gait.rate;
  const { mass, limbs, heads } = rig.mass;

  // The heap heaves and slumps, and rolls slightly as it drags itself on
  mass.position.y = 0.72 + Math.sin(t * 1.3) * 0.06 * gait.heave;
  mass.rotation.z = Math.sin(t * 0.7) * 0.09 * gait.roll;
  mass.rotation.x = Math.sin(t * 0.9 + 1) * 0.05 * gait.heave;

  limbs.forEach(({ socket, joint, down, phase }) => {
    const own = t + phase;
    if (down) {
      // Weight-bearing: pushes back, lifts, reaches forward again
      socket.rotation.x = 1.1 + Math.sin(own * 1.4) * 0.3 * gait.heave;
      joint.rotation.x = 0.5 + Math.max(Math.sin(own * 1.4 - 0.8), 0) * 0.5;
    } else {
      // Grasping at nothing
      socket.rotation.x = 0.15 + Math.sin(own) * 0.45 * gait.reach;
      socket.rotation.z = Math.sin(own * 0.6 + 1.2) * 0.4 * gait.reach;
      joint.rotation.x = -0.4 + Math.sin(own * 1.7) * 0.55 * gait.reach;
    }
  });

  heads.forEach(({ head, phase }) => {
    head.rotation.y = Math.sin(time * 0.6 + phase) * 0.5;
    head.rotation.x = Math.sin(time * 0.45 + phase * 1.3) * 0.25;
  });
};

/**
 * A knot of brutes. Loose, never dressed — these are not soldiers.
 */
export const buildBrutes = ({ kind = "troll" } = {}) => {
  const spec = KINDS[kind] ?? KINDS.troll;
  const m = {
    hide: matte(spec.hide),
    hideDark: matte(spec.hideDark),
    back: matte(spec.back, 0.95),
    detail: matte(spec.detail, 0.6),
  };

  const root = new THREE.Group();
  const brutes = [];

  for (let i = 0; i < spec.count; i += 1) {
    const brute = makeBrute(spec, m);
    const across = spec.count === 1 ? 0 : (i / (spec.count - 1) - 0.5) * 2.3;
    brute.group.position.set(across, 0, ((i % 2) - 0.5) * 0.7);
    brute.group.rotation.y = (((i * 7) % 5) - 2) * 0.11;
    brute.group.scale.setScalar(spec.scale * (1 - (i % 3) * 0.04));
    brute.phase = i * 2.1;
    root.add(brute.group);
    brutes.push(brute);
  }

  return { root, brutes, spec, kind, count: brutes.length };
};

const GAITS = {
  // Standing: shoulders rolling, head swinging. Something this heavy is never
  // quite still, and a brute that froze would read as a bug.
  idle: { rate: 1.1, stride: 0.14, sway: 1, hunch: 0, swing: 0, strike: 0 },
  // A heavy, unhurried walk. Slower than infantry — mass reads as slowness.
  march: { rate: 2.2, stride: 1, sway: 0.8, hunch: 0.06, swing: 0.5, strike: 0 },
  // Laying about itself
  attack: { rate: 2.8, stride: 0.45, sway: 1.5, hunch: 0.16, swing: 1, strike: 1 },
};

/**
 * Pose a knot of brutes.
 *
 * The arms do the work here rather than the legs. They are the widest part of
 * the figure, they are what an overhead camera actually sees moving, and a
 * brute swinging its arms reads as alive at sizes where a leg cycle is two
 * pixels of nothing.
 */
export const poseBrutes = (rig, time, state = "idle") => {
  const gait = GAITS[state] ?? GAITS.idle;
  const hunch = rig.spec.hunch;

  rig.brutes.forEach((brute) => {
    const t = time * gait.rate + brute.phase;

    brute.legs.forEach(({ hip, shin, side }) => {
      const swing = t + (side > 0 ? 0 : Math.PI);
      hip.rotation.x = Math.sin(swing) * 0.42 * gait.stride;
      shin.rotation.x = -0.3 - Math.max(-Math.sin(swing - 0.7), 0) * 0.45 * gait.stride;
    });

    brute.hips.position.y = 1.05 + Math.abs(Math.sin(t)) * 0.05 * gait.stride;
    brute.hips.rotation.z = Math.sin(t) * 0.05 * gait.sway;
    brute.spine.rotation.x = hunch + gait.hunch;

    const strike = gait.strike
      ? Math.max(Math.sin(time * 3.1 + brute.phase * 2), 0) ** 2
      : 0;

    brute.arms.forEach(({ shoulder, forearm, side }) => {
      const own = t + (side > 0 ? Math.PI : 0);
      shoulder.rotation.x = Math.sin(own) * 0.4 * (gait.stride + gait.swing) - strike * 1.1;
      shoulder.rotation.z = side * (0.42 + Math.sin(own * 0.6) * 0.1 * gait.sway);
      forearm.rotation.x = -0.5 - strike * 0.5;
    });

    brute.head.rotation.y = Math.sin(time * 0.5 + brute.phase) * 0.3;
    brute.head.rotation.x = -hunch * 0.5 - gait.hunch;
  });
};
