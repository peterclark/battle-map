import * as THREE from "three";
import {
  at,
  bevelled,
  merge,
  part as skinned,
  surfaceMaterial,
  swept,
  turned,
} from "./kit.js";

// The Tyrannosaurus, and the scene every creature is lit by: real geometry
// under a real
// light, with the camera pointed straight down at it.
//
// The comparison this exists to settle is not "which drawing is better" — it
// is what each approach gets you for free. Here, the shadow is cast rather
// than drawn, the flank is shaded by where the light actually is, and the
// stride is a joint hierarchy rather than a set of sine curves chosen to look
// like one. The costs move too: a WebGL context, a 600 KB dependency, and a
// GPU doing work on whatever box drives the table.
//
// The geometry is primitives rather than a sculpted model, but it is no
// longer a stack of boxes. Since this is one animal alone on a Colossal stand
// — the biggest thing in the game, and the one most likely to be looked at
// closely in the combat panel — it is worth the geometry: a skull cut as a
// profile with a fenestra behind the eye, lips over the tooth rows,
// osteoderms down the spine, and a foot with three toes and claws. All of it
// merges into eighteen buffers, one per joint that actually moves, where the
// box version needed fifty meshes to say less.

// The animal used to be 0x3f5a2a on turf of 0x3f6420 — the same colour, near
// enough, which is the exact failure the guide warns about and the largest
// creature in the game was committing it. A Colossal that vanishes into the
// grass is worse than a small one that does, because there is only one of it
// and no formation to carry the read.
//
// So it is countershaded the way a big land predator actually is: pale sand
// along the flanks, a dark saddle and cross-banding over the back, cream
// underneath. Against a dark yellow-green field that separates by value first
// and hue second, which is the order that survives being shrunk.
const HIDE = 0xa8946a;
const HIDE_DARK = 0x5b4a2f;
const BAND = 0x6d5836;
const BELLY = 0xd8cba6;
const CLAW = 0xf0e9d6;
const MAW = 0x6d2730;

const EYE = 0xe8a423;

const HIDE_S = { roughness: 0.86 };
const SCUTE = { metalness: 0.15, roughness: 0.6 };
const BONE = { metalness: 0.2, roughness: 0.45 };
const WET = { metalness: 0.35, roughness: 0.24 };

// Outlines are x-across, y-along. `prone` lays one down pointing forward,
// which is how a skull, a jaw and a foot are built here.
const prone = (points, thickness, bevel = 0.03) =>
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

const tooth = (size) =>
  turned(
    [
      [size, 0],
      [size * 0.8, size * 0.7],
      [size * 0.45, size * 1.5],
      [0, size * 2.1],
    ],
    8
  );

