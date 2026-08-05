import * as THREE from "three";
import { at, bevelled, merge, part, surfaceMaterial, turned } from "./kit.js";

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

const HIDE = { roughness: 0.85 };
const BONE = { metalness: 0.18, roughness: 0.55 };
const MOSS = { roughness: 0.97 };

// Outlines are drawn x-across, y-along. `prone` lays one down pointing
// forward — skulls, jaws, feet, frills — with thickness becoming height.
const prone = (points, thickness, bevel = 0.012) =>
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

// A horn, turned so it tapers and curves rather than standing as a cone.
// `curve` bends it along its length, which is what stops a set of four
// reading as a row of traffic cones.
const horn = (length, base, curve = 0) =>
  merge([
    at(
      turned(
        [
          [base, 0],
          [base * 0.86, length * 0.22],
          [base * 0.62, length * 0.5],
          [base * 0.34, length * 0.76],
          [base * 0.12, length * 0.93],
          [0, length],
        ],
        12
      ),
      { rot: [curve * 0.3, 0, 0] }
    ),
  ]);

// --- Triceratops -----------------------------------------------------------

const trikeBodyParts = () => [
  part(new THREE.CapsuleGeometry(0.42, 0.52, 10, 18), PALETTE.trikeHide, {
    pos: [0, 0, 0.06],
    rot: [Math.PI / 2, 0, 0],
    ...HIDE,
  }),
  part(new THREE.SphereGeometry(0.36, 16, 13), PALETTE.trikeBack, {
    pos: [0, 0.16, -0.16],
    scale: [1.15, 0.62, 1],
    ...HIDE,
  }),
  // Two plates along the spine, pale enough to break up the hide from above,
  // cut with a scalloped edge rather than left as boxes
  ...[
    [0.04, 0.32, 1],
    [0.34, 0.3, 0.8],
  ].map(([z, y, w]) =>
    part(
      prone(
        [
          [-0.25 * w, -0.12],
          [-0.14 * w, -0.14],
          [0, -0.11],
          [0.14 * w, -0.14],
          [0.25 * w, -0.12],
          [0.22 * w, 0.11],
          [0, 0.14],
          [-0.22 * w, 0.11],
        ],
        0.07,
        0.01
      ),
      PALETTE.trikeBack,
      { pos: [0, y, z], ...HIDE }
    )
  ),
  // Osteoderms along the flanks
  ...[-1, 1].flatMap((side) =>
    [-0.28, -0.06, 0.16, 0.36].map((z, i) =>
      part(new THREE.OctahedronGeometry(0.055 + (i % 2) * 0.012, 0), PALETTE.trikeBack, {
        pos: [side * 0.4, 0.06 - (i % 2) * 0.04, z],
        scale: [0.6, 1, 1.4],
        ...HIDE,
      })
    )
  ),
];

