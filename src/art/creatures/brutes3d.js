import * as THREE from "three";
import { at, bevelled, merge, part, spanning, surfaceMaterial, swept, turned } from "./kit.js";

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
  zombieTroll: {
    // Zombie Trolls, ported from `docs/reference/zombie-trolls.html`. Still
    // meat, so it cannot lean on bone for contrast the way the Skeleton
    // Trolls do: grey-green grave hide (1.7:1 against the turf), bruising
    // that goes *darker* than the field rather than matching it, and the pale
    // thing across the shoulders is its own ribcage, showing through a back
    // torn open to the bone.
    hide: 0x7f8672,
    hideDark: 0x62675a,
    // Bruising and the torn lip of the wound. Kept off the shoulder masses,
    // where two dark lumps read as pauldrons rather than as rot.
    bruise: 0x4f4347,
    back: 0x5e2a27,
    detail: 0xd6c9ae,
    wood: 0x6b5540,
    eyes: 0xbcd9a8,
    scale: 1,
    count: 3,
    hunch: 0.72,
    club: true,
    spiked: true,
    shackled: true,
    mantle: "wound",
  },
  boneBrute: {
    // Skeleton Trolls. Bone against dark turf carries itself.
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
const IRON = { metalness: 0.55, roughness: 0.55 };
const STONE = { roughness: 0.95 };

// A lopsided lump — the unit of construction for anything made of meat.
// Scaled unevenly and rotated off-axis so no two read as the same sphere.
const lump = (radius, seed) =>
  new THREE.SphereGeometry(radius, 10 + (seed % 3) * 2, 8 + (seed % 2) * 2);

// A point on the torso capsule's surface, stated by where it is rather than by
// a guess at the number: `s` along the capsule's axis, `a` round it from the
// crown of the back (the side the overhead camera sees once the spine is
// hunched), `r` out from the axis. The capsule is the first part in
// `spineParts` — radius 0.42, half-length 0.25, tipped PI/2.4 about X and
// widened 1.08 across — and detail placed with this follows it exactly.
const TORSO_AXIS = [0, Math.cos(Math.PI / 2.4), Math.sin(Math.PI / 2.4)];
const onBack = (s, a, r) => [
  r * 1.08 * Math.sin(a),
  0.1 + s * TORSO_AXIS[1] + r * Math.cos(a) * TORSO_AXIS[2],
  s * TORSO_AXIS[2] - r * Math.cos(a) * TORSO_AXIS[1],
];
const backNormal = (a) => [
  Math.sin(a),
  Math.cos(a) * TORSO_AXIS[2],
  -Math.cos(a) * TORSO_AXIS[1],
];

// How far round the back the wound is torn at a point along it. Ragged, and
// hashed from `s` so it is the same shape every time.
const WOUND = { from: -0.22, to: 0.3 };
const tornTo = (s) => 1.05 + 0.16 * Math.sin(s * 23) + 0.08 * Math.sin(s * 57 + 1);

// A sheet laid on the back between two arcs, as a grid remapped through
// `onBack` — so it conforms to the torso rather than sitting on it as a plate.
const backSheet = (r, span) => {
  const geometry = new THREE.PlaneGeometry(1, 1, 16, 10);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i += 1) {
    const s = span.from + (p.getX(i) + 0.5) * (span.to - span.from);
    const a = p.getY(i) * 2 * tornTo(s);
    p.setXYZ(i, ...onBack(s, a, r));
  }
  geometry.computeVertexNormals();
  return geometry;
};

