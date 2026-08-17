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

// How deep a wing is, front to back, as a multiple of the shallow build.
// Measured off the reference, its wing chord runs to about three quarters of
// its half-span; at CHORD = 1 this rig is nearer four tenths, which reads as
// slats rather than as wings.
//
// **It is free**, and that is worth recording, because the argument against it
// was obvious and wrong. Depth is the axis a stand has least of, so deepening
// a wing looks like it must shrink the whole animal. It does not, because the
// wing is not what sets the depth: the head sets the front of the bounding box
// and the tail sets the back, and the wings sit *inside* that envelope with
// room to spare. Built both ways and rendered on the board at true stand
// scale, the two come out at 9.08 x 6.87 either way — same size on the card,
// same placement, the only difference being that one has wings and the other
// has slats.
//
// The general form of that, which is what makes it worth more than a dragon:
// on a rig whose extremes are set by something else, everything in between is
// free to grow until it reaches them. Find out what actually sets the box
// before paying for it.
//
// The one real cost was the tail. A deeper wing swallowed it — the trailing
// edge overtook the tip and it disappeared from overhead again — so the tail
// is longer and straighter than it was, and that is where the depth went. The
// reference's long tail wanted it anyway.
const CHORD = 1.9;

const KINDS = {
  red: {
    hide: 0x7e2820,
    hideDark: 0x511713,
    membrane: 0xb8543c,
    belly: 0xd9a25c,
    horn: 0xe8dcc0,
    wings: true,
    chord: CHORD,
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
    chord: CHORD,
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
    chord: CHORD,
    necks: 1,
    scale: 1.15,
  },
  hydra: {
    // No wings, so the necks do all of it
    // Was 0x3f5f4a, which is the turf's own value — a Colossal that
    // disappears into the grass. Pushed darker and bluer so it separates by
    // being *under* the field rather than level with it.
    hide: 0x27443c,
    hideDark: 0x172b26,
    membrane: 0x5c7a68,
    belly: 0xbfc98f,
    horn: 0xe4dcbd,
    wings: false,
    necks: 5,
    scale: 1.05,
  },
};

// How far the tail is carried round from dead astern, and how much further
// the last third curves. See the note where they are applied.
//
// Both angles were arrived at by measuring rather than by eye, because from
// directly overhead a tail is either outside the wing's footprint or it does
// not exist, and a render cannot tell you which.
//
// Swept too little it runs straight up the middle of the wing. Swept too much
// — the first fix tried better than fifty degrees at each joint — the two
// angles compound and the tail curls into a hook that is *shorter* than the
// tail it was trying to extend: measured, root to tip fell to 1.5 units
// against a wing reaching 3.1, still entirely underneath it. A gentle C
// reaches; a hook does not.
const TAIL_REST = 0.3;
const TAIL_TIP_REST = 0.2;

// These were the last surfaces on the board still perfectly flat in colour,
// which is most of why a dragon read as painted plastic next to a reference
// full of oxidised, blotchy iron-red. Mottling is per-fragment noise off the
// vertex position — no map, no UVs, no second material, nothing to draw.
//
// The scale has to match the size of the part or the whole part lands inside
// one lobe of the noise and merely shifts colour. Hence three different
// numbers for what is otherwise the same treatment: the body is most of a
// unit across, a wing is two units, and a horn is a tenth of one.
const HIDE_S = { roughness: 0.82, mottle: 0.17, mottleScale: 8 };
const SCALE_S = { metalness: 0.22, roughness: 0.5, mottle: 0.12, mottleScale: 22 };
const HORN_S = { metalness: 0.22, roughness: 0.42, mottle: 0.1, mottleScale: 26 };
// The membrane is the broadest surface on the board and the one the eye rests
// on, so it gets the most. Low scale, because the noise is sampled in model
// units and this thing is two of them across.
const SKIN_S = { roughness: 0.88, mottle: 0.22, mottleScale: 3.2 };

const prone = (points, thickness, bevel = 0.02) =>
  at(bevelled(points, thickness, bevel), { rot: [-Math.PI / 2, 0, 0] });

/**
 * The outline of a wing: a bowed leading edge, and a trailing edge that hangs
 * between the finger tips in scallops.
 *
 * Generated rather than written out by hand, because the shape is the whole
 * point and hand-written points get it wrong in two opposite ways, both of
 * which this file has now shipped. Straight segments between a notch and a
 * lobe make a row of sharp triangles, which reads as a torn banner. Uniform
 * sine lobes at full depth make a row of even semicircles, which reads as a
 * scalloped valance — decorative, and just as wrong. The membrane wants
 * shallow, slightly uneven sag.
 *
 * `notch` is where a finger ends and `sag` is how far the membrane falls
 * below it midway between two of them. Both taper outboard, because a wing
 * narrows toward the tip.
 *
 * `bow` bends the leading edge forward at mid-span instead of running it dead
 * straight from root to tip. A straight leading edge is the single thing that
 * most made these read as airframes rather than as animals: a real wing
 * sweeps forward out of the shoulder to a wrist that sits *ahead* of it, then
 * back to the tip.
 *
 * `chord` scales the whole front-to-back dimension. It is the one number that
 * decides whether these look like the reference or like slats, and it is in
 * direct tension with the stand — see the note in `KINDS`.
 */
