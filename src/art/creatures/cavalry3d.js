import * as THREE from "three";
import { at, bevelled, merge, part, surfaceMaterial, swept, turned } from "./kit.js";

// Mounted troops: a beast, a rider on its back, and something in the rider's
// hand pointing the way the unit is going.
//
// This began as Goblin Wolf Riders alone, and it is where the finding that
// decided the whole approach came from. One large body made of capsules reads
// as a blob from directly overhead. Six small figures in a formation read
// clearly — the spacing, the staggered ranks, the shafts all pointing one
// way. A pattern survives the overhead camera where a single silhouette does
// not.
//
// It is parameterised by mount and by rider, because a knight's charger is not
// a re-tinted wolf. The two differ where it matters from above: a wolf is low
// and long with a brush tail, a horse is tall and deep-chested with a mane
// running its neck. And a barded horse carries a caparison — a broad cloth
// over its back — which is both historically right and the largest pale area
// anything on this board presents to a camera above it.
//
// Like the infantry, a rider is now merged buffers rather than loose meshes:
// one per part that moves on its own, which here is fourteen where it used to
// be twenty-six. The saved budget went into tack. A horse with a bridle, reins
// and a saddle reads as ridden; one without reads as a horse with a man
// balanced on it.

const MOUNTS = {
  wolf: {
    hide: 0x7d7264,
    hideDark: 0x3f3a32,
    muzzle: 0x2a2621,
    mane: 0x554d42,
    height: 0.62,
    // A wolf slinks; a horse stands over its legs
    legReach: 0.34,
    brush: true,
    // A wolf wears a collar and a rope, not a bridle and a saddle
    tack: "rope",
  },
  bonehorse: {
    // A dead horse. Bone reads against dark turf without any help, so the
    // trick is keeping the tack dim enough that the animal stays the read.
    hide: 0xbdb49a,
    hideDark: 0x8d8674,
    muzzle: 0x6a6456,
    mane: 0x6d6a5c,
    height: 0.82,
    legReach: 0.46,
    brush: false,
    tack: "bridle",
  },
  horse: {
    hide: 0x5a4436,
    hideDark: 0x3d2d23,
    muzzle: 0x2b201a,
    // A pale mane down the neck, the same trick the lizardfolk use: one light
    // strip tracing the animal's length is worth more than any amount of
    // modelling below it
    mane: 0xcfc0a0,
    height: 0.82,
    legReach: 0.44,
    brush: false,
    tack: "bridle",
  },
};

const RIDERS = {
  goblin: { skin: 0x6f8f3c, kit: 0x3d3128, metal: 0x9aa2aa, cloth: 0x6b5335 },
  knight: { skin: 0xbb8c63, kit: 0x8d959f, metal: 0xc3cad2, cloth: 0x9c3a34 },
  scout: { skin: 0xbb8c63, kit: 0x5d4a30, metal: 0x9aa2aa, cloth: 0x8a7452 },
  elf: { skin: 0xd6b394, kit: 0xc9cdd4, metal: 0xe0c877, cloth: 0xeef1f5 },
  dwarf: { skin: 0xc09274, kit: 0x4d5058, metal: 0xb8a05e, cloth: 0xd9cdb4 },
  // A dead rider on a dead horse: bone over everything, and the caparison
  // rotted to a rag
  wight: { skin: 0xcfc6ad, kit: 0x4c4f4a, metal: 0x8a8f88, cloth: 0x6d6a5c },
  wildman: { skin: 0xa8815e, kit: 0x5c4a38, metal: 0x9aa2aa, cloth: 0xbba98c },
};