// The trunk, and where the detail budget goes.
//
// This animal is alone on a Colossal stand, which on a 4K panel is roughly
// two hundred and eighty pixels across — about ten times the linear size of
// one infantryman, and a hundred times the pixels. It is also the single
// cheapest unit on the board at seventeen buffers against a spear block's two
// hundred. So the geometry here is deliberately lavish: everything below
// merges into the buffers that already exist, and costs nothing measurable.
const trunkParts = () => {
  const parts = [
    skinned(new THREE.CapsuleGeometry(1.15, 1.9, 12, 22), HIDE, {
      pos: [0, 0, -1.1],
      rot: [Math.PI / 2, 0, 0],
      scale: [1, 0.82, 1.05],
      ...HIDE_S,
    }),
    skinned(new THREE.CapsuleGeometry(0.92, 1.6, 12, 20), BELLY, {
      pos: [0, -0.42, -1.1],
      rot: [Math.PI / 2, 0, 0],
      scale: [0.94, 0.8, 0.9],
      ...HIDE_S,
    }),
    // The shoulder and hip masses. A theropod is not a tube: it is widest at
    // the pelvis, narrows through the ribs and swells again at the chest, and
    // that double bulge is most of what says "muscle" from above.
    skinned(new THREE.SphereGeometry(1.02, 16, 14), HIDE, {
      pos: [0, -0.05, 0.35],
      scale: [1.16, 0.86, 1.05],
      ...HIDE_S,
    }),
    skinned(new THREE.SphereGeometry(0.86, 16, 14), HIDE, {
      pos: [0, -0.02, -2.1],
      scale: [1.1, 0.9, 1.0],
      ...HIDE_S,
    }),
  ];

  // Osteoderms down the spine — the one pale line an overhead camera can
  // follow the whole length of the animal, and the strongest single read on
  // the model.
  //
  // Every one of these used to be *inside* the body. The trunk is a capsule
  // scaled before it is rotated, so its top surface sits at y = 1.21 rather
  // than the 0.94 its scale factor suggests, and detail placed by eye against
  // the wrong number vanishes without any sign that it is there. Anything
  // meant to sit on a body has to be checked against where the body's surface
  // actually is.
  [-2.4, -1.9, -1.4, -0.9, -0.4, 0.1, 0.6].forEach((z, i) => {
    parts.push(
      skinned(new THREE.OctahedronGeometry(0.22 + (i % 2) * 0.05, 0), CLAW, {
        pos: [0, 1.24 - Math.abs(i - 4) * 0.05, z],
        scale: [0.5, 1.15, 1.6],
        ...SCUTE,
      })
    );
  });

  // Two rows of smaller scutes down each flank, placed on the surface by
  // angle rather than by guesswork. Individually they are a pixel; together
  // they are a pair of dotted lines following the animal's length, and they
  // stop the flank reading as a balloon.
  [
    [35, CLAW, 0.1],
    [64, HIDE_DARK, 0.085],
  ].forEach(([deg, colour, r], row) => {
    const a = (deg * Math.PI) / 180;
    [-1, 1].forEach((side) =>
      [-2.3, -1.8, -1.3, -0.8, -0.3, 0.2, 0.7].forEach((z, i) =>
        parts.push(
          skinned(new THREE.OctahedronGeometry(r + (i % 2) * 0.015, 0), colour, {
            pos: [
              side * 1.15 * Math.sin(a) * 1.02,
              1.2075 * Math.cos(a) * 1.02,
              z + row * 0.25,
            ],
            scale: [0.45, 1, 1.5],
            ...SCUTE,
          })
        )
      )
    );
  });

  // Cross-bands over the back. Broad, shallow plates in the darker hide,
  // sitting a hair proud of the flank — from directly above they are the
  // whole pattern, and a smooth pale body needs them to stop reading as a
  // bean. Kept inside the capsule's straight section so they do not poke
  // through where it turns into its end caps.
  //
  // Narrower across than the body is, so each band only breaks the surface
  // over the spine and sinks away down the flank — a saddle rather than a
  // hoop. Widths and spacing are uneven on purpose: four identical bands
  // wrapped the whole way round read as a ladder strapped to the animal.
  [
    [-1.92, 1.02, 0.22, 0.1],
    [-1.34, 0.97, 0.16, -0.14],
    [-0.86, 1.04, 0.25, 0.06],
    [-0.42, 0.95, 0.15, -0.09],
    [-0.02, 1.0, 0.2, 0.12],
  ].forEach(([z, w, d, yaw]) => {
    parts.push(
      skinned(new THREE.SphereGeometry(1.0, 20, 14), BAND, {
        pos: [0, 0, z],
        rot: [0, yaw, 0],
        scale: [w, 1.25, d],
        ...HIDE_S,
      })
    );
  });

  // Skin folds where the leg meets the body, and along the flank behind the
  // ribs. Swept tubes, laid shallow so they catch the key light as creases
  // rather than standing proud as pipes.
  [-1, 1].forEach((side) =>
    [
      [[0.2, -0.5, 1.0], [1.02, -0.2, 0.55], [1.12, 0.35, -0.1]],
      [[0.35, -0.7, -1.9], [1.06, -0.35, -1.6], [1.05, 0.2, -1.1]],
      [[0.3, -0.6, -0.6], [1.05, -0.3, -0.45], [1.1, 0.25, -0.2]],
    ].forEach((path) =>
      parts.push(
        skinned(
          swept(
            path.map(([x, y, z]) => [x * side, y, z]),
            0.055,
            { segments: 14, sides: 5 }
          ),
          HIDE_DARK,
          { ...HIDE_S }
        )
      )
    )
  );

  return parts;
};

const neckParts = () => [
  skinned(new THREE.CapsuleGeometry(0.68, 0.6, 10, 16), HIDE, {
    pos: [0, 0, -0.38],
    rot: [Math.PI / 2.3, 0, 0],
    ...HIDE_S,
  }),
];

