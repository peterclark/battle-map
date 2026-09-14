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
//
// It sits at 1 now, and that is not a reversal. The joint table below carries
// the reference's proportions directly — its finger fan already spans three
// quarters of the half-span — so the multiplier has nothing left to correct.
// Left at 1.9 it double-counted and stretched the hand into a long thin
// pennant trailing backwards off the wrist.
const CHORD = 1;

const KINDS = {
  red: {
    // Read off the reference by eye rather than sampled from its pixels — the
    // image is not on disk here — so treat these as close, not exact. The
    // relationships are the confident part: body much darker than membrane,
    // membrane warm copper, and nothing anywhere near white.
    // Chosen for how they *render*, not for how they match as swatches. The
    // board tone-maps with ACES at 1.25 exposure, which lifts and desaturates
    // everything; picking the hex that matched the reference flat produced a
    // pale peach membrane on screen. These are pushed darker and more
    // saturated so that what comes out the other side is the reference's
    // colour.
    hide: 0x4a2016,
    hideDark: 0x2c1109,
    membrane: 0x9c4a28,
    // Was 0xd9a25c, a pale gold that drew a bright stripe down the spine and
    // ringed the flanks. The reference has no pale marking at all; the body is
    // uniformly dark and the membrane is the only light thing on the animal.
    belly: 0x5f2c1d,
    // Was 0xe8dcc0 — bone white, on every horn, tooth, claw, crown spike and
    // wing tip. There is no white anywhere in the reference, and against an
    // otherwise unified rust animal those spikes were the loudest wrong note
    // in the whole rig. Mid rust keeps them readable as distinct shapes
    // without pretending to be bone.
    horn: 0x633326,
    wings: true,
    chord: CHORD,
    necks: 1,
    scale: 1.15,
  },
  redLesser: {
    hide: 0x582a1c,
    hideDark: 0x361710,
    membrane: 0xa85630,
    belly: 0x6d3623,
    horn: 0x6f3d2c,
    wings: true,
    chord: CHORD,
    necks: 1,
    scale: 0.95,
  },
  blue: {
    // Same treatment applied across the family, so the two breeds read as one
    // kind of animal in two colourways rather than as two different rigs
    hide: 0x1e3c5e,
    hideDark: 0x122740,
    membrane: 0x5589b8,
    belly: 0x2f5878,
    horn: 0x4776a0,
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
/**
 * A bone: a tapering cylinder running from one point to another.
 *
 * Stated as *endpoints* rather than as a position and a rotation, which is the
 * single most useful idea taken from the reference build. Every orientation bug
 * in this project has come from writing a rotation by hand and getting the axis
 * or the sign wrong — the wing claw that pointed inboard, the head crown that
 * drove down through the skull, the wheels that sat a quarter turn off their
 * axles. None of those is expressible here: say where it starts and where it
 * ends, and the quaternion that carries a cylinder's +Y onto that direction is
 * computed rather than guessed.
 */
const spanning = (a, b, r0, r1, seg = 10) => {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const geo = new THREE.CylinderGeometry(r1, r0, A.distanceTo(B), seg, 1);
  geo.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      B.clone().sub(A).normalize()
    )
  );
  geo.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return geo;
};

/**
 * The wing, defined once as joint coordinates in its own plane: +x outboard
 * along the span, +y forward along the chord.
 *
 * Bones and membrane are both derived from this one table, which is the
 * structural fix. The previous build generated an abstract outline and then
 * placed the spars separately against it — which is precisely how the main spar
 * ended up stranded a quarter of the way back across the membrane, reading as a
 * bar laid over the wing rather than as its leading edge.
 *
 * Note where the fingers start. All four radiate from the **wrist**, the way a
 * bat's hand does. Fanning them from the shoulder, as this rig did, spreads
 * them across the whole wing and reads as slats rather than as a hand.
 */
const JOINTS = {
  shoulder: [0, 0],
  elbow: [1.35, 0.62],
  wrist: [2.5, 0.92],
  tips: [
    [3.85, 1.2],
    [3.55, 0.05],
    [3.0, -0.95],
    [2.2, -1.72],
  ],
  // Where the trailing edge comes back to meet the body
  root: [1.05, -1.25],
};

// The wing plane is laid into the rig's axes: span across, chord forward.
// `prone()` already maps an outline's +y onto -z, so a bone has to be placed
// the same way or the two stop agreeing.
// How big the wing is against the rest of the animal. The joint table holds
// the reference's *proportions*; this is the one number that says how much of
// the silhouette they get. In the reference the wings are the animal and
// everything else hangs off them, which is the read this rig is after.
const WING_SCALE = 1.4;

const inWing = ([x, y], side, chord) => [
  side * x * WING_SCALE,
  0,
  -y * chord * WING_SCALE,
];

