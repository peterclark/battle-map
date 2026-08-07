import * as THREE from "three";
import { at, bevelled, merge, part, surfaceMaterial, turned } from "./kit.js";

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
//
// The figures merge the way the infantry do — one buffer per part that moves
// on its own, nine rather than eighteen meshes — and the budget that frees
// went into the things that make a reptile a reptile at close range: a row of
// osteoderms down each flank, a crest that sweeps back off the skull, clawed
// three-toed feet, and a serrated blade rather than a cone.

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

const SCALE = { roughness: 0.72 };
const BONE_S = { metalness: 0.18, roughness: 0.55 };
const BLADE = { metalness: 0.5, roughness: 0.26 };
const HIDE = { roughness: 0.85 };
const WOOD = { roughness: 0.8 };

// Two ways to lay an extruded outline down, and mixing them up costs an
// afternoon. `flat` is for things carried along a haft — blades, heads — and
// puts width fore-and-aft with thickness side to side. `prone` is for things
// that lie along the ground pointing forward — skulls, jaws, feet — and keeps
// width across the figure with thickness as height. The outline is drawn the
// same way for both: x across, y along.
const flat = (points, thickness, bevel) =>
  at(bevelled(points, thickness, bevel), { rot: [0, -Math.PI / 2, 0] });

const prone = (points, thickness, bevel) =>
  at(bevelled(points, thickness, bevel), { rot: [-Math.PI / 2, 0, 0] });

// Body, dorsal ridge, forelimbs and whatever they hold that does not swing.
const spineParts = (breed) => {
  const parts = [
    part(new THREE.CapsuleGeometry(0.2, 0.34, 8, 16), breed.body, {
      pos: [0, 0.04, -0.06],
      rot: [Math.PI / 2, 0, 0],
      scale: [1.05, 1, 1],
      ...SCALE,
    }),
    // The dorsal ridge: the brightest thing on the figure, running its length.
    // This is the read from directly overhead and everything else is detail.
    part(
      at(
        bevelled(
          [
            [-0.045, 0.34],
            [0.045, 0.34],
            [0.05, 0.12],
            [0.038, -0.04],
            [0.05, -0.2],
            [0.04, -0.32],
            [-0.04, -0.32],
            [-0.05, -0.2],
            [-0.038, -0.04],
            [-0.05, 0.12],
          ],
          0.06,
          0.006
        ),
        { rot: [Math.PI / 2, 0, 0] }
      ),
      breed.ridge,
      { pos: [0, 0.2, -0.06], ...BONE_S }
    ),
    // Raked backward so each spine presents its length to the camera rather
    // than its point
    ...[-0.16, 0.02, 0.2].map((z, i) =>
      part(
        turned(
          [
            [0, 0],
            [0.05, 0.02],
            [0.036, 0.09],
            [0, 0.17],
          ],
          10
        ),
        breed.ridge,
        { pos: [0, 0.23, z], rot: [0.7 + i * 0.05, 0, 0], ...BONE_S }
      )
    ),
  ];

  // Osteoderms down the flanks. Individually two pixels; together they are a
  // dotted line the length of the animal, which is what scaly hide looks like
  // when it is too small to model.
  [-1, 1].forEach((side) =>
    [-0.24, -0.1, 0.04, 0.18].forEach((z, i) =>
      parts.push(
        part(new THREE.OctahedronGeometry(0.035 + (i % 2) * 0.008, 0), breed.ridge, {
          pos: [side * 0.19, 0.06 - (i % 2) * 0.03, z],
          scale: [0.7, 1, 1.3],
          ...BONE_S,
        })
      )
    )
  );

  // Forelimbs. Neither rotates in the poser — the blade does — so they belong
  // here rather than in buffers of their own.
  [-1, 1].forEach((side) =>
    parts.push(
      part(new THREE.CapsuleGeometry(0.048, 0.18, 8, 12), breed.limb, {
        pos: [side * 0.19, -0.03, -0.06],
        ...SCALE,
      }),
      // Claws on the hand
      ...[-0.03, 0, 0.03].map((dx) =>
        part(new THREE.ConeGeometry(0.014, 0.05, 6), BONE, {
          pos: [side * 0.19 + dx, -0.14, -0.08],
          rot: [-2.4, 0, 0],
          ...BONE_S,
        })
      )
    )
  );

  if (breed.shield) {
    // A hide shield on a wicker frame, canted to present its face upward as
    // well as forward — the broadest pale surface the figure has
    parts.push(
      part(
        turned(
          [
            [0, -0.03],
            [0.12, -0.025],
            [0.18, -0.012],
            [0.198, 0],
            [0.19, 0.014],
            [0, 0.022],
          ],
          18
        ),
        SHIELD_FACE,
        { pos: [-0.25, -0.06, -0.14], rot: [Math.PI / 2.5, 0, 0.1], ...HIDE }
      ),
      part(new THREE.TorusGeometry(0.19, 0.016, 6, 20), HAFT, {
        pos: [-0.25, -0.06, -0.14],
        rot: [Math.PI / 2.5 + Math.PI / 2, 0, 0.1],
        ...WOOD,
      })
    );
  }

  return parts;
};

