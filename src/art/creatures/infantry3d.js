import * as THREE from "three";

// Orc Axemen — a block of heavy infantry, built from the same primitives as
// the monster and the cavalry.
//
// This is the case that matters most, because it is the shape most of the
// army list takes: of ninety-odd units, the great majority are ranks of
// footmen and only a handful are monsters. If a formation of twenty reads
// from directly overhead and costs little enough to run twenty of them on a
// board, the technique covers the whole game. If it does not, it covers the
// monsters and nothing else.
//
// Twenty figures rather than the card's five attack dice. Battleground does
// not track individual models, and the count here follows the density of the
// printed card art — which is the whole point of the test: a rank is only a
// rank if there are enough of them to make a pattern.

const ARMOUR = 0x2f2a24;
const ARMOUR_LIT = 0x453d34;
const SKIN = 0x5f7a35;
const STEEL = 0x8d959d;
const STEEL_DARK = 0x5a6169;
const SHIELD = 0x4a3524;
const SHIELD_BOSS = 0x7b8189;

const matte = (color, roughness = 0.85) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

const MATERIALS = {
  armour: matte(ARMOUR),
  armourLit: matte(ARMOUR_LIT),
  skin: matte(SKIN),
  steel: matte(STEEL, 0.45),
  steelDark: matte(STEEL_DARK, 0.5),
  shield: matte(SHIELD),
  boss: matte(SHIELD_BOSS, 0.4),
};

// One set of geometry, shared by every figure in the block. Twenty orcs cost
// one orc's worth of buffers; only the transforms differ.
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
  haft: new THREE.CylinderGeometry(0.038, 0.032, 1.05, 6),
  axeHead: new THREE.BoxGeometry(0.06, 0.32, 0.24),
  axeHorn: new THREE.ConeGeometry(0.06, 0.17, 4),
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

// One orc, facing -Z, standing on y = 0
const makeOrc = () => {
  const group = new THREE.Group();

  const hips = new THREE.Group();
  hips.position.y = 0.52;
  group.add(hips);

  add(GEOMETRY.torso, MATERIALS.armour, hips, [0, 0.12, 0]);
  add(GEOMETRY.pauldron, MATERIALS.armourLit, hips, [0.2, 0.26, 0]);
  add(GEOMETRY.pauldron, MATERIALS.armourLit, hips, [-0.2, 0.26, 0]);

  const head = new THREE.Group();
  head.position.set(0, 0.46, -0.02);
  hips.add(head);
  add(GEOMETRY.head, MATERIALS.skin, head, [0, 0, 0]);
  add(GEOMETRY.helm, MATERIALS.steelDark, head, [0, 0.11, 0]);

  // Two legs, alternating on the march
  const legs = [1, -1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.1, -0.06, 0);
    hips.add(hip);
    add(GEOMETRY.limb, MATERIALS.armour, hip, [0, -0.14, 0]);
    const shin = new THREE.Group();
    shin.position.y = -0.26;
    hip.add(shin);
    add(GEOMETRY.limb, MATERIALS.armour, shin, [0, -0.11, 0]);
    add(GEOMETRY.boot, MATERIALS.armour, shin, [0, -0.24, -0.02]);
    return { hip, shin, side };
  });

  // Shield on the left, canted forward so it presents its face to an enemy —
  // and, incidentally, most of its area to the camera
  const shieldArm = new THREE.Group();
  shieldArm.position.set(-0.24, 0.18, -0.06);
  hips.add(shieldArm);
  add(GEOMETRY.limb, MATERIALS.skin, shieldArm, [0, -0.1, 0]);
  const shield = new THREE.Group();
  shield.position.set(-0.06, -0.08, -0.12);
  shieldArm.add(shield);
  add(GEOMETRY.shield, MATERIALS.shield, shield, [0, 0, 0], [Math.PI / 2.6, 0, 0.12]);
  add(GEOMETRY.boss, MATERIALS.boss, shield, [0, 0.06, -0.1]);

  // Axe on the right, shouldered
  const axeArm = new THREE.Group();
  axeArm.position.set(0.24, 0.2, -0.04);
  hips.add(axeArm);
  add(GEOMETRY.limb, MATERIALS.skin, axeArm, [0, -0.1, 0]);

  const axe = new THREE.Group();
  axe.position.set(0.02, -0.06, 0);
  axeArm.add(axe);
  add(GEOMETRY.haft, MATERIALS.armour, axe, [0, 0.34, 0]);
  add(GEOMETRY.axeHead, MATERIALS.steel, axe, [0.07, 0.76, 0]);
  add(GEOMETRY.axeHorn, MATERIALS.steel, axe, [0.07, 0.94, 0], [0, 0, -0.2]);

  return { group, hips, head, legs, shield, axe };
};