/**
 * A scallop between two finger tips, sampled off a quadratic Bézier whose
 * control point is pulled *toward* the wrist.
 *
 * The direction is the whole thing, and this rig had it backwards twice. A
 * membrane between two fingers is stretched taut, so it pulls **in** — concave,
 * with a sharp cusp at each finger tip. Letting it sag outward, which is the
 * intuitive reading of "a membrane hangs", gives a row of convex lobes: that is
 * a scalloped valance, and it is why the last version read as decoration. The
 * attempt before that used straight segments and read as a torn banner.
 */
const scallop = (from, to, pull, steps = 7) => {
  const mx = (from[0] + to[0]) / 2;
  const my = (from[1] + to[1]) / 2;
  const span = Math.hypot(to[0] - from[0], to[1] - from[1]);
  // Toward the wrist, by a fraction of how far apart the two tips are
  const dx = JOINTS.wrist[0] - mx;
  const dy = JOINTS.wrist[1] - my;
  const d = Math.hypot(dx, dy) || 1;
  const cx = mx + (dx / d) * span * pull;
  const cy = my + (dy / d) * span * pull;
  const out = [];
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const u = 1 - t;
    out.push([
      u * u * from[0] + 2 * u * t * cx + t * t * to[0],
      u * u * from[1] + 2 * u * t * cy + t * t * to[1],
    ]);
  }
  return out;
};

/**
 * Lay an outline into the wing plane for one side.
 *
 * Mirroring the geometry with a negative scale is the obvious way to get the
 * second wing and it does not work: a negative scale reverses the winding, the
 * face normals point inward, and the whole membrane renders as an unlit black
 * sheet. Reversing the point order restores the winding, so the left wing is
 * built rather than transformed.
 */
const laid = (pts, side, chord) => {
  const out = pts.map(([x, y]) => [side * x * WING_SCALE, y * chord * WING_SCALE]);
  return side < 0 ? out.reverse() : out;
};

// The inner panel: leading edge along the arm, trailing edge sweeping back to
// the body. This is the part that stays broad when the wing folds.
const wingInnerParts = (spec, side) => {
  const chord = spec.chord ?? 1;
  const { shoulder, elbow, wrist, root, tips } = JOINTS;
  const last = tips[tips.length - 1];
  const bone = (a, b, r0, r1) =>
    spanning(inWing(a, side, chord), inWing(b, side, chord), r0, r1, 12);

  return [
    // Humerus and radius, lying *on* the leading edge because they are what
    // the leading edge is
    part(bone(shoulder, elbow, 0.085, 0.062), spec.hideDark, HIDE_S),
    part(bone(elbow, wrist, 0.062, 0.046), spec.hideDark, HIDE_S),
    // The strut that carries the trailing edge back to the body
    part(bone(wrist, root, 0.03, 0.012), spec.hideDark, HIDE_S),
    part(
      prone(
        // The trailing edge starts at the *last finger*, not at the wrist.
        // Started at the wrist it leaves a wedge of open air between this
        // panel and the hand — the two pieces of one membrane visibly not
        // meeting. The fan and this panel overlap slightly around the wrist
        // instead, which is what a real wing does there anyway.
        laid(
          [shoulder, elbow, wrist, last, ...scallop(last, root, 0.16)],
          side,
          chord
        ),
        0.05,
        0.008
      ),
      spec.membrane,
      SKIN_S
    ),
  ];
};

// The outer panel: the hand. Four fingers fanned from the wrist with the
// membrane drawn taut between them.
const wingOuterParts = (spec, side) => {
  const chord = spec.chord ?? 1;
  const { wrist, tips } = JOINTS;
  // Everything here is relative to the wrist, because that is where this
  // panel's group is hung and where it hinges
  const rel = ([x, y]) => [x - wrist[0], y - wrist[1]];
  const bone = (a, b, r0, r1) =>
    spanning(inWing(rel(a), side, chord), inWing(rel(b), side, chord), r0, r1, 10);

  const outline = [rel(wrist)];
  tips.forEach((tip, i) => {
    outline.push(rel(tip));
    if (i < tips.length - 1) {
      // Wider bays are pulled in harder, so every bay reads about equally taut
      outline.push(...scallop(tips[i], tips[i + 1], 0.2).map(rel));
    }
  });

  return [
    ...tips.map((tip, i) =>
      part(bone(wrist, tip, 0.04, 0.012 + (i === 0 ? 0.006 : 0)), spec.hideDark, HIDE_S)
    ),
    part(prone(laid(outline, side, chord), 0.045, 0.008), spec.membrane, SKIN_S),
    // The claw at the wrist, hooked forward off the leading edge
    part(spike(0.4, 0.062, 0), spec.horn, {
      pos: [side * 0.06, 0.03, -0.12],
      rot: [-Math.PI / 2, -side * 0.5, 0],
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
  part(new THREE.CylinderGeometry(0.11, 0.015, 1.95, 14), spec.hide, {
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
        // The wrist, read out of the same joint table the panels are built
        // from, so the hand hinges exactly where the arm ends
        outer.position.set(
          side * JOINTS.wrist[0] * WING_SCALE,
          0,
          -JOINTS.wrist[1] * (spec.chord ?? 1) * WING_SCALE
        );
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
