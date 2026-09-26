import * as THREE from "three";
import {
  at,
  bevelled,
  merge,
  meshOf,
  part,
  spanning,
  surfaceMaterial,
  swept,
  turned,
} from "./kit.js";

// A block of foot — the shape most of the game takes.
//
// Of eighty-nine units in the army lists, more than half are ranks of
// infantry, so this one rig carries more of the board than everything else
// put together. It is parameterised twice over:
//
//   By weapon. What a figure carries changes its silhouette more than
//   anything else about it, so this is the distinction worth having.
//
//   By palette. Orcs and men are the same skeleton in different colours and
//   different kit, and pretending otherwise would mean two copies of one rig
//   drifting apart.
//
// Every weapon here is posed for a camera looking straight down rather than
// for accuracy, which is the rule this project has broken twice and paid for
// twice. A spear carried upright is a dot. A bow held vertically, as a real
// archer holds it, is a line four pixels wide. Both are turned until they
// present their length or their face to the camera above them.
//
// --- on the merge ---------------------------------------------------------
//
// A figure used to be nineteen small meshes: a capsule per limb, a sphere per
// pauldron, a box per boot. It is now eight, because eight is how many parts
// of a man move independently of each other — body, head, two thighs, two
// shins, shield, weapon. Everything within one of those is merged into a
// single buffer by `kit.js`, which frees the budget that paid for the detail:
// turned helms, bevelled shield boards with raised rims, forged axe heads
// with a beard and a horn, recurve bows with strings on them.
//
// The buffers are built once per block and shared by all twenty figures, so
// twenty men still cost one man's worth of memory. Only the transforms differ.

// Palettes have one job beyond looking right: something on every figure must
// carry real value contrast against the turf, which is a dark yellow-green.
// A figure that is uniformly mid-dark reads as a smudge at stand scale.
const PALETTES = {
  orc: {
    // Lightened from the near-black this started as. At thirty pixels a
    // figure, 0x2f2a24 armour on dark turf was a black lump — the exact
    // failure the guide warns about, committed before the guide existed.
    armour: 0x453d33,
    armourLit: 0x5d5245,
    skin: 0x6a8a3c,
    metal: 0x9aa2aa,
    metalDark: 0x646b73,
    shield: 0x6b5335,
    shieldTrim: 0xc9b98f,
    haft: 0x3a2f24,
    cloth: 0x7a5c33,
  },
  hawkshold: {
    // Men in mail and livery. Steel and a pale surcoat separate cleanly from
    // green, and the heraldic red gives the block a second read.
    armour: 0x6b727c,
    armourLit: 0x8d959f,
    skin: 0xbb8c63,
    metal: 0xc3cad2,
    metalDark: 0x767d86,
    shield: 0x9c3a34,
    shieldTrim: 0xe8dcc0,
    haft: 0x6b4f30,
    cloth: 0xd9cfb8,
  },
  dwarf: {
    // Iron and oiled leather, with brass and a pale beard. The beard is the
    // point: it is the one bright thing on a dwarf and it sits on his chest,
    // which is most of what a camera above him can see.
    armour: 0x4d5058,
    armourLit: 0x6b6f78,
    skin: 0xc09274,
    metal: 0xb8a05e,
    metalDark: 0x6e6046,
    shield: 0x7b4a2a,
    shieldTrim: 0xd8c07a,
    haft: 0x4a3524,
    cloth: 0xd9cdb4,
  },
  highElf: {
    // White and gold, and every elf wears a cloak. A cloak is a broad pale
    // sheet hanging off the shoulders — the largest flat area a man-sized
    // figure can turn upward, and worth more here than any amount of detail.
    armour: 0xc9cdd4,
    armourLit: 0xe6e9ee,
    skin: 0xd6b394,
    metal: 0xe0c877,
    metalDark: 0x9c8a4e,
    shield: 0x2e5f8a,
    shieldTrim: 0xe8dcc0,
    haft: 0x8a7550,
    cloth: 0xeef1f5,
  },
  undead: {
    // Bone against dark turf needs no help at all — this is the one palette
    // that gets its contrast for free. The trick is to keep everything else
    // dim so the bone reads as bone rather than as armour.
    armour: 0xcfc6ad,
    armourLit: 0xe4dcc4,
    skin: 0xbdb49a,
    metal: 0x8a8f88,
    metalDark: 0x4c4f4a,
    shield: 0x2e2a24,
    shieldTrim: 0x9aa08c,
    haft: 0x33302a,
    cloth: 0x6d6a5c,
    // Three more, used only by the bone build below. A skeleton's whole read
    // is pale bone against something dark, so the dark is a colour in its own
    // right here rather than an absence of one: it lines the eye sockets, it
    // fills the ribcage behind the ribs, and it is what every pale part is
    // seen against. The witchlight is the one bright pip on the figure.
    socket: 0x21201c,
    witch: 0xa9c98d,
    boneDark: 0x8e8674,
  },
  wildmen: {
    // Furs and hide. Mercenaries and half-orcs: no livery, no uniform, and a
    // paler pelt over the shoulders to lift them off the ground.
    armour: 0x5c4a38,
    armourLit: 0xa8917a,
    skin: 0xa8815e,
    metal: 0x9aa2aa,
    metalDark: 0x62686e,
    shield: 0x6b5335,
    shieldTrim: 0xb9a377,
    haft: 0x4a3a26,
    cloth: 0xbba98c,
  },
  levy: {
    // Militia and peasants: no mail, no livery, whatever was in the barn
    armour: 0x6f5c41,
    armourLit: 0x8a7452,
    skin: 0xbb8c63,
    metal: 0x9aa2aa,
    metalDark: 0x6a7078,
    shield: 0x5d4a30,
    shieldTrim: 0xa89372,
    haft: 0x6b4f30,
    cloth: 0xa8946f,
  },
};

// How a people is put together. Non-uniform scale on primitives is crude, but
// at thirty pixels a figure the proportion is the whole read: a dwarf is
// short and broad, an elf is tall and narrow, and a skeleton is a man with
// the meat off. Anything subtler than that is invisible.
const BUILDS = {
  man: { height: 1, breadth: 1, cloak: false, beard: false },
  dwarf: { height: 0.76, breadth: 1.24, cloak: false, beard: true },
  elf: { height: 1.08, breadth: 0.9, cloak: true, beard: false },
  // A skeleton is not a narrow man: it is a different set of parts, and from
  // directly above it is a ribcage before it is anything else. `bone` swaps
  // every buffer below for one built out of bones, and carries the anchors
  // that go with them — the skull sits forward of where a helmed head would,
  // because the neck it hangs off rakes forward.
  skeleton: {
    height: 1.02,
    breadth: 0.86,
    cloak: false,
    beard: false,
    bone: true,
    headAt: [0, 0.47, -0.085],
    litter: true,
  },
  // A robe is a cone, and a cone seen from directly above is a disc — one of
  // the broadest flat shapes a single figure can offer. Mages get their read
  // from the thing that makes them look least like soldiers.
  mage: { height: 1.04, breadth: 1, cloak: false, beard: false, robe: true },
};

