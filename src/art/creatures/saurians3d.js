import * as THREE from "three";
import { matte } from "./materials.js";

// The heavy saurians of the Lizardmen list: Triceratops Herd and Ancients.
//
// Both are Large, which means a stand nearly a third again as wide as an
// infantry card and only two or three animals standing on it. That inverts
// the problem the rank-and-file units have. A regiment reads because twenty
// small silhouettes make a pattern; a monster has to read on its own, from
// directly overhead, with nothing to help it.
//
// So each of these is built around one broad horizontal feature, because
// breadth is the only currency a top-down camera accepts:
//
//   The Triceratops has its frill — a plate of pale bone fanned out behind
//   the skull. It is the single best top-down feature in the army: broad,
//   flat, presented squarely upward, and unmistakable at any size. The horns
//   rake forward off it so the animal has a direction.
//
//   The Ancients have a carapace — a wide mossed-over shell across the back,
//   pale lichen against dark stone, with a crown of horns behind the skull.
//   Where the Triceratops is wide at the head, an Ancient is wide across the
//   shoulders, which is enough to tell them apart at a glance.
//
// Both are laid out as loose groups rather than dressed ranks. Herds do not
// form up.
//
// One proportion note that is not artistic licence. The band a stand gives
// its figures is about 3.2" wide and 1.3" deep -- nearly two and a half to
// one -- while a quadruped seen from above is longer than it is wide. The fit
// is therefore always depth-limited, and every inch of length costs size on
// the table. So these are built stubbier than the animals they are named
// after: short tails, compact bodies, frills tucked close. Length is the one
// thing there is no room for.

// Bodies dark and cool, bone and lichen pale. The turf is a dark yellow-green
// and the pale furniture is what has to carry the silhouette.
const PALETTE = {
  trikeHide: 0x4a4035,
  trikeBack: 0x5d5142,
  frill: 0xd6c8a6,
  horn: 0xefe6cc,
  beak: 0x6d6350,
  ancientHide: 0x2b332c,
  ancientShell: 0x7a8464,
  lichen: 0xc2d199,
  crest: 0xe8dcc0,
  claw: 0xd8cfb4,
};

const MATERIALS = {
  trikeHide: matte(PALETTE.trikeHide),
  trikeBack: matte(PALETTE.trikeBack),
  frill: matte(PALETTE.frill, 0.75),
  horn: matte(PALETTE.horn, 0.6),
  beak: matte(PALETTE.beak, 0.7),
  ancientHide: matte(PALETTE.ancientHide),
  ancientShell: matte(PALETTE.ancientShell),
  lichen: matte(PALETTE.lichen, 0.95),
  crest: matte(PALETTE.crest, 0.65),
  claw: matte(PALETTE.claw, 0.6),
};