// The zombie troll's back: torn open across the shoulders, dark with clotted
// gore, and the ribs arching pale across it on either side of the spine.
// From directly above that is a fishbone laid over the widest part of the
// figure — the pale element the brief asks for, found in the body rather than
// worn on it, and the thing no skeleton troll can show because it has no
// meat for the bone to show *through*.
const woundParts = (spec) => {
  const parts = [
    part(backSheet(0.428, WOUND), spec.back, { roughness: 0.6, mottle: 0.2, mottleScale: 14 }),
  ];

  // A torn lip of flesh round the edge, so the wound reads as a hole rather
  // than a painted patch
  [1, -1].forEach((side) => {
    const edge = [];
    for (let k = 0; k <= 8; k += 1) {
      const s = WOUND.from + (k / 8) * (WOUND.to - WOUND.from);
      edge.push(onBack(s, side * tornTo(s), 0.43));
    }
    parts.push(part(swept(edge, 0.028, { segments: 20, sides: 5 }), spec.bruise, MEAT));
  });

  // Ribs. Arcs across the width rather than hoops round it, because from
  // above an arc across is what a ribcage is.
  [-0.16, -0.05, 0.06, 0.17, 0.27].forEach((s, i) => {
    const reach = tornTo(s) * (0.92 - Math.abs(i - 2) * 0.04);
    const arc = [];
    for (let k = -4; k <= 4; k += 1) {
      const a = (k / 4) * reach;
      arc.push(onBack(s - Math.abs(k) * 0.012, a, 0.455 - Math.abs(k / 4) ** 2 * 0.02));
    }
    parts.push(part(swept(arc, 0.03, { segments: 20, sides: 6 }), spec.detail, HORN));
  });
  // and the spine they hang off, knuckled
  for (let s = WOUND.from; s <= WOUND.to + 0.01; s += 0.065) {
    parts.push(
      part(new THREE.SphereGeometry(0.042, 8, 6), spec.detail, {
        pos: onBack(s, 0, 0.47),
        scale: [1, 0.8, 1.2],
        ...HORN,
      })
    );
  }

  // Boils and bruising over the rest of the hide
  [
    [-0.34, 1.35, 0.03],
    [-0.1, -1.5, 0.035],
    [0.12, 1.55, 0.028],
    [0.36, -1.2, 0.04],
    [0.4, 0.7, 0.03],
    [-0.3, -0.9, 0.032],
    [0.22, -1.7, 0.026],
  ].forEach(([s, a, r]) =>
    parts.push(
      part(new THREE.SphereGeometry(r, 8, 6), 0xb3a493, { pos: onBack(s, a, 0.42), ...MEAT })
    )
  );
  [
    [-0.36, -1.1, 0.1],
    [0.34, 1.25, 0.12],
    [0.05, 1.75, 0.09],
  ].forEach(([s, a, r], i) =>
    parts.push(
      part(lump(r, i), spec.bruise, {
        pos: onBack(s, a, 0.39),
        scale: [1.2, 0.6, 1.1],
        ...MEAT,
      })
    )
  );

  // What it has already walked through, still stuck in it: broken spears and
  // crossbow bolts, leaning *out* of the flanks. A stuck shaft standing
  // straight up would be a dot from this camera; laid out sideways it is a
  // line, and a spray of lines off the flanks widens the silhouette.
  [
    [0.02, 1.5, 0.52, 0.35],
    [0.24, -1.4, 0.46, 0.25],
    [-0.12, -1.65, 0.4, -0.1],
    [0.3, 1.2, 0.2, 0.3],
    [-0.08, 1.3, 0.2, 0.05],
    [0.12, -1.15, 0.18, 0.2],
    [0.36, -0.5, 0.18, 0.5],
    [-0.2, 0.9, 0.17, -0.2],
  ].forEach(([s, a, length, back]) => {
    const spear = length > 0.3;
    const n = backNormal(a);
    const dir = new THREE.Vector3(n[0], n[1] * 0.7, n[2])
      .addScaledVector(new THREE.Vector3(...TORSO_AXIS), back)
      .normalize();
    const base = new THREE.Vector3(...onBack(s, a, 0.36));
    const tip = base.clone().addScaledVector(dir, length + 0.06);
    const r = spear ? 0.018 : 0.009;
    parts.push(
      part(spanning(base.toArray(), tip.toArray(), r, r * 0.9, 6), spec.wood, { roughness: 0.88 })
    );
    if (spear) {
      // snapped off, splintered
      parts.push(
        part(
          spanning(tip.toArray(), tip.clone().addScaledVector(dir, 0.05).toArray(), 0.016, 0.003, 5),
          spec.wood,
          { roughness: 0.88 }
        )
      );
    } else {
      // two dark fletches, crossed
      const side = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
      const f = tip.clone().addScaledVector(dir, -0.03);
      [side, side.clone().cross(dir)].forEach((v) =>
        parts.push(
          part(
            spanning(
              f.clone().addScaledVector(v, -0.022).toArray(),
              f.clone().addScaledVector(v, 0.022).toArray(),
              0.012,
              0.012,
              4
            ),
            0x26231f,
            { roughness: 0.92 }
          )
        )
      );
    }
  });

  return parts;
};

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
  } else if (spec.mantle === "wound") {
    parts.push(...woundParts(spec));
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
  // on a curved surface that follows it. A wound has neither: nothing is worn
  // over it, and a scar is what it would be if it had healed.
  if (spec.mantle === "wound") return parts;
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
    part(new THREE.SphereGeometry(0.05, 10, 8), spec.eyes ?? 0xc8a83a, {
      pos: [x, 0.02, -0.2],
      ...HORN,
    })
  ),
  // Lank grave-hair, raked back off the crown
  ...(spec.mantle === "wound"
    ? [-0.12, -0.05, 0.02, 0.09, 0.15].map((x, i) =>
        part(
          swept(
            [
              [x, 0.2, -0.04],
              [x * 1.3, 0.2, 0.12],
              [x * 1.5, 0.08 - (i % 2) * 0.04, 0.26],
            ],
            0.014,
            { segments: 8, sides: 4 }
          ),
          0x2b2622,
          { roughness: 0.95 }
        )
      )
    : []),
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
  // An iron shackle it has never been let out of, with the broken chain
  // still hanging off the back of the wrist
  ...(spec.shackled
    ? [
        part(new THREE.TorusGeometry(0.15, 0.035, 6, 16), 0x3e3b39, {
          pos: [0, -0.34, 0],
          rot: [Math.PI / 2, 0, 0],
          ...IRON,
        }),
        ...[0, 1, 2].map((k) =>
          part(new THREE.TorusGeometry(0.036, 0.011, 5, 10), 0x3e3b39, {
            pos: [0, -0.4 - k * 0.058, 0.17],
            rot: [0, (k % 2) * (Math.PI / 2), 0],
            scale: [1, 1.3, 1],
            ...IRON,
          })
        ),
      ]
    : []),
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
    spec.wood ?? spec.hideDark,
    { pos: [0, -0.18, 0], ...MEAT }
  ),
  // Stubs where limbs were torn off, and a couple of driven spikes
  ...[
    [0.09, 0.62, 0.03, 0.9],
    [-0.08, 0.78, -0.04, -0.8],
    [0.02, 0.44, 0.09, 0.2],
  ].map(([x, y, z, roll], i) =>
    part(new THREE.ConeGeometry(0.05, 0.16, 8), i === 2 ? spec.detail : (spec.wood ?? spec.hideDark), {
      pos: [x, y - 0.18, z],
      rot: [0, 0, roll],
      ...(i === 2 ? HORN : MEAT),
    })
  ),
  ...(spec.spiked ? spikedParts() : []),
];