// How a block forms up, which is a different question from what it is made of.
//
// This is the distinction the Undead list turns on. The Skeleton Horde and
// the Zombies are near enough the same figures at the same spacing, and if
// they form up the same way they are the same unit at stand scale — which is
// the one thing the brief for this faction says must not happen. A rank
// dresses: every figure faces the same way, stands on the same line, is the
// same size as its neighbour and steps nearly in time with it. A crowd does
// none of those, and the difference is legible from directly above long
// before any single figure in either is.
const DRESSINGS = {
  // Dressed, and deliberately all zeroes: this is what every block on the
  // board already did, and a table whose default row changes nothing is a
  // table that cannot move a unit it was not aimed at. The dressing a rank
  // has is the tight lattice jitter below, which it has always had.
  ranked: { turn: 0, drift: 0, size: 0, stoop: 0, spread: 1 },
  // A crowd: every figure turned its own way, out of line, out of step, and
  // no two of them the same height.
  ragged: { turn: 1.1, drift: 0.46, size: 0.22, stoop: 0.3, spread: 1 },
};

// Surfaces, as the merged material reads them.
//
// materials.js explains why metalness tops out at 0.72 rather than 1: with no
// environment to reflect, a fully metallic surface has no diffuse term. What
// it does not say, and what this rig learned the hard way, is that 0.72 is
// only safe on *small* parts. A blade or a brow band at 0.72 catches the key
// light and flashes. A breastplate at 0.72 fills the middle of the figure
// with a surface that has nothing to reflect, and the whole man goes black
// from above — which is the exact failure the guide warns about, arrived at
// from the opposite direction.
//
// So metalness is graded by how much of the silhouette a part occupies.
const PLATE = { metalness: 0.3, roughness: 0.44 }; // breastplate, cops, greaves
const BLADE = { metalness: 0.5, roughness: 0.26 }; // blades and heads
const STEEL = { metalness: 0.68, roughness: 0.3 }; // small bright fittings
const IRON = { metalness: 0.55, roughness: 0.55 }; // sockets, ferrules, rims
const CLOTH = { roughness: 0.92 };
const WOOD = { roughness: 0.78 };
const HIDE = { roughness: 0.72 };

// A flat profile — blade, board, plate.
//
// The convention is worth stating once because every weapon here uses it:
// outlines are drawn in XY with **x across the blade and y along it**,
// extruded for thickness, then turned a quarter so the width runs fore-and-aft
// and the thickness runs side-to-side. That is the orientation an overhead
// camera wants, and it matches how these parts hang off a shouldered haft.
const flat = (points, thickness, bevel) =>
  at(bevelled(points, thickness, bevel), { rot: [0, -Math.PI / 2, 0] });

// --- the kit a figure wears ------------------------------------------------

// A round shield: a domed board, a raised rim, a turned boss.
//
// It replaces a cylinder and a sphere, and it is the single most valuable
// object on an infantryman when the camera is overhead — the broadest thing
// he carries, and the one most worth spending geometry on.
const shieldParts = (p) => [
  part(
    turned(
      [
        [0, 0.052],
        [0.07, 0.048],
        [0.16, 0.036],
        [0.225, 0.018],
        [0.252, 0.004],
        [0.26, -0.012],
        [0.244, -0.03],
        [0.16, -0.036],
        [0, -0.04],
      ],
      22
    ),
    p.shield,
    { rot: [Math.PI / 2.6, 0, 0.12], ...WOOD }
  ),
  // The rim is what makes a shield read as a made object rather than a disc
  part(new THREE.TorusGeometry(0.252, 0.018, 8, 26), p.shieldTrim, {
    rot: [Math.PI / 2.6 + Math.PI / 2, 0, 0.12],
    pos: [0, -0.004, 0],
    ...IRON,
  }),
  part(
    turned(
      [
        [0, 0.098],
        [0.03, 0.09],
        [0.055, 0.062],
        [0.07, 0.028],
        [0.075, 0.006],
        [0.075, 0],
      ],
      18
    ),
    p.shieldTrim,
    { pos: [0, 0.03, -0.055], rot: [Math.PI / 2.6, 0, 0.12], ...STEEL }
  ),
];

// A helm: a turned bowl with a brow band and a nasal, rather than a cone.
const helmParts = (p, robed) =>
  robed
    ? [
        // A hood, gathered rather than conical
        part(
          turned(
            [
              [0, 0.24],
              [0.05, 0.19],
              [0.11, 0.12],
              [0.16, 0.02],
              [0.185, -0.09],
              [0.2, -0.17],
              [0.18, -0.2],
              [0, -0.21],
            ],
            18
          ),
          p.cloth,
          { pos: [0, 0.05, 0.02], rot: [0.14, 0, 0], ...CLOTH }
        ),
        // The face inside it. A hood with nothing under it is a bag; one
        // shadowed opening is the whole difference.
        part(new THREE.SphereGeometry(0.105, 14, 12), p.haft, {
          pos: [0, -0.02, -0.09],
          scale: [1, 1, 0.7],
          ...CLOTH,
        }),
      ]
    : [
        part(
          turned(
            [
              [0, 0.15],
              [0.045, 0.145],
              [0.09, 0.115],
              [0.122, 0.055],
              [0.138, -0.02],
              [0.142, -0.06],
              [0.128, -0.075],
              [0, -0.08],
            ],
            20
          ),
          p.metalDark,
          { pos: [0, 0.045, 0], ...PLATE }
        ),
        // Brow band — a bright ring where the light catches hardest
        part(new THREE.TorusGeometry(0.138, 0.015, 7, 22), p.metal, {
          pos: [0, -0.025, 0],
          rot: [Math.PI / 2, 0, 0],
          ...STEEL,
        }),
        // Nasal, down the front of the face
        part(new THREE.BoxGeometry(0.032, 0.13, 0.03), p.metal, {
          pos: [0, -0.01, -0.14],
          ...STEEL,
        }),
      ];

// A stable pseudo-random number from an integer.
//
// Every scatter in this file — where a bone fell, which way a figure is
// turned, how far out of step it is — has to be identical on every frame and
// every reload. `Math.random()` would give a block that shimmers, which is
// the one thing the guide says never to do, so jitter is hashed from the
// thing it belongs to instead.
const noise = (n) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// --- bone: the undead foot -------------------------------------------------
//
// Ported from `docs/reference/skeleton-horde.html`, which builds a skeleton
// the way an anatomist would: a pelvis, a spine of vertebrae, five pairs of
// ribs, long bones with a knuckle at each end, and a skull with a slack jaw.
// The reference stands its figures 1.6 units tall with the hips at 0.92 and
// the heels on zero; this rig hangs its figures off hips at 0.52, so a
// coordinate taken from that page is scaled by about 0.64 — and its z is
// negated, because the reference presses forward along +z and every figure
// here faces -Z.
//
// Two things the reference does not have to care about, and this does.
//
// **Ribs are the read, and a rib is only a read against something dark.**
// From an orbit camera a ribcage is unmistakable from any angle. From
// directly overhead the top rib hides the four below it, and a stack of pale
// hoops on a pale sternum is a smudge. So the cage *widens downward* — five
// nested arcs rather than a column of equal hoops, which is what an overhead
// camera can see all of at once — and a dark core is built inside it. That
// core is the same trick the Abomination needed: pale parts read because
// something dark is behind them, not because they are pale.
//
// **A face pointing forward is a face this camera never sees.** The skull is
// tipped back so its face plane rakes upward, which puts both sockets and the
// witchlight where they can be seen, and reads as keening rather than as
// marching with the chin down.

