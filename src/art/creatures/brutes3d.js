import * as THREE from "three";
import { at, bevelled, merge, part, surfaceMaterial, swept, turned } from "./kit.js";

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
  // Spread wide on purpose. Twelve bodies within a few percent of each other
  // merge into one pale blob however well each is modelled — what makes a
  // pile of corpses read is the contrast between them and the dark in the
  // gaps, not the anatomy of any one.
  flesh: 0xc9b9a2,
  fleshDark: 0x7d6a5c,
  fleshLivid: 0xa88f7e,
  fleshDrained: 0xd8ccb6,
  fleshBruised: 0x5e4a46,
  bone: 0xd8cebb,
  // Wet, and it has to read wet. Blood at the same roughness as skin is a
  // brown patch; the whole effect is the specular, so these go on the surface
  // tier that catches the key light hardest.
  blood: 0x6b1712,
  bloodDark: 0x3d0d0a,
  bloodFresh: 0x8f2018,
  maw: 0x2a0f0e,
};

// Wet, but not lacquered. At 0.24/0.15 a broad pool caught the key light as
// one flat white blaze and read as plastic sheeting; blood is glossy in
// streaks and dull in the middle of a pool.
const GORE = { metalness: 0.13, roughness: 0.24 };
const GORE_WET = { metalness: 0.2, roughness: 0.15 };
// Dead flesh is blotchy, and the mottling does more for it than any amount
// of extra geometry — it is the difference between meat and painted plastic.
const FLESH = { roughness: 0.82, mottle: 0.24, mottleScale: 15 };
const FLESH_COARSE = { roughness: 0.84, mottle: 0.22, mottleScale: 6 };

// A ragged collar of meat where a limb was torn out of somebody and pushed
// into the heap. Every limb and every head gets one; without it they read as
// dolls' parts pegged into a ball.
const tornStump = (radius, colour) => {
  const parts = [];
  const points = 9;
  for (let i = 0; i < points; i += 1) {
    const a = (i / points) * Math.PI * 2;
    const r = radius * (0.86 + ((i * 5) % 4) * 0.09);
    parts.push(
      part(new THREE.SphereGeometry(radius * 0.34, 7, 6), colour, {
        pos: [Math.cos(a) * r, Math.sin(a) * r, ((i * 3) % 4) * 0.012],
        scale: [1, 1, 0.55],
        ...FLESH,
      })
    );
  }
  // The bone that was in it, and the blood that came out
  parts.push(
    part(new THREE.CylinderGeometry(radius * 0.3, radius * 0.34, 0.07, 8), ABOMINATION.bone, {
      pos: [0, 0, -0.02],
      rot: [Math.PI / 2, 0, 0],
      ...HORN,
    }),
    part(new THREE.SphereGeometry(radius * 0.8, 10, 8), ABOMINATION.bloodFresh, {
      pos: [0, 0, 0.015],
      scale: [1.1, 1.1, 0.22],
      ...GORE,
    })
  );
  return parts;
};

// Blood run down a surface.
//
// Thin, and flattened *against* what it is running over. The first pass used
// a fat tube with a ball on the end and the whole model sprouted red
// lollipops — blood is a film with a specular, not a sausage. What sells it
// is the roughness, not the volume.
const runnel = (from, to, width, colour = ABOMINATION.blood) => {
  const mid = [
    (from[0] + to[0]) / 2,
    (from[1] + to[1]) / 2 - 0.008,
    (from[2] + to[2]) / 2,
  ];
  return [
    part(swept([from, mid, to], width * 0.42, { segments: 10, sides: 5 }), colour, {
      ...GORE_WET,
    }),
    // The drop gathering at the bottom of the run: a teardrop lying on the
    // surface rather than a bead sitting on it
    part(new THREE.SphereGeometry(width * 0.95, 8, 6), colour, {
      pos: to,
      scale: [1, 1.7, 0.45],
      ...GORE_WET,
    }),
  ];
};

// A patch of it, pooled and spreading — flat enough to be a stain
const gorePatch = (pos, radius, colour = ABOMINATION.blood) =>
  part(new THREE.SphereGeometry(radius, 10, 8), colour, {
    pos,
    scale: [1, 0.22, 1.35],
    ...GORE,
  });

