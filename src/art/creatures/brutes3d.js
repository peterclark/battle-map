import * as THREE from "three";
import { at, bevelled, merge, part, surfaceMaterial, swept, turned } from "./kit.js";

// The big ones that are not beasts: Trolls, Ogres, the Hill Giant, the Earth
// Elemental, and the undead versions of all of them. The Abomination used to
// live here too and is in `abomination3d.js`, since it has no skeleton to share.
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
//
// The merge pays for itself twice over here. A brute is twelve buffers rather
// than twenty meshes, and a brute's *skin* is where the freed budget went:
// knotted muscle, warts, a hide cloak cut with a ragged hem, a club that is a
// tree rather than a cylinder. None of that would have been affordable as
// separate meshes on three or four figures a stand.

const KINDS = {
  troll: {
    // Lifted off 0x5c6b4a, which measured 1.2:1 against the turf — the same
    // failure the Tyrannosaurus was committing. Still mossy, but now paler
    // than the field rather than the same value as it.
    hide: 0x8a9a63,
    hideDark: 0x53603c,
    back: 0x9aa87c,
    detail: 0xd8cfb4,
    scale: 1,
    count: 3,
    hunch: 0.62,
    club: true,
    // What lies across the shoulders, which is the brightest thing on it
    mantle: "moss",
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
    mantle: "hide",
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
    mantle: "hide",
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
    mantle: "bone",
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
    mantle: "stone",
  },
};

const MEAT = { roughness: 0.9, mottle: 0.18, mottleScale: 5 };
const HORN = { metalness: 0.2, roughness: 0.5 };
const STONE = { roughness: 0.95 };

// A lopsided lump — the unit of construction for anything made of meat.
// Scaled unevenly and rotated off-axis so no two read as the same sphere.
const lump = (radius, seed) =>
  new THREE.SphereGeometry(radius, 10 + (seed % 3) * 2, 8 + (seed % 2) * 2);

