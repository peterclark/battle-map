import * as THREE from "three";

// A block of foot — the shape most of the game takes.
//
// Of eighty-nine units in the army lists, more than half are ranks of
// infantry, so this one rig carries more of the board than everything else
// put together. It is parameterised twice over:
//
//   By weapon. The card already distinguishes a spearman from an archer from
//   a swordsman, and until now the board did not — everyone mustered as an
//   axeman. What a figure carries changes its silhouette more than anything
//   else about it, so this is the distinction worth having.
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
// Twenty figures rather than the card's attack dice. Battleground does not
// track individual models, and the count follows the density of the printed
// card art: a rank is only a rank if there are enough of them to make a
// pattern.

const matte = (color, roughness = 0.85) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

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

// One set of geometry, shared by every figure in every block on the board.
// Twenty men cost one man's worth of buffers; only the transforms differ.
const GEOMETRY = {
  torso: new THREE.CapsuleGeometry(0.19, 0.3, 4, 8),
  pauldron: new THREE.SphereGeometry(0.13, 8, 6),
  head: new THREE.SphereGeometry(0.13, 10, 8),
  helm: new THREE.ConeGeometry(0.155, 0.22, 8),
  limb: new THREE.CapsuleGeometry(0.062, 0.22, 3, 6),
  boot: new THREE.BoxGeometry(0.13, 0.08, 0.2),
  // A shield is the broadest thing an infantryman carries, which makes it the
  // most valuable thing on the model when the camera is directly above
  shield: new THREE.CylinderGeometry(0.26, 0.26, 0.05, 12),
  boss: new THREE.SphereGeometry(0.07, 8, 6),

  axeHaft: new THREE.CylinderGeometry(0.038, 0.032, 1.05, 6),
  axeHead: new THREE.BoxGeometry(0.06, 0.32, 0.24),
  axeHorn: new THREE.ConeGeometry(0.06, 0.17, 4),

  swordBlade: new THREE.BoxGeometry(0.05, 0.78, 0.13),
  swordGuard: new THREE.BoxGeometry(0.05, 0.05, 0.32),
  swordGrip: new THREE.CylinderGeometry(0.033, 0.033, 0.22, 6),

  spearHaft: new THREE.CylinderGeometry(0.032, 0.028, 1.9, 6),
  spearHead: new THREE.ConeGeometry(0.055, 0.28, 5),

  // A bow is a wide arc. Held across the body rather than upright, it is the
  // broadest pale shape an archer has — worth more from above than the arrow
  // ever will be.
  bow: new THREE.TorusGeometry(0.32, 0.022, 5, 14, Math.PI * 1.15),
  arrow: new THREE.CylinderGeometry(0.012, 0.012, 0.62, 4),
  quiver: new THREE.CylinderGeometry(0.058, 0.05, 0.34, 6),
};

const add = (geometry, material, parent, position, rotation) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

// How each weapon is built, how the block carrying it forms up, and how it is
// posed. Keeping the three together means a new weapon is one entry rather
// than edits scattered through the file.
const WEAPONS = {
  axe: {
    files: 5,
    ranks: 4,
    shield: true,
    build: (parent, m) => {
      add(GEOMETRY.axeHaft, m.haft, parent, [0, 0.34, 0]);
      add(GEOMETRY.axeHead, m.metal, parent, [0.07, 0.76, 0]);
      add(GEOMETRY.axeHorn, m.metal, parent, [0.07, 0.94, 0], [0, 0, -0.2]);
    },
    // Carried back over the shoulder. Authentic, and the only way the camera
    // sees an axe at all.
    rest: 0.85,
    swing: 1.4,
  },
  sword: {
    files: 5,
    ranks: 4,
    shield: true,
    build: (parent, m) => {
      add(GEOMETRY.swordGrip, m.haft, parent, [0, 0.16, 0]);
      add(GEOMETRY.swordGuard, m.metalDark, parent, [0, 0.29, 0]);
      add(GEOMETRY.swordBlade, m.metal, parent, [0, 0.7, 0]);
    },
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
    build: (parent, m) => {
      add(GEOMETRY.spearHaft, m.haft, parent, [0, 0.72, 0]);
      add(GEOMETRY.spearHead, m.metal, parent, [0, 1.75, 0]);
    },
    // Well down off the vertical. Held as a real pikeman holds it, a spear is
    // a single dark pixel; laid back over the shoulder it draws a line the
    // length of the stand, and a block of them reads as a thicket.
    rest: 1.15,
    swing: 0.5,
  },
  bow: {
    // Archers stand looser and shallower than heavy foot
    files: 5,
    ranks: 3,
    shield: false,
    spacing: 1.16,
    build: (parent, m) => {
      // Laid over so the arc presents its face upward
      add(GEOMETRY.bow, m.cloth, parent, [0, 0.3, 0], [1.15, 0, 0.15]);
      add(GEOMETRY.arrow, m.haft, parent, [0.03, 0.34, -0.1], [1.35, 0, 0]);
    },
    rest: 0.2,
    swing: 0.35,
  },
};