// The colours a bare skeleton needs, with fallbacks so the build is not
// wedged to one palette.
const boneHues = (p) => ({
  bone: p.armour,
  boneLit: p.armourLit,
  dull: p.boneDark ?? p.skin,
  dark: p.socket ?? p.haft,
  witch: p.witch ?? p.shieldTrim,
});

const BONE = { roughness: 0.66 };
// Rust, not iron. A smooth metal surface has nothing to reflect here — see
// the note on metalness above — and a helm at 0.55 metalness comes out a
// black ball bigger than the skull inside it. What is left of this kit after
// a century in the ground is not reflective anyway.
const RUST = { metalness: 0.12, roughness: 0.84 };
const SOCKET = { roughness: 0.96 };
const WITCH = { roughness: 0.24, metalness: 0.1 };

// A long bone: a shaft with a knuckle at each end. The knuckles are what stop
// a limb reading as a run of pipe, and at this scale they are most of what
// survives of a bone at all.
const longBone = (a, b, r, colour, opts = {}) => [
  part(spanning(a, b, r, r * 0.88, 7), colour, { ...BONE, ...opts }),
  part(new THREE.SphereGeometry(r * 1.5, 7, 6), colour, {
    pos: a,
    ...BONE,
    ...opts,
  }),
  part(new THREE.SphereGeometry(r * 1.38, 7, 6), colour, {
    pos: b,
    ...BONE,
    ...opts,
  }),
];

// Where the thorax sits, in hips-local space. One table, so the ribs, the
// sternum, the vertebrae and the clavicles are all read off the same numbers
// rather than written twice and left to drift.
const THORAX = {
  // The spine rakes gently forward: enough to turn the cage toward the camera
  // above it, not enough to spend depth the stand has not got.
  base: [0, 0.0, 0.0],
  top: [0, 0.44, -0.07],
  // Five ribs, top to bottom, each wider and reaching further forward than
  // the one above it. Seen from overhead that is five nested arcs.
  ribs: [
    { y: 0.362, half: 0.105, reach: 0.082 },
    { y: 0.31, half: 0.132, reach: 0.104 },
    { y: 0.256, half: 0.152, reach: 0.12 },
    { y: 0.202, half: 0.165, reach: 0.128 },
    { y: 0.15, half: 0.17, reach: 0.13 },
  ],
};

// How far forward the spine has got by a given height.
const rake = (y) => (y / THORAX.top[1]) * THORAX.top[2];

// The two anchors the arms have to reach, kept next to the groups that use
// them in `makeFigure` by being named here rather than written twice.
const WEAPON_AT = [0.26, 0.14, -0.04];
const SHIELD_AT = [-0.3, 0.1, -0.18];
const SHOULDER = (side) => [side * 0.148, 0.375, rake(0.375) - 0.02];

const boneBodyParts = (p) => {
  const c = boneHues(p);
  const parts = [];

  // The pelvis, flattened front to back the way a real one is
  parts.push(
    part(new THREE.TorusGeometry(0.102, 0.034, 6, 14), c.bone, {
      rot: [Math.PI / 2, 0, 0],
      scale: [1, 1, 0.58],
      ...BONE,
    })
  );

  // The spine. Vertebrae are wider than they are tall, which is the detail
  // that makes a line of beads read as a backbone.
  for (let i = 0; i < 7; i += 1) {
    const y = 0.04 + (i / 6) * 0.4;
    parts.push(
      part(new THREE.SphereGeometry(0.029, 7, 6), c.bone, {
        pos: [0, y, rake(y) + 0.012],
        scale: [1.3, 0.8, 1],
        ...BONE,
      })
    );
  }

  // The dark inside the cage. Without it the ribs are pale bars on a pale
  // ground and the whole chest reads as one blob.
  parts.push(
    part(new THREE.SphereGeometry(0.1, 12, 10), c.dark, {
      pos: [0, 0.255, rake(0.255) - 0.028],
      scale: [0.66, 1.2, 0.52],
      ...SOCKET,
    })
  );

  // The ribs. Each one is swept along the path it takes — out from the spine,
  // round the side, forward and in toward the sternum — rather than cut from
  // a torus and rotated into place, so there is no angle to get the sign of.
  THORAX.ribs.forEach(({ y, half, reach }) => {
    const z = rake(y);
    [1, -1].forEach((side) => {
      parts.push(
        part(
          swept(
            [
              [side * 0.02, y + 0.008, z + 0.01],
              [side * half * 0.78, y + 0.002, z - reach * 0.3],
              [side * half, y - 0.014, z - reach * 0.66],
              [side * half * 0.66, y - 0.032, z - reach * 0.94],
              [side * half * 0.24, y - 0.044, z - reach * 1.06],
            ],
            0.014,
            { segments: 10, sides: 5 }
          ),
          c.bone,
          BONE
        )
      );
    });
  });

  // The sternum, closing the front of the cage
  const first = THORAX.ribs[0];
  const last = THORAX.ribs[THORAX.ribs.length - 1];
  parts.push(
    part(
      spanning(
        [0, first.y - 0.044, rake(first.y) - first.reach * 1.06],
        [0, last.y - 0.044, rake(last.y) - last.reach * 1.06],
        0.017,
        0.013,
        6
      ),
      c.boneLit,
      BONE
    )
  );

  // Clavicles and the shoulder knuckles they end on
  [1, -1].forEach((side) => {
    parts.push(
      part(
        spanning([0, 0.408, rake(0.408) - 0.03], SHOULDER(side), 0.017, 0.015, 6),
        c.bone,
        BONE
      ),
      part(new THREE.SphereGeometry(0.038, 7, 6), c.bone, {
        pos: SHOULDER(side),
        ...BONE,
      })
    );
  });

  // Arms, stated by their joints. Each stops at the group the hand hangs off
  // — the sword's pivot on the right, the shield's on the left — so the hand
  // travels with what it is holding instead of being left behind by it.
  parts.push(
    ...longBone(SHOULDER(1), [0.238, 0.262, -0.02], 0.021, c.bone),
    ...longBone([0.238, 0.262, -0.02], WEAPON_AT, 0.017, c.bone),
    ...longBone(SHOULDER(-1), [-0.248, 0.252, -0.06], 0.021, c.bone),
    ...longBone([-0.248, 0.252, -0.06], SHIELD_AT, 0.017, c.bone)
  );

  // What is left of the armour they were buried in. All of it is dim on
  // purpose: the brief for this faction is that the bone is the read, and
  // anything bright on the kit competes with it.
  parts.push(
    // A grave-cloth tabard, gone to rags at the hem
    part(
      turned(
        [
          [0.094, 0.07],
          [0.12, 0.0],
          [0.138, -0.072],
          [0.124, -0.09],
          [0, -0.095],
        ],
        14
      ),
      p.haft,
      { pos: [0, -0.02, -0.012], ...CLOTH }
    ),
    // A belt, which is what holds the tabard on
    part(new THREE.TorusGeometry(0.118, 0.016, 5, 16), p.haft, {
      pos: [0, 0.03, 0],
      rot: [Math.PI / 2, 0, 0],
      scale: [1, 1, 0.62],
      ...HIDE,
    }),
    // One rusted pauldron, on the arm that swings
    part(
      new THREE.SphereGeometry(0.062, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2),
      p.metalDark,
      { pos: [0.15, 0.386, -0.05], scale: [1.1, 0.42, 1.2], ...RUST }
    )
  );

  return parts;
};