const spineParts = (spec) => {
  const parts = [
    part(new THREE.CapsuleGeometry(0.42, 0.5, 10, 18), spec.hide, {
      pos: [0, 0.1, 0],
      rot: [Math.PI / 2.4, 0, 0],
      scale: [1.08, 1, 1],
      ...MEAT,
    }),
    ...[0.42, -0.42].map((x) =>
      part(new THREE.SphereGeometry(0.28, 14, 12), spec.hideDark, {
        pos: [x, 0.3, -0.14],
        scale: [1.1, 0.95, 1],
        ...MEAT,
      })
    ),
  ];

  // The slab across the shoulders: the widest, brightest thing on the figure,
  // and the one place where the kind is worth distinguishing.
  if (spec.mantle === "stone") {
    // Slabs of rock, overlapping, at angles — weather rather than tailoring
    [
      [-0.34, 0.34, 0.02, 0.5, 0.16],
      [0.16, 0.4, -0.02, 0.56, -0.2],
      [-0.02, 0.3, 0.28, 0.44, 0.38],
    ].forEach(([x, y, z, w, roll], i) => {
      parts.push(
        part(
          bevelled(
            [
              [-w, -0.2],
              [-w * 0.7, -0.28],
              [w * 0.8, -0.24],
              [w, 0.06],
              [w * 0.5, 0.28],
              [-w * 0.6, 0.24],
            ],
            0.15,
            0.02
          ),
          i === 1 ? spec.back : spec.detail,
          { pos: [x, y, z], rot: [Math.PI / 2 - 0.3, roll, 0], ...STONE }
        )
      );
    });
  } else {
    // A hide, a bone plate or a mat of moss, cut with a ragged edge. A
    // rectangle across the shoulders reads as a plank; a torn hem reads as
    // something that was flayed off an animal.
    parts.push(
      part(
        at(
          bevelled(
            [
              [-0.52, 0.3],
              [0.52, 0.3],
              [0.56, 0.02],
              [0.44, -0.1],
              [0.5, -0.24],
              [0.3, -0.32],
              [0.12, -0.2],
              [-0.06, -0.34],
              [-0.26, -0.22],
              [-0.44, -0.3],
              [-0.5, -0.08],
            ],
            0.14,
            0.016
          ),
          { rot: [Math.PI / 2, 0, 0] }
        ),
        spec.back,
        { pos: [0, 0.47, 0.1], rot: [0.24, 0, 0], ...MEAT }
      )
    );
    // Knots of muscle and warts over the back. Free, now that they merge.
    //
    // Sitting on the back rather than in it: the torso is a capsule scaled
    // before it is rotated, so its upper surface is near y = 0.55 and not the
    // 0.42 its radius suggests. Detail placed against the wrong number is
    // simply invisible, with nothing to show it is there.
    [
      [0.2, 0.56, -0.1, 0.1],
      [-0.24, 0.54, 0.16, 0.085],
      [0.06, 0.58, 0.26, 0.07],
      [-0.1, 0.52, -0.24, 0.09],
      [0.34, 0.44, 0.2, 0.075],
      [-0.36, 0.42, -0.06, 0.08],
    ].forEach(([x, y, z, r], i) => {
      parts.push(
        part(lump(r, i), i % 2 ? spec.hideDark : spec.detail, {
          pos: [x, y, z],
          scale: [1.2, 0.7, 1],
          ...MEAT,
        })
      );
    });
  }

  // A ridge of knobbled vertebrae down the spine. A brute's back is the
  // largest single surface anything on this board turns upward, and until now
  // it was blank — this is the one pale line an overhead camera can follow.
  // Set forward of the mantle rather than under it, so the two do not fight
  [-0.62, -0.48, -0.34, -0.2, -0.06].forEach((z, i) =>
    parts.push(
      part(new THREE.OctahedronGeometry(0.075 - Math.abs(i - 2) * 0.008, 0), spec.detail, {
        pos: [0, 0.56 - Math.abs(i - 2) * 0.015, z],
        scale: [0.6, 1, 1.4],
        ...HORN,
      })
    )
  );

  // Scars across the shoulders, and the rope that holds whatever it is
  // wearing. Both are swept lines, which is the cheapest way to put something
  // on a curved surface that follows it.
  [
    [[-0.5, 0.4, 0.1], [-0.1, 0.56, -0.02], [0.34, 0.46, -0.16]],
    [[0.2, 0.5, 0.36], [0.38, 0.52, 0.1], [0.3, 0.4, -0.2]],
  ].forEach((path) =>
    parts.push(
      part(swept(path, 0.022, { segments: 12, sides: 4 }), spec.detail, { ...MEAT })
    )
  );
  parts.push(
    part(
      swept(
        [
          [-0.46, 0.2, 0.06],
          [-0.2, 0.46, 0.3],
          [0.2, 0.46, 0.3],
          [0.46, 0.2, 0.06],
        ],
        0.028,
        { segments: 16, sides: 5 }
      ),
      spec.hideDark,
      { ...MEAT }
    )
  );

  if (spec.mantle === "bone") {
    // Ribs showing through, which is the whole point of a skeleton troll
    [0.22, 0.06, -0.1].forEach((z, i) =>
      parts.push(
        part(swept(
          [
            [-0.34, -0.1, 0],
            [-0.24, 0.12, 0],
            [0, 0.2, 0],
            [0.24, 0.12, 0],
            [0.34, -0.1, 0],
          ],
          0.035,
          { segments: 14, sides: 5 }
        ), spec.detail, { pos: [0, 0.16 - i * 0.02, z], ...HORN })
      )
    );
  }

  return parts;
};