const headParts = () => {
  const parts = [
    // A skull cut as a profile: deep at the hinge, tapering to the snout,
    // with the brow ridge standing proud above the eye
    skinned(
      prone(
        [
          [-0.6, -0.95],
          [0.6, -0.95],
          [0.54, -0.2],
          [0.4, 0.46],
          [0.27, 0.88],
          [0, 0.98],
          [-0.27, 0.88],
          [-0.4, 0.46],
          [-0.54, -0.2],
        ],
        0.8,
        0.05
      ),
      HIDE,
      { pos: [0, 0, -0.72], ...HIDE_S }
    ),
    // A domed cranium over the back of the skull, so the head is not a slab
    skinned(new THREE.SphereGeometry(0.5, 14, 12), HIDE, {
      pos: [0, 0.24, -0.25],
      scale: [1.05, 0.55, 1.1],
      ...HIDE_S,
    }),
    // Brows, which is what makes a skull read as a skull from above
    ...[0.44, -0.44].map((x) =>
      skinned(new THREE.BoxGeometry(0.3, 0.22, 0.5), HIDE_DARK, {
        pos: [x, 0.34, -0.74],
        rot: [0, x > 0 ? -0.1 : 0.1, 0],
        ...HIDE_S,
      })
    ),
    // Lacrimal horns above the eye — small, but they break the brow line and
    // they are the one place a theropod skull has something pointed on top
    ...[0.44, -0.44].map((x) =>
      skinned(
        turned(
          [
            [0.1, 0],
            [0.07, 0.09],
            [0, 0.2],
          ],
          8
        ),
        CLAW,
        { pos: [x, 0.42, -0.78], rot: [-0.35, 0, x > 0 ? 0.2 : -0.2], ...BONE }
      )
    ),
    // The fenestra behind the eye, sunk into the cheek
    ...[0.56, -0.56].map((x) =>
      skinned(new THREE.SphereGeometry(0.22, 10, 8), HIDE_DARK, {
        pos: [x, 0.02, -0.42],
        scale: [0.4, 1, 1.5],
        ...HIDE_S,
      })
    ),
    // And the antorbital fenestra ahead of it, which is the hollow that makes
    // a theropod snout read as bone rather than as a muzzle
    ...[0.5, -0.5].map((x) =>
      skinned(new THREE.SphereGeometry(0.17, 10, 8), HIDE_DARK, {
        pos: [x, 0.06, -1.05],
        scale: [0.35, 0.9, 1.7],
        ...HIDE_S,
      })
    ),
    // The jugal boss, low on the cheek
    ...[0.55, -0.55].map((x) =>
      skinned(new THREE.SphereGeometry(0.16, 10, 8), HIDE, {
        pos: [x, -0.2, -0.6],
        scale: [0.6, 0.8, 1.6],
        ...HIDE_S,
      })
    ),
    ...[0.44, -0.44].map((x) =>
      skinned(new THREE.SphereGeometry(0.13, 14, 12), EYE, {
        pos: [x, 0.28, -0.86],
        ...WET,
      })
    ),
    // Nostrils
    ...[0.16, -0.16].map((x) =>
      skinned(new THREE.SphereGeometry(0.08, 8, 7), HIDE_DARK, {
        pos: [x, 0.14, -1.6],
        scale: [0.7, 0.8, 1.4],
        ...HIDE_S,
      })
    ),
  ];
  // A lip running the length of the upper jaw, over the tooth row. It is what
  // stops the teeth reading as a row of pegs stuck to a plank.
  [-1, 1].forEach((side) =>
    parts.push(
      skinned(
        swept(
          [
            [side * 0.42, -0.1, -0.2],
            [side * 0.46, -0.16, -0.7],
            [side * 0.4, -0.18, -1.2],
            [side * 0.2, -0.16, -1.62],
          ],
          0.075,
          { segments: 16, sides: 6 }
        ),
        HIDE_DARK,
        { ...HIDE_S }
      )
    )
  );
  // Upper tooth row
  for (let i = 0; i < 5; i += 1) {
    const z = -0.42 - i * 0.3;
    const size = 0.14 - i * 0.012;
    [0.32, -0.32].forEach((x) =>
      parts.push(
        skinned(tooth(size), CLAW, { pos: [x, -0.18, z], rot: [Math.PI, 0, 0], ...BONE })
      )
    );
  }
  return parts;
};

