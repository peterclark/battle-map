import * as THREE from "three";
import { matte, metal } from "./materials.js";

// Lizardfolk — the three peoples of the Lizardmen list, built from one rig
// with the proportions dialled per breed.
//
// The whole design is answering one question: what says *reptile* to a camera
// hanging directly overhead? Not scales, which are below the resolution of a
// stand. Not a snout, which is four pixels. Two things carry it:
//
//   The dorsal ridge. A pale bone-coloured strip running the length of the
//   spine, against a body that is deliberately cooler and darker than the
//   turf. From above it is the brightest thing on the figure and it traces
//   the animal's whole length.
//
//   The tail. A man has no tail, so a shape with one is not a man. It also
//   happens to be the part that moves most legibly from overhead — a tail
//   swinging counter to the stride sweeps across the stand, where a leg
//   cycle mostly hides under the body that owns it.
//
// Everything else is in service of those two.

// Cool bodies against warm turf. The field is roughly 0x3d6421 — a dark
// yellow-green — so the breeds separate from it by hue as well as by value,
// and the bone furniture carries the contrast on its own.
const BREEDS = {
  swarmling: {
    // Small, lean, low, and many. The tail is proportionally the longest of
    // the three, which is most of what makes them read at this size.
    scale: 0.78,
    body: 0x6b4f2c,
    ridge: 0xe6d9b4,
    limb: 0x513a22,
    lean: 0.85,
    tail: 1.25,
    files: 6,
    ranks: 4,
    shield: false,
    armed: true,
  },
  trog: {
    // Squat and broad. Toad-like in mass, still reptilian in outline.
    scale: 0.95,
    body: 0x2f4d59,
    ridge: 0xd8cba4,
    limb: 0x243c46,
    lean: 0.7,
    tail: 0.9,
    files: 5,
    ranks: 4,
    shield: true,
    armed: true,
  },
  tyrant: {
    // Tall, upright, the most humanoid of the three, and the proudest crest.
    // Fewer to a stand, and they should look like it.
    scale: 1.18,
    body: 0x1f4247,
    ridge: 0xefe3c2,
    limb: 0x173236,
    lean: 0.4,
    tail: 0.95,
    files: 4,
    ranks: 3,
    shield: true,
    armed: true,
  },

  // The beasts. Same skeleton, no weapons, spine carried near horizontal,
  // and scattered rather than dressed — a pack is not a formation, and the
  // difference should be visible from across the table.
  hatchling: {
    scale: 0.6,
    body: 0x55632a,
    ridge: 0xdfe0b0,
    limb: 0x3f4a1e,
    lean: 1.15,
    tail: 1.45,
    files: 6,
    ranks: 4,
    shield: false,
    armed: false,
    loose: 0.3,
  },
  raptor: {
    scale: 1.0,
    body: 0x4e3821,
    ridge: 0xe4cf9c,
    limb: 0x382614,
    lean: 1.25,
    tail: 1.6,
    files: 4,
    ranks: 3,
    shield: false,
    armed: false,
    loose: 0.34,
  },
};

const BONE = 0xe8dcc0;
const STEEL = 0x9aa2aa;
const HAFT = 0x3a2f24;
const SHIELD_FACE = 0xb9a377;