// The heap.
//
// The first version of this was a boulder with parts glued to it: seven big
// spheres in a near-black rot, and the arms and heads stuck on the outside.
// From above it read as exactly that — dark spheres with some pale bits — and
// the direction for this unit is the opposite. It is *made of people*, so the
// people have to be the mass. Nothing here is a lump of anything; the surface
// is torsos, backs, shoulders, hips and ribcages jammed together at every
// angle, and the dark is only what shows in the gaps between them.
//
// That also fixes the contrast. A near-black mass on dark turf is the failure
// the guide warns about; a heap of dead flesh is pale and reads instantly.
//
// It is spread far wider than it is deep, which is both what a mass dragging
// itself along would do and what the stand demands — a rig built square fits
// the shallow axis and then wastes two thirds of the width it was given.
// The confirmed brief is "pale dead flesh against a dark rotten core", and
// this list used to open with the palest tone and carry one dark one. The heap
// came out the same value as the limbs growing from it, so at stand scale the
// two merged into a single pale blob and the limbs — the one silhouette
// nothing else in the game makes — did not read at all.
//
// Weighted dark now. The limbs carry the pale, the heap carries the rot, and
// the contrast between them is what separates a mass of bodies from a rock.
const CORPSE_TONES = [
  ABOMINATION.fleshDark,
  ABOMINATION.fleshBruised,
  ABOMINATION.fleshLivid,
  ABOMINATION.fleshDark,
  ABOMINATION.fleshBruised,
  ABOMINATION.flesh,
];

// One body in the pile: a ribcage tapering to a waist, with a shoulder mass
// and a hip mass on it. Half-buried, so only the part above the surface is
// worth building.
const corpse = (tone, roll) => [
  part(new THREE.CapsuleGeometry(0.2, 0.34, 10, 14), tone, {
    rot: [Math.PI / 2, 0, 0],
    scale: [1.25, 0.92, 1],
    ...FLESH_COARSE,
  }),
  // Shoulders, the widest part of a back
  part(new THREE.SphereGeometry(0.19, 12, 10), tone, {
    pos: [0, 0.02, -0.24],
    scale: [1.45, 0.78, 0.9],
    ...FLESH_COARSE,
  }),
  // Hips
  part(new THREE.SphereGeometry(0.17, 12, 10), tone, {
    pos: [0, -0.01, 0.26],
    scale: [1.2, 0.8, 0.95],
    ...FLESH_COARSE,
  }),
  // The spine down the back, which is what says this is a body seen from
  // behind rather than a sack
  ...[-0.2, -0.08, 0.04, 0.16, 0.28].map((z, i) =>
    part(new THREE.SphereGeometry(0.035 - Math.abs(i - 2) * 0.004, 7, 6), ABOMINATION.bone, {
      pos: [0, 0.17 - Math.abs(i - 2) * 0.012, z],
      scale: [0.7, 0.8, 1.3],
      ...HORN,
    })
  ),
  // Shoulder blades, standing off the back
  ...[0.085, -0.085].map((x) =>
    part(new THREE.SphereGeometry(0.075, 8, 7), tone, {
      pos: [x, 0.145, -0.15],
      scale: [1, 0.42, 1.25],
      ...FLESH,
    })
  ),
  // The furrow down the spine and the cleft at the hips. Both are shadow
  // rather than form, and shadow is what separates one body from the next.
  part(
    swept(
      [
        [0, 0.15, -0.26],
        [0, 0.175, -0.08],
        [0, 0.165, 0.1],
        [0, 0.13, 0.3],
      ],
      0.026,
      { segments: 14, sides: 5 }
    ),
    ABOMINATION.coreDark,
    { ...MEAT }
  ),
  // An arm folded under, showing at the flank
  part(new THREE.CapsuleGeometry(0.05, 0.2, 8, 10), tone, {
    pos: [roll > 0 ? 0.2 : -0.2, 0.02, -0.02],
    rot: [Math.PI / 2.2, 0, roll > 0 ? -0.4 : 0.4],
    ...FLESH,
  }),
];