// The skull. Tipped back so the face rakes upward — from straight above, a
// skull looking where it is going is a pale dome and nothing else.
const boneHeadParts = (p, helmed) => {
  const c = boneHues(p);
  const parts = [
    part(new THREE.SphereGeometry(0.088, 14, 11), c.bone, {
      scale: [0.94, 1, 1.06],
      ...BONE,
    }),
    // The maxilla, carrying the cheekbones
    part(new THREE.BoxGeometry(0.108, 0.07, 0.064), c.bone, {
      pos: [0, -0.045, -0.064],
      ...BONE,
    }),
    // The jaw, hanging slack. A closed mouth is a line; an open one is a
    // shadow, and shadow is the only facial detail that survives at this size.
    part(new THREE.BoxGeometry(0.098, 0.035, 0.09), c.bone, {
      pos: [0, -0.122, -0.042],
      rot: [-0.3, 0, 0],
      ...BONE,
    }),
    part(new THREE.BoxGeometry(0.08, 0.03, 0.05), c.dark, {
      pos: [0, -0.098, -0.06],
      ...SOCKET,
    }),
  ];

  [1, -1].forEach((side) => {
    parts.push(
      part(new THREE.SphereGeometry(0.036, 9, 7), c.dark, {
        pos: [side * 0.04, 0.006, -0.062],
        scale: [1, 0.95, 0.85],
        ...SOCKET,
      }),
      // The witchlight. There is no emissive term in the merged material, so
      // this earns its glow the only way it can: a small, smooth, bright pip
      // sunk in a socket that is the darkest thing on the figure.
      part(new THREE.SphereGeometry(0.021, 7, 6), c.witch, {
        pos: [side * 0.04, 0.006, -0.079],
        ...WITCH,
      }),
      part(new THREE.BoxGeometry(0.022, 0.042, 0.034), c.bone, {
        pos: [side * 0.068, -0.018, -0.04],
        ...BONE,
      })
    );
  });

  // Half the horde kept the helm it was buried in. It is rust, not steel:
  // a bright helm would take the read off the skull beside it.
  if (helmed) {
    parts.push(
      part(
        turned(
          [
            [0, 0.1],
            [0.046, 0.092],
            [0.076, 0.058],
            [0.09, 0.012],
            [0.094, -0.014],
            [0.082, -0.026],
            [0, -0.03],
          ],
          16
        ),
        p.metalDark,
        { pos: [0, 0.022, 0.004], ...RUST }
      ),
      part(new THREE.BoxGeometry(0.022, 0.078, 0.022), p.metalDark, {
        pos: [0, -0.016, -0.086],
        ...RUST,
      })
    );
  }

  // One rotation at the end, so the whole skull tips together rather than
  // each feature being placed at an angle of its own
  const skull = merge(parts);
  skull.rotateX(0.4);
  return [skull];
};

const boneThighParts = (p) =>
  longBone([0, 0, 0], [0, -0.26, 0], 0.026, boneHues(p).bone);

const boneShinParts = (p) => {
  const c = boneHues(p);
  return [
    ...longBone([0, 0, 0], [0, -0.245, -0.012], 0.021, c.bone),
    // The fibula, alongside the tibia. Two bones below the knee and one above
    // is the proportion that says leg rather than stick.
    part(
      spanning([0.024, -0.02, 0.008], [0.022, -0.235, 0.002], 0.011, 0.009, 5),
      c.dull,
      BONE
    ),
    // The foot: a heel and four toe bones, flat on the ground
    part(new THREE.SphereGeometry(0.03, 7, 6), c.bone, {
      pos: [0, -0.268, 0.014],
      ...BONE,
    }),
    ...[0, 1, 2, 3].map((i) =>
      part(
        spanning(
          [(i - 1.5) * 0.017, -0.268, 0.006],
          [(i - 1.5) * 0.023, -0.276, -0.096],
          0.009,
          0.007,
          5
        ),
        c.bone,
        BONE
      )
    ),
  ];
};

// A hand, built at the origin of whatever group it holds — so it swings with
// the sword rather than staying behind with the arm.
const boneHandParts = (p) => {
  const c = boneHues(p);
  return [
    part(new THREE.SphereGeometry(0.028, 8, 6), c.bone, {
      pos: [0, 0.015, 0],
      ...BONE,
    }),
    ...[0, 1, 2].map((i) =>
      part(
        spanning(
          [(i - 1) * 0.017, 0.03, 0.006],
          [(i - 1) * 0.02, 0.046, -0.042],
          0.008,
          0.0065,
          5
        ),
        c.bone,
        BONE
      )
    ),
  ];
};

// What the horde is walking over. One merged mesh for the whole stand, laid
// inside the block's own footprint so it costs no extent and therefore none
// of the size the stand can give the figures.
//
// This is the same finding as the rat swarm's trampled earth: ranks leave
// bright pasture showing between the files whatever you do about spacing, and
// bright pasture between the files is what makes a block read as figures
// standing on a lawn. Bones between the files make it a place they were dug
// out of.
const litterParts = (p, halfWidth, halfDepth, ground) => {
  const c = boneHues(p);
  const parts = [];
  for (let i = 0; i < 18; i += 1) {
    const x = (noise(i * 3 + 1) * 2 - 1) * halfWidth;
    const z = (noise(i * 3 + 2) * 2 - 1) * halfDepth;
    const a = noise(i * 3 + 3) * Math.PI;
    const len = 0.07 + noise(i + 41) * 0.1;
    parts.push(
      ...longBone(
        [x - Math.cos(a) * len, ground + 0.015, z - Math.sin(a) * len],
        [x + Math.cos(a) * len, ground + 0.015, z + Math.sin(a) * len],
        0.017 + noise(i + 71) * 0.007,
        c.dull
      )
    );
  }
  // And the odd skull among them. A dropped shield was tried here, from the
  // reference, and taken out again: a dark disc lying flat on the turf at
  // this scale does not read as a shield, it reads as a hole in the ground.
  for (let i = 0; i < 3; i += 1) {
    parts.push(
      part(new THREE.SphereGeometry(0.072, 9, 7), c.dull, {
        pos: [
          (noise(i * 7 + 5) * 2 - 1) * halfWidth,
          ground + 0.05,
          (noise(i * 7 + 6) * 2 - 1) * halfDepth,
        ],
        scale: [0.94, 0.86, 1.06],
        ...BONE,
      })
    );
  }
  return parts;
};