// One set of geometry, shared by every figure on every stand. Twenty
// lizardfolk cost one lizardfolk's worth of buffers; only transforms differ.
const GEOMETRY = {
  body: new THREE.CapsuleGeometry(0.2, 0.34, 8, 16),
  ridge: new THREE.BoxGeometry(0.09, 0.05, 0.62),
  spine: new THREE.ConeGeometry(0.05, 0.16, 14),
  head: new THREE.ConeGeometry(0.14, 0.36, 14),
  brow: new THREE.BoxGeometry(0.17, 0.04, 0.1),
  tailA: new THREE.CylinderGeometry(0.085, 0.055, 0.34, 18),
  tailB: new THREE.CylinderGeometry(0.055, 0.015, 0.36, 18),
  thigh: new THREE.CapsuleGeometry(0.062, 0.16, 8, 16),
  shin: new THREE.CapsuleGeometry(0.048, 0.16, 8, 16),
  foot: new THREE.BoxGeometry(0.11, 0.05, 0.19),
  arm: new THREE.CapsuleGeometry(0.048, 0.18, 8, 16),
  haft: new THREE.CylinderGeometry(0.028, 0.024, 0.86, 18),
  blade: new THREE.ConeGeometry(0.07, 0.26, 14),
  shield: new THREE.CylinderGeometry(0.2, 0.2, 0.04, 18),
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

// One lizardfolk, facing -Z, standing on y = 0.
const makeLizard = (breed, materials) => {
  const group = new THREE.Group();

  // The hips carry the whole animal. A reptile's spine runs closer to
  // horizontal than a man's, so the body hangs forward off this joint and
  // the tail hangs back off it — which is exactly the outline we want from
  // above.
  const hips = new THREE.Group();
  hips.position.y = 0.46;
  group.add(hips);

  const spine = new THREE.Group();
  spine.rotation.x = breed.lean * 0.55;
  hips.add(spine);

  add(GEOMETRY.body, materials.body, spine, [0, 0.04, -0.06], [Math.PI / 2, 0, 0]);

  // The dorsal ridge: the brightest thing on the figure, running its length.
  // This is the read from directly overhead and everything else is detail.
  add(GEOMETRY.ridge, materials.ridge, spine, [0, 0.2, -0.06]);
  [-0.16, 0.02, 0.2].forEach((z, i) => {
    add(
      GEOMETRY.spine,
      materials.ridge,
      spine,
      [0, 0.23, z],
      // Raked backward so each spine presents its length to the camera
      // rather than its point
      [0.7 + i * 0.05, 0, 0]
    );
  });

  const head = new THREE.Group();
  head.position.set(0, 0.12, -0.36);
  spine.add(head);
  // A wedge laid along -Z: a snout, not a ball
  add(GEOMETRY.head, materials.body, head, [0, 0, -0.08], [-Math.PI / 2, 0, 0]);
  add(GEOMETRY.brow, materials.ridge, head, [0, 0.08, 0.02]);

  // Tail: two tapering segments, hinged, so it can swing as one curve
  const tailRoot = new THREE.Group();
  tailRoot.position.set(0, 0.06, 0.16);
  hips.add(tailRoot);
  add(GEOMETRY.tailA, materials.body, tailRoot, [0, 0, 0.16 * breed.tail], [
    Math.PI / 2,
    0,
    0,
  ]);
  const tailTip = new THREE.Group();
  tailTip.position.z = 0.32 * breed.tail;
  tailRoot.add(tailTip);
  add(GEOMETRY.tailB, materials.body, tailTip, [0, -0.02, 0.17 * breed.tail], [
    Math.PI / 2.15,
    0,
    0,
  ]);
  tailRoot.scale.z = breed.tail;

  // Digitigrade legs, splayed wider than a man's — the stance is half the
  // silhouette from above
  const legs = [1, -1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.14, -0.04, 0);
    hips.add(hip);
    add(GEOMETRY.thigh, materials.limb, hip, [0, -0.1, 0.02]);
    const shin = new THREE.Group();
    shin.position.y = -0.2;
    hip.add(shin);
    shin.rotation.x = -0.5;
    add(GEOMETRY.shin, materials.limb, shin, [0, -0.09, 0]);
    const foot = new THREE.Group();
    foot.position.y = -0.19;
    shin.add(foot);
    add(GEOMETRY.foot, materials.limb, foot, [0, -0.02, -0.04]);
    return { hip, shin, foot, side };
  });

  // Forelimbs. On the armed breeds the right one carries a blade, shouldered
  // — a vertical haft is a dot from overhead, and this project has learned
  // that the hard way twice. The beasts just have claws.
  const armR = new THREE.Group();
  armR.position.set(0.19, 0.06, -0.06);
  spine.add(armR);
  add(GEOMETRY.arm, materials.limb, armR, [0, -0.09, 0]);

  let weapon = null;
  if (breed.armed) {
    weapon = new THREE.Group();
    weapon.position.set(0.02, -0.1, 0);
    armR.add(weapon);
    add(GEOMETRY.haft, materials.haft, weapon, [0, 0.3, 0]);
    add(GEOMETRY.blade, materials.steel, weapon, [0, 0.72, 0]);
  }

  const armL = new THREE.Group();
  armL.position.set(-0.19, 0.06, -0.06);
  spine.add(armL);
  add(GEOMETRY.arm, materials.limb, armL, [0, -0.09, 0]);

  let shield = null;
  if (breed.shield) {
    shield = new THREE.Group();
    shield.position.set(-0.06, -0.12, -0.08);
    armL.add(shield);
    // Canted to present its face upward as well as forward — the broadest
    // pale surface the figure has
    add(GEOMETRY.shield, materials.shield, shield, [0, 0, 0], [Math.PI / 2.5, 0, 0.1]);
  }

  return { group, hips, spine, head, tailRoot, tailTip, legs, weapon, shield };
};

/**
 * A stand of lizardfolk.
 *
 * `breed` is one of swarmling / trog / tyrant. The three differ in size,
 * colour, how far forward they carry the spine, and how many crowd onto a
 * stand — Swarmlings come in a press, Tyrants in a thin proud line.
 */