// Iron bands round the trunk, a crown of rusted spikes hammered through the
// head, and what the last swing left on it. Radii are the club profile's own.
const spikedParts = () => [
  ...[
    [0.52, 0.09],
    [0.72, 0.11],
  ].map(([y, r]) =>
    part(new THREE.TorusGeometry(r + 0.008, 0.016, 6, 16), 0x3e3b39, {
      pos: [0, y - 0.18, 0],
      rot: [Math.PI / 2, 0, 0],
      ...IRON,
    })
  ),
  ...[0.88, 0.97, 1.05].flatMap((y, row) =>
    [0, 1, 2, 3, 4, 5].map((j) => {
      const a = (j * Math.PI) / 3 + row * 0.5;
      const out = [Math.cos(a), 0.12 * row, Math.sin(a)];
      const r = 0.14;
      return part(
        spanning(
          [out[0] * r, y - 0.18, out[2] * r],
          [out[0] * (r + 0.1), y - 0.18 + out[1] * 0.1, out[2] * (r + 0.1)],
          0.02,
          0.002,
          5
        ),
        0x6d4530,
        { metalness: 0.25, roughness: 0.85 }
      );
    })
  ),
  ...[
    [0.07, 0.98, 0.1],
    [-0.11, 0.9, -0.05],
  ].map(([x, y, z], i) =>
    part(lump(0.06, i), 0x5e2a27, { pos: [x, y - 0.18, z], scale: [1, 0.7, 1], roughness: 0.6 })
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