// Torso, arms and whatever hangs off them. This is the biggest cluster and
// the one that carries the figure's colour.
const bodyParts = (p, body) => {
  if (body.bone) return boneBodyParts(p);
  const parts = [];

  if (body.robe) {
    // A cone seen from above is a disc: the broadest shape one figure offers
    parts.push(
      part(
        turned(
          [
            [0.04, 0.36],
            [0.12, 0.2],
            [0.19, 0.02],
            [0.26, -0.18],
            [0.31, -0.34],
            [0.32, -0.38],
            [0, -0.39],
          ],
          18
        ),
        p.cloth,
        { pos: [0, -0.02, 0], ...CLOTH }
      )
    );
  }

  parts.push(
    part(new THREE.CapsuleGeometry(0.19, 0.3, 8, 18), p.armour, {
      pos: [0, 0.12, 0],
      ...HIDE,
    })
  );

  // Plate, and who wears it. A spellcaster in a breastplate and pauldrons is
  // a soldier in a dress — and worse, three white domes in a row read as a
  // snowman from above. Robed figures get a cord and nothing else.
  if (body.robe) {
    parts.push(
      part(new THREE.TorusGeometry(0.2, 0.016, 6, 20), p.haft, {
        pos: [0, -0.02, 0],
        rot: [Math.PI / 2, 0, 0],
        ...CLOTH,
      })
    );
  } else {
    parts.push(
      // A breastplate laid over the chest. Bevelled, so its edge draws a
      // bright line across the one face the camera sees square on.
      part(
        flat(
          [
            [-0.15, -0.16],
            [0.15, -0.16],
            [0.17, 0.06],
            [0.11, 0.19],
            [-0.11, 0.19],
            [-0.17, 0.06],
          ],
          0.09,
          0.014
        ),
        p.armourLit,
        { pos: [0, 0.16, -0.13], rot: [0, Math.PI / 2, 0], ...PLATE }
      ),
      part(new THREE.TorusGeometry(0.185, 0.022, 6, 20), p.haft, {
        pos: [0, -0.03, 0],
        rot: [Math.PI / 2, 0, 0],
        scale: [1, 1, 0.8],
        ...HIDE,
      })
    );

    // Shoulder cops, turned rather than spherical, so they read as plate
    [-1, 1].forEach((side) => {
      parts.push(
        part(
          turned(
            [
              [0, 0.075],
              [0.055, 0.068],
              [0.1, 0.04],
              [0.128, -0.005],
              [0.135, -0.045],
              [0, -0.05],
            ],
            16
          ),
          p.armourLit,
          { pos: [side * 0.2, 0.28, 0], rot: [0, 0, side * -0.22], ...PLATE }
        )
      );
    });
  }

  // A cloak spread behind the shoulders. Nothing else on a figure this size
  // presents so much flat area straight up — so it is cut with a curved hem
  // rather than left a rectangle.
  if (body.cloak) {
    parts.push(
      part(
        at(
          bevelled(
            [
              [-0.2, 0],
              [0.2, 0],
              [0.25, -0.2],
              [0.23, -0.4],
              [0.12, -0.52],
              [0, -0.55],
              [-0.12, -0.52],
              [-0.23, -0.4],
              [-0.25, -0.2],
            ],
            0.026,
            0.008
          ),
          { rot: [Math.PI / 2, 0, 0] }
        ),
        p.cloth,
        { pos: [0, 0.3, 0.06], rot: [-0.35, 0, 0], ...CLOTH }
      )
    );
  }

  // Both upper arms. Neither rotates in the poser — the shield and the weapon
  // do — so they belong in the body buffer rather than in one of their own.
  [
    [-0.24, 0.08, -0.06],
    [0.24, 0.1, -0.04],
  ].forEach((pos, i) => {
    parts.push(
      part(new THREE.CapsuleGeometry(0.062, 0.22, 8, 14), p.skin, {
        pos,
        rot: [0, 0, (i === 0 ? 1 : -1) * 0.12],
        ...HIDE,
      }),
      // A vambrace, which is the only thing that reads on an arm this size —
      // or a sleeve cuff, on someone who does not wear plate
      part(
        new THREE.CylinderGeometry(
          body.robe ? 0.08 : 0.064,
          body.robe ? 0.07 : 0.058,
          body.robe ? 0.16 : 0.085,
          14
        ),
        body.robe ? p.cloth : p.metalDark,
        {
          pos: [pos[0], pos[1] - (body.robe ? 0.06 : 0.105), pos[2]],
          ...(body.robe ? CLOTH : PLATE),
        }
      )
    );
  });

  return parts;
};

const headParts = (p, body, helmed) => {
  if (body.bone) return boneHeadParts(p, helmed);
  const parts = [
    part(new THREE.SphereGeometry(0.13, 18, 14), p.skin, {
      scale: [1, 1.05, 1.02],
      ...HIDE,
    }),
    ...helmParts(p, body.robe),
  ];
  // A beard hangs down the chest, which is one of the few parts of a figure
  // an overhead camera sees square on. Turned, so it tapers.
  if (body.beard) {
    parts.push(
      part(
        turned(
          [
            [0, 0.02],
            [0.115, -0.01],
            [0.125, -0.1],
            [0.1, -0.2],
            [0.055, -0.29],
            [0, -0.33],
          ],
          16
        ),
        p.cloth,
        { pos: [0, -0.12, -0.13], rot: [-0.7, 0, 0], scale: [1.15, 1, 0.85], ...CLOTH }
      )
    );
  }
  return parts;
};

const thighParts = (p, body) =>
  body.bone
    ? boneThighParts(p)
    : [
        part(new THREE.CapsuleGeometry(0.068, 0.2, 8, 14), p.armour, {
          pos: [0, -0.14, 0],
          ...HIDE,
        }),
      ];

const shinParts = (p, body) =>
  body.bone
    ? boneShinParts(p)
    : [
        part(new THREE.CapsuleGeometry(0.055, 0.2, 8, 14), p.armour, {
          pos: [0, -0.11, 0],
          ...HIDE,
        }),
        // Greave
        part(new THREE.CylinderGeometry(0.066, 0.058, 0.16, 14), p.metalDark, {
          pos: [0, -0.09, -0.012],
          scale: [1, 1, 0.75],
          ...PLATE,
        }),
        // A boot with a toe, cut as a profile rather than left a box
        part(
          at(
            bevelled(
              [
                [-0.065, -0.1],
                [0.065, -0.1],
                [0.07, 0.03],
                [0.03, 0.055],
                [-0.03, 0.055],
                [-0.07, 0.03],
              ],
              0.075,
              0.01
            ),
            { rot: [Math.PI / 2, 0, 0] }
          ),
          p.haft,
          { pos: [0, -0.26, -0.03], ...HIDE }
        ),
      ];

// --- weapons ---------------------------------------------------------------

// A tapered haft with a ferrule at the butt — shared by axe, spear and staff,
// because they are the same stick with different things on the end.
const haftParts = (p, length, radius = 0.036) => [
  part(new THREE.CylinderGeometry(radius * 0.86, radius, length, 14), p.haft, {
    pos: [0, length / 2 - 0.18, 0],
    ...WOOD,
  }),
  part(new THREE.CylinderGeometry(radius * 1.25, radius * 1.15, 0.06, 14), p.metalDark, {
    pos: [0, -0.16, 0],
    ...IRON,
  }),
];