const ARMS = {
  // Shouldered at rest, levelled for the charge, and never so upright that
  // the overhead camera loses it
  spear: { length: 1.75, rest: -0.5, level: 0.5, head: true },
  // A couched lance is the best of the three from above: nearly horizontal
  // even at rest, so its whole length faces the camera. It also earns a
  // vamplate and a pennon, which are pure area at the end of a long line.
  lance: { length: 2.3, rest: -0.25, level: 0.35, head: true, vamplate: true },
  // Scouts carry a blade — short, raised, and no help at all from above,
  // which is why they also get the boldest mount colour
  sword: { length: 0.8, rest: -1.0, level: 0.7, head: false, blade: true },
  // Horse archers shoot rather than charge. The bow lies across the rider,
  // so the shaft is short and flat and the arc does the work.
  bow: { length: 0.62, rest: 1.3, level: -0.2, head: false, arc: true },
};

// See infantry3d.js for why metalness is graded rather than uniform: 0.72
// across a large surface has nothing to reflect and renders black.
const PLATE = { metalness: 0.3, roughness: 0.44 };
const BLADE = { metalness: 0.5, roughness: 0.26 };
const STEEL = { metalness: 0.68, roughness: 0.3 };
const CLOTH = { roughness: 0.92 };
const WOOD = { roughness: 0.78 };
const HIDE = { roughness: 0.8 };
const FUR = { roughness: 0.95 };

// Outlines are drawn in XY and turned a quarter, so width runs fore-and-aft
// and thickness side-to-side — the same convention the infantry weapons use.
const flat = (points, thickness, bevel) =>
  at(bevelled(points, thickness, bevel), { rot: [0, -Math.PI / 2, 0] });

// --- the animal ------------------------------------------------------------

const spineParts = (mount, kit, caparison) => {
  const parts = [
    // The barrel, deeper at the chest than at the flank
    part(new THREE.CapsuleGeometry(0.34, 0.95, 8, 16), mount.hide, {
      pos: [0, 0, 0.05],
      rot: [Math.PI / 2, 0, 0],
      scale: [1, 1, 1.02],
      ...HIDE,
    }),
    part(new THREE.CapsuleGeometry(0.3, 0.3, 8, 16), mount.hideDark, {
      pos: [0, -0.04, -0.4],
      rot: [Math.PI / 2, 0, 0],
      scale: [1.08, 1.08, 1],
      ...HIDE,
    }),
  ];

  if (mount.tack === "bridle") {
    // A saddle, cut as a profile so it has a cantle and a pommel. It is the
    // one place a horse's outline breaks, and from above it separates the
    // animal from the man.
    parts.push(
      part(
        flat(
          [
            [-0.34, -0.02],
            [-0.28, 0.1],
            [-0.1, 0.04],
            [0.1, 0.04],
            [0.26, 0.12],
            [0.34, -0.02],
            [0.3, -0.1],
            [-0.3, -0.1],
          ],
          0.44,
          0.014
        ),
        kit.kit,
        { pos: [0, 0.3, -0.14], ...HIDE }
      ),
      // Girth
      part(new THREE.TorusGeometry(0.35, 0.022, 6, 20), kit.kit, {
        pos: [0, 0.02, -0.14],
        rot: [0, Math.PI / 2, 0],
        scale: [1, 1.05, 1],
        ...HIDE,
      })
    );
  } else {
    // A war-wolf is roped rather than saddled: a hide pad and a cinch
    parts.push(
      part(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 16), kit.kit, {
        pos: [0, 0.3, -0.1],
        scale: [1, 1, 1.3],
        ...HIDE,
      }),
      part(new THREE.TorusGeometry(0.33, 0.018, 6, 18), kit.cloth, {
        pos: [0, 0.02, -0.1],
        rot: [0, Math.PI / 2, 0],
        ...CLOTH,
      }),
      // A dark ridge of hackles down the spine, and a ruff at the shoulders.
      // A wolf's whole body is one colour from above and reads as a lozenge
      // without them — this is the "one strip tracing the length" trick, run
      // dark-on-pale instead of the usual way round.
      part(
        at(
          bevelled(
            [
              [-0.045, -0.72],
              [0.045, -0.72],
              [0.06, -0.5],
              [0.042, -0.34],
              [0.062, -0.16],
              [0.04, 0.02],
              [0.058, 0.2],
              [0.035, 0.4],
              [0.03, 0.6],
              [-0.03, 0.6],
              [-0.035, 0.4],
              [-0.058, 0.2],
              [-0.04, 0.02],
              [-0.062, -0.16],
              [-0.042, -0.34],
              [-0.06, -0.5],
            ],
            0.12,
            0.008
          ),
          { rot: [Math.PI / 2, 0, 0] }
        ),
        mount.hideDark,
        { pos: [0, 0.3, 0.05], ...FUR }
      ),
      part(
        turned(
          [
            [0.3, -0.16],
            [0.42, -0.05],
            [0.44, 0.03],
            [0.3, 0.12],
          ],
          16
        ),
        mount.hideDark,
        { pos: [0, 0.02, -0.34], rot: [Math.PI / 2, 0, 0], scale: [1, 0.9, 1], ...FUR }
      )
    );
  }

  // The caparison goes on before the rider, so the rider sits on top of it.
  // Scalloped along the hem, because a rectangle of cloth reads as a mattress.
  if (caparison) {
    parts.push(
      part(
        at(
          bevelled(
            [
              [-0.46, 0.62],
              [0.46, 0.62],
              [0.46, -0.5],
              [0.34, -0.62],
              [0.23, -0.5],
              [0.11, -0.62],
              [0, -0.5],
              [-0.11, -0.62],
              [-0.23, -0.5],
              [-0.34, -0.62],
              [-0.46, -0.5],
            ],
            0.05,
            0.012
          ),
          { rot: [Math.PI / 2, 0, 0] }
        ),
        kit.cloth,
        { pos: [0, 0.22, 0.08], rot: [0.02, 0, 0], ...CLOTH }
      )
    );
  }

  return parts;
};