const massParts = () => {
  const parts = [];

  // The bodies. Position, tone, scale, and the two angles they are lying at.
  [
    [0.0, 0.14, -0.08, 0.95, 0.2, -0.35],
    [0.56, 0.04, 0.16, 0.85, -0.5, 0.25],
    [-0.54, 0.08, -0.14, 0.88, 0.9, 0.4],
    [0.2, 0.3, 0.26, 0.74, 2.3, -0.2],
    [-0.24, 0.26, 0.22, 0.7, -1.9, 0.3],
    [0.98, -0.02, -0.1, 0.76, 0.6, -0.45],
    [-0.94, 0.0, 0.12, 0.8, -0.8, 0.35],
    [0.42, 0.3, -0.28, 0.66, 1.4, 0.5],
    [-0.42, 0.28, -0.26, 0.64, -1.2, -0.4],
    [1.34, -0.08, 0.06, 0.6, 1.1, 0.3],
    [-1.3, -0.06, -0.04, 0.62, -1.5, -0.25],
    [0.02, 0.34, 0.38, 0.58, 0.1, 0.6],
    [0.72, 0.26, -0.1, 0.6, -2.4, 0.2],
    [-0.7, 0.24, 0.08, 0.58, 2.1, -0.3],
    [0.26, 0.02, -0.34, 0.66, 0.7, 0.15],
    [-0.28, 0.04, 0.36, 0.62, -0.4, -0.2],
  ].forEach(([x, y, z, sc, yaw, pitch], i) => {
    corpse(CORPSE_TONES[i % CORPSE_TONES.length], i % 2 ? 1 : -1).forEach((g) =>
      parts.push(
        at(g, { scale: [sc, sc, sc], rot: [pitch, yaw, 0], pos: [x, y, z] })
      )
    );
  });

  // The dark between them. Only in the gaps — this is what the whole mass
  // used to be, and it belongs underneath rather than on the surface.
  //
  // Shadow between the bodies cannot be *added*: a tube of dark laid along a
  // seam sits proud of the surface and reads as a log across the pile, which
  // is what the first attempt did. Separation has to come from tone and from
  // real gaps with the dark underneath showing through them.
  [
    [0.32, -0.08, 0.02, 0.42],
    [-0.34, -0.1, -0.04, 0.4],
    [0.86, -0.14, 0.1, 0.34],
    [-0.84, -0.12, 0.06, 0.36],
    [0.0, -0.06, 0.28, 0.34],
    [1.24, -0.18, -0.02, 0.3],
    [-1.2, -0.16, 0.0, 0.32],
  ].forEach(([x, y, z, r], i) =>
    parts.push(
      part(lump(r, i), i % 2 ? ABOMINATION.core : ABOMINATION.coreDark, {
        pos: [x, y, z],
        scale: [1, 0.78, 1],
        ...MEAT,
      })
    )
  );

  // Ribcages surfacing out of it. Pale, curved, unmistakably human, and the
  // one detail that carries at any size.
  [
    [0.5, 0.34, 0.14, 0.5, -0.3],
    [-0.62, 0.3, -0.08, 0.42, 0.5],
    [0.1, 0.42, 0.34, 0.36, 0.1],
    [1.1, 0.2, -0.14, 0.32, 1.2],
  ].forEach(([x, y, z, sc, yaw]) => {
    [0, 1, 2].forEach((i) =>
      parts.push(
        part(
          swept(
            [
              [-0.3, -0.12, 0],
              [-0.2, 0.1, 0],
              [0, 0.17, 0],
              [0.2, 0.1, 0],
              [0.3, -0.12, 0],
            ],
            0.03,
            { segments: 12, sides: 5 }
          ),
          ABOMINATION.bone,
          {
            pos: [x, y, z + (i - 1) * 0.13 * sc],
            rot: [0, yaw, 0],
            scale: [sc, sc, sc],
            ...HORN,
          }
        )
      )
    );
  });

  // Pools and runnels over it, so the whole thing looks freshly made
  [
    [[0.2, 0.5, -0.2], [0.32, 0.06, 0.02]],
    [[-0.42, 0.44, 0.1], [-0.56, 0.0, 0.24]],
    [[0.86, 0.32, -0.1], [1.02, -0.06, -0.04]],
    [[-0.9, 0.36, 0.06], [-1.1, -0.02, 0.14]],
    [[0.02, 0.52, 0.3], [0.1, 0.14, 0.44]],
  ].forEach(([from, to]) => parts.push(...runnel(from, to, 0.03)));
  [
    [[0.3, 0.46, -0.12], 0.085],
    [[-0.48, 0.4, 0.16], 0.075],
    [[0.9, 0.28, 0.04], 0.065],
    [[-0.86, 0.32, -0.1], 0.06],
    [[0.08, 0.5, 0.22], 0.08],
    [[-0.16, 0.44, -0.3], 0.065],
    [[0.6, 0.4, 0.2], 0.055],
    [[-0.72, 0.3, -0.24], 0.05],
  ].forEach(([pos, r], i) =>
    parts.push(gorePatch(pos, r, i % 2 ? ABOMINATION.blood : ABOMINATION.bloodDark))
  );

  return parts;
};