const wingOutline = ({
  span,
  chordRoot,
  chordTip,
  notchRoot,
  notchTip,
  sagRoot,
  sagTip,
  bow = 0,
  chord = 1,
  fingers,
  steps = 5,
  leadSteps = 7,
}) => {
  const tip = (i) => span - (2 * span * i) / fingers;
  // 0 at the tip, 1 at the root, so the taper reads the way it is named
  const inboard = (x) => (span - x) / (2 * span);
  const lerp = (a, b, u) => a + (b - a) * u;
  const deep = (v) => v * chord;
  const points = [];

  // Leading edge, root to tip, bowed forward through the middle
  for (let i = 0; i <= leadSteps; i += 1) {
    const u = i / leadSteps;
    points.push([
      -span + 2 * span * u,
      deep(lerp(chordRoot, chordTip, u) + Math.sin(u * Math.PI) * bow),
    ]);
  }

  // Trailing edge, tip back to root
  for (let i = 0; i < fingers; i += 1) {
    const x0 = tip(i);
    const x1 = tip(i + 1);
    points.push([x0, deep(lerp(notchTip, notchRoot, inboard(x0)))]);
    // Alternate bays hang a little slacker than their neighbours. Barely
    // visible one bay at a time, and the difference between a membrane and a
    // row of identical scallops.
    const slack = i % 2 ? 1 : 0.82;
    for (let s = 1; s < steps; s += 1) {
      const u = s / steps;
      const x = lerp(x0, x1, u);
      const t = inboard(x);
      points.push([
        x,
        deep(
          lerp(notchTip, notchRoot, t) -
            Math.sin(u * Math.PI) * lerp(sagTip, sagRoot, t) * slack
        ),
      ]);
    }
  }
  const last = tip(fingers);
  points.push([last, deep(lerp(notchTip, notchRoot, inboard(last)))]);
  return points;
};

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