const neckParts = (mount, kit) => {
  const parts = [
    // A wedge skull rather than a box: narrower at the muzzle, with a
    // pronounced brow
    part(
      flat(
        [
          [-0.15, -0.13],
          [0.15, -0.13],
          [0.16, 0.05],
          [0.1, 0.13],
          [-0.1, 0.13],
          [-0.16, 0.05],
        ],
        0.3,
        0.014
      ),
      mount.hide,
      { pos: [0, 0, -0.16], rot: [0, Math.PI / 2, 0], ...HIDE }
    ),
    part(
      flat(
        [
          [-0.085, -0.075],
          [0.085, -0.075],
          [0.09, 0.05],
          [0.06, 0.078],
          [-0.06, 0.078],
          [-0.09, 0.05],
        ],
        0.3,
        0.01
      ),
      mount.muzzle,
      { pos: [0, -0.05, -0.46], rot: [0, Math.PI / 2, 0], ...HIDE }
    ),
    // Ears, turned so they cup
    ...[0.11, -0.11].map((x) =>
      part(
        turned(
          [
            [0, -0.09],
            [0.075, -0.05],
            [0.06, 0.03],
            [0.03, 0.07],
            [0, 0.09],
          ],
          12
        ),
        mount.hideDark,
        { pos: [x, 0.17, -0.06], rot: [-0.2, 0, x > 0 ? -0.2 : 0.2], ...FUR }
      )
    ),
    ...[0.11, -0.11].map((x) =>
      part(new THREE.SphereGeometry(0.045, 12, 10), 0xd8b23a, {
        pos: [x, 0.06, -0.34],
        ...BLADE,
      })
    ),
    // The mane: pale, and running the length of the neck toward the camera.
    // Cut with a ragged lower edge so it reads as hair rather than as a plank.
    part(
      at(
        bevelled(
          [
            [-0.055, 0.33],
            [0.055, 0.33],
            [0.06, 0.1],
            [0.048, -0.02],
            [0.058, -0.14],
            [0.045, -0.26],
            [0.05, -0.33],
            [-0.05, -0.33],
            [-0.045, -0.26],
            [-0.058, -0.14],
            [-0.048, -0.02],
            [-0.06, 0.1],
          ],
          0.1,
          0.008
        ),
        { rot: [Math.PI / 2, 0, 0] }
      ),
      mount.mane,
      { pos: [0, 0.17, -0.1], rot: [0.25, 0, 0], ...FUR }
    ),
  ];

  if (mount.tack === "bridle") {
    // Browband, noseband and cheek strap. Three thin lines, and between them
    // they are the difference between a horse and a ridden horse.
    parts.push(
      part(new THREE.TorusGeometry(0.1, 0.014, 5, 16), kit.kit, {
        pos: [0, -0.04, -0.42],
        rot: [Math.PI / 2, 0, 0],
        scale: [1, 1, 0.9],
        ...HIDE,
      }),
      part(new THREE.TorusGeometry(0.16, 0.014, 5, 16), kit.kit, {
        pos: [0, 0.03, -0.16],
        rot: [Math.PI / 2, 0, 0],
        scale: [1, 1, 0.85],
        ...HIDE,
      }),
      ...[0.13, -0.13].map((x) =>
        part(swept([[0, 0.1, -0.16], [0.01, 0.0, -0.3], [0, -0.04, -0.42]], 0.013), kit.kit, {
          pos: [x, 0, 0],
          ...HIDE,
        })
      ),
      // Reins, running back to the rider's hands
      ...[0.11, -0.11].map((x) =>
        part(
          swept(
            [
              [0, -0.04, -0.4],
              [0.02, 0.06, -0.1],
              [0.01, 0.16, 0.24],
            ],
            0.012
          ),
          kit.kit,
          { pos: [x, 0, 0], ...HIDE }
        )
      )
    );
  } else {
    // A spiked collar, which is what a war-wolf gets instead
    parts.push(
      part(new THREE.TorusGeometry(0.19, 0.03, 6, 18), kit.kit, {
        pos: [0, 0.02, 0.04],
        rot: [Math.PI / 2 + 0.2, 0, 0],
        ...HIDE,
      }),
      ...[0, 1, 2, 3, 4].map((i) =>
        part(new THREE.ConeGeometry(0.028, 0.09, 8), kit.metal, {
          pos: [
            Math.sin(((i - 2) * Math.PI) / 7) * 0.2,
            0.02 + Math.cos(((i - 2) * Math.PI) / 7) * 0.19,
            0.04,
          ],
          rot: [0, 0, ((i - 2) * -Math.PI) / 7],
          ...STEEL,
        })
      )
    );
  }

  return parts;
};