// How each weapon is built, how the block carrying it forms up, and how it is
// posed. Keeping the three together means a new weapon is one entry rather
// than edits scattered through the file.
const WEAPONS = {
  axe: {
    files: 5,
    ranks: 4,
    shield: true,
    parts: (p) => [
      ...haftParts(p, 1.08),
      // A bearded axe: the beard hooks down below the socket and the horn
      // rises above it, and between them they double the head's silhouette
      part(
        flat(
          [
            [-0.02, -0.14],
            [0.09, -0.215],
            [0.2, -0.15],
            [0.245, 0.0],
            [0.215, 0.145],
            [0.09, 0.175],
            [-0.02, 0.13],
          ],
          0.055,
          0.012
        ),
        p.metal,
        { pos: [0.05, 0.78, 0], ...BLADE }
      ),
      // The socket, wrapping the haft
      part(new THREE.CylinderGeometry(0.058, 0.052, 0.3, 14), p.metalDark, {
        pos: [0, 0.78, 0],
        ...IRON,
      }),
      // Langets down the haft, which is where a real axe is bound
      part(new THREE.BoxGeometry(0.016, 0.2, 0.05), p.metalDark, {
        pos: [0, 0.58, 0],
        ...IRON,
      }),
      part(
        flat(
          [
            [0, -0.07],
            [0.09, 0.0],
            [0, 0.09],
          ],
          0.045,
          0.008
        ),
        p.metal,
        { pos: [0.02, 0.98, 0], ...BLADE }
      ),
    ],
    // Carried back over the shoulder. Authentic, and the only way the camera
    // sees an axe at all.
    rest: 0.85,
    swing: 1.4,
  },
  sword: {
    files: 5,
    ranks: 4,
    shield: true,
    parts: (p) => [
      // A wrapped grip, turned so the wrap shows as ridges
      part(
        turned(
          [
            [0, 0],
            [0.032, 0.01],
            [0.03, 0.06],
            [0.033, 0.11],
            [0.03, 0.16],
            [0.033, 0.21],
            [0, 0.23],
          ],
          14
        ),
        p.haft,
        { pos: [0, 0.06, 0], ...HIDE }
      ),
      // Pommel
      part(
        turned(
          [
            [0, 0],
            [0.05, 0.015],
            [0.055, 0.05],
            [0.04, 0.08],
            [0, 0.09],
          ],
          14
        ),
        p.metalDark,
        { pos: [0, 0.0, 0], rot: [Math.PI, 0, 0], ...STEEL }
      ),
      // Cross guard, drooping toward the blade the way a real one does
      part(
        flat(
          [
            [-0.18, -0.022],
            [-0.13, -0.05],
            [0.13, -0.05],
            [0.18, -0.022],
            [0.17, 0.026],
            [-0.17, 0.026],
          ],
          0.05,
          0.008
        ),
        p.metalDark,
        { pos: [0, 0.3, 0], rot: [0, Math.PI / 2, 0], ...BLADE }
      ),
      // The blade, tapered to a point with a fuller cut down its centre
      part(
        flat(
          [
            [-0.066, 0],
            [0.066, 0],
            [0.062, 0.4],
            [0.045, 0.6],
            [0, 0.72],
            [-0.045, 0.6],
            [-0.062, 0.4],
          ],
          0.05,
          0.01
        ),
        p.metal,
        { pos: [0, 0.33, 0], ...BLADE }
      ),
    ],
    // Laid flatter than an axe: a blade has less to show at its tip, so more
    // of its length has to face upward
    rest: 1.0,
    swing: 1.5,
  },
  spear: {
    // Pikes form deeper and tighter than swordsmen — that density is half of
    // what a spear block looks like from above
    files: 5,
    ranks: 5,
    shield: true,
    parts: (p) => [
      ...haftParts(p, 1.92, 0.03),
      // A leaf-bladed head with a socket and langets
      part(
        flat(
          [
            [-0.018, 0],
            [0.018, 0],
            [0.047, 0.07],
            [0.05, 0.15],
            [0.032, 0.27],
            [0, 0.36],
            [-0.032, 0.27],
            [-0.05, 0.15],
            [-0.047, 0.07],
          ],
          0.036,
          0.006
        ),
        p.metal,
        { pos: [0, 1.78, 0], ...BLADE }
      ),
      part(new THREE.CylinderGeometry(0.042, 0.034, 0.16, 14), p.metalDark, {
        pos: [0, 1.7, 0],
        ...IRON,
      }),
      // A pennon below the head. Free silhouette, and it puts the block's
      // colour up where the camera can see it.
      part(
        at(
          bevelled(
            [
              [-0.015, 0],
              [0.015, 0],
              [0.02, -0.16],
              [-0.01, -0.22],
              [-0.015, -0.16],
            ],
            0.11,
            0.006
          ),
          { rot: [0, Math.PI / 2, 0] }
        ),
        p.shield,
        { pos: [0, 1.62, 0], ...CLOTH }
      ),
    ],
    // Well down off the vertical. Held as a real pikeman holds it, a spear is
    // a single dark pixel; laid back over the shoulder it draws a line the
    // length of the stand, and a block of them reads as a thicket.
    rest: 1.15,
    swing: 0.5,
  },
  crossbow: {
    // Crossbows drill in ranks where bowmen skirmish — they shoot flat and
    // stand shoulder to shoulder to do it
    files: 5,
    ranks: 4,
    shield: false,
    parts: (p) => [
      // The tiller, cut as a profile so it has a stock and a nose
      part(
        at(
          bevelled(
            [
              [-0.026, -0.3],
              [0.026, -0.3],
              [0.03, 0.02],
              [0.024, 0.22],
              [-0.024, 0.22],
              [-0.03, 0.02],
            ],
            0.06,
            0.008
          ),
          { rot: [Math.PI / 2, 0, 0] }
        ),
        p.haft,
        { pos: [0, 0.3, 0.02], ...WOOD }
      ),
      // The prod, across the tiller. A crossbow reads as a cross from above,
      // which is the whole reason it is worth distinguishing from a bow.
      part(
        at(
          bevelled(
            [
              [-0.3, -0.018],
              [-0.12, -0.026],
              [0.12, -0.026],
              [0.3, -0.018],
              [0.3, 0.014],
              [-0.3, 0.014],
            ],
            0.042,
            0.006
          ),
          { rot: [Math.PI / 2, 0, 0] }
        ),
        p.metalDark,
        { pos: [0, 0.315, -0.24], ...IRON }
      ),
      // String, drawn back to the nut
      part(swept([[-0.29, 0, -0.235], [0, 0, -0.08], [0.29, 0, -0.235]], 0.008), p.cloth, {
        pos: [0, 0.325, 0],
        ...CLOTH,
      }),
      part(new THREE.CylinderGeometry(0.036, 0.036, 0.05, 12), p.metal, {
        pos: [0, 0.325, -0.06],
        rot: [0, 0, Math.PI / 2],
        ...STEEL,
      }),
      // A quarrel in the groove
      part(new THREE.CylinderGeometry(0.011, 0.011, 0.34, 8), p.haft, {
        pos: [0, 0.345, -0.18],
        rot: [Math.PI / 2, 0, 0],
        ...WOOD,
      }),
    ],
    // Levelled, because that is both how a crossbow is carried ready and how
    // it turns its cross toward the camera
    rest: 1.35,
    swing: 0.25,
  },
  staff: {
    // Spellcasters are not troops and should not form up like them: a handful
    // of figures, widely spaced, so the stand reads as a retinue rather than
    // a rank.
    files: 3,
    ranks: 2,
    shield: false,
    spacing: 1.75,
    parts: (p) => [
      // A knotted shaft: the swell is what says grown rather than turned
      part(
        turned(
          [
            [0.028, 0],
            [0.03, 0.3],
            [0.036, 0.34],
            [0.029, 0.4],
            [0.031, 0.8],
            [0.038, 0.85],
            [0.03, 0.9],
            [0.028, 1.2],
            [0, 1.22],
          ],
          12
        ),
        p.haft,
        { pos: [0, -0.16, 0], ...WOOD }
      ),
      // A cage of iron holding a stone at the head — three claws, and the
      // stone bright enough to be the figure's contrast against the turf
      part(new THREE.OctahedronGeometry(0.085, 1), p.metal, {
        pos: [0, 1.2, 0],
        ...BLADE,
      }),
      ...[0, 1, 2].map((i) =>
        part(
          swept(
            [
              [0, -0.14, 0],
              [0.075, -0.05, 0],
              [0.085, 0.06, 0],
              [0.03, 0.12, 0],
            ],
            0.013
          ),
          p.metalDark,
          { pos: [0, 1.2, 0], rot: [0, (i * Math.PI * 2) / 3, 0], ...IRON }
        )
      ),
    ],
    // Held across the body rather than planted upright — a staff standing on
    // end is the single least useful shape on this board
    rest: 1.25,
    swing: 0.45,
  },
  bow: {
    // Archers stand looser and shallower than heavy foot
    files: 5,
    ranks: 3,
    shield: false,
    spacing: 1.16,
    parts: (p) => [
      // A recurve, swept along a curve rather than cut from a torus: the tips
      // turn back, which is the whole visual difference between a bow and a
      // hoop. Laid over so the arc presents its face upward.
      part(
        swept(
          [
            [-0.28, -0.16, 0],
            [-0.32, 0.0, 0],
            [-0.24, 0.2, 0],
            [0, 0.3, 0],
            [0.24, 0.2, 0],
            [0.32, 0.0, 0],
            [0.28, -0.16, 0],
          ],
          0.02,
          { segments: 30, sides: 6 }
        ),
        p.haft,
        { pos: [0, 0.3, 0], rot: [1.15, 0, 0.15], ...WOOD }
      ),
      // The string, nocked and drawn a little
      part(
        swept(
          [
            [-0.28, -0.16, 0],
            [0, 0.02, 0.05],
            [0.28, -0.16, 0],
          ],
          0.006,
          { segments: 12, sides: 5 }
        ),
        p.shieldTrim,
        { pos: [0, 0.3, 0], rot: [1.15, 0, 0.15], ...CLOTH }
      ),
      part(new THREE.CylinderGeometry(0.011, 0.011, 0.62, 8), p.haft, {
        pos: [0.03, 0.34, -0.1],
        rot: [1.35, 0, 0],
        ...WOOD,
      }),
      // Fletching. Three vanes, and the only part of an arrow with any area.
      ...[0, 1, 2].map((i) =>
        part(
          at(
            bevelled(
              [
                [-0.008, 0],
                [0.008, 0],
                [0.03, 0.03],
                [0.03, 0.1],
                [-0.008, 0.12],
              ],
              0.006,
              0
            ),
            { rot: [0, 0, 0] }
          ),
          p.shieldTrim,
          {
            pos: [0.03, 0.34, -0.1],
            rot: [1.35 + Math.PI / 2, (i * Math.PI * 2) / 3, 0],
            ...CLOTH,
          }
        )
      ),
    ],
    rest: 0.2,
    swing: 0.35,
  },
};