const trikeHeadParts = () => {
  const parts = [
    // The frill. Laid almost flat and tipped slightly back, so its full face
    // is turned toward a camera directly above it — and scalloped round the
    // rim, because a plain disc reads as a dinner plate.
    part(
      prone(
        (() => {
          const points = [];
          for (let i = 0; i <= 22; i += 1) {
            const a = -Math.PI * 0.78 + (i / 22) * Math.PI * 1.56;
            // A shallow scallop, one lobe per epoccipital
            const r = 0.6 + Math.sin(a * 6) * 0.035;
            points.push([Math.sin(a) * r, -Math.cos(a) * r * 0.86]);
          }
          return points;
        })(),
        0.085,
        0.014
      ),
      PALETTE.frill,
      { pos: [0, 0.1, 0.08], rot: [0.22, 0, 0], ...BONE }
    ),
  ];

  // Spikes around the rim, raked outward — they extend the silhouette
  // without adding height
  for (let i = 0; i < 7; i += 1) {
    const a = -Math.PI * 0.72 + (i / 6) * Math.PI * 1.44;
    parts.push(
      part(horn(0.24, 0.07), PALETTE.horn, {
        pos: [Math.sin(a) * 0.6, 0.12, 0.08 - Math.cos(a) * 0.6],
        rot: [-Math.PI / 2 + 0.5, a, 0],
        ...BONE,
      })
    );
  }

  parts.push(
    // A skull that narrows to the beak rather than sitting as a box
    part(
      prone(
        [
          [-0.19, -0.2],
          [0.19, -0.2],
          [0.17, 0.02],
          [0.11, 0.16],
          [-0.11, 0.16],
          [-0.17, 0.02],
        ],
        0.22,
        0.014
      ),
      PALETTE.trikeHide,
      { pos: [0, 0.02, -0.22], ...HIDE }
    ),
    // The beak: a parrot's hook, which is what a ceratopsian actually has
    part(
      turned(
        [
          [0, -0.16],
          [0.07, -0.1],
          [0.12, 0.0],
          [0.15, 0.1],
          [0.1, 0.15],
          [0, 0.16],
        ],
        14
      ),
      PALETTE.beak,
      { pos: [0, -0.04, -0.44], rot: [-Math.PI / 2.1, 0, 0], ...BONE }
    ),
    // Brow horns rake forward, which is the direction the animal is going
    part(horn(0.48, 0.078, 1), PALETTE.horn, {
      pos: [0.15, 0.12, -0.3],
      rot: [-1.35, 0, 0.16],
      ...BONE,
    }),
    part(horn(0.48, 0.078, 1), PALETTE.horn, {
      pos: [-0.15, 0.12, -0.3],
      rot: [-1.35, 0, -0.16],
      ...BONE,
    }),
    part(horn(0.28, 0.08), PALETTE.horn, {
      pos: [0, 0.1, -0.46],
      rot: [-0.95, 0, 0],
      ...BONE,
    }),
    ...[0.16, -0.16].map((x) =>
      part(new THREE.SphereGeometry(0.04, 8, 7), 0x2a2118, {
        pos: [x, 0.06, -0.34],
        ...HIDE,
      })
    )
  );

  return parts;
};

const trikeLegParts = () => [
  part(new THREE.CapsuleGeometry(0.15, 0.24, 8, 14), PALETTE.trikeHide, {
    pos: [0, -0.16, 0],
    ...HIDE,
  }),
];

// Shin and hoof together: the hoof never turns on its own
const trikeShinParts = () => [
  part(new THREE.CapsuleGeometry(0.12, 0.2, 8, 14), PALETTE.trikeHide, {
    pos: [0, -0.13, 0],
    ...HIDE,
  }),
  part(
    turned(
      [
        [0, 0],
        [0.16, 0.015],
        [0.175, 0.07],
        [0.15, 0.11],
        [0, 0.12],
      ],
      16
    ),
    PALETTE.trikeHide,
    { pos: [0, -0.34, 0.01], ...HIDE }
  ),
  ...[-0.09, 0.02, 0.11].map((x) =>
    part(new THREE.ConeGeometry(0.035, 0.08, 7), PALETTE.claw, {
      pos: [x, -0.31, -0.13],
      rot: [-Math.PI / 2.2, 0, 0],
      ...BONE,
    })
  ),
];

const trikeTailParts = () => [
  part(new THREE.CylinderGeometry(0.2, 0.07, 0.4, 16), PALETTE.trikeHide, {
    pos: [0, 0, 0.19],
    rot: [Math.PI / 2.2, 0, 0],
    ...HIDE,
  }),
];

// One Triceratops, facing -Z, standing on y = 0.
const makeTriceratops = (buffers, material) => {
  const group = new THREE.Group();

  const body = new THREE.Group();
  body.position.y = 0.62;
  group.add(body);
  hang(body, buffers.body, material);

  // The head assembly. The frill is the whole reason this animal reads.
  const head = new THREE.Group();
  head.position.set(0, 0.1, -0.56);
  body.add(head);
  hang(head, buffers.head, material);

  const legs = [
    [0.3, -0.34, true],
    [-0.3, -0.34, true],
    [0.32, 0.28, false],
    [-0.32, 0.28, false],
  ].map(([x, z, front]) => {
    const hip = new THREE.Group();
    hip.position.set(x, -0.06, z);
    body.add(hip);
    hang(hip, buffers.leg, material);
    const shin = new THREE.Group();
    shin.position.y = -0.3;
    shin.rotation.x = front ? 0.18 : -0.22;
    hip.add(shin);
    hang(shin, buffers.shin, material);
    return { hip, shin, front, x };
  });

  const tail = new THREE.Group();
  tail.position.set(0, 0.02, 0.4);
  body.add(tail);
  hang(tail, buffers.tail, material);

  return { group, body, head, legs, tail, kind: "triceratops" };
};

// --- Ancients --------------------------------------------------------------