// One set of geometry, shared by every animal on every stand.
const GEOMETRY = {
  // Triceratops
  trikeBody: new THREE.CapsuleGeometry(0.42, 0.52, 8, 16),
  trikeHump: new THREE.SphereGeometry(0.36, 18, 14),
  // A wide, shallow cylinder laid flat is the frill: all area, no height
  frill: new THREE.CylinderGeometry(0.62, 0.52, 0.09, 18),
  frillSpike: new THREE.ConeGeometry(0.07, 0.22, 14),
  skull: new THREE.BoxGeometry(0.38, 0.24, 0.44),
  beak: new THREE.ConeGeometry(0.16, 0.3, 14),
  browHorn: new THREE.ConeGeometry(0.075, 0.46, 14),
  noseHorn: new THREE.ConeGeometry(0.075, 0.26, 14),
  legUpper: new THREE.CapsuleGeometry(0.15, 0.24, 8, 16),
  legLower: new THREE.CapsuleGeometry(0.12, 0.2, 8, 16),
  hoof: new THREE.CylinderGeometry(0.15, 0.17, 0.1, 18),
  trikeTail: new THREE.CylinderGeometry(0.2, 0.07, 0.4, 18),
  backPlate: new THREE.BoxGeometry(0.5, 0.07, 0.24),

  // Ancients
  ancientBody: new THREE.CapsuleGeometry(0.38, 0.6, 8, 16),
  shell: new THREE.SphereGeometry(0.56, 18, 14),
  lichenPatch: new THREE.SphereGeometry(0.17, 18, 14),
  ancientSkull: new THREE.ConeGeometry(0.26, 0.62, 14),
  jaw: new THREE.BoxGeometry(0.26, 0.09, 0.34),
  crestHorn: new THREE.ConeGeometry(0.095, 0.66, 14),
  ancientLimb: new THREE.CapsuleGeometry(0.145, 0.3, 8, 16),
  ancientShin: new THREE.CapsuleGeometry(0.115, 0.26, 8, 16),
  ancientFoot: new THREE.BoxGeometry(0.34, 0.12, 0.42),
  ancientArm: new THREE.CapsuleGeometry(0.11, 0.26, 8, 16),
  claw: new THREE.ConeGeometry(0.055, 0.2, 14),
  ancientTail: new THREE.CylinderGeometry(0.22, 0.06, 0.52, 18),
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

// A quadruped leg, hung off the body. `front` shifts the joint angles so the
// forelimbs brace and the hindlimbs drive, which is most of what makes a
// four-legged walk look like one.
const quadLeg = (parent, x, z, front, material) => {
  const hip = new THREE.Group();
  hip.position.set(x, -0.06, z);
  parent.add(hip);
  add(GEOMETRY.legUpper, material, hip, [0, -0.16, 0]);
  const shin = new THREE.Group();
  shin.position.y = -0.3;
  shin.rotation.x = front ? 0.18 : -0.22;
  hip.add(shin);
  add(GEOMETRY.legLower, material, shin, [0, -0.13, 0]);
  add(GEOMETRY.hoof, material, shin, [0, -0.28, 0.01]);
  return { hip, shin, front, x };
};

// One Triceratops, facing -Z, standing on y = 0.
const makeTriceratops = () => {
  const group = new THREE.Group();

  const body = new THREE.Group();
  body.position.y = 0.62;
  group.add(body);

  add(GEOMETRY.trikeBody, MATERIALS.trikeHide, body, [0, 0, 0.06], [Math.PI / 2, 0, 0]);
  add(GEOMETRY.trikeHump, MATERIALS.trikeBack, body, [0, 0.16, -0.16], null, [1.15, 0.62, 1]);
  // Two plates along the spine, pale enough to break up the hide from above
  add(GEOMETRY.backPlate, MATERIALS.trikeBack, body, [0, 0.32, 0.04]);
  add(GEOMETRY.backPlate, MATERIALS.trikeBack, body, [0, 0.3, 0.34], null, [0.8, 1, 1]);

  // The head assembly. The frill is the whole reason this animal reads.
  const head = new THREE.Group();
  head.position.set(0, 0.1, -0.56);
  body.add(head);

  // Laid almost flat and tipped slightly back, so its full face is turned
  // toward a camera directly above it
  add(GEOMETRY.frill, MATERIALS.frill, head, [0, 0.1, 0.08], [0.22, 0, 0]);
  // Spikes around the rim, raked outward — they extend the silhouette
  // without adding height
  for (let i = 0; i < 7; i += 1) {
    const a = -Math.PI * 0.72 + (i / 6) * Math.PI * 1.44;
    add(
      GEOMETRY.frillSpike,
      MATERIALS.horn,
      head,
      [Math.sin(a) * 0.6, 0.12, 0.08 - Math.cos(a) * 0.6],
      [-Math.PI / 2 + 0.5, a, 0]
    );
  }

  add(GEOMETRY.skull, MATERIALS.trikeHide, head, [0, 0.02, -0.22]);
  add(GEOMETRY.beak, MATERIALS.beak, head, [0, -0.04, -0.44], [-Math.PI / 2.1, 0, 0]);
  // Brow horns rake forward, which is the direction the animal is going
  add(GEOMETRY.browHorn, MATERIALS.horn, head, [0.15, 0.12, -0.3], [-1.35, 0, 0.16]);
  add(GEOMETRY.browHorn, MATERIALS.horn, head, [-0.15, 0.12, -0.3], [-1.35, 0, -0.16]);
  add(GEOMETRY.noseHorn, MATERIALS.horn, head, [0, 0.1, -0.46], [-0.95, 0, 0]);

  const legs = [
    quadLeg(body, 0.3, -0.34, true, MATERIALS.trikeHide),
    quadLeg(body, -0.3, -0.34, true, MATERIALS.trikeHide),
    quadLeg(body, 0.32, 0.28, false, MATERIALS.trikeHide),
    quadLeg(body, -0.32, 0.28, false, MATERIALS.trikeHide),
  ];

  const tail = new THREE.Group();
  tail.position.set(0, 0.02, 0.4);
  body.add(tail);
  add(GEOMETRY.trikeTail, MATERIALS.trikeHide, tail, [0, 0, 0.19], [Math.PI / 2.2, 0, 0]);

  return { group, body, head, legs, tail, kind: "triceratops" };
};

// One Ancient, facing -Z, standing on y = 0.
const makeAncient = () => {
  const group = new THREE.Group();

  const hips = new THREE.Group();
  hips.position.y = 0.86;
  group.add(hips);

  // Hunched: the spine carried well forward, counterweighted by the tail.
  // An Ancient is a bipedal thing bent under its own shell.
  const spine = new THREE.Group();
  spine.rotation.x = 0.62;
  hips.add(spine);

  add(GEOMETRY.ancientBody, MATERIALS.ancientHide, spine, [0, 0.02, -0.04], [Math.PI / 2, 0, 0]);

  // The carapace: broad across the shoulders, flattened so it reads as a
  // plate from above rather than a ball
  add(GEOMETRY.shell, MATERIALS.ancientShell, spine, [0, 0.14, 0.02], null, [1.12, 0.46, 0.92]);
  // Lichen, which is what makes the thing look old rather than merely large
  add(GEOMETRY.lichenPatch, MATERIALS.lichen, spine, [0.24, 0.3, -0.1], null, [1, 0.4, 1.2]);
  add(GEOMETRY.lichenPatch, MATERIALS.lichen, spine, [-0.18, 0.31, 0.14], null, [1.3, 0.4, 0.9]);
  add(GEOMETRY.lichenPatch, MATERIALS.lichen, spine, [0.04, 0.32, 0.3], null, [0.9, 0.35, 0.8]);
  add(GEOMETRY.lichenPatch, MATERIALS.lichen, spine, [-0.3, 0.28, -0.22], null, [1.1, 0.35, 1]);

  const head = new THREE.Group();
  head.position.set(0, 0.16, -0.5);
  spine.add(head);
  add(GEOMETRY.ancientSkull, MATERIALS.ancientHide, head, [0, 0, -0.14], [-Math.PI / 2, 0, 0]);
  add(GEOMETRY.jaw, MATERIALS.ancientHide, head, [0, -0.09, -0.2]);
  // A crown of horns raked back off the skull — the Ancient's answer to the
  // Triceratops frill, and the pale thing that carries it from above
  [-0.42, -0.15, 0.15, 0.42].forEach((x, i) => {
    add(
      GEOMETRY.crestHorn,
      MATERIALS.crest,
      head,
      [x * 0.6, 0.14, 0.12],
      [-1.15, 0, x * 0.62],
      [1, 1 - Math.abs(i - 1.5) * 0.12, 1]
    );
  });

  const legs = [1, -1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.28, -0.06, 0);
    hips.add(hip);
    add(GEOMETRY.ancientLimb, MATERIALS.ancientHide, hip, [0, -0.2, 0.02]);
    const shin = new THREE.Group();
    shin.position.y = -0.38;
    shin.rotation.x = -0.42;
    hip.add(shin);
    add(GEOMETRY.ancientShin, MATERIALS.ancientHide, shin, [0, -0.16, 0]);
    const foot = new THREE.Group();
    foot.position.y = -0.34;
    shin.add(foot);
    add(GEOMETRY.ancientFoot, MATERIALS.ancientHide, foot, [0, -0.04, -0.08]);
    add(GEOMETRY.claw, MATERIALS.claw, foot, [0.1, -0.04, -0.26], [-1.5, 0, 0]);
    add(GEOMETRY.claw, MATERIALS.claw, foot, [-0.1, -0.04, -0.26], [-1.5, 0, 0]);
    return { hip, shin, foot, side };
  });

  // Heavy forelimbs, hanging wide. They swing rather than carry anything —
  // an Ancient does not need a weapon.
  const arms = [1, -1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.36, 0.04, -0.16);
    spine.add(shoulder);
    add(GEOMETRY.ancientArm, MATERIALS.ancientHide, shoulder, [0, -0.16, 0]);
    const hand = new THREE.Group();
    hand.position.y = -0.32;
    shoulder.add(hand);
    add(GEOMETRY.claw, MATERIALS.claw, hand, [0, -0.06, -0.08], [-1.2, 0, 0]);
    add(GEOMETRY.claw, MATERIALS.claw, hand, [side * 0.09, -0.06, -0.04], [-1.1, 0, side * 0.3]);
    return { shoulder, hand, side };
  });

  const tailRoot = new THREE.Group();
  tailRoot.position.set(0, 0.02, 0.22);
  hips.add(tailRoot);
  add(GEOMETRY.ancientTail, MATERIALS.ancientHide, tailRoot, [0, -0.06, 0.24], [Math.PI / 2.3, 0, 0]);

  return { group, hips, spine, head, legs, arms, tailRoot, kind: "ancients" };
};