const jawParts = () => {
  const parts = [
    skinned(
      prone(
        [
          [-0.35, -1.0],
          [0.35, -1.0],
          [0.3, -0.1],
          [0.18, 0.7],
          [0, 0.95],
          [-0.18, 0.7],
          [-0.3, -0.1],
        ],
        0.3,
        0.03
      ),
      HIDE_DARK,
      { pos: [0, -0.1, -1.0], ...HIDE_S }
    ),
    skinned(new THREE.BoxGeometry(0.52, 0.12, 1.5), MAW, {
      pos: [0, 0.06, -0.95],
      ...HIDE_S,
    }),
  ];
  for (let i = 0; i < 5; i += 1) {
    const z = -0.42 - i * 0.32;
    const size = 0.14 - i * 0.012;
    [0.3, -0.3].forEach((x) =>
      parts.push(skinned(tooth(size), CLAW, { pos: [x, 0.12, z], ...BONE }))
    );
  }
  return parts;
};

const tailParts = (i) => [
  skinned(new THREE.CapsuleGeometry(0.88 - i * 0.155, 0.4, 8, 16), HIDE, {
    pos: [0, 0, 0.42],
    rot: [Math.PI / 2, 0, 0],
    ...HIDE_S,
  }),
  skinned(new THREE.OctahedronGeometry(0.16 - i * 0.022, 0), CLAW, {
    pos: [0, 0.84 - i * 0.155, 0.3],
    scale: [0.55, 1, 1.5],
    ...SCUTE,
  }),
];

const thighParts = () => [
  skinned(new THREE.CapsuleGeometry(0.66, 1.05, 10, 16), HIDE, {
    pos: [0, -0.5, 0],
    scale: [1, 1, 1.3],
    ...HIDE_S,
  }),
];

const shinParts = () => [
  skinned(new THREE.CapsuleGeometry(0.34, 0.95, 8, 16), HIDE_DARK, {
    pos: [0, -0.5, 0],
    ...HIDE_S,
  }),
];

const footParts = () => {
  const parts = [
    skinned(new THREE.BoxGeometry(0.5, 0.22, 0.6), HIDE_DARK, {
      pos: [0, -0.1, -0.16],
      ...HIDE_S,
    }),
  ];
  [-0.3, 0, 0.3].forEach((fan) => {
    parts.push(
      skinned(
        prone(
          [
            [-0.09, -0.32],
            [0.09, -0.32],
            [0.08, 0.28],
            [-0.08, 0.28],
          ],
          0.16,
          0.02
        ),
        HIDE_DARK,
        {
          pos: [Math.sin(fan) * 0.34, -0.12, -0.52 - Math.cos(fan) * 0.1],
          rot: [0, fan, 0],
          ...HIDE_S,
        }
      ),
      skinned(
        turned(
          [
            [0.1, 0],
            [0.08, 0.1],
            [0.05, 0.2],
            [0, 0.3],
          ],
          10
        ),
        CLAW,
        {
          pos: [Math.sin(fan) * 0.4, -0.12, -0.88 - Math.cos(fan) * 0.1],
          rot: [-Math.PI / 2, fan, 0],
          ...BONE,
        }
      )
    );
  });
  return parts;
};

const armParts = () => [
  skinned(new THREE.CapsuleGeometry(0.16, 0.42, 8, 14), HIDE_DARK, {
    pos: [0, -0.3, 0],
    ...HIDE_S,
  }),
  ...[0.06, -0.06].map((x) =>
    skinned(
      turned(
        [
          [0.07, 0],
          [0.05, 0.1],
          [0, 0.26],
        ],
        8
      ),
      CLAW,
      { pos: [x, -0.62, -0.1], rot: [-0.5, 0, 0], ...BONE }
    )
  ),
];

// How hard each tail segment is swept at rest, accumulating outward. The
// wave the poser runs is added on top of these rather than replacing them.
const TAIL_SWEEP = [0.58, 0.64, 0.68, 0.7, 0.7];

// And the neck counter-curves, which is what makes it an S rather than a
// comma — the head comes back toward the front of the stand instead of
// trailing off the side with the tail.
const NECK_SWEEP = -1.15;
const HEAD_SWEEP = -0.55;

/**
 * Build the animal. Returns the root object plus the joints an animation
 * needs to touch, so posing is setting rotations rather than rebuilding.
 */
