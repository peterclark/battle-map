import * as THREE from "three";
import { at, bevelled, merge, part, surfaceMaterial, turned } from "./kit.js";

// Dragons, and the Hydra that is built the same way without the wings.
//
// These are the only units on the board with a genuinely easy answer to the
// overhead camera, and the answer is wings. A spread wing is a broad flat
// membrane held out horizontally at shoulder height — it is, quite literally,
// the ideal shape for a camera looking straight down, and no amount of
// clever posing elsewhere on this board produces anything like it. A winged
// Colossal reads from the far side of the table.
//
// So the wings are the sculpt, and everything else is hung off them. They
// stay spread even at rest: a dragon with its wings folded is a lizard, and
// this project already has lizards.
//
// The Hydra gets no wings and has to earn its silhouette the hard way, with
// necks. Five of them, fanned wide and moving independently, make a shape
// nothing else in the game makes — which is the same trick as a formation,
// run on one body.

const KINDS = {
  red: {
    hide: 0x7e2820,
    hideDark: 0x511713,
    membrane: 0xb8543c,
    belly: 0xd9a25c,
    horn: 0xe8dcc0,
    wings: true,
    necks: 1,
    scale: 1.15,
  },
  redLesser: {
    hide: 0x8c3a26,
    hideDark: 0x5c2317,
    membrane: 0xc06848,
    belly: 0xd9a25c,
    horn: 0xe8dcc0,
    wings: true,
    necks: 1,
    scale: 0.95,
  },
  blue: {
    hide: 0x264a72,
    hideDark: 0x16304c,
    membrane: 0x4d7fae,
    belly: 0xa8c6da,
    horn: 0xeef1f5,
    wings: true,
    necks: 1,
    scale: 1.15,
  },
  hydra: {
    // No wings, so the necks do all of it
    hide: 0x3f5f4a,
    hideDark: 0x2a4232,
    membrane: 0x6f8f6a,
    belly: 0xbfc98f,
    horn: 0xe4dcbd,
    wings: false,
    necks: 5,
    scale: 1.05,
  },
};

const HIDE_S = { roughness: 0.82 };
const SCALE_S = { metalness: 0.22, roughness: 0.5 };
const HORN_S = { metalness: 0.22, roughness: 0.42 };
const SKIN_S = { roughness: 0.88 };

const prone = (points, thickness, bevel = 0.02) =>
  at(bevelled(points, thickness, bevel), { rot: [-Math.PI / 2, 0, 0] });