const legParts = (mount) => [
  part(new THREE.CapsuleGeometry(0.078, 0.3, 8, 14), mount.hide, {
    pos: [0, -0.18, 0],
    ...HIDE,
  }),
];

const shinParts = (mount) => [
  part(new THREE.CapsuleGeometry(0.058, 0.3, 8, 14), mount.hideDark, {
    pos: [0, -0.13, 0],
    ...HIDE,
  }),
  mount.brush
    ? // A paw, with claws
      part(
        at(
          bevelled(
            [
              [-0.07, -0.11],
              [0.07, -0.11],
              [0.075, 0.03],
              [0.03, 0.06],
              [-0.03, 0.06],
              [-0.075, 0.03],
            ],
            0.09,
            0.012
          ),
          { rot: [Math.PI / 2, 0, 0] }
        ),
        mount.hideDark,
        { pos: [0, -0.28, -0.02], ...FUR }
      )
    : // A hoof, turned — the one part of a horse that is genuinely a solid of
      // revolution
      part(
        turned(
          [
            [0, 0],
            [0.075, 0.01],
            [0.082, 0.06],
            [0.07, 0.11],
            [0.062, 0.14],
            [0, 0.15],
          ],
          14
        ),
        mount.muzzle,
        { pos: [0, -0.33, -0.02], ...HIDE }
      ),
];