export const buildTyrannosaur = () => {
  const material = surfaceMaterial();
  const root = new THREE.Group();

  // Hips carry everything; the animal pivots about them the way it really does
  const hips = new THREE.Group();
  hips.position.set(0, 2.6, 0.6);
  root.add(hips);
  hang(hips, merge(trunkParts()), material);

  // Neck and head, hinged so the head can swing and duck
  const neck = new THREE.Group();
  neck.position.set(0, 0.52, -1.8);
  neck.rotation.y = NECK_SWEEP;
  hips.add(neck);
  hang(neck, merge(neckParts()), material);

  const head = new THREE.Group();
  head.position.set(0, 0.2, -1.0);
  head.rotation.y = HEAD_SWEEP;
  neck.add(head);
  hang(head, merge(headParts()), material);

  // Lower jaw on its own hinge
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.24, -0.2);
  head.add(jaw);
  hang(jaw, merge(jawParts()), material);

  // Tail: a chain of groups, each hung off the last, so a wave started at the
  // hips travels outward on its own.
  //
  // It is also swept hard to one side at rest, and that is a fit decision as
  // much as an artistic one. Straight out behind, this animal measured three
  // times longer than it was wide, and the stand fits against *both* axes — so
  // it was scaled down to squeeze eleven units of nose-to-tail into a band
  // barely one and a half deep. Curled, the same length becomes width, which
  // is the axis with room. It is what a sculptor does with a long animal on a
  // shallow base, and for the same reason.
  const tail = [];
  let attach = hips;
  for (let i = 0; i < TAIL_SWEEP.length; i += 1) {
    const seg = new THREE.Group();
    seg.position.set(0, 0, i === 0 ? 0.85 : 0.66);
    seg.userData.restY = TAIL_SWEEP[i];
    seg.rotation.y = TAIL_SWEEP[i];
    attach.add(seg);
    hang(seg, merge(tailParts(i)), material);
    tail.push(seg);
    attach = seg;
  }

  const thighBuffer = merge(thighParts());
  const shinBuffer = merge(shinParts());
  const footBuffer = merge(footParts());
  const legs = [1, -1].map((side) => {
    const thigh = new THREE.Group();
    thigh.position.set(side * 1.12, -0.1, -0.1);
    hips.add(thigh);
    thigh.rotation.z = -side * 0.34;
    hang(thigh, thighBuffer, material);

    const shin = new THREE.Group();
    shin.position.set(0, -1.05, 0);
    shin.rotation.z = side * 0.34;
    thigh.add(shin);
    hang(shin, shinBuffer, material);

    const foot = new THREE.Group();
    foot.position.set(0, -1.05, 0);
    shin.add(foot);
    hang(foot, footBuffer, material);

    return { thigh, shin, foot };
  });

  const armBuffer = merge(armParts());
  const arms = [1, -1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.78, 0.1, -1.85);
    hips.add(arm);
    hang(arm, armBuffer, material);
    return arm;
  });

  return { root, hips, neck, head, jaw, tail, legs, arms };
};

const GAITS = {
  idle: { wave: 1.1, waveGain: 0.5, stride: 0.1, bob: 0.4, jaw: 0.05, surge: 0 },
  march: { wave: 2.4, waveGain: 1, stride: 1, bob: 1, jaw: 0.12, surge: 0 },
  attack: { wave: 3.3, waveGain: 1.3, stride: 0.55, bob: 1.5, jaw: 1, surge: 1 },
};

/**
 * Pose the animal for a moment in time. Nothing is rebuilt — this only sets
 * rotations, which is what keeps a boardful of them affordable.
 */