// --- limbs ------------------------------------------------------------------
//
// Two kinds, alternating round the mass, and they are meant to be told apart:
// arms end in a hand with fingers and a thumb, legs are thicker, carry a knee
// and end in a foot with toes. Fourteen identical capsules read as a sea
// anemone. Fourteen recognisably *human* arms and legs read as what this
// thing is made of, which is the whole point of the unit.

const armUpper = () => [
  // The stump it was torn from, facing back into the mass
  ...tornStump(0.075, ABOMINATION.fleshLivid),
  // Deltoid, then the upper arm tapering to the elbow
  part(new THREE.SphereGeometry(0.072, 10, 8), ABOMINATION.fleshDrained, {
    pos: [0, 0.01, -0.08],
    scale: [1, 1.05, 1.15],
    ...FLESH,
  }),
  part(new THREE.CapsuleGeometry(0.055, 0.34, 8, 12), ABOMINATION.fleshDrained, {
    pos: [0, 0, -0.3],
    rot: [Math.PI / 2, 0, 0],
    scale: [1.08, 1, 1],
    ...FLESH,
  }),
  ...runnel([0.04, -0.045, -0.12], [0.012, -0.058, -0.42], 0.02),
];

const armLower = () => {
  const parts = [
    // Elbow, then a forearm that flattens toward the wrist the way one does
    part(new THREE.SphereGeometry(0.055, 10, 8), ABOMINATION.fleshDark, {
      pos: [0, 0, -0.02],
      ...FLESH,
    }),
    part(new THREE.CapsuleGeometry(0.045, 0.28, 8, 12), ABOMINATION.fleshDrained, {
      pos: [0, 0, -0.22],
      rot: [Math.PI / 2, 0, 0],
      scale: [1.15, 1, 1],
      ...FLESH,
    }),
    part(new THREE.SphereGeometry(0.04, 8, 7), ABOMINATION.fleshDark, {
      pos: [0, 0, -0.38],
      scale: [1.2, 0.8, 1],
      ...FLESH,
    }),
    // The palm: a flat slab, not a ball
    part(
      at(
        bevelled(
          [
            [-0.062, -0.07],
            [0.062, -0.07],
            [0.07, 0.04],
            [0.04, 0.085],
            [-0.04, 0.085],
            [-0.07, 0.04],
          ],
          0.05,
          0.008
        ),
        { rot: [-Math.PI / 2, 0, 0] }
      ),
      ABOMINATION.fleshDrained,
      { pos: [0, 0, -0.47], ...FLESH }
    ),
  ];

  // Four fingers, each in two joints so they curl rather than point, and a
  // thumb set across them. A grasping hand and a mitten are different
  // silhouettes, and this thing is doing nothing but grasping.
  [-0.048, -0.016, 0.016, 0.048].forEach((x, i) => {
    const curl = 0.5 + (i % 2) * 0.25;
    const reach = 0.075 - Math.abs(i - 1.5) * 0.008;
    parts.push(
      part(new THREE.CapsuleGeometry(0.019, reach, 5, 7), ABOMINATION.fleshDrained, {
        pos: [x, 0.012, -0.545],
        rot: [Math.PI / 2 - curl * 0.3, 0, 0],
        ...FLESH,
      }),
      part(new THREE.CapsuleGeometry(0.016, reach * 0.8, 5, 7), ABOMINATION.fleshDrained, {
        pos: [x, 0.012 + reach * 0.4, -0.585],
        rot: [Math.PI / 2 - curl, 0, 0],
        ...FLESH,
      }),
      // A nail, which is two pixels and still the thing that says *hand*
      part(new THREE.SphereGeometry(0.014, 6, 5), ABOMINATION.bone, {
        pos: [x, 0.012 + reach * 0.75, -0.6],
        scale: [1, 0.5, 1.2],
        ...HORN,
      })
    );
  });
  parts.push(
    part(new THREE.CapsuleGeometry(0.022, 0.06, 5, 7), ABOMINATION.fleshDrained, {
      pos: [-0.072, -0.012, -0.5],
      rot: [Math.PI / 2.4, 0, 0.7],
      ...FLESH,
    }),
    part(new THREE.CapsuleGeometry(0.019, 0.05, 5, 7), ABOMINATION.fleshDrained, {
      pos: [-0.088, 0.01, -0.55],
      rot: [Math.PI / 3, 0, 1.0],
      ...FLESH,
    })
  );
  parts.push(...runnel([0.0, -0.048, -0.3], [-0.018, -0.058, -0.46], 0.018, ABOMINATION.bloodFresh));
  return parts;
};