// One figure, facing -Z, standing on y = 0.
const makeFigure = (weapon, m, spec) => {
  const group = new THREE.Group();

  const hips = new THREE.Group();
  hips.position.y = 0.52;
  group.add(hips);

  add(GEOMETRY.torso, m.armour, hips, [0, 0.12, 0]);
  add(GEOMETRY.pauldron, m.armourLit, hips, [0.2, 0.26, 0]);
  add(GEOMETRY.pauldron, m.armourLit, hips, [-0.2, 0.26, 0]);

  const head = new THREE.Group();
  head.position.set(0, 0.46, -0.02);
  hips.add(head);
  add(GEOMETRY.head, m.skin, head, [0, 0, 0]);
  add(GEOMETRY.helm, m.metalDark, head, [0, 0.11, 0]);

  // Two legs, alternating on the march
  const legs = [1, -1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.1, -0.06, 0);
    hips.add(hip);
    add(GEOMETRY.limb, m.armour, hip, [0, -0.14, 0]);
    const shin = new THREE.Group();
    shin.position.y = -0.26;
    hip.add(shin);
    add(GEOMETRY.limb, m.armour, shin, [0, -0.11, 0]);
    add(GEOMETRY.boot, m.armour, shin, [0, -0.24, -0.02]);
    return { hip, shin, side };
  });

  // Shield on the left, canted forward so it presents its face to an enemy —
  // and, incidentally, most of its area to the camera
  let shield = null;
  const shieldArm = new THREE.Group();
  shieldArm.position.set(-0.24, 0.18, -0.06);
  hips.add(shieldArm);
  add(GEOMETRY.limb, m.skin, shieldArm, [0, -0.1, 0]);
  if (spec.shield) {
    shield = new THREE.Group();
    shield.position.set(-0.06, -0.08, -0.12);
    shieldArm.add(shield);
    add(GEOMETRY.shield, m.shield, shield, [0, 0, 0], [Math.PI / 2.6, 0, 0.12]);
    add(GEOMETRY.boss, m.shieldTrim, shield, [0, 0.06, -0.1]);
  } else if (weapon === "bow") {
    // No shield, so the quiver takes the slot and gives the figure a second
    // shape at its back
    add(GEOMETRY.quiver, m.haft, shieldArm, [-0.02, -0.04, 0.14], [0.5, 0, 0.2]);
  }

  // Weapon arm on the right
  const weaponArm = new THREE.Group();
  weaponArm.position.set(0.24, 0.2, -0.04);
  hips.add(weaponArm);
  add(GEOMETRY.limb, m.skin, weaponArm, [0, -0.1, 0]);

  const held = new THREE.Group();
  held.position.set(0.02, -0.06, 0);
  weaponArm.add(held);
  spec.build(held, m);

  return { group, hips, head, legs, shield, weapon: held };
};

/**
 * A block of infantry.
 *
 * Ranks are tight and files are dressed, because that regularity is the read:
 * a formation is recognisable as a formation before any single figure in it
 * is recognisable as a man.
 *
 * `weapon` is axe, sword, spear or bow, and carries the block's shape with
 * it — pikes form deeper, archers looser.
 */
export const buildInfantry = ({
  weapon = "axe",
  palette = "orc",
  files,
  ranks,
} = {}) => {
  const spec = WEAPONS[weapon] ?? WEAPONS.axe;
  const p = PALETTES[palette] ?? PALETTES.orc;
  const m = {
    armour: matte(p.armour),
    armourLit: matte(p.armourLit),
    skin: matte(p.skin),
    metal: matte(p.metal, 0.45),
    metalDark: matte(p.metalDark, 0.5),
    shield: matte(p.shield),
    shieldTrim: matte(p.shieldTrim, 0.4),
    haft: matte(p.haft),
    cloth: matte(p.cloth, 0.7),
  };

  const root = new THREE.Group();
  const figures = [];

  const across = files ?? spec.files;
  const deep = ranks ?? spec.ranks;
  const stepX = 1.15 * (spec.spacing ?? 1);
  const stepZ = 1.05 * (spec.spacing ?? 1);

  for (let rank = 0; rank < deep; rank += 1) {
    for (let file = 0; file < across; file += 1) {
      const figure = makeFigure(weapon, m, spec);
      // Alternate ranks step half a file across, closing the gaps in front —
      // the same dressing the card art shows
      const stagger = rank % 2 === 1 ? stepX / 2 : 0;
      figure.group.position.set(
        -((across - 1) * stepX) / 2 + file * stepX + stagger - stagger / 2,
        0,
        -((deep - 1) * stepZ) / 2 + rank * stepZ
      );
      // A little drift, so the block is soldiers rather than a lattice.
      // Hashed from position, never random — a random offset would shimmer.
      const jitter = ((file * 11 + rank * 7) % 7) - 3;
      figure.group.rotation.y = jitter * 0.03;
      figure.group.position.x += jitter * 0.02;
      figure.phase = (file * 1.3 + rank * 2.1) % (Math.PI * 2);
      root.add(figure.group);
      figures.push(figure);
    }
  }

  return { root, figures, spec, weapon, count: figures.length };
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
    figure.hips.rotation.x = -gait.lean;

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

    figure.weapon.rotation.x =
      spec.rest -
      gait.ready * 0.4 -
      strike * spec.swing +
      Math.sin(t) * 0.05 * gait.stride;
    figure.weapon.rotation.z = shooting ? 0 : strike * 0.35;
  });
};