const ancientSpineParts = () => [
  part(new THREE.CapsuleGeometry(0.38, 0.6, 10, 18), PALETTE.ancientHide, {
    pos: [0, 0.02, -0.04],
    rot: [Math.PI / 2, 0, 0],
    ...HIDE,
  }),
  // The carapace: broad across the shoulders, flattened so it reads as a
  // plate from above rather than a ball
  part(new THREE.SphereGeometry(0.56, 18, 14), PALETTE.ancientShell, {
    pos: [0, 0.14, 0.02],
    scale: [1.12, 0.46, 0.92],
    ...HIDE,
  }),
  // Growth rings across the shell, which is what makes it read as a shell
  // rather than as a dome
  ...[0.3, 0.45, 0.58].map((r, i) =>
    part(new THREE.TorusGeometry(r, 0.022, 6, 26), PALETTE.ancientHide, {
      pos: [0, 0.27 - i * 0.03, 0.02],
      rot: [Math.PI / 2, 0, 0],
      scale: [1.12, 0.92, 1],
      ...HIDE,
    })
  ),
  // Lichen, which is what makes the thing look old rather than merely large
  ...[
    [0.24, 0.3, -0.1, 1, 0.4, 1.2],
    [-0.18, 0.31, 0.14, 1.3, 0.4, 0.9],
    [0.04, 0.32, 0.3, 0.9, 0.35, 0.8],
    [-0.3, 0.28, -0.22, 1.1, 0.35, 1],
  ].map(([x, y, z, sx, sy, sz]) =>
    part(new THREE.SphereGeometry(0.17, 12, 10), PALETTE.lichen, {
      pos: [x, y, z],
      scale: [sx, sy, sz],
      ...MOSS,
    })
  ),
];

const ancientHeadParts = () => [
  part(
    prone(
      [
        [-0.2, -0.3],
        [0.2, -0.3],
        [0.17, 0.02],
        [0.09, 0.24],
        [0, 0.32],
        [-0.09, 0.24],
        [-0.17, 0.02],
      ],
      0.26,
      0.014
    ),
    PALETTE.ancientHide,
    { pos: [0, 0.02, -0.16], ...HIDE }
  ),
  part(
    prone(
      [
        [-0.13, -0.2],
        [0.13, -0.2],
        [0.11, 0.1],
        [0, 0.22],
        [-0.11, 0.1],
      ],
      0.09,
      0.01
    ),
    PALETTE.ancientHide,
    { pos: [0, -0.09, -0.16], ...HIDE }
  ),
  // Teeth
  ...[-0.09, -0.03, 0.03, 0.09].map((x, i) =>
    part(new THREE.ConeGeometry(0.022, 0.07, 6), PALETTE.claw, {
      pos: [x, -0.03, -0.24 - (i % 2) * 0.05],
      rot: [Math.PI, 0, 0],
      ...BONE,
    })
  ),
  // A crown of horns raked back off the skull — the Ancient's answer to the
  // Triceratops frill, and the pale thing that carries it from above
  ...[-0.42, -0.15, 0.15, 0.42].map((x, i) =>
    part(horn(0.68 * (1 - Math.abs(i - 1.5) * 0.12), 0.098, 0.8), PALETTE.crest, {
      pos: [x * 0.6, 0.14, 0.12],
      rot: [-1.15, 0, x * 0.62],
      ...BONE,
    })
  ),
  ...[0.13, -0.13].map((x) =>
    part(new THREE.SphereGeometry(0.038, 8, 7), 0xc8a83a, {
      pos: [x, 0.06, -0.3],
      ...BONE,
    })
  ),
];

const ancientLimbParts = () => [
  part(new THREE.CapsuleGeometry(0.145, 0.3, 8, 14), PALETTE.ancientHide, {
    pos: [0, -0.2, 0.02],
    ...HIDE,
  }),
];

// Shin, foot and claws: nothing below the knee turns on its own
const ancientShinParts = () => [
  part(new THREE.CapsuleGeometry(0.115, 0.26, 8, 14), PALETTE.ancientHide, {
    pos: [0, -0.16, 0],
    ...HIDE,
  }),
  part(
    prone(
      [
        [-0.17, -0.24],
        [0.17, -0.24],
        [0.19, 0.08],
        [0.1, 0.21],
        [0.035, 0.15],
        [-0.035, 0.21],
        [-0.1, 0.15],
        [-0.19, 0.08],
      ],
      0.13,
      0.016
    ),
    PALETTE.ancientHide,
    { pos: [0, -0.38, -0.08], ...HIDE }
  ),
  ...[0.1, -0.1].map((x) =>
    part(horn(0.22, 0.055), PALETTE.claw, {
      pos: [x, -0.38, -0.26],
      rot: [-1.5, 0, 0],
      ...BONE,
    })
  ),
];