// Where the animals stand. A herd is a loose group with its own spacing and
// its own angles — dressing them in ranks would make them a regiment, which
// is exactly what a Large unit is not.
const HERDS = {
  triceratops: {
    make: makeTriceratops,
    beasts: [
      { x: -1.12, z: -0.05, turn: 0.17, scale: 1 },
      { x: 1.1, z: -0.12, turn: -0.21, scale: 0.96 },
      { x: -0.02, z: 0.16, turn: 0.05, scale: 1.04 },
    ],
  },
  ancients: {
    make: makeAncient,
    beasts: [
      { x: -1.02, z: -0.06, turn: 0.15, scale: 1.06 },
      { x: 1.04, z: 0.1, turn: -0.19, scale: 0.98 },
    ],
  },
};

/**
 * A stand of heavy saurians.
 *
 * `kind` is `triceratops` or `ancients`. Two or three animals rather than a
 * rank — these are the units the game calls Large, and a Large unit that
 * fields twenty of anything has stopped being large.
 */
export const buildSaurians = ({ kind = "triceratops" } = {}) => {
  const herd = HERDS[kind] ?? HERDS.triceratops;
  const root = new THREE.Group();
  const beasts = [];

  herd.beasts.forEach((placement, index) => {
    const beast = herd.make();
    beast.group.position.set(placement.x, 0, placement.z);
    beast.group.rotation.y = placement.turn;
    beast.group.scale.setScalar(placement.scale);
    // A fixed offset per animal rather than a random one: the herd has to
    // look unsynchronised without shimmering between frames
    beast.phase = index * 2.4;
    root.add(beast.group);
    beasts.push(beast);
  });

  return { root, beasts, kind, count: beasts.length };
};