export const poseTyrannosaur = (rig, time, state = "idle") => {
  const gait = GAITS[state] ?? GAITS.idle;
  const t = time;

  // The wave travels down the tail rather than swinging it as one piece
  rig.tail.forEach((seg, i) => {
    // Added to the rest sweep, not replacing it — the curl is the animal's
    // shape and the wave is what it is doing.
    //
    // The amplitude falls off toward the base rather than growing toward the
    // tip, which is both what a curled tail does — it flicks at the end, it
    // does not swing as one bar — and what keeps the animal inside the stand
    // it was fitted to. The fit is measured from a static bounding box, so a
    // pose that sweeps far outside it puts the tail across the name banner.
    const reach = 0.08 + i * 0.03;
    seg.rotation.y =
      seg.userData.restY +
      Math.sin(t * gait.wave - i * 0.6) * reach * gait.waveGain;
    seg.rotation.x = Math.sin(t * gait.wave * 0.5 - i * 0.4) * 0.04;
  });

  // Head and neck counter the tail, which is what keeps the animal balanced
  rig.neck.rotation.y =
    NECK_SWEEP - Math.sin(t * gait.wave) * 0.1 * gait.waveGain;
  rig.neck.rotation.x = 0.1 + Math.sin(t * gait.wave * 2) * 0.05 * gait.bob;
  rig.head.rotation.x = -0.12 + Math.sin(t * gait.wave * 2 + 0.7) * 0.07 * gait.bob;
  rig.head.rotation.y = HEAD_SWEEP + Math.sin(t * 0.7) * 0.14;

  const jawOpen =
    state === "attack"
      ? 0.28 + 0.34 * Math.abs(Math.sin(t * 5))
      : gait.jaw + Math.max(Math.sin(t * 0.6), 0.8) * 0.06;
  rig.jaw.rotation.x = jawOpen;

  // Stride: the two legs run half a cycle apart, and the shin trails the thigh
  rig.legs.forEach(({ thigh, shin, foot }, i) => {
    const phase = t * gait.wave * 2 + i * Math.PI;
    thigh.rotation.x = Math.sin(phase) * 0.55 * gait.stride;
    shin.rotation.x = Math.max(-Math.sin(phase - 0.7), 0) * 0.8 * gait.stride;
    foot.rotation.x = -thigh.rotation.x * 0.5 - shin.rotation.x * 0.5;
  });

  rig.arms.forEach((arm, i) => {
    arm.rotation.x = -0.5 + Math.sin(t * 3 + i) * 0.16;
  });

  // The whole animal rises and falls on each stride, and pitches into a lunge
  rig.hips.position.y = 2.6 + Math.sin(t * gait.wave * 4) * 0.11 * gait.bob;
  rig.hips.rotation.x =
    Math.sin(t * gait.wave * 2) * 0.03 * gait.bob -
    gait.surge * Math.max(Math.sin(t * 5), 0) * 0.16;
  // The lunge moves the hips, not the root.
  //
  // `CreatureLayer` owns `root.position` — it is what places the rig inside
  // the card's art field — so a poser writing to it silently discards that
  // placement. This one did, every frame, and the animal sat centred on the
  // stand with its tail across the name banner. It is the same trap as writing
  // to `root.scale`, which the cavalry rig fell into; the rule is that a poser
  // touches nothing on the root.
  rig.hips.position.z = 0.6 - gait.surge * Math.max(Math.sin(t * 5), 0) * 0.9;
};

/**
 * A scene lit for a table seen from directly above: one hard key throwing a
 * real shadow across the ground, and enough fill that the flanks do not go
 * black. The camera is orthographic, so the animal does not distort toward
 * the edges of the board the way a perspective lens would.
 */
export const buildScene = (width, height, { span = 14 } = {}) => {
  const scene = new THREE.Scene();

  const aspect = width / height;
  const camera = new THREE.OrthographicCamera(
    (-span * aspect) / 2,
    (span * aspect) / 2,
    span / 2,
    -span / 2,
    0.1,
    100
  );
  camera.position.set(0, 20, 0);
  camera.lookAt(0, 0, 0);
  // Straight down needs an explicit up, or the view rolls arbitrarily
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);

  const key = new THREE.DirectionalLight(0xfff0d0, 2.1);
  key.position.set(3.5, 17, 2.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  key.shadow.bias = -0.0015;
  scene.add(key);

  scene.add(new THREE.HemisphereLight(0xbcd6ff, 0x2b3d19, 0.55));
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));

  // A rim from behind and low, opposite the key. It does almost nothing to
  // brightness and a great deal to shape: it catches the far edge of a helmet
  // or a shoulder and separates the figure from whatever is behind it, which
  // is the difference between a lit model and a lump with a shadow.
  const rim = new THREE.DirectionalLight(0xcfe0ff, 1.1);
  rim.position.set(-6, 4, -9);
  scene.add(rim);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x3f6420, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  return { scene, camera, ground, key, rim };
};

/**
 * Point the camera at the board from `degrees` off vertical. Zero is straight
 * down, which is the honest choice for a surface two players stand across —
 * any tilt favours whoever is on the low side.
 */
export const setTilt = (camera, degrees) => {
  const radians = (degrees * Math.PI) / 180;
  const distance = 20;
  camera.position.set(
    0,
    Math.cos(radians) * distance,
    Math.sin(radians) * distance
  );
  camera.up.set(0, Math.cos(radians), -Math.sin(radians));
  camera.lookAt(0, 1.6, 0);
  camera.updateProjectionMatrix();
};