// The forelimb, with its claws: the hand never turns on its own either
const ancientArmParts = (side) => [
  part(new THREE.CapsuleGeometry(0.11, 0.26, 8, 14), PALETTE.ancientHide, {
    pos: [0, -0.16, 0],
    ...HIDE,
  }),
  part(horn(0.22, 0.055), PALETTE.claw, {
    pos: [0, -0.38, -0.08],
    rot: [-1.2, 0, 0],
    ...BONE,
  }),
  part(horn(0.22, 0.055), PALETTE.claw, {
    pos: [side * 0.09, -0.38, -0.04],
    rot: [-1.1, 0, side * 0.3],
    ...BONE,
  }),
];

const ancientTailParts = () => [
  part(new THREE.CylinderGeometry(0.22, 0.06, 0.52, 16), PALETTE.ancientHide, {
    pos: [0, -0.06, 0.24],
    rot: [Math.PI / 2.3, 0, 0],
    ...HIDE,
  }),
];

// One Ancient, facing -Z, standing on y = 0.
const makeAncient = (buffers, material) => {
  const group = new THREE.Group();

  const hips = new THREE.Group();
  hips.position.y = 0.86;
  group.add(hips);

  // Hunched: the spine carried well forward, counterweighted by the tail.
  // An Ancient is a bipedal thing bent under its own shell.
  const spine = new THREE.Group();
  spine.rotation.x = 0.62;
  hips.add(spine);
  hang(spine, buffers.spine, material);

  const head = new THREE.Group();
  head.position.set(0, 0.16, -0.5);
  spine.add(head);
  hang(head, buffers.head, material);

  const legs = [1, -1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.28, -0.06, 0);
    hips.add(hip);
    hang(hip, buffers.leg, material);
    const shin = new THREE.Group();
    shin.position.y = -0.38;
    shin.rotation.x = -0.42;
    hip.add(shin);
    hang(shin, buffers.shin, material);
    return { hip, shin, side };
  });

  // Heavy forelimbs, hanging wide. They swing rather than carry anything —
  // an Ancient does not need a weapon.
  const arms = [1, -1].map((side, i) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.36, 0.04, -0.16);
    spine.add(shoulder);
    hang(shoulder, buffers.arm[i], material);
    return { shoulder, side };
  });

  const tailRoot = new THREE.Group();
  tailRoot.position.set(0, 0.02, 0.22);
  hips.add(tailRoot);
  hang(tailRoot, buffers.tail, material);

  return { group, hips, spine, head, legs, arms, tailRoot, kind: "ancients" };
};

// Where the animals stand. A herd is a loose group with its own spacing and
// its own angles — dressing them in ranks would make them a regiment, which
// is exactly what a Large unit is not.
const HERDS = {
  triceratops: {
    make: makeTriceratops,
    buffers: () => ({
      body: merge(trikeBodyParts()),
      head: merge(trikeHeadParts()),
      leg: merge(trikeLegParts()),
      shin: merge(trikeShinParts()),
      tail: merge(trikeTailParts()),
    }),
    beasts: [
      { x: -1.12, z: -0.05, turn: 0.17, scale: 1 },
      { x: 1.1, z: -0.12, turn: -0.21, scale: 0.96 },
      { x: -0.02, z: 0.16, turn: 0.05, scale: 1.04 },
    ],
  },
  ancients: {
    make: makeAncient,
    buffers: () => ({
      spine: merge(ancientSpineParts()),
      head: merge(ancientHeadParts()),
      leg: merge(ancientLimbParts()),
      shin: merge(ancientShinParts()),
      arm: [1, -1].map((side) => merge(ancientArmParts(side))),
      tail: merge(ancientTailParts()),
    }),
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
  const material = surfaceMaterial();
  // Built once and worn by every animal in the herd
  const buffers = herd.buffers();
  const root = new THREE.Group();
  const beasts = [];

  herd.beasts.forEach((placement, index) => {
    const beast = herd.make(buffers, material);
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