export const buildLizardfolk = ({ breed = "trog" } = {}) => {
  const spec = BREEDS[breed] ?? BREEDS.trog;
  const materials = {
    body: matte(spec.body),
    ridge: matte(spec.ridge, 0.7),
    limb: matte(spec.limb),
    steel: metal(STEEL, 0.32),
    haft: matte(HAFT),
    shield: matte(SHIELD_FACE, 0.7),
    bone: matte(BONE, 0.7),
  };

  const root = new THREE.Group();
  const lizards = [];

  const stepX = 1.02 * spec.scale;
  const stepZ = 1.0 * spec.scale;

  for (let rank = 0; rank < spec.ranks; rank += 1) {
    for (let file = 0; file < spec.files; file += 1) {
      const lizard = makeLizard(spec, materials);
      // Alternate ranks step half a file across, closing the gaps in front
      const stagger = rank % 2 === 1 ? stepX / 2 : 0;
      lizard.group.position.set(
        -((spec.files - 1) * stepX) / 2 + file * stepX + stagger - stagger / 2,
        0,
        -((spec.ranks - 1) * stepZ) / 2 + rank * stepZ
      );
      lizard.group.scale.setScalar(spec.scale);
      // Stable jitter so the stand is animals rather than a lattice. Hashed
      // from position, never random — a random offset would shimmer.
      const jitter = ((file * 13 + rank * 5) % 7) - 3;
      const drift = ((file * 7 + rank * 11) % 9) - 4;
      // A pack scatters; a regiment dresses its ranks. `loose` is the whole
      // difference, and it is visible from across the table.
      const spread = spec.loose ?? 0;
      lizard.group.rotation.y = jitter * (spread ? 0.34 : 0.045);
      lizard.group.position.x += jitter * (0.02 + spread * 0.09);
      lizard.group.position.z += drift * spread * 0.08;
      lizard.phase = (file * 1.7 + rank * 2.3) % (Math.PI * 2);
      root.add(lizard.group);
      lizards.push(lizard);
    }
  }

  return { root, lizards, spec, count: lizards.length };
};

const GAITS = {
  // At the halt: weight shifting, heads casting about, tails idling
  idle: { rate: 1.6, stride: 0.12, bob: 0.3, tail: 0.5, crouch: 0, weapon: 0, strike: 0 },
  // Loping forward. Reptiles carry the spine lower as they move.
  march: { rate: 3.4, stride: 1, bob: 1, tail: 1, crouch: 0.1, weapon: 0.2, strike: 0 },
  // Fighting: down into a crouch, tails lashing, blades working
  attack: { rate: 5, stride: 0.4, bob: 1.1, tail: 1.6, crouch: 0.24, weapon: 0.55, strike: 1 },
};

/**
 * Pose a stand of lizardfolk.
 *
 * The tail does the heavy lifting. It swings counter to the stride, which is
 * both how a real tail counterbalances a gait and — more to the point — the
 * one motion on the animal that a camera directly overhead can actually see.
 */
export const poseLizardfolk = (rig, time, state = "idle") => {
  const gait = GAITS[state] ?? GAITS.idle;

  rig.lizards.forEach((lizard) => {
    const t = time * gait.rate + lizard.phase;

    lizard.legs.forEach(({ hip, shin, side }) => {
      const swing = t + (side > 0 ? 0 : Math.PI);
      hip.rotation.x = Math.sin(swing) * 0.5 * gait.stride;
      shin.rotation.x = -0.5 - Math.max(-Math.sin(swing - 0.7), 0) * 0.6 * gait.stride;
    });

    lizard.hips.position.y = 0.46 - gait.crouch + Math.abs(Math.sin(t)) * 0.04 * gait.bob;
    // Lower the spine as the animal drives forward or drops into a fight
    lizard.spine.rotation.x = rig.spec.lean * 0.55 + gait.crouch * 0.9;

    // Counter-swing: the tail goes the way the legs are not
    const sway = Math.sin(t) * 0.4 * gait.tail;
    lizard.tailRoot.rotation.y = -sway;
    lizard.tailTip.rotation.y = -sway * 0.8;
    lizard.tailRoot.rotation.x = -0.12 + Math.sin(t * 0.7) * 0.06 * gait.tail;

    // The head stays level while the body works under it, and casts about
    lizard.head.rotation.x = -rig.spec.lean * 0.4 - gait.crouch;
    lizard.head.rotation.y = Math.sin(time * 0.7 + lizard.phase) * 0.28;

    // A blow is faster than a pace, so the strike runs on its own clock
    const strike = gait.strike
      ? Math.max(Math.sin(time * 6.5 + lizard.phase * 2), 0) ** 1.6
      : 0;
    if (lizard.weapon) {
      lizard.weapon.rotation.x = 0.8 - gait.weapon * 0.5 - strike * 1.5;
      lizard.weapon.rotation.z = strike * 0.3;
    }
  });
};