const hang = (parent, geometry, material, position) => {
  if (!geometry) return null;
  const mesh = new THREE.Mesh(geometry, material);
  if (position) mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

// A horn or a talon: turned, tapering, and curved along its length
const spike = (length, base, curve = 0) =>
  at(
    turned(
      [
        [base, 0],
        [base * 0.82, length * 0.28],
        [base * 0.55, length * 0.58],
        [base * 0.26, length * 0.82],
        [0, length],
      ],
      10
    ),
    { rot: [curve, 0, 0] }
  );

const bodyParts = (spec) => [
  part(new THREE.CapsuleGeometry(0.52, 1.05, 10, 18), spec.hide, {
    pos: [0, 0, 0.1],
    rot: [Math.PI / 2, 0, 0],
    ...HIDE_S,
  }),
  part(new THREE.SphereGeometry(0.52, 16, 13), spec.hideDark, {
    pos: [0, -0.05, -0.5],
    scale: [1, 0.85, 1],
    ...HIDE_S,
  }),
  // A dorsal ridge, the same device the lizardfolk use, at ten times the
  // size — and scalloped, so it reads as a crest rather than as a plank
  part(
    prone(
      [
        [-0.07, -0.75],
        [0.07, -0.75],
        [0.08, -0.42],
        [0.062, -0.2],
        [0.082, 0.06],
        [0.06, 0.3],
        [0.07, 0.55],
        [0.05, 0.75],
        [-0.05, 0.75],
        [-0.07, 0.55],
        [-0.06, 0.3],
        [-0.082, 0.06],
        [-0.062, -0.2],
        [-0.08, -0.42],
      ],
      0.12,
      0.012
    ),
    spec.belly,
    { pos: [0, 0.46, 0.1], ...SCALE_S }
  ),
  ...[-0.5, 0, 0.5].map((z, i) =>
    part(spike(0.32, 0.1), spec.horn, {
      pos: [0, 0.56, z],
      rot: [0.6 + i * 0.06, 0, 0],
      ...HORN_S,
    })
  ),
  // Scutes down the flanks
  ...[-1, 1].flatMap((side) =>
    [-0.5, -0.1, 0.3, 0.65].map((z, i) =>
      part(new THREE.OctahedronGeometry(0.07 + (i % 2) * 0.015, 0), spec.belly, {
        pos: [side * 0.5, 0.1 - (i % 2) * 0.05, z],
        scale: [0.5, 1, 1.5],
        ...SCALE_S,
      })
    )
  ),
];

const neckSegParts = (spec, reach) => [
  part(new THREE.CapsuleGeometry(0.16, 0.34, 8, 14), spec.hide, {
    pos: [0, 0, -0.28 * reach],
    rot: [Math.PI / 2, 0, 0],
    ...HIDE_S,
  }),
  // A run of small spines, so a neck is not a hose
  ...[0.02, -0.18, -0.38].map((z) =>
    part(spike(0.11, 0.038), spec.horn, {
      pos: [0, 0.14, z * reach],
      rot: [0.9, 0, 0],
      ...HORN_S,
    })
  ),
];

const dragonHeadParts = (spec) => [
  // A wedge skull cut as a profile, rather than a cone
  part(
    prone(
      [
        [-0.2, -0.34],
        [0.2, -0.34],
        [0.17, 0.02],
        [0.1, 0.25],
        [0, 0.36],
        [-0.1, 0.25],
        [-0.17, 0.02],
      ],
      0.24,
      0.016
    ),
    spec.hide,
    { pos: [0, 0.02, -0.2], ...HIDE_S }
  ),
  part(
    prone(
      [
        [-0.13, -0.28],
        [0.13, -0.28],
        [0.11, 0.08],
        [0, 0.26],
        [-0.11, 0.08],
      ],
      0.09,
      0.01
    ),
    spec.hideDark,
    { pos: [0, -0.1, -0.24], ...HIDE_S }
  ),
  // Teeth along the jaw line
  ...[-0.09, -0.03, 0.03, 0.09].map((x, i) =>
    part(spike(0.09, 0.022), spec.horn, {
      pos: [x, -0.04, -0.26 - (i % 2) * 0.07],
      rot: [Math.PI, 0, 0],
      ...HORN_S,
    })
  ),
  // A pair of swept horns off the back of the skull
  ...[0.12, -0.12].map((x) =>
    part(spike(0.46, 0.075, 0.4), spec.horn, {
      pos: [x, 0.1, 0.06],
      rot: [-0.9, 0, x > 0 ? 0.3 : -0.3],
      ...HORN_S,
    })
  ),
  ...[0.11, -0.11].map((x) =>
    part(new THREE.SphereGeometry(0.045, 10, 8), spec.eye ?? 0xe8a423, {
      pos: [x, 0.08, -0.26],
      ...HORN_S,
    })
  ),
];

// The wing: spars and the membrane between them.
//
// This is the single best top-down feature in the game — a broad flat
// membrane held out horizontally — so it is the one that most deserved the
// geometry the merge freed. The membrane now has finger spars running through
// it and a scalloped trailing edge, which is the difference between a wing
// and a plank.
const wingInnerParts = (spec, side) => [
  part(new THREE.CylinderGeometry(0.075, 0.045, 1.9, 14), spec.hideDark, {
    pos: [side * 0.9, 0, 0],
    rot: [0, 0, Math.PI / 2],
    ...HIDE_S,
  }),
  part(
    prone(
      [
        // Straight along the leading spar, scalloped along the trailing edge —
        // the scallops are what stop a wing reading as an aeroplane's
        [-0.9, 0.56],
        [0.9, 0.5],
        [0.86, -0.2],
        [0.62, -0.44],
        [0.45, -0.3],
        [0.2, -0.56],
        [0.05, -0.4],
        [-0.22, -0.62],
        [-0.38, -0.45],
        [-0.64, -0.66],
        [-0.82, -0.48],
      ],
      0.05,
      0.008
    ),
    spec.membrane,
    { pos: [side * 0.85, -0.03, 0.42], ...SKIN_S }
  ),
  // Finger spars, splayed back through the membrane. They lie *along* the
  // wing, which needs the quarter turn — a cylinder's axis is Y, and left
  // upright these stood through the membrane like fence posts.
  ...[-0.5, 0, 0.5].map((x) =>
    part(new THREE.CylinderGeometry(0.032, 0.016, 1.1, 8), spec.hideDark, {
      pos: [side * 0.85 + x * 0.72, 0.012, 0.46],
      rot: [Math.PI / 2, x * 0.42, 0],
      ...HIDE_S,
    })
  ),
];

const wingOuterParts = (spec, side) => [
  part(new THREE.CylinderGeometry(0.075, 0.045, 1.9, 14), spec.hideDark, {
    pos: [side * 0.72, 0, 0.2],
    rot: [0.25, 0, Math.PI / 2],
    scale: [1, 0.85, 1],
    ...HIDE_S,
  }),
  part(
    prone(
      [
        // Tapering outward, the way a wing actually does
        [-0.8, 0.46],
        [0.8, 0.2],
        [0.66, -0.12],
        [0.42, -0.3],
        [0.26, -0.16],
        [0.0, -0.42],
        [-0.16, -0.26],
        [-0.44, -0.52],
        [-0.6, -0.34],
        [-0.78, -0.46],
      ],
      0.045,
      0.008
    ),
    spec.membrane,
    { pos: [side * 0.7, -0.04, 0.58], ...SKIN_S }
  ),
  ...[-0.4, 0.2].map((x) =>
    part(new THREE.CylinderGeometry(0.026, 0.012, 0.86, 8), spec.hideDark, {
      pos: [side * 0.7 + x * 0.72, 0.008, 0.56],
      rot: [Math.PI / 2, x * 0.5, 0],
      ...HIDE_S,
    })
  ),
  part(spike(0.3, 0.06, 0), spec.horn, {
    pos: [side * 1.4, 0, -0.05],
    rot: [0, 0, side * -1.3],
    ...HORN_S,
  }),
];

const thighParts = (spec) => [
  part(new THREE.CapsuleGeometry(0.22, 0.42, 8, 14), spec.hide, {
    pos: [0, -0.3, 0],
    ...HIDE_S,
  }),
];

const shinParts = (spec) => [
  part(new THREE.CapsuleGeometry(0.17, 0.38, 8, 14), spec.hide, {
    pos: [0, -0.28, 0],
    ...HIDE_S,
  }),
];

const footParts = (spec) => [
  part(
    prone(
      [
        [-0.18, -0.26],
        [0.18, -0.26],
        [0.19, 0.08],
        [0.09, 0.22],
        [-0.09, 0.22],
        [-0.19, 0.08],
      ],
      0.14,
      0.016
    ),
    spec.hideDark,
    { pos: [0, -0.05, -0.12], ...HIDE_S }
  ),
  ...[0.11, -0.11, 0].map((x, i) =>
    part(spike(0.26, 0.06), spec.horn, {
      pos: [x, -0.05, -0.34 - (i === 2 ? 0.04 : 0)],
      rot: [-1.5, 0, 0],
      ...HORN_S,
    })
  ),
];

const armUpperParts = (spec) => [
  part(new THREE.CapsuleGeometry(0.13, 0.3, 8, 12), spec.hide, {
    pos: [0, -0.2, 0],
    ...HIDE_S,
  }),
];

const armLowerParts = (spec) => [
  part(new THREE.CapsuleGeometry(0.1, 0.28, 8, 12), spec.hide, {
    pos: [0, -0.18, 0],
    ...HIDE_S,
  }),
  ...[0.06, -0.06].map((x) =>
    part(spike(0.16, 0.035), spec.horn, {
      pos: [x, -0.34, -0.06],
      rot: [-1.2, 0, 0],
      ...HORN_S,
    })
  ),
];

const tailParts = (spec) => [
  part(new THREE.CylinderGeometry(0.3, 0.16, 0.8, 16), spec.hide, {
    pos: [0, 0, 0.36],
    rot: [Math.PI / 2.1, 0, 0],
    ...HIDE_S,
  }),
  ...[0.16, 0.5].map((z) =>
    part(new THREE.OctahedronGeometry(0.07, 0), spec.belly, {
      pos: [0, 0.24 - z * 0.14, z],
      scale: [0.5, 1, 1.5],
      ...SCALE_S,
    })
  ),
];

const tailTipParts = (spec) => [
  part(new THREE.CylinderGeometry(0.16, 0.03, 0.9, 14), spec.hide, {
    pos: [0, -0.06, 0.4],
    rot: [Math.PI / 2.2, 0, 0],
    ...HIDE_S,
  }),
];

const buildBuffers = (spec, reaches) => ({
  body: merge(bodyParts(spec)),
  neck: reaches.map((reach) => merge(neckSegParts(spec, reach))),
  head: merge(dragonHeadParts(spec)),
  wingInner: [1, -1].map((side) => merge(wingInnerParts(spec, side))),
  wingOuter: [1, -1].map((side) => merge(wingOuterParts(spec, side))),
  thigh: merge(thighParts(spec)),
  shin: merge(shinParts(spec)),
  foot: merge(footParts(spec)),
  armUpper: merge(armUpperParts(spec)),
  armLower: merge(armLowerParts(spec)),
  tail: merge(tailParts(spec)),
  tailTip: merge(tailTipParts(spec)),
});

// A neck with a head on it. The hydra gets five, fanned; a dragon gets one.
const makeNeck = (parent, buffers, material, index, angle) => {
  const root = new THREE.Group();
  root.position.set(0, 0.42, -0.72);
  root.rotation.y = angle;
  parent.add(root);

  const reach = buffers.reaches[index];
  const lower = new THREE.Group();
  lower.rotation.x = -0.5;
  root.add(lower);
  hang(lower, buffers.neck[index], material);

  const upper = new THREE.Group();
  upper.position.z = -0.58 * reach;
  lower.add(upper);
  upper.rotation.x = 0.55;
  hang(upper, buffers.neck[index], material);

  const head = new THREE.Group();
  head.position.z = -0.6 * reach;
  upper.add(head);
  hang(head, buffers.head, material);

  return { root, lower, upper, head, angle };
};

// One dragon, facing -Z, standing on y = 0.
const makeDragon = (spec, buffers, material) => {
  const group = new THREE.Group();

  const body = new THREE.Group();
  body.position.y = 1.15;
  group.add(body);
  hang(body, buffers.body, material);

  const necks = [];
  if (spec.necks === 1) {
    necks.push(makeNeck(body, buffers, material, 0, 0));
  } else {
    // Fanned across the front, longest in the middle
    for (let i = 0; i < spec.necks; i += 1) {
      const spread = (i / (spec.necks - 1) - 0.5) * 1.5;
      necks.push(makeNeck(body, buffers, material, i, spread));
    }
  }

  // The wings. Held out and back at a shallow angle so they lie almost flat
  // to the ground — which is what makes this animal readable at all.
  const wings = spec.wings
    ? [1, -1].map((side, i) => {
        const shoulder = new THREE.Group();
        shoulder.position.set(side * 0.4, 0.34, -0.1);
        body.add(shoulder);
        shoulder.rotation.z = side * 0.28;
        shoulder.rotation.y = side * -0.25;
        hang(shoulder, buffers.wingInner[i], material);

        const outer = new THREE.Group();
        outer.position.set(side * 1.75, 0, 0);
        shoulder.add(outer);
        hang(outer, buffers.wingOuter[i], material);

        return { shoulder, outer, side };
      })
    : [];

  // Hind legs take the weight; forelimbs are small and tucked
  const legs = [1, -1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.42, -0.16, 0.36);
    body.add(hip);
    hip.rotation.z = side * 0.2;
    hang(hip, buffers.thigh, material);
    const shin = new THREE.Group();
    shin.position.y = -0.62;
    hip.add(shin);
    shin.rotation.x = -0.55;
    hang(shin, buffers.shin, material);
    const foot = new THREE.Group();
    foot.position.y = -0.54;
    shin.add(foot);
    hang(foot, buffers.foot, material);
    return { hip, shin, foot, side };
  });

  const arms = [1, -1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.36, -0.1, -0.44);
    body.add(shoulder);
    shoulder.rotation.z = side * 0.5;
    hang(shoulder, buffers.armUpper, material);
    const lower = new THREE.Group();
    lower.position.y = -0.38;
    shoulder.add(lower);
    lower.rotation.x = -0.9;
    hang(lower, buffers.armLower, material);
    return { shoulder, lower, side };
  });

  const tail = new THREE.Group();
  tail.position.set(0, -0.02, 0.62);
  body.add(tail);
  hang(tail, buffers.tail, material);
  const tailTip = new THREE.Group();
  tailTip.position.z = 0.74;
  tail.add(tailTip);
  hang(tailTip, buffers.tailTip, material);

  return { group, body, necks, wings, legs, arms, tail, tailTip };
};