// The colours, carried instead of a weapon by one figure in the front rank.
const bannerParts = (p) => [
  part(new THREE.CylinderGeometry(0.024, 0.028, 1.45, 12), p.haft, {
    pos: [0, 0.5, 0],
    ...WOOD,
  }),
  // A sheet with a swallow-tailed fly and a slight wave along its length —
  // the wave is what catches the key light and stops it reading as card
  part(
    at(
      bevelled(
        [
          [-0.25, 0],
          [0.25, 0],
          [0.25, -0.44],
          [0.12, -0.54],
          [0.0, -0.44],
          [-0.12, -0.54],
          [-0.25, -0.44],
        ],
        0.022,
        0.008
      ),
      { rot: [Math.PI / 2, 0, 0] }
    ),
    p.shield,
    { pos: [0, 1.16, 0.22], rot: [0.5, 0, 0], ...CLOTH }
  ),
  part(new THREE.TorusGeometry(0.03, 0.012, 6, 14), p.shieldTrim, {
    pos: [0, 1.19, 0],
    rot: [Math.PI / 2, 0, 0],
    ...STEEL,
  }),
  part(
    turned(
      [
        [0, 0],
        [0.055, 0.04],
        [0.04, 0.11],
        [0, 0.18],
      ],
      14
    ),
    p.shieldTrim,
    { pos: [0, 1.22, 0], ...STEEL }
  ),
];

// A hand belongs to whatever it is holding, not to the arm behind it: the
// shield and the weapon are the two parts that move, so the bone hand merges
// into their buffers and travels with them.
const withHand = (geometry, p, body) =>
  body.bone && geometry ? merge([geometry, ...boneHandParts(p)]) : geometry;

// One block's worth of buffers, built once and worn by every figure in it.
//
// `heads` is a list rather than a single buffer because a block wants more
// than one head: half the skeletons kept the helm they were buried in and
// half did not, and alternating between two buffers gives twenty figures that
// variety for the cost of one extra buffer and no extra meshes at all.
const buildBuffers = (weapon, spec, p, body) => ({
  body: merge(bodyParts(p, body)),
  heads: (body.bone ? [false, true] : [false]).map((helmed) =>
    merge(headParts(p, body, helmed))
  ),
  thigh: merge(thighParts(p, body)),
  shin: merge(shinParts(p, body)),
  shield: spec.shield
    ? withHand(merge(shieldParts(p)), p, body)
    : weapon === "bow"
      ? // No shield, so a quiver takes the slot and gives the figure a second
        // shape at its back
        merge([
          part(
            turned(
              [
                [0, 0],
                [0.06, 0.01],
                [0.055, 0.28],
                [0.062, 0.32],
                [0.05, 0.34],
                [0, 0.35],
              ],
              14
            ),
            p.haft,
            { pos: [-0.02, -0.18, 0.1], rot: [0.5, 0, 0.2], ...HIDE }
          ),
          ...[-0.02, 0.02].map((dx) =>
            part(new THREE.CylinderGeometry(0.009, 0.009, 0.2, 6), p.shieldTrim, {
              pos: [-0.02 + dx, 0.06, 0.02],
              rot: [0.5, 0, 0.2],
              ...CLOTH,
            })
          ),
        ])
    : null,
  weapon: withHand(merge(spec.parts(p)), p, body),
  banner: merge(bannerParts(p)),
});


const hang = (parent, geometry, material, position) => {
  if (!geometry) return null;
  const mesh = new THREE.Mesh(geometry, material);
  if (position) mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

// One figure, facing -Z, standing on y = 0.
//
// Eight meshes, which is one per part of a man that moves independently of
// the others. Everything inside one of them was merged when the buffers were
// built.
const makeFigure = (buffers, material, spec, build, carriesBanner, index) => {
  const group = new THREE.Group();
  // Short and broad, or tall and narrow. Applied to the whole figure so the
  // kit scales with the body rather than floating beside it.
  group.scale.set(build.breadth, build.height, build.breadth);

  const hips = new THREE.Group();
  hips.position.y = 0.52;
  group.add(hips);
  hang(hips, buffers.body, material);

  const head = new THREE.Group();
  head.position.set(...(build.headAt ?? [0, 0.46, -0.02]));
  hips.add(head);
  hang(head, buffers.heads[index % buffers.heads.length], material);

  // Two legs, alternating on the march
  const legs = [1, -1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.1, -0.06, 0);
    hips.add(hip);
    hang(hip, buffers.thigh, material);
    const shin = new THREE.Group();
    shin.position.y = -0.26;
    hip.add(shin);
    hang(shin, buffers.shin, material);
    return { hip, shin, side };
  });

  // Shield on the left, canted forward so it presents its face to an enemy —
  // and, incidentally, most of its area to the camera
  let shield = null;
  if (buffers.shield) {
    shield = new THREE.Group();
    shield.position.set(-0.3, 0.1, -0.18);
    hips.add(shield);
    hang(shield, buffers.shield, material);
    // A quiver is worn, not held: it must not swing with the shield arm
    if (!spec.shield) shield = null;
  }

  // Weapon arm on the right
  const held = new THREE.Group();
  held.position.set(0.26, 0.14, -0.04);
  hips.add(held);
  hang(held, carriesBanner ? buffers.banner : buffers.weapon, material);

  return { group, hips, head, legs, shield, weapon: held, carriesBanner };
};