/**
 * A block of infantry. Ranks are tight and files are dressed, because that
 * regularity is the read: a formation is recognisable as a formation before
 * any single figure in it is recognisable as a man.
 */
export const buildInfantry = ({ files = 5, ranks = 4 } = {}) => {
  const root = new THREE.Group();
  const orcs = [];

  const stepX = 1.15;
  const stepZ = 1.05;

  for (let rank = 0; rank < ranks; rank += 1) {
    for (let file = 0; file < files; file += 1) {
      const orc = makeOrc();
      // Alternate ranks step half a file across, closing the gaps in front —
      // the same dressing the card art shows
      const stagger = rank % 2 === 1 ? stepX / 2 : 0;
      orc.group.position.set(
        -((files - 1) * stepX) / 2 + file * stepX + stagger - stagger / 2,
        0,
        -((ranks - 1) * stepZ) / 2 + rank * stepZ
      );
      // A little drift, so the block is soldiers rather than a lattice
      const jitter = ((file * 11 + rank * 7) % 7) - 3;
      orc.group.rotation.y = jitter * 0.03;
      orc.group.position.x += jitter * 0.02;
      orc.phase = (file * 1.3 + rank * 2.1) % (Math.PI * 2);
      root.add(orc.group);
      orcs.push(orc);
    }
  }

  return { root, orcs, count: orcs.length };
};

const GAITS = {
  // At the halt: weight shifting, heads turning, shields settling
  idle: { rate: 1.4, stride: 0.1, bob: 0.3, lean: 0, axe: 0, chop: 0 },
  // Marching in step — but not in lockstep, which reads as mechanical
  march: { rate: 3.6, stride: 1, bob: 1, lean: 0.05, axe: 0.15, chop: 0 },
  // Hacking: shields up, axes working, the block leaning into it
  attack: { rate: 5.4, stride: 0.35, bob: 1.2, lean: 0.16, axe: 0.5, chop: 1 },
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

  rig.orcs.forEach((orc) => {
    const t = time * gait.rate + orc.phase;

    orc.legs.forEach(({ hip, shin, side }) => {
      const swing = t + (side > 0 ? 0 : Math.PI);
      hip.rotation.x = Math.sin(swing) * 0.55 * gait.stride;
      shin.rotation.x = Math.max(-Math.sin(swing - 0.7), 0) * 0.7 * gait.stride;
    });

    orc.hips.position.y = 0.52 + Math.abs(Math.sin(t)) * 0.045 * gait.bob;
    orc.hips.rotation.x = -gait.lean;

    // The head stays level while the body bobs under it
    orc.head.rotation.x = gait.lean - Math.abs(Math.sin(t)) * 0.05 * gait.bob;
    orc.head.rotation.y = Math.sin(time * 0.6 + orc.phase) * 0.2;

    // Shields come up as the fighting starts
    orc.shield.rotation.x = -gait.axe * 0.5 + Math.sin(t + 0.4) * 0.05;

    // The axe is shouldered on the march and swings on the attack. Chopping
    // runs at its own rate — a blow is faster than a pace.
    const chop = gait.chop
      ? Math.max(Math.sin(time * 7 + orc.phase * 2), 0) ** 1.6
      : 0;
    // Carried back over the shoulder rather than upright — authentic, and
    // the only way the camera sees an axe at all
    orc.axe.rotation.x =
      0.85 - gait.axe * 0.4 - chop * 1.4 + Math.sin(t) * 0.05 * gait.stride;
    orc.axe.rotation.z = chop * 0.35;
  });
};