const tailParts = (mount, index) =>
  mount.brush
    ? [
        // A brush: fattest in the middle, tapering to a tip
        part(
          turned(
            [
              [0, 0],
              [0.07, 0.06],
              [0.105, 0.16],
              [0.09, 0.28],
              [0.045, 0.38],
              [0, 0.42],
            ],
            12
          ),
          index === 0 ? mount.hideDark : mount.mane,
          { pos: [0, 0, 0.02], rot: [Math.PI / 2.2, 0, 0], ...FUR }
        ),
      ]
    : [
        // A dock and a switch of hair hanging from it
        part(new THREE.CapsuleGeometry(0.06, 0.14, 6, 12), mount.hide, {
          pos: [0, 0, 0.08],
          rot: [Math.PI / 3.4, 0, 0],
          ...HIDE,
        }),
        part(
          turned(
            [
              [0, 0],
              [0.075, -0.06],
              [0.085, -0.24],
              [0.05, -0.44],
              [0, -0.52],
            ],
            12
          ),
          mount.mane,
          { pos: [0, 0.02, 0.18], rot: [-0.5, 0, 0], ...FUR }
        ),
      ];

// --- the rider -------------------------------------------------------------

const riderParts = (kit, arm) => {
  const parts = [
    part(new THREE.CapsuleGeometry(0.17, 0.24, 8, 16), kit.kit, { ...HIDE }),
    // A cuirass over the torso
    part(
      flat(
        [
          [-0.14, -0.14],
          [0.14, -0.14],
          [0.155, 0.05],
          [0.1, 0.17],
          [-0.1, 0.17],
          [-0.155, 0.05],
        ],
        0.08,
        0.012
      ),
      kit.metal,
      { pos: [0, 0.04, -0.11], rot: [0, Math.PI / 2, 0], ...PLATE }
    ),
    part(new THREE.SphereGeometry(0.155, 16, 13), kit.skin, {
      pos: [0, 0.3, -0.03],
      ...HIDE,
    }),
    // A helm, turned, with a brow band — the same shape the foot wear
    part(
      turned(
        [
          [0, -0.09],
          [0.155, -0.07],
          [0.168, -0.02],
          [0.15, 0.06],
          [0.11, 0.13],
          [0.055, 0.17],
          [0, 0.18],
        ],
        18
      ),
      kit.kit,
      { pos: [0, 0.36, -0.03], ...PLATE }
    ),
    part(new THREE.TorusGeometry(0.163, 0.017, 6, 20), kit.metal, {
      pos: [0, 0.325, -0.03],
      rot: [Math.PI / 2, 0, 0],
      ...STEEL,
    }),
    ...[
      [0.19, 0.06, -0.06, -0.7],
      [-0.19, 0.06, -0.06, 0.7],
    ].map(([x, y, z, roll]) =>
      part(new THREE.CapsuleGeometry(0.055, 0.2, 8, 12), kit.skin, {
        pos: [x, y, z],
        rot: [0, 0, roll],
        ...HIDE,
      })
    ),
  ];

  // A lancer carries a shield on the bridle arm. It is the broadest thing on
  // a mounted figure and it does the same work here it does on foot.
  if (arm.vamplate) {
    parts.push(
      part(
        turned(
          [
            [0, -0.03],
            [0.14, -0.02],
            [0.2, 0.0],
            [0.22, 0.03],
            [0.2, 0.05],
            [0, 0.06],
          ],
          18
        ),
        kit.cloth,
        { pos: [-0.24, 0.02, -0.12], rot: [Math.PI / 2.3, 0, 0.2], ...CLOTH }
      ),
      part(new THREE.TorusGeometry(0.21, 0.016, 6, 22), kit.metal, {
        pos: [-0.24, 0.02, -0.12],
        rot: [Math.PI / 2.3 + Math.PI / 2, 0, 0.2],
        ...STEEL,
      })
    );
  }

  return parts;
};