const legUpper = () => [
  ...tornStump(0.095, ABOMINATION.fleshLivid),
  // A thigh, which is the heaviest thing on a body and should look it
  part(new THREE.CapsuleGeometry(0.082, 0.32, 8, 12), ABOMINATION.fleshDrained, {
    pos: [0, 0, -0.28],
    rot: [Math.PI / 2, 0, 0],
    scale: [1.05, 1.12, 1],
    ...FLESH,
  }),
  part(new THREE.SphereGeometry(0.065, 10, 8), ABOMINATION.fleshDrained, {
    pos: [0, 0.04, -0.2],
    scale: [1, 0.9, 1.6],
    ...FLESH,
  }),
  ...runnel([0.07, -0.07, -0.1], [0.035, -0.09, -0.44], 0.026),
];

const legLower = () => {
  const parts = [
    // Kneecap, calf, ankle
    part(new THREE.SphereGeometry(0.066, 10, 8), ABOMINATION.fleshDark, {
      pos: [0, 0.01, -0.02],
      scale: [1, 1, 1.15],
      ...FLESH,
    }),
    part(new THREE.CapsuleGeometry(0.055, 0.26, 8, 12), ABOMINATION.fleshDrained, {
      pos: [0, 0.02, -0.2],
      rot: [Math.PI / 2, 0, 0],
      ...FLESH,
    }),
    part(new THREE.SphereGeometry(0.062, 10, 8), ABOMINATION.fleshDrained, {
      pos: [0, 0.05, -0.16],
      scale: [0.9, 1, 0.9],
      ...FLESH,
    }),
    part(new THREE.SphereGeometry(0.04, 8, 7), ABOMINATION.fleshDark, {
      pos: [0, 0, -0.36],
      ...FLESH,
    }),
    // A foot, cut as a profile so it has a heel and a sole
    part(
      at(
        bevelled(
          [
            [-0.062, -0.05],
            [0.062, -0.05],
            [0.07, 0.09],
            [0.03, 0.15],
            [-0.03, 0.15],
            [-0.07, 0.09],
          ],
          0.06,
          0.01
        ),
        { rot: [-Math.PI / 2, 0, 0] }
      ),
      ABOMINATION.fleshDrained,
      { pos: [0, -0.03, -0.44], rot: [0.5, 0, 0], ...FLESH }
    ),
  ];
  // Five toes
  [-0.048, -0.024, 0, 0.024, 0.048].forEach((x, i) =>
    parts.push(
      part(new THREE.CapsuleGeometry(0.017 - Math.abs(i - 2) * 0.002, 0.03, 5, 6), ABOMINATION.fleshDrained, {
        pos: [x, -0.06, -0.53],
        rot: [Math.PI / 2.2, 0, 0],
        ...FLESH,
      })
    )
  );
  parts.push(...runnel([0.0, -0.055, -0.22], [-0.028, -0.072, -0.4], 0.022, ABOMINATION.bloodFresh));
  return parts;
};

