import * as THREE from "three";

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

const matte = (color, roughness = 0.9) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

const KINDS = {
  troll: {
    hide: 0x5c6b4a,
    hideDark: 0x3f4a33,
    back: 0x9aa87c,
    detail: 0xd8cfb4,
    scale: 1,
    count: 3,
    hunch: 0.62,
    club: true,
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
  },
  abomination: {
    // Stitched together out of other things, and it should look wrong: the
    // arms are longer than they should be and it carries nothing.
    hide: 0x6b6357,
    hideDark: 0x453f37,
    back: 0xa39a86,
    detail: 0xcfc6ad,
    scale: 1.05,
    count: 2,
    hunch: 0.8,
    club: false,
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
  },
};

const GEOMETRY = {
  torso: new THREE.CapsuleGeometry(0.42, 0.5, 5, 10),
  // The slab across the shoulders: the widest, brightest thing on the figure
  back: new THREE.BoxGeometry(1.02, 0.16, 0.62),
  shoulder: new THREE.SphereGeometry(0.28, 9, 7),
  head: new THREE.SphereGeometry(0.24, 10, 8),
  jaw: new THREE.BoxGeometry(0.26, 0.12, 0.24),
  tusk: new THREE.ConeGeometry(0.05, 0.18, 4),
  upperArm: new THREE.CapsuleGeometry(0.15, 0.42, 4, 7),
  foreArm: new THREE.CapsuleGeometry(0.13, 0.4, 4, 7),
  fist: new THREE.SphereGeometry(0.2, 8, 6),
  thigh: new THREE.CapsuleGeometry(0.18, 0.3, 4, 7),
  shin: new THREE.CapsuleGeometry(0.15, 0.28, 4, 7),
  foot: new THREE.BoxGeometry(0.34, 0.14, 0.46),
  club: new THREE.CylinderGeometry(0.09, 0.14, 1.15, 6),
};

const add = (geometry, material, parent, position, rotation, scale) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  if (scale) mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

// One brute, facing -Z, standing on y = 0.
const makeBrute = (spec, m) => {
  const group = new THREE.Group();

  const hips = new THREE.Group();
  hips.position.y = 1.05;
  group.add(hips);

  // Hunched hard forward. This is the whole difference between a brute and a
  // very large man from directly above.
  const spine = new THREE.Group();
  spine.rotation.x = spec.hunch;
  hips.add(spine);

  add(GEOMETRY.torso, m.hide, spine, [0, 0.1, 0], [Math.PI / 2.4, 0, 0]);
  add(GEOMETRY.back, m.back, spine, [0, 0.36, 0.04], [0.24, 0, 0]);
  add(GEOMETRY.shoulder, m.hideDark, spine, [0.42, 0.3, -0.14]);
  add(GEOMETRY.shoulder, m.hideDark, spine, [-0.42, 0.3, -0.14]);

  const head = new THREE.Group();
  head.position.set(0, 0.3, -0.46);
  spine.add(head);
  add(GEOMETRY.head, m.hide, head, [0, 0, 0]);
  add(GEOMETRY.jaw, m.hideDark, head, [0, -0.16, -0.1]);
  add(GEOMETRY.tusk, m.detail, head, [0.1, -0.12, -0.18], [-2.6, 0, 0.2]);
  add(GEOMETRY.tusk, m.detail, head, [-0.1, -0.12, -0.18], [-2.6, 0, -0.2]);

  // Arms hung wide and long. Half the silhouette from above is here.
  const arms = [1, -1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.46, 0.22, -0.06);
    spine.add(shoulder);
    shoulder.rotation.z = side * 0.42;
    add(GEOMETRY.upperArm, m.hide, shoulder, [0, -0.3, 0]);
    const forearm = new THREE.Group();
    forearm.position.y = -0.6;
    shoulder.add(forearm);
    forearm.rotation.x = -0.5;
    add(GEOMETRY.foreArm, m.hide, forearm, [0, -0.26, 0]);
    add(GEOMETRY.fist, m.hideDark, forearm, [0, -0.5, 0]);

    let club = null;
    if (spec.club && side > 0) {
      club = new THREE.Group();
      club.position.set(0, -0.5, 0);
      forearm.add(club);
      // Laid back over the shoulder, like every other weapon on this board,
      // and for the same reason
      add(GEOMETRY.club, m.hideDark, club, [0, 0.4, 0.1], [0.9, 0, 0]);
    }
    return { shoulder, forearm, club, side };
  });

  const legs = [1, -1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.24, -0.08, 0);
    hips.add(hip);
    add(GEOMETRY.thigh, m.hide, hip, [0, -0.24, 0.02]);
    const shin = new THREE.Group();
    shin.position.y = -0.46;
    hip.add(shin);
    shin.rotation.x = -0.3;
    add(GEOMETRY.shin, m.hide, shin, [0, -0.22, 0]);
    const foot = new THREE.Group();
    foot.position.y = -0.44;
    shin.add(foot);
    add(GEOMETRY.foot, m.hideDark, foot, [0, -0.05, -0.1]);
    return { hip, shin, foot, side };
  });

  return { group, hips, spine, head, arms, legs };
};

/**
 * A knot of brutes. Loose, never dressed — these are not soldiers.
 */
export const buildBrutes = ({ kind = "troll" } = {}) => {
  const spec = KINDS[kind] ?? KINDS.troll;
  const m = {
    hide: matte(spec.hide),
    hideDark: matte(spec.hideDark),
    back: matte(spec.back, 0.95),
    detail: matte(spec.detail, 0.6),
  };

  const root = new THREE.Group();
  const brutes = [];

  for (let i = 0; i < spec.count; i += 1) {
    const brute = makeBrute(spec, m);
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