const weaponParts = (kit, arm) => {
  const parts = [
    part(new THREE.CylinderGeometry(0.036, 0.044, arm.length, 14), kit.kit, {
      rot: [Math.PI / 2, 0, 0],
      ...WOOD,
    }),
  ];

  if (arm.arc) {
    // A horse archer's bow lies across him, arc turned upward — the same
    // reasoning as the foot archers, and the only part of him that reads
    parts.push(
      part(
        swept(
          [
            [-0.26, -0.15, 0],
            [-0.3, 0, 0],
            [-0.22, 0.19, 0],
            [0, 0.28, 0],
            [0.22, 0.19, 0],
            [0.3, 0, 0],
            [0.26, -0.15, 0],
          ],
          0.019,
          { segments: 26, sides: 6 }
        ),
        kit.kit,
        { pos: [0, 0.02, -0.1], rot: [1.2, 0, 0.1], ...WOOD }
      ),
      part(
        swept(
          [
            [-0.26, -0.15, 0],
            [0, 0.0, 0.04],
            [0.26, -0.15, 0],
          ],
          0.006,
          { segments: 10, sides: 5 }
        ),
        kit.cloth,
        { pos: [0, 0.02, -0.1], rot: [1.2, 0, 0.1], ...CLOTH }
      )
    );
  }

  if (arm.head) {
    parts.push(
      part(
        flat(
          [
            [-0.02, 0],
            [0.02, 0],
            [0.06, 0.08],
            [0.055, 0.2],
            [0, 0.34],
            [-0.055, 0.2],
            [-0.06, 0.08],
          ],
          0.04,
          0.008
        ),
        kit.metal,
        { pos: [0, 0, -arm.length / 2 - 0.16], rot: [-Math.PI / 2, 0, 0], ...BLADE }
      )
    );
  }

  if (arm.vamplate) {
    // The cone that guards the hand. Pure area on a nearly horizontal shaft,
    // which is the best thing a camera above can be given.
    parts.push(
      part(
        turned(
          [
            [0.045, 0],
            [0.1, 0.09],
            [0.145, 0.16],
            [0.15, 0.19],
            [0.06, 0.19],
          ],
          16
        ),
        kit.metal,
        { pos: [0, 0, 0.5], rot: [Math.PI / 2, 0, 0], ...PLATE }
      ),
      // A pennon below the head, streaming back
      part(
        at(
          bevelled(
            [
              [-0.02, 0],
              [0.02, 0],
              [0.03, -0.3],
              [-0.01, -0.4],
              [-0.02, -0.3],
            ],
            0.13,
            0.006
          ),
          { rot: [0, Math.PI / 2, 0] }
        ),
        kit.cloth,
        { pos: [0, 0, -arm.length / 2 + 0.16], rot: [-Math.PI / 2, 0, 0], ...CLOTH }
      )
    );
  }

  if (arm.blade) {
    parts.push(
      part(
        flat(
          [
            [-0.055, 0],
            [0.055, 0],
            [0.05, 0.34],
            [0.034, 0.5],
            [0, 0.6],
            [-0.034, 0.5],
            [-0.05, 0.34],
          ],
          0.042,
          0.008
        ),
        kit.metal,
        { pos: [0, 0, -arm.length / 2 - 0.24], rot: [-Math.PI / 2, 0, 0], ...BLADE }
      ),
      part(
        flat([[-0.15, -0.022], [0.15, -0.022], [0.14, 0.024], [-0.14, 0.024]], 0.045, 0.008),
        kit.kit,
        { pos: [0, 0, -arm.length / 2 - 0.2], rot: [-Math.PI / 2, 0, 0], ...STEEL }
      )
    );
  }

  return parts;
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

// One formation's worth of buffers, shared by every rider in it
const buildBuffers = (mount, kit, arm, caparison) => ({
  spine: merge(spineParts(mount, kit, caparison)),
  neck: merge(neckParts(mount, kit)),
  leg: merge(legParts(mount)),
  shin: merge(shinParts(mount)),
  tail: [0, 1].map((i) => merge(tailParts(mount, i))),
  rider: merge(riderParts(kit, arm)),
  weapon: merge(weaponParts(kit, arm)),
});

// One mount and the figure on its back. Faces -Z, stands on y = 0.
const makeRider = (mount, buffers, material) => {
  const group = new THREE.Group();

  const spine = new THREE.Group();
  spine.position.y = mount.height;
  group.add(spine);
  hang(spine, buffers.spine, material);

  const neck = new THREE.Group();
  neck.position.set(0, 0.02, -0.62);
  spine.add(neck);
  hang(neck, buffers.neck, material);

  // Four legs at the corners. Each is a hip group with a shin under it, so a
  // trot is two rotations rather than a translation.
  const legs = [];
  [
    [0.24, -0.42, "front"],
    [-0.24, -0.42, "front"],
    [0.26, 0.42, "rear"],
    [-0.26, 0.42, "rear"],
  ].forEach(([x, z, kind]) => {
    const hip = new THREE.Group();
    hip.position.set(x, -0.12, z);
    spine.add(hip);
    hang(hip, buffers.leg, material);
    const shin = new THREE.Group();
    shin.position.y = -mount.legReach;
    hip.add(shin);
    hang(shin, buffers.shin, material);
    legs.push({ hip, shin, kind });
  });

  // Tail. A wolf's brush flicks in two segments; a horse's switch hangs.
  const tail = [];
  let attach = spine;
  const segments = mount.brush ? 2 : 1;
  for (let i = 0; i < segments; i += 1) {
    const seg = new THREE.Group();
    seg.position.set(0, i === 0 ? 0.06 : 0, i === 0 ? 0.62 : 0.24);
    attach.add(seg);
    hang(seg, buffers.tail[i], material);
    tail.push(seg);
    attach = seg;
  }

  const rider = new THREE.Group();
  rider.position.set(0, mount.height * 0.55, -0.12);
  spine.add(rider);
  hang(rider, buffers.rider, material);

  // The shaft is what makes a formation read from above: six of them pointing
  // the same way is a stronger cue than any single figure
  const weapon = new THREE.Group();
  weapon.position.set(0.22, 0.12, -0.1);
  rider.add(weapon);
  hang(weapon, buffers.weapon, material);

  return { group, spine, neck, legs, tail, rider, weapon };
};

/**
 * A formation of cavalry, in staggered ranks the way the card art arranges
 * them. Each rider carries its own phase so the formation moves together
 * without moving as one animal.
 */
export const buildCavalry = ({
  mount = "wolf",
  rider = "goblin",
  arm = "spear",
  caparison = false,
  files = 3,
  ranks = 2,
} = {}) => {
  const profile = MOUNTS[mount] ?? MOUNTS.wolf;
  const kit = RIDERS[rider] ?? RIDERS.goblin;
  const weapon = ARMS[arm] ?? ARMS.spear;
  const material = surfaceMaterial();
  const buffers = buildBuffers(profile, kit, weapon, caparison);

  const root = new THREE.Group();
  // The formation opens out on the charge, and that is a scale on the riders
  // rather than on the root. `CreatureLayer` owns the root's scale — it is
  // what fits the rig to its stand — so a poser writing to it silently
  // discards the fit and the unit renders at modelled size, straddling half
  // the board.
  const spread = new THREE.Group();
  root.add(spread);
  const riders = [];

  const spanX = 6.4;
  const stepX = spanX / files;
  const stepZ = 2.6;

  for (let rank = 0; rank < ranks; rank += 1) {
    for (let file = 0; file < files; file += 1) {
      const made = makeRider(profile, buffers, material);
      // The rear rank steps half a file across, closing the gaps in the front
      const stagger = rank % 2 === 1 ? stepX / 2 : 0;
      made.group.position.set(
        -spanX / 2 + stepX / 2 + file * stepX + stagger,
        0,
        -1.3 + rank * stepZ
      );
      // A hand's width of drift so the ranks are not machined
      made.group.rotation.y = (((file * 7 + rank * 13) % 5) - 2) * 0.035;
      made.phase = (file * 1.9 + rank * 2.7) % (Math.PI * 2);
      spread.add(made.group);
      riders.push(made);
    }
  }

  return { root, spread, riders, profile, weapon, count: riders.length };
};

const GAITS = {
  // Standing, shifting weight, heads turning, tails moving
  idle: { rate: 1.6, stride: 0.12, bob: 0.35, lean: 0, level: 0, spread: 0 },
  // A working trot
  march: { rate: 5.2, stride: 1, bob: 1, lean: 0.06, level: 0.15, spread: 0 },
  // Charging: bodies stretched forward, shafts levelled, ranks opening out
  attack: { rate: 7.6, stride: 1.25, bob: 1.5, lean: 0.2, level: 1, spread: 0.5 },
};

/**
 * Pose the whole formation for a moment in time.
 *
 * A four-legged animal trots on diagonal pairs — front-left with rear-right —
 * which is the one thing here that had to be got right for it to look like an
 * animal at all rather than a rocking toy.
 */
export const poseCavalry = (rig, time, state = "idle") => {
  const gait = GAITS[state] ?? GAITS.idle;
  const arm = rig.weapon;

  rig.riders.forEach((mount) => {
    const t = time * gait.rate + mount.phase;

    mount.legs.forEach(({ hip, shin, kind }, index) => {
      // Diagonal pairs: legs 0 (front-right) and 3 (rear-left) swing
      // together, 1 and 2 together
      const diagonal = index === 0 || index === 3 ? 0 : Math.PI;
      const swing = t + diagonal;
      hip.rotation.x = Math.sin(swing) * 0.7 * gait.stride;
      // The shin trails the hip and only folds on the recovery stroke
      shin.rotation.x = Math.max(-Math.sin(swing - 0.8), 0) * 0.9 * gait.stride;
      // Front legs reach a little further than the rear push
      if (kind === "front") hip.rotation.x *= 1.15;
    });

    // The body rises twice per stride cycle and pitches into the run
    mount.spine.position.y =
      rig.profile.height + Math.sin(t * 2) * 0.055 * gait.bob;
    mount.spine.rotation.x = -gait.lean + Math.sin(t * 2 + 0.6) * 0.04 * gait.bob;

    // Head steadies against the body's bob, the way a running animal's does
    mount.neck.rotation.x =
      gait.lean * 0.8 - Math.sin(t * 2 + 0.6) * 0.05 * gait.bob;
    mount.neck.rotation.y = Math.sin(time * 0.7 + mount.phase) * 0.22;

    mount.tail.forEach((seg, i) => {
      seg.rotation.y = Math.sin(t * 0.8 - i * 0.7) * 0.3;
      seg.rotation.x = 0.2 + Math.sin(t - i * 0.5) * 0.12;
    });

    // The rider absorbs the bob rather than riding it rigidly
    mount.rider.rotation.x =
      gait.lean * 1.4 + Math.sin(t * 2 + 1.1) * 0.07 * gait.bob;
    mount.rider.position.y =
      rig.profile.height * 0.55 - Math.sin(t * 2) * 0.02 * gait.bob;

    mount.weapon.rotation.x =
      arm.rest + gait.level * arm.level + Math.sin(t + mount.phase) * 0.05;
  });

  // Charging, the formation opens out; at rest it closes back up
  rig.spread.scale.x = 1 + gait.spread * 0.12;
};