/**
 * One dragon on the stand. Colossal units come alone — the count trick that
 * carries infantry and brutes works against a monster, and a Colossal that
 * shares its stand stops being colossal.
 */
export const buildDragon = ({ kind = "red" } = {}) => {
  const spec = KINDS[kind] ?? KINDS.red;
  const material = surfaceMaterial();
  // A hydra's necks are not the same length — the middle ones reach further —
  // so each gets its own buffer rather than sharing one
  const reaches =
    spec.necks === 1
      ? [1.15]
      : Array.from(
          { length: spec.necks },
          (_, i) => 1 - Math.abs((i / (spec.necks - 1) - 0.5) * 1.5) * 0.18
        );
  const buffers = buildBuffers(spec, reaches);
  buffers.reaches = reaches;

  const root = new THREE.Group();
  const dragon = makeDragon(spec, buffers, material);
  dragon.group.scale.setScalar(spec.scale);
  root.add(dragon.group);

  return { root, dragon, spec, kind, count: 1 };
};

const GAITS = {
  // Settled but never still: the wings breathe, the neck casts about, the
  // tail moves. A Colossal that froze would look broken.
  idle: { rate: 0.8, beat: 0.35, stride: 0.1, rear: 0, lunge: 0, tail: 1 },
  // Moving up. Wings held out for balance rather than beating.
  march: { rate: 1.7, beat: 0.5, stride: 1, rear: 0.05, lunge: 0, tail: 1.2 },
  // Reared, wings hammering, neck striking. This is the one animation on the
  // board allowed to be theatrical — it is a dragon.
  attack: { rate: 2.4, beat: 1.6, stride: 0.3, rear: 0.22, lunge: 1, tail: 1.8 },
};