// --- the faces --------------------------------------------------------------
//
// A human head is not a sphere with features drawn on it, which is what these
// were and why they read as balls. Four proportions do almost all of the
// work, and none of them is detail:
//
//   It is *taller than it is wide* and *longer than it is tall*.
//   The back of it overhangs the neck; the front is a flat plane, not a curve.
//   The face occupies the lower half — the cranium above the brow is a third
//   of the whole and has nothing on it.
//   It narrows to a chin.
//
// Built to those, a head reads as human at sizes where none of the features
// are resolvable at all. The screaming is on top of that: an open mouth is a
// dark cavity with teeth round it and a jaw swung off a hinge, not a plate.
const spareHeadParts = (index) => {
  const skull = index % 3 === 0;
  const skin = skull ? ABOMINATION.bone : CORPSE_TONES[index % CORPSE_TONES.length];
  const surf = skull ? HORN : FLESH;

  const parts = [
    // The cranium: an ovoid, overhanging at the back, flattened at the temples
    part(new THREE.SphereGeometry(0.115, 14, 12), skin, {
      pos: [0, 0.03, 0.012],
      scale: [0.88, 1.06, 1.12],
      ...surf,
    }),
    // The face plane below the brow — flat, not a continuation of the ball
    part(
      at(
        bevelled(
          [
            [-0.082, -0.09],
            [0.082, -0.09],
            [0.088, 0.03],
            [0.07, 0.075],
            [-0.07, 0.075],
            [-0.088, 0.03],
          ],
          0.1,
          0.008
        ),
        { rot: [-Math.PI / 2, 0, 0] }
      ),
      skin,
      { pos: [0, -0.028, -0.055], rot: [0.12, 0, 0], ...surf }
    ),
    // Brow ridge, and the flat forehead above it
    part(new THREE.SphereGeometry(0.075, 10, 8), skin, {
      pos: [0, 0.052, -0.088],
      scale: [1.15, 0.42, 0.55],
      ...surf,
    }),
    // Cheekbones, set wide and high
    ...[0.072, -0.072].map((x) =>
      part(new THREE.SphereGeometry(0.042, 8, 7), skin, {
        pos: [x, -0.018, -0.075],
        scale: [0.9, 0.75, 1.1],
        ...surf,
      })
    ),
    // The jaw hinge and the angle of the mandible under the ear — the corner
    // that makes a head look like a head from directly above
    ...[0.082, -0.082].map((x) =>
      part(new THREE.SphereGeometry(0.045, 8, 7), skin, {
        pos: [x, -0.055, 0.005],
        scale: [0.8, 0.9, 1.0],
        ...surf,
      })
    ),
    // Nose: a bridge and a tip, not a hole
    part(new THREE.CapsuleGeometry(0.017, 0.05, 5, 7), skin, {
      pos: [0, -0.008, -0.108],
      rot: [0.35, 0, 0],
      scale: [1.1, 1, 1],
      ...surf,
    }),
    ...[0.018, -0.018].map((x) =>
      part(new THREE.SphereGeometry(0.011, 6, 5), ABOMINATION.coreDark, {
        pos: [x, -0.042, -0.115],
        ...MEAT,
      })
    ),
    // Eye sockets: sunk hollows with the eye inside, rather than dots on the
    // surface. The socket is what reads; the eye only catches a highlight.
    ...[0.048, -0.048].map((x) =>
      part(new THREE.SphereGeometry(0.036, 10, 8), ABOMINATION.coreDark, {
        pos: [x, 0.012, -0.088],
        scale: [1.05, 0.95, 0.9],
        ...MEAT,
      })
    ),
    // The mouth cavity, sunk into the face plane
    part(new THREE.SphereGeometry(0.042, 10, 8), ABOMINATION.maw, {
      pos: [0, -0.078, -0.072],
      scale: [1.0, 1.2, 0.85],
      ...MEAT,
    }),
    // Upper teeth
    ...[-0.03, -0.01, 0.01, 0.03].map((x) =>
      part(new THREE.ConeGeometry(0.0095, 0.026, 5), ABOMINATION.bone, {
        pos: [x, -0.062, -0.098],
        rot: [Math.PI - 0.2, 0, 0],
        ...HORN,
      })
    ),
    // The neck it was torn off, under the back of the skull
    part(new THREE.CylinderGeometry(0.05, 0.058, 0.05, 10), skin, {
      pos: [0, -0.055, 0.075],
      rot: [0.4, 0, 0],
      ...surf,
    }),
    ...tornStump(0.056, ABOMINATION.fleshLivid).map((g) =>
      at(g, { rot: [Math.PI / 2 - 0.4, 0, 0], pos: [0, -0.075, 0.09] })
    ),
  ];

  if (!skull) {
    // An eye rolled up in the socket. One highlight each, and it is enough.
    parts.push(
      ...[0.048, -0.048].map((x) =>
        part(new THREE.SphereGeometry(0.021, 8, 7), 0xd9d2c4, {
          pos: [x, 0.02, -0.1],
          ...FLESH,
        })
      ),
      // Hair, matted flat to the back of the skull
      part(new THREE.SphereGeometry(0.108, 10, 8), 0x35292a, {
        pos: [0, 0.048, 0.035],
        scale: [0.92, 0.95, 1.05],
        ...MEAT,
      })
    );
  }

  // Blood from the mouth and one socket, down the chin and the cheek
  parts.push(
    ...runnel([0.0, -0.098, -0.078], [0.014, -0.15, -0.045], 0.019, ABOMINATION.bloodFresh),
    ...runnel([-0.04, -0.012, -0.098], [-0.05, -0.082, -0.062], 0.014, ABOMINATION.blood)
  );

  return parts;
};