/**
 * A block of infantry.
 *
 * Ranks are tight and files are dressed, because that regularity is the read:
 * a formation is recognisable as a formation before any single figure in it
 * is recognisable as a man.
 *
 * `weapon` is axe, sword, spear, crossbow, staff or bow, and carries the
 * block's shape with it — pikes form deeper, archers looser.
 */
export const buildInfantry = ({
  weapon = "axe",
  palette = "orc",
  build = "man",
  files,
  ranks,
  spacing,
  banner = false,
  dressing = "ranked",
} = {}) => {
  const spec = WEAPONS[weapon] ?? WEAPONS.axe;
  const p = PALETTES[palette] ?? PALETTES.orc;
  const body = BUILDS[build] ?? BUILDS.man;
  const form = DRESSINGS[dressing] ?? DRESSINGS.ranked;
  const material = surfaceMaterial();
  const buffers = buildBuffers(weapon, spec, p, body);

  const root = new THREE.Group();
  const figures = [];

  const across = files ?? spec.files;
  const deep = ranks ?? spec.ranks;
  // Broad people need more room across the front; narrow ones close up
  const gap = (spacing ?? spec.spacing ?? 1) * (0.6 + body.breadth * 0.4);
  const stepX = 1.15 * gap;
  const stepZ = 1.05 * gap;

  for (let rank = 0; rank < deep; rank += 1) {
    for (let file = 0; file < across; file += 1) {
      // One figure carries the colours instead of a weapon: front rank,
      // centre, where a real standard-bearer would stand
      const carriesBanner =
        banner && rank === 0 && file === Math.floor(across / 2);
      const index = rank * across + file;
      const figure = makeFigure(
        buffers,
        material,
        spec,
        body,
        carriesBanner,
        index
      );
      // Alternate ranks step half a file across, closing the gaps in front —
      // the same dressing the card art shows
      const stagger = rank % 2 === 1 ? stepX / 2 : 0;
      figure.group.position.set(
        -((across - 1) * stepX) / 2 + file * stepX + stagger - stagger / 2,
        0,
        -((deep - 1) * stepZ) / 2 + rank * stepZ
      );
      // A little drift, so the block is soldiers rather than a lattice, and
      // how much of it is what separates a rank from a crowd. Hashed from
      // position, never random — a random offset would shimmer.
      const jitter = ((file * 11 + rank * 7) % 7) - 3;
      figure.group.rotation.y =
        jitter * 0.03 + (noise(index * 5 + 1) - 0.5) * form.turn;
      figure.group.position.x +=
        jitter * 0.02 + (noise(index * 5 + 2) - 0.5) * form.drift * stepX;
      figure.group.position.z +=
        (noise(index * 5 + 3) - 0.5) * form.drift * stepZ;
      if (form.size) {
        const grown = 1 + (noise(index * 5 + 4) - 0.5) * form.size;
        figure.group.scale.multiplyScalar(grown);
      }
      figure.lean = noise(index * 5 + 5) * form.stoop;
      figure.phase = ((file * 1.3 + rank * 2.1) % (Math.PI * 2)) * form.spread;
      root.add(figure.group);
      figures.push(figure);
    }
  }

  // The ground they are standing on, for the units that brought their own.
  // Laid strictly inside the block's own footprint, so it adds no extent —
  // and therefore costs none of the size the stand can give the figures.
  if (body.litter) {
    const bounds = new THREE.Box3().setFromObject(root);
    const litter = meshOf(
      litterParts(
        p,
        ((across - 1) * stepX) / 2,
        ((deep - 1) * stepZ) / 2,
        bounds.min.y
      ),
      material
    );
    if (litter) root.add(litter);
  }

  return { root, figures, spec, weapon, build: body, count: figures.length };
};

const GAITS = {
  // At the halt: weight shifting, heads turning, shields settling
  idle: { rate: 1.4, stride: 0.1, bob: 0.3, lean: 0, ready: 0, strike: 0 },
  // Marching in step — but not in lockstep, which reads as mechanical
  march: { rate: 3.6, stride: 1, bob: 1, lean: 0.05, ready: 0.15, strike: 0 },
  // Shields up, weapons working, the block leaning into it
  attack: { rate: 5.4, stride: 0.35, bob: 1.2, lean: 0.16, ready: 0.5, strike: 1 },
};

/**
 * Pose the block.
 *
 * The whole block shares one clock but every figure has its own phase. That
 * is deliberate: a rank moving in perfect unison reads as a machine, and a
 * rank moving at random reads as a crowd. A tight spread of phases around a
 * common rhythm is what reads as soldiers.
 */
export const poseInfantry = (rig, time, state = "idle") => {
  const gait = GAITS[state] ?? GAITS.idle;
  const spec = rig.spec;
  const shooting = rig.weapon === "bow";

  rig.figures.forEach((figure) => {
    const t = time * gait.rate + figure.phase;

    figure.legs.forEach(({ hip, shin, side }) => {
      const swing = t + (side > 0 ? 0 : Math.PI);
      hip.rotation.x = Math.sin(swing) * 0.55 * gait.stride;
      shin.rotation.x = Math.max(-Math.sin(swing - 0.7), 0) * 0.7 * gait.stride;
    });

    figure.hips.position.y = 0.52 + Math.abs(Math.sin(t)) * 0.045 * gait.bob;
    // A crowd stoops unevenly; a rank does not. `figure.lean` is zero for
    // everyone in a dressed block and per-figure in a ragged one.
    figure.hips.rotation.x = -(gait.lean + figure.lean);

    // The head stays level while the body bobs under it
    figure.head.rotation.x = gait.lean - Math.abs(Math.sin(t)) * 0.05 * gait.bob;
    figure.head.rotation.y = Math.sin(time * 0.6 + figure.phase) * 0.2;

    // Shields come up as the fighting starts
    if (figure.shield) {
      figure.shield.rotation.x = -gait.ready * 0.5 + Math.sin(t + 0.4) * 0.05;
    }

    // A blow is faster than a pace, so the strike runs on its own clock. An
    // archer looses rather than swinging, so the same scalar drives a much
    // smaller motion with a longer pause between shots.
    const strike = gait.strike
      ? Math.max(Math.sin(time * (shooting ? 3.4 : 7) + figure.phase * 2), 0) **
        (shooting ? 3 : 1.6)
      : 0;

    if (figure.carriesBanner) {
      // Colours are carried, not swung: held well back off the vertical so
      // the cloth stays visible, with a slow sway and no strike at all
      figure.weapon.rotation.x = 0.6 + Math.sin(t * 0.5) * 0.06;
      figure.weapon.rotation.z = Math.sin(t * 0.4 + 1) * 0.07;
    } else {
      figure.weapon.rotation.x =
        spec.rest -
        gait.ready * 0.4 -
        strike * spec.swing +
        Math.sin(t) * 0.05 * gait.stride;
      figure.weapon.rotation.z = shooting ? 0 : strike * 0.35;
    }
  });
};