/**
 * Pose a dragon.
 *
 * The wing beat is the animation. It is slow — a big wing moves slowly, and
 * anything quick reads as a bat rather than a dragon — but it sweeps the two
 * broadest surfaces on the board, so it carries the whole animal.
 */
export const poseDragon = (rig, time, state = "idle") => {
  const gait = GAITS[state] ?? GAITS.idle;
  const d = rig.dragon;
  const t = time * gait.rate;

  d.body.position.y = 1.15 + Math.sin(t) * 0.05 + gait.rear * 0.5;
  d.body.rotation.x = -gait.rear;

  d.wings.forEach(({ shoulder, outer, side }) => {
    const beat = Math.sin(t * 1.6);
    shoulder.rotation.z = side * (0.28 + beat * 0.3 * gait.beat);
    // The outer half trails the inner, which is what stops a wing looking
    // like a rigid plank hinged at the shoulder
    outer.rotation.z = side * Math.sin(t * 1.6 - 0.7) * 0.34 * gait.beat;
    outer.rotation.x = Math.sin(t * 1.6 - 0.9) * 0.16 * gait.beat;
  });

  d.necks.forEach((neck, i) => {
    const own = t + i * 1.35;
    const strike = gait.lunge
      ? Math.max(Math.sin(own * 1.4), 0) ** 2.4
      : 0;
    neck.lower.rotation.x = -0.5 - strike * 0.45 + Math.sin(own * 0.7) * 0.08;
    neck.upper.rotation.x = 0.55 + strike * 0.7 + Math.sin(own * 0.9 + 0.5) * 0.1;
    neck.root.rotation.y = neck.angle + Math.sin(own * 0.5) * 0.22;
    neck.head.rotation.x = -0.2 - strike * 0.5;
  });

  d.legs.forEach(({ hip, shin, side }) => {
    const swing = t * 2 + (side > 0 ? 0 : Math.PI);
    hip.rotation.x = Math.sin(swing) * 0.34 * gait.stride;
    shin.rotation.x = -0.55 - Math.max(-Math.sin(swing - 0.7), 0) * 0.4 * gait.stride;
  });

  d.arms.forEach(({ shoulder, side }) => {
    shoulder.rotation.x = Math.sin(t * 2 + (side > 0 ? 1 : 2)) * 0.2 - gait.lunge * 0.3;
  });

  d.tail.rotation.y = Math.sin(t * 0.9) * 0.3 * gait.tail;
  d.tailTip.rotation.y = Math.sin(t * 0.9 - 0.8) * 0.35 * gait.tail;
};