// The body is deliberately slight. In the reference the animal reads as a thin
// rod slung between two enormous wings, and anything that thickens the body
// takes the wings' share of the silhouette — which is the only part of a
// dragon this camera really sees.
const bodyParts = (spec) => [
  part(new THREE.CapsuleGeometry(0.42, 1.2, 10, 18), spec.hide, {
    pos: [0, 0, 0.1],
    rot: [Math.PI / 2, 0, 0],
    ...HIDE_S,
  }),
  part(new THREE.SphereGeometry(0.44, 16, 13), spec.hideDark, {
    pos: [0, -0.05, -0.52],
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
      pos: [0, 0.53, z],
      rot: [0.6 + i * 0.06, 0, 0],
      ...HORN_S,
    })
  ),
  // Scutes down the flanks
  // Two rows of scutes down each flank, set on the capsule's surface by angle
  ...[38, 68].flatMap((deg, row) => {
    const a = (deg * Math.PI) / 180;
    return [-1, 1].flatMap((side) =>
      [-0.6, -0.25, 0.1, 0.45, 0.75].map((z, i) =>
        part(
          new THREE.OctahedronGeometry(0.062 - row * 0.012 + (i % 2) * 0.012, 0),
          row ? spec.hideDark : spec.belly,
          {
            pos: [side * 0.43 * Math.sin(a), 0.43 * Math.cos(a), z + row * 0.16],
            scale: [0.45, 1, 1.5],
            ...SCALE_S,
          }
        )
      )
    );
  }),
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
  // And a crown of smaller spikes fanned flat around the back of the skull,
  // so from directly above the head reads as a star rather than as a lump.
  //
  // Placed by angle rather than by hand-written offsets — the skull is a
  // wedge and working out where its surface actually is at each bearing is
  // exactly the arithmetic this project has got wrong before. Laid almost
  // flat, because a spike standing up is a dot from this camera.
  ...[-1.15, -0.72, -0.32, 0.32, 0.72, 1.15].map((angle) =>
    part(spike(0.3, 0.045, 0), spec.horn, {
      pos: [Math.sin(angle) * 0.15, 0.09, 0.05],
      // Lay it back and outward. +PI/2 about X carries the spike from
      // straight up to straight back; a little under that leaves it raked
      // slightly upward, and the Y turn fans it out along its own bearing.
      // Turning the other way — which is the intuitive sign — drives it down
      // through the skull instead, where nothing can be seen of it.
      rot: [1.3, angle, 0],
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
// Where the root of each panel's leading edge sits, front to back. Held fixed
// as the chord changes, so deepening a wing grows it *backward* from a fixed
// shoulder rather than sliding the whole thing forward over the head.
const LEAD_Z_INNER = -0.14;
const LEAD_Z_OUTER = 0.12;

const wingInnerParts = (spec, side) => {
  const chord = spec.chord ?? 1;
  const chordRoot = 0.56;
  return [
    // The arm bone, which belongs *on* the leading edge. It used to sit at
    // z = 0, which was the leading edge back when the membrane was shallow;
    // deepening the chord left it stranded a quarter of the way back, reading
    // as a bar laid across the wing rather than as its front spar.
    part(new THREE.CylinderGeometry(0.075, 0.045, 2.1, 14), spec.hideDark, {
      pos: [side * 1.0, 0, LEAD_Z_INNER],
      rot: [0, 0, Math.PI / 2],
      ...HIDE_S,
    }),
    part(
      prone(
        wingOutline({
          span: 1.0,
          chordRoot,
          // Forward of the root, which is the sweep out to the wrist
          chordTip: 0.74,
          bow: 0.1,
          notchRoot: -0.3,
          notchTip: -0.24,
          // Shallower than the first pass at this. Deep uniform lobes read as
          // a scalloped valance rather than as skin.
          sagRoot: 0.3,
          sagTip: 0.24,
          chord,
          fingers: 4,
        }),
        0.05,
        0.008
      ),
      spec.membrane,
      { pos: [side * 0.95, -0.03, LEAD_Z_INNER + chordRoot * chord], ...SKIN_S }
    ),
    // Finger spars, fanned back through the membrane from the shoulder. They
    // lie *along* the wing, which needs the quarter turn — a cylinder's axis
    // is Y, and left upright these stood through the membrane like fence
    // posts.
    //
    // Thin. The first pass ran these at 0.032 and they read as slats rather
    // than as veins — you saw the struts and not the sheet, which is the wrong
    // way round: in the reference the membrane is the subject and the veins
    // are texture on it. Halved, and tapered to almost nothing at the tip.
    ...[-0.62, -0.31, 0, 0.31, 0.62].map((x) =>
      part(
        new THREE.CylinderGeometry(0.016, 0.005, 1.15 * chord, 8),
        spec.hideDark,
        {
          pos: [
            side * 0.95 + x * 0.78,
            0.012,
            LEAD_Z_INNER + chord * (chordRoot * 0.5 + 0.24),
          ],
          rot: [Math.PI / 2, x * 0.62, 0],
          ...HIDE_S,
        }
      )
    ),
  ];
};

const wingOuterParts = (spec, side) => {
  const chord = spec.chord ?? 1;
  // Meets the inner panel at the wrist, so this root chord matches the inner
  // panel's tip chord and the two halves make one continuous edge
  const chordRoot = 0.74;
  return [
    part(new THREE.CylinderGeometry(0.075, 0.045, 2.0, 14), spec.hideDark, {
      pos: [side * 0.78, 0, LEAD_Z_OUTER],
      rot: [0.25, 0, Math.PI / 2],
      scale: [1, 0.85, 1],
      ...HIDE_S,
    }),
    part(
      prone(
        // Sweeping back and tapering hard toward the tip, which is what the
        // outer half of a wing does and what the first pass did not
        wingOutline({
          span: 0.88,
          chordRoot,
          chordTip: 0.16,
          bow: 0.06,
          notchRoot: -0.26,
          notchTip: -0.08,
          sagRoot: 0.26,
          sagTip: 0.1,
          chord,
          fingers: 3,
        }),
        0.045,
        0.008
      ),
      spec.membrane,
      { pos: [side * 0.76, -0.04, LEAD_Z_OUTER + chordRoot * chord], ...SKIN_S }
    ),
    ...[-0.42, 0, 0.42].map((x) =>
      part(
        new THREE.CylinderGeometry(0.013, 0.004, 0.9 * chord, 8),
        spec.hideDark,
        {
          pos: [
            side * 0.76 + x * 0.78,
            0.008,
            LEAD_Z_OUTER + chord * (chordRoot * 0.5 + 0.12),
          ],
          rot: [Math.PI / 2, x * 0.6, 0],
          ...HIDE_S,
        }
      )
    ),
    // The wrist claw, hooked forward off the leading edge at the joint.
    //
    // The most distinctive thing in the reference after the wings themselves,
    // and it is free in the shallow axis for the reason that matters here: it
    // points *across* the board rather than along it, so it buys silhouette
    // without buying depth. `spike` builds along +Y, so the X turn lays it
    // forward and the Y turn swings it outboard.
    part(spike(0.44, 0.07, 0), spec.horn, {
      pos: [side * -0.02, 0.03, LEAD_Z_OUTER + chordRoot * chord - 0.5 * chord],
      // Laid forward by the X turn, then swung *outboard* by the Y turn. The
      // sign is the counter-intuitive one: after -PI/2 about X the spike
      // points along -Z, and rotating that by +t about Y carries it toward
      // -X, so outboard on the +X wing needs a negative angle.
      rot: [-Math.PI / 2, -side * 0.55, 0],
      ...HORN_S,
    }),
    part(spike(0.32, 0.06, 0), spec.horn, {
      pos: [side * 1.58, 0, -0.05],
      rot: [0, 0, side * -1.3],
      ...HORN_S,
    }),
  ];
};

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
  part(new THREE.CylinderGeometry(0.2, 0.11, 1.75, 16), spec.hide, {
    pos: [0, 0, 0.46],
    rot: [Math.PI / 2.1, 0, 0],
    ...HIDE_S,
  }),
  // Segment ridges down the spine. In the reference the tail is visibly
  // jointed rather than a smooth cone, and a dotted pale line along a length
  // is one of the cheapest reads there is from above.
  ...[0.1, 0.32, 0.54, 0.76].map((z) =>
    part(new THREE.OctahedronGeometry(0.07, 0), spec.belly, {
      pos: [0, 0.2 - z * 0.13, z],
      scale: [0.5, 1, 1.6],
      ...SCALE_S,
    })
  ),
];

const tailTipParts = (spec) => [
  part(new THREE.CylinderGeometry(0.11, 0.015, 2.55, 14), spec.hide, {
    pos: [0, -0.06, 0.52],
    rot: [Math.PI / 2.2, 0, 0],
    ...HIDE_S,
  }),
  ...[0.18, 0.46].map((z) =>
    part(new THREE.OctahedronGeometry(0.045, 0), spec.belly, {
      pos: [0, 0.1 - z * 0.1, z],
      scale: [0.5, 1, 1.6],
      ...SCALE_S,
    })
  ),
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
        shoulder.position.set(side * 0.32, 0.34, -0.42);
        body.add(shoulder);
        shoulder.rotation.z = side * 0.28;
        shoulder.rotation.y = side * -0.25;
        hang(shoulder, buffers.wingInner[i], material);

        const outer = new THREE.Group();
        outer.position.set(side * 1.95, 0, 0);
        shoulder.add(outer);
        hang(outer, buffers.wingOuter[i], material);

        return { shoulder, outer, side };
      })
    : [];

  // Hind legs take the weight; forelimbs are small and tucked
  const legs = [1, -1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.36, -0.16, 0.36);
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
    shoulder.position.set(side * 0.3, -0.1, -0.46);
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

  // The tail, swept to one side rather than trailing straight back.
  //
  // This is where the reference and the stand have to be reconciled. The
  // animal in the reference is about as long as it is wide, and a stand wants
  // two and a half to one; a tail this length pointed straight aft would be
  // depth the fit cannot spend, and the whole dragon would scale down to pay
  // for it. Swept, the same length becomes width — which is what a sculptor
  // does with a long animal on a shallow base, and it reads as alive rather
  // than as a plank.
  //
  // These are *rest* rotations. The poser adds its motion on top rather than
  // overwriting them, or the sweep would be flattened out on the first frame.
  const tail = new THREE.Group();
  tail.position.set(0, 0.06, 0.62);
  tail.rotation.y = TAIL_REST;
  body.add(tail);
  hang(tail, buffers.tail, material);
  const tailTip = new THREE.Group();
  tailTip.position.z = 1.62;
  tailTip.rotation.y = TAIL_TIP_REST;
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
  // A winged dragon's neck is short — the head sits almost on the shoulders in
  // the reference, and there is a hard reason to follow that here beyond
  // fidelity: a neck reaching forward spends the shallow axis, and it spends
  // it on the one part of the animal this camera values least. Shortening it
  // paid for the longer tail, which is worth far more from above. The hydra is
  // the opposite case and keeps its reach, because its necks *are* its
  // silhouette.
  const reaches =
    spec.necks === 1
      ? [0.78]
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

  // Added to the rest sweep, not written over it
  d.tail.rotation.y = TAIL_REST + Math.sin(t * 0.9) * 0.22 * gait.tail;
  d.tailTip.rotation.y =
    TAIL_TIP_REST + Math.sin(t * 0.9 - 0.8) * 0.3 * gait.tail;
};