const GAITS = {
  // At rest: heads swinging, weight rocking, tails idling. A big animal
  // standing still is never quite still.
  idle: { rate: 0.9, stride: 0.12, sway: 1, head: 1, lower: 0, drive: 0 },
  // Moving up. Slower cadence than infantry — mass reads as unhurried.
  march: { rate: 2.1, stride: 1, sway: 0.7, head: 0.5, lower: 0.06, drive: 0.5 },
  // Head down and into it.
  attack: { rate: 2.9, stride: 0.7, sway: 1.4, head: 0.35, lower: 0.16, drive: 1 },
};

/**
 * Pose a herd.
 *
 * A quadruped walks on diagonal pairs — near-fore with off-hind — and getting
 * that right is most of what separates a walking animal from a rocking toy.
 * The biped Ancients get the alternating stride the lizardfolk use, slowed
 * down and weighted.
 */
export const poseSaurians = (rig, time, state = "idle") => {
  const gait = GAITS[state] ?? GAITS.idle;

  rig.beasts.forEach((beast) => {
    const t = time * gait.rate + beast.phase;

    if (beast.kind === "triceratops") {
      beast.legs.forEach((leg) => {
        // Diagonal pairs: a foreleg and the hindleg on the other side move
        // together
        const diagonal = (leg.front ? 0 : Math.PI) + (leg.x > 0 ? 0 : Math.PI);
        const swing = t + diagonal;
        leg.hip.rotation.x = Math.sin(swing) * 0.42 * gait.stride;
        leg.shin.rotation.x =
          (leg.front ? 0.18 : -0.22) +
          Math.max(-Math.sin(swing - 0.6), 0) * 0.4 * gait.stride;
      });

      beast.body.position.y = 0.62 - gait.lower + Math.abs(Math.sin(t * 2)) * 0.03;
      beast.body.rotation.z = Math.sin(t) * 0.045 * gait.sway;
      beast.body.rotation.x = gait.drive * 0.1;

      // The head sweeps side to side, which from above swings the frill —
      // the broadest pale thing on the stand — across the turf
      beast.head.rotation.y = Math.sin(time * 0.55 + beast.phase) * 0.3 * gait.head;
      beast.head.rotation.x = -gait.drive * 0.22 + Math.sin(t * 2) * 0.03;
      beast.tail.rotation.y = -Math.sin(t) * 0.3 * gait.sway;
      return;
    }

    // Ancients
    beast.legs.forEach(({ hip, shin, side }) => {
      const swing = t + (side > 0 ? 0 : Math.PI);
      hip.rotation.x = Math.sin(swing) * 0.42 * gait.stride;
      shin.rotation.x = -0.42 - Math.max(-Math.sin(swing - 0.7), 0) * 0.5 * gait.stride;
    });

    beast.hips.position.y = 0.86 - gait.lower + Math.abs(Math.sin(t)) * 0.045;
    beast.hips.rotation.z = Math.sin(t) * 0.05 * gait.sway;
    beast.spine.rotation.x = 0.62 + gait.drive * 0.16;

    beast.arms.forEach(({ shoulder, side }) => {
      const swing = t + (side > 0 ? Math.PI : 0);
      shoulder.rotation.x = Math.sin(swing) * 0.34 * gait.stride - gait.drive * 0.3;
      shoulder.rotation.z = side * (0.12 + gait.drive * 0.1);
    });

    beast.head.rotation.y = Math.sin(time * 0.45 + beast.phase) * 0.26 * gait.head;
    beast.head.rotation.x = -0.3 - gait.drive * 0.25;
    beast.tailRoot.rotation.y = -Math.sin(t) * 0.26 * gait.sway;
    beast.tailRoot.rotation.x = -0.1 + Math.sin(t * 0.8) * 0.05;
  });
};