// The lower jaw, hung on its own hinge so every face in the heap screams at
// its own moment rather than the whole thing gaping in unison.
const spareJawParts = (index) => {
  const skull = index % 3 === 0;
  const skin = skull ? ABOMINATION.bone : CORPSE_TONES[index % CORPSE_TONES.length];
  const surf = skull ? HORN : FLESH;
  return [
    part(
      at(
        bevelled(
          [
            [-0.075, -0.055],
            [0.075, -0.055],
            [0.082, 0.055],
            [0.05, 0.095],
            [-0.05, 0.095],
            [-0.082, 0.055],
          ],
          0.055,
          0.008
        ),
        { rot: [-Math.PI / 2, 0, 0] }
      ),
      skin,
      { pos: [0, -0.03, -0.09], ...surf }
    ),
    ...[-0.028, -0.0095, 0.0095, 0.028].map((x) =>
      part(new THREE.ConeGeometry(0.0085, 0.022, 5), ABOMINATION.bone, {
        pos: [x, 0.006, -0.082],
        ...HORN,
      })
    ),
    // The tongue, because a scream that is all teeth reads as a skull
    !skull &&
      part(new THREE.CapsuleGeometry(0.016, 0.034, 6, 8), ABOMINATION.bloodFresh, {
        pos: [0, -0.002, -0.048],
        rot: [Math.PI / 2.1, 0, 0],
        scale: [1.2, 1, 1],
        ...GORE,
      }),
  ].filter(Boolean);
};

// How much thicker the limbs are than they were modelled. See the note at the
// socket below: this is girth only, never reach.
const LIMB_GIRTH = 1.25;
// Weight-bearing limbs are lengthened just enough to plant on the ground
// rather than leave the whole creature hovering, which is what it was doing.
const LEG_REACH = 2.0;
// How steeply a weight-bearing limb drops. Raised with the reach so the foot
// lands under the heap instead of out beyond it, where it would cost width.
const DOWN_PITCH = 1.28;