const headParts = (spec) => [
  part(new THREE.SphereGeometry(0.24, 14, 12), spec.hide, {
    scale: [1, 0.98, 1.1],
    ...MEAT,
  }),
  // A heavy brow, which is most of what makes a head look brutal from above
  part(
    at(
      bevelled(
        [
          [-0.2, -0.05],
          [0.2, -0.05],
          [0.22, 0.05],
          [0, 0.09],
          [-0.22, 0.05],
        ],
        0.14,
        0.014
      ),
      { rot: [Math.PI / 2, 0, 0] }
    ),
    spec.hideDark,
    { pos: [0, 0.06, -0.16], rot: [0.3, 0, 0], ...MEAT }
  ),
  // Jaw, undershot
  part(
    at(
      bevelled(
        [
          [-0.14, -0.09],
          [0.14, -0.09],
          [0.15, 0.05],
          [0.08, 0.08],
          [-0.08, 0.08],
          [-0.15, 0.05],
        ],
        0.24,
        0.014
      ),
      { rot: [Math.PI / 2, 0, 0] }
    ),
    spec.hideDark,
    { pos: [0, -0.16, -0.12], ...MEAT }
  ),
  // Tusks, turned so they curve rather than stand as cones
  ...[0.1, -0.1].map((x) =>
    part(
      turned(
        [
          [0, 0],
          [0.05, 0.03],
          [0.045, 0.1],
          [0.03, 0.16],
          [0, 0.2],
        ],
        10
      ),
      spec.detail,
      { pos: [x, -0.14, -0.2], rot: [-0.45, 0, x > 0 ? 0.22 : -0.22], ...HORN }
    )
  ),
  ...[0.11, -0.11].map((x) =>
    part(new THREE.SphereGeometry(0.05, 10, 8), 0xc8a83a, {
      pos: [x, 0.02, -0.2],
      ...HORN,
    })
  ),
];

const upperArmParts = (spec) => [
  part(new THREE.CapsuleGeometry(0.15, 0.42, 8, 14), spec.hide, {
    pos: [0, -0.3, 0],
    ...MEAT,
  }),
  // A shoulder knot, so the arm has a shape rather than a diameter
  part(lump(0.13, 1), spec.hideDark, {
    pos: [0.02, -0.16, -0.06],
    scale: [1, 1.2, 1],
    ...MEAT,
  }),
];

const foreArmParts = (spec) => [
  part(new THREE.CapsuleGeometry(0.13, 0.4, 8, 14), spec.hide, {
    pos: [0, -0.26, 0],
    ...MEAT,
  }),
  part(new THREE.SphereGeometry(0.2, 12, 10), spec.hideDark, {
    pos: [0, -0.5, 0],
    scale: [1, 0.95, 1.05],
    ...MEAT,
  }),
  // Knuckles
  ...[-0.09, 0, 0.09].map((x, i) =>
    part(lump(0.06, i), spec.hideDark, {
      pos: [x, -0.55, -0.14],
      ...MEAT,
    })
  ),
];

// A club is a tree with the branches broken off, not a cylinder
const clubParts = (spec) => [
  part(
    turned(
      [
        [0.075, 0],
        [0.085, 0.18],
        [0.075, 0.36],
        [0.09, 0.52],
        [0.11, 0.72],
        [0.145, 0.92],
        [0.155, 1.05],
        [0.13, 1.14],
        [0, 1.16],
      ],
      12
    ),
    spec.hideDark,
    { pos: [0, -0.18, 0], ...MEAT }
  ),
  // Stubs where limbs were torn off, and a couple of driven spikes
  ...[
    [0.09, 0.62, 0.03, 0.9],
    [-0.08, 0.78, -0.04, -0.8],
    [0.02, 0.44, 0.09, 0.2],
  ].map(([x, y, z, roll], i) =>
    part(new THREE.ConeGeometry(0.05, 0.16, 8), i === 2 ? spec.detail : spec.hideDark, {
      pos: [x, y - 0.18, z],
      rot: [0, 0, roll],
      ...(i === 2 ? HORN : MEAT),
    })
  ),
];

const thighParts = (spec) => [
  part(new THREE.CapsuleGeometry(0.18, 0.3, 8, 14), spec.hide, {
    pos: [0, -0.24, 0.02],
    scale: [1.1, 1, 1],
    ...MEAT,
  }),
];