// A wedge laid along -Z: a snout, not a ball, with a crest sweeping back
const headParts = (breed) => [
  part(
    prone(
      [
        [-0.088, -0.13],
        [0.088, -0.13],
        [0.078, 0.06],
        [0.045, 0.17],
        [0, 0.22],
        [-0.045, 0.17],
        [-0.078, 0.06],
      ],
      0.14,
      0.01
    ),
    breed.body,
    // Squeezed toward the snout so the skull wedges rather than sitting as a
    // block: a reptile's head is deepest at the jaw hinge and thins forward
    { pos: [0, 0.02, -0.07], rot: [0.12, 0, 0], scale: [1, 1, 1], ...SCALE }
  ),
  // Jaw, slung under the snout
  part(
    prone(
      [
        [-0.085, -0.13],
        [0.085, -0.13],
        [0.075, 0.1],
        [0, 0.22],
        [-0.075, 0.1],
      ],
      0.06,
      0.008
    ),
    breed.limb,
    { pos: [0, -0.06, -0.09], rot: [0.16, 0, 0], ...SCALE }
  ),
  // Teeth along the jaw line
  ...[-0.06, -0.02, 0.02, 0.06].map((x, i) =>
    part(new THREE.ConeGeometry(0.014, 0.045, 5), BONE, {
      pos: [x, -0.035, -0.16 - (i % 2) * 0.04],
      rot: [Math.PI, 0, 0],
      ...BONE_S,
    })
  ),
  // The crest: a fan of bone off the back of the skull, laid nearly flat so
  // it reads as area rather than as a spike
  part(
    at(
      bevelled(
        [
          [-0.02, 0],
          [0.02, 0],
          [0.13, -0.12],
          [0.1, -0.22],
          [0.04, -0.18],
          [0, -0.26],
          [-0.04, -0.18],
          [-0.1, -0.22],
          [-0.13, -0.12],
        ],
        0.035,
        0.006
      ),
      { rot: [Math.PI / 2, 0, 0] }
    ),
    breed.ridge,
    { pos: [0, 0.07, 0.02], rot: [-0.35, 0, 0], ...BONE_S }
  ),
  ...[0.07, -0.07].map((x) =>
    part(new THREE.SphereGeometry(0.028, 8, 7), 0xd8b23a, {
      pos: [x, 0.05, -0.12],
      ...BLADE,
    })
  ),
];

const tailAParts = (breed) => [
  part(new THREE.CylinderGeometry(0.075, 0.05, 0.34, 14), breed.body, {
    pos: [0, 0, 0.16 * breed.tail],
    rot: [Math.PI / 2, 0, 0],
    ...SCALE,
  }),
  ...[0.06, 0.2].map((z) =>
    part(new THREE.OctahedronGeometry(0.03, 0), breed.ridge, {
      pos: [0, 0.07, z * breed.tail],
      scale: [0.6, 1.3, 1],
      ...BONE_S,
    })
  ),
];

const tailBParts = (breed) => [
  part(new THREE.CylinderGeometry(0.055, 0.015, 0.36, 14), breed.body, {
    pos: [0, -0.02, 0.17 * breed.tail],
    rot: [Math.PI / 2.15, 0, 0],
    ...SCALE,
  }),
];

const thighParts = (breed) => [
  part(new THREE.CapsuleGeometry(0.062, 0.16, 8, 12), breed.limb, {
    pos: [0, -0.1, 0.02],
    ...SCALE,
  }),
];