const makeAbomination = (material) => {
  const group = new THREE.Group();

  const mass = new THREE.Group();
  mass.position.y = 0.72;
  group.add(mass);
  hang(mass, merge(massParts()), material);

  // Limbs, all round the mass and pointing every way. Some reach the ground
  // and take weight; the rest paw at the air. Arms and legs alternate, and
  // each kind is one pair of buffers shared by every limb of that kind.
  const buffers = {
    arm: [merge(armUpper()), merge(armLower())],
    leg: [merge(legUpper()), merge(legLower())],
  };
  const limbs = [];
  const COUNT = 14;
  for (let i = 0; i < COUNT; i += 1) {
    // Spread by golden angle so no two sit in a line, without random, then
    // pulled toward the board's wide axis.
    //
    // Thickening a limb grows it in both directions across its length. One of
    // those is height, which this camera never sees and the stand never pays
    // for; the other is whichever way the limb happens to point. A limb aimed
    // along the board's depth therefore spends its girth on the one axis there
    // is no room for — girth 3 with an even fan measured 1.26:1, against 2.37
    // before it, which would have rendered this creature at half the size.
    //
    // `a - k sin 2a` compresses the spacing near 0 and PI, so more limbs lie
    // along the wide axis and fewer point up and down the shallow one. Same
    // count, same reach, same girth, spent where the stand has room.
    const even = i * 2.399;
    const a = even - Math.sin(2 * even) * 0.5;
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
    // Lower limbs splay down and out to carry it; upper ones reach.
    // The ones taking weight are legs, which is both anatomically right and
    // the reason to have two kinds at all.
    const down = i % 3 === 0;
    const kind = down || i % 4 === 1 ? "leg" : "arm";
    socket.rotation.x = down ? DOWN_PITCH : 0.15 + (i % 4) * 0.12;
    socket.rotation.z = ((i * 5) % 7) * 0.06 - 0.18;
    // Thicken across the limb and leave its length alone.
    //
    // Measured, this rig is 6.31 wide by 2.67 deep, which is 2.37:1 against a
    // band that wants about 2.4 — so the box is already the right shape and any
    // reach added anywhere shrinks the whole creature for nothing. That is the
    // lesson the ballista taught. Girth is the one dimension that is free.
    //
    // It is also what was wrong. At stand scale this creature is 167 px over
    // 6.31 units, so 26 px per unit, and an arm of radius 0.055 came out 2.9 px
    // across — under the 4 px floor where detail stops being visible at all.
    // The reference build runs its limbs at 11-13% of the mass half-width
    // against 3% here, and that difference is the whole silhouette.
    //
    // Scaling x and y and leaving z alone keeps the determinant positive, so
    // no winding is reversed — the trap that renders a mirrored part as an
    // unlit black sheet.
    socket.scale.set(LIMB_GIRTH, LIMB_GIRTH, down ? LEG_REACH : 1);
    mass.add(socket);
    hang(socket, buffers[kind][0], material);

    const joint = new THREE.Group();
    joint.position.z = kind === "leg" ? -0.5 : -0.52;
    socket.add(joint);
    joint.rotation.x = down ? 0.5 : -0.4;
    hang(joint, buffers[kind][1], material);

    limbs.push({ socket, joint, down, kind, phase: i * 1.31 });
  }

  // Faces in the heap, looking outward, each with its jaw on its own hinge
  const heads = [];
  for (let i = 0; i < 7; i += 1) {
    const a = i * 1.257 + 0.4;
    const head = new THREE.Group();
    head.position.set(
      Math.cos(a) * 0.95,
      0.24 + ((i * 3) % 4) * 0.1,
      Math.sin(a) * 0.34
    );
    // Tipped back, the way a head does when it is screaming
    // Tipped hard back. A face on the flank of the heap looking outward is a
    // face an overhead camera never sees; thrown back, the open mouth points
    // straight up at it, which is the whole read.
    //
    // The sign matters and is easy to get backwards: a face looks down its
    // own -Z, so a *positive* rotation about X lifts it. Negative buries it in
    // the heap, which is where these were.
    head.rotation.x = 0.95 + ((i * 3) % 4) * 0.08;
    head.rotation.z = (((i * 5) % 5) - 2) * 0.12;
    head.scale.setScalar(0.86 + ((i * 3) % 4) * 0.1);
    mass.add(head);
    hang(head, merge(spareHeadParts(i)), material);

    const jaw = new THREE.Group();
    jaw.position.set(0, -0.05, -0.012);
    head.add(jaw);
    hang(jaw, merge(spareJawParts(i)), material);

    heads.push({
      head,
      jaw,
      phase: i * 2.03,
      gape: 0.34 + (i % 3) * 0.09,
      tilt: head.rotation.x,
    });
  }

  return { group, mass, limbs, heads };
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

  limbs.forEach(({ socket, joint, down, kind, phase }) => {
    const own = t + phase;
    if (down) {
      // Weight-bearing: pushes back, lifts, reaches forward again
      socket.rotation.x = 1.1 + Math.sin(own * 1.4) * 0.3 * gait.heave;
      joint.rotation.x = 0.5 + Math.max(Math.sin(own * 1.4 - 0.8), 0) * 0.5;
    } else if (kind === "leg") {
      // A leg that is not carrying anything kicks rather than gropes
      socket.rotation.x = 0.15 + Math.sin(own * 0.8) * 0.3 * gait.reach;
      joint.rotation.x = -0.4 - Math.max(Math.sin(own * 1.9), 0) * 0.7 * gait.reach;
    } else {
      // Grasping at nothing
      socket.rotation.x = 0.15 + Math.sin(own) * 0.45 * gait.reach;
      socket.rotation.z = Math.sin(own * 0.6 + 1.2) * 0.4 * gait.reach;
      joint.rotation.x = -0.4 + Math.sin(own * 1.7) * 0.55 * gait.reach;
    }
  });

  heads.forEach(({ head, jaw, phase, gape, tilt }) => {
    head.rotation.y = Math.sin(time * 0.6 + phase) * 0.5;
    head.rotation.x = tilt + Math.sin(time * 0.45 + phase * 1.3) * 0.18;
    // Each face screams on its own clock. Anything synchronised would imply
    // one animal underneath, and the whole point is that there is not one.
    jaw.rotation.x = gape * (0.55 + 0.45 * Math.abs(Math.sin(time * 1.7 + phase)));
  });
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