const shinParts = (spec) => [
  part(new THREE.CapsuleGeometry(0.15, 0.28, 8, 14), spec.hide, {
    pos: [0, -0.22, 0],
    ...MEAT,
  }),
];

const footParts = (spec) => [
  // A splayed foot with toes, cut as a profile
  part(
    at(
      bevelled(
        [
          [-0.18, -0.24],
          [0.18, -0.24],
          [0.2, 0.08],
          [0.11, 0.2],
          [0.04, 0.14],
          [-0.04, 0.2],
          [-0.11, 0.14],
          [-0.2, 0.08],
        ],
        0.16,
        0.018
      ),
      { rot: [Math.PI / 2, 0, 0] }
    ),
    spec.hide,
    { pos: [0, -0.05, -0.1], ...MEAT }
  ),
  ...[-0.11, 0, 0.11].map((x) =>
    part(new THREE.ConeGeometry(0.035, 0.09, 8), spec.detail, {
      pos: [x, -0.06, -0.32],
      rot: [-Math.PI / 2, 0, 0],
      ...HORN,
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

const buildBruteBuffers = (spec) => ({
  spine: merge(spineParts(spec)),
  head: merge(headParts(spec)),
  upperArm: merge(upperArmParts(spec)),
  foreArm: merge(foreArmParts(spec)),
  club: spec.club ? merge(clubParts(spec)) : null,
  thigh: merge(thighParts(spec)),
  shin: merge(shinParts(spec)),
  foot: merge(footParts(spec)),
});

// One brute, facing -Z, standing on y = 0.
const makeBrute = (spec, buffers, material) => {
  const group = new THREE.Group();

  const hips = new THREE.Group();
  hips.position.y = 1.05;
  group.add(hips);

  // Hunched hard forward. This is the whole difference between a brute and a
  // very large man from directly above.
  const spine = new THREE.Group();
  spine.rotation.x = spec.hunch;
  hips.add(spine);
  hang(spine, buffers.spine, material);

  const head = new THREE.Group();
  head.position.set(0, 0.3, -0.46);
  spine.add(head);
  hang(head, buffers.head, material);

  // Arms hung wide and long. Half the silhouette from above is here.
  const arms = [1, -1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.46, 0.22, -0.06);
    spine.add(shoulder);
    shoulder.rotation.z = side * 0.42;
    hang(shoulder, buffers.upperArm, material);
    const forearm = new THREE.Group();
    forearm.position.y = -0.6;
    shoulder.add(forearm);
    forearm.rotation.x = -0.5;
    hang(forearm, buffers.foreArm, material);

    let club = null;
    if (buffers.club && side > 0) {
      club = new THREE.Group();
      club.position.set(0, -0.5, 0);
      forearm.add(club);
      // Laid back over the shoulder, like every other weapon on this board,
      // and for the same reason
      club.rotation.x = 0.9;
      hang(club, buffers.club, material, [0, 0.4, 0.1]);
    }
    return { shoulder, forearm, club, side };
  });

  const legs = [1, -1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.24, -0.08, 0);
    hips.add(hip);
    hang(hip, buffers.thigh, material);
    const shin = new THREE.Group();
    shin.position.y = -0.46;
    hip.add(shin);
    shin.rotation.x = -0.3;
    hang(shin, buffers.shin, material);
    const foot = new THREE.Group();
    foot.position.y = -0.44;
    shin.add(foot);
    hang(foot, buffers.foot, material);
    return { hip, shin, foot, side };
  });

  return { group, hips, spine, head, arms, legs };
};

/**
 * A knot of brutes. Loose, never dressed — these are not soldiers.
 */
export const buildBrutes = ({ kind = "troll" } = {}) => {
  const spec = KINDS[kind] ?? KINDS.troll;
  const material = surfaceMaterial();
  const buffers = buildBruteBuffers(spec);

  const root = new THREE.Group();
  const brutes = [];

  for (let i = 0; i < spec.count; i += 1) {
    const brute = makeBrute(spec, buffers, material);
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