// Shin and foot together: the foot never rotates on its own
const shinParts = (breed) => [
  part(new THREE.CapsuleGeometry(0.048, 0.16, 8, 12), breed.limb, {
    pos: [0, -0.09, 0],
    ...SCALE,
  }),
  // Three toes, splayed — a bird's foot, which is the correct foot for this
  // and also the widest thing at ground level
  ...[-0.055, 0, 0.055].map((x, i) =>
    part(
      prone(
        [
          [-0.024, -0.05],
          [0.024, -0.05],
          [0.02, 0.1],
          [-0.02, 0.1],
        ],
        0.045,
        0.006
      ),
      breed.limb,
      { pos: [x, -0.19, -0.06 - (i === 1 ? 0.03 : 0)], rot: [0, x * 2.4, 0], ...SCALE }
    )
  ),
  ...[-0.055, 0, 0.055].map((x, i) =>
    part(new THREE.ConeGeometry(0.016, 0.055, 6), BONE, {
      pos: [x, -0.215, -0.14 - (i === 1 ? 0.03 : 0)],
      rot: [-Math.PI / 2, 0, 0],
      ...BONE_S,
    })
  ),
];

// A serrated blade lashed to a haft — the weapon a people without forges makes
const weaponParts = () => [
  part(new THREE.CylinderGeometry(0.024, 0.028, 0.86, 12), HAFT, {
    pos: [0, 0.3, 0],
    ...WOOD,
  }),
  part(
    flat(
      [
        [-0.055, 0],
        [0.055, 0],
        [0.07, 0.08],
        [0.05, 0.13],
        [0.068, 0.18],
        [0.045, 0.23],
        [0.06, 0.28],
        [0, 0.38],
        [-0.06, 0.28],
        [-0.045, 0.23],
        [-0.068, 0.18],
        [-0.05, 0.13],
        [-0.07, 0.08],
      ],
      0.038,
      0.006
    ),
    STEEL,
    { pos: [0, 0.66, 0], ...BLADE }
  ),
  // The lashing that holds it on
  ...[0, 1, 2].map((i) =>
    part(new THREE.TorusGeometry(0.032, 0.008, 5, 12), SHIELD_FACE, {
      pos: [0, 0.6 + i * 0.03, 0],
      rot: [Math.PI / 2, 0, 0.2 * (i - 1)],
      ...HIDE,
    })
  ),
];

const hang = (parent, geometry, material, position) => {
  if (!geometry) return null;
  const mesh = new THREE.Mesh(geometry, material);
  if (position) mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

const buildBuffers = (breed) => ({
  spine: merge(spineParts(breed)),
  head: merge(headParts(breed)),
  tailA: merge(tailAParts(breed)),
  tailB: merge(tailBParts(breed)),
  thigh: merge(thighParts(breed)),
  shin: merge(shinParts(breed)),
  weapon: breed.armed ? merge(weaponParts()) : null,
});

// One lizardfolk, facing -Z, standing on y = 0.
const makeLizard = (breed, buffers, material) => {
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
  hang(spine, buffers.spine, material);

  const head = new THREE.Group();
  head.position.set(0, 0.12, -0.36);
  spine.add(head);
  hang(head, buffers.head, material);

  // Tail: two tapering segments, hinged, so it can swing as one curve
  const tailRoot = new THREE.Group();
  tailRoot.position.set(0, 0.12, 0.08);
  hips.add(tailRoot);
  hang(tailRoot, buffers.tailA, material);
  const tailTip = new THREE.Group();
  tailTip.position.z = 0.32 * breed.tail;
  tailRoot.add(tailTip);
  hang(tailTip, buffers.tailB, material);
  tailRoot.scale.z = breed.tail;

  // Digitigrade legs, splayed wider than a man's — the stance is half the
  // silhouette from above
  const legs = [1, -1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.14, -0.04, 0);
    hips.add(hip);
    hang(hip, buffers.thigh, material);
    const shin = new THREE.Group();
    shin.position.y = -0.2;
    hip.add(shin);
    shin.rotation.x = -0.5;
    hang(shin, buffers.shin, material);
    return { hip, shin, side };
  });

  // On the armed breeds the right forelimb carries a blade, shouldered — a
  // vertical haft is a dot from overhead, and this project has learned that
  // the hard way twice. The beasts just have claws.
  let weapon = null;
  if (buffers.weapon) {
    weapon = new THREE.Group();
    weapon.position.set(0.21, -0.04, -0.06);
    spine.add(weapon);
    hang(weapon, buffers.weapon, material);
  }

  return { group, hips, spine, head, tailRoot, tailTip, legs, weapon };
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
  const material = surfaceMaterial();
  const buffers = buildBuffers(spec);

  const root = new THREE.Group();
  const lizards = [];

  const stepX = 1.02 * spec.scale;
  const stepZ = 1.0 * spec.scale;

  for (let rank = 0; rank < spec.ranks; rank += 1) {
    for (let file = 0; file < spec.files; file += 1) {
      const lizard = makeLizard(spec, buffers, material);
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
