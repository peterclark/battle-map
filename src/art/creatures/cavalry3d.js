import * as THREE from "three";

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
// It is now parameterised by mount and by rider, because a knight's charger
// is not a re-tinted wolf. The two differ where it matters from above: a wolf
// is low and long with a brush tail, a horse is tall and deep-chested with a
// mane running its neck. And a barded horse carries a caparison — a broad
// cloth over its back — which is both historically right and the largest pale
// area anything on this board presents to a camera above it.

const matte = (color, roughness = 0.85) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

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
    caparison: null,
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
    caparison: null,
  },
};

const RIDERS = {
  goblin: { skin: 0x6f8f3c, kit: 0x3d3128, metal: 0x9aa2aa, cloth: 0x6b5335 },
  knight: { skin: 0xbb8c63, kit: 0x8d959f, metal: 0xc3cad2, cloth: 0x9c3a34 },
  scout: { skin: 0xbb8c63, kit: 0x5d4a30, metal: 0x9aa2aa, cloth: 0x8a7452 },
};

const ARMS = {
  // Shouldered at rest, levelled for the charge, and never so upright that
  // the overhead camera loses it
  spear: { length: 1.75, rest: -0.5, level: 0.5, head: true },
  // A couched lance is the best of the three from above: nearly horizontal
  // even at rest, so its whole length faces the camera
  lance: { length: 2.3, rest: -0.25, level: 0.35, head: true },
  // Scouts carry a blade — short, raised, and no help at all from above,
  // which is why they also get the boldest mount colour
  sword: { length: 0.8, rest: -1.0, level: 0.7, head: false },
};

const GEOMETRY = {
  body: new THREE.CapsuleGeometry(0.34, 0.95, 4, 10),
  chest: new THREE.CapsuleGeometry(0.3, 0.3, 4, 8),
  skull: new THREE.BoxGeometry(0.3, 0.26, 0.46),
  snout: new THREE.BoxGeometry(0.17, 0.15, 0.28),
  ear: new THREE.ConeGeometry(0.08, 0.18, 4),
  eye: new THREE.SphereGeometry(0.045, 8, 6),
  limb: new THREE.CapsuleGeometry(0.075, 0.3, 3, 6),
  paw: new THREE.BoxGeometry(0.14, 0.09, 0.2),
  tailSeg: new THREE.CapsuleGeometry(0.09, 0.22, 3, 6),
  maneStrip: new THREE.BoxGeometry(0.1, 0.06, 0.66),
  // Draped over the whole back and hanging past the flanks
  caparison: new THREE.BoxGeometry(0.92, 0.06, 1.34),
  torso: new THREE.CapsuleGeometry(0.17, 0.24, 4, 8),
  head: new THREE.SphereGeometry(0.16, 10, 8),
  cap: new THREE.ConeGeometry(0.17, 0.2, 7),
  arm: new THREE.CapsuleGeometry(0.055, 0.2, 3, 6),
  point: new THREE.ConeGeometry(0.085, 0.26, 5),
};

// Shaft geometry varies by weapon, so it is built per length and cached
const shafts = new Map();
const shaftFor = (length) => {
  if (!shafts.has(length)) {
    shafts.set(length, new THREE.CylinderGeometry(0.042, 0.036, length, 6));
  }
  return shafts.get(length);
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

// One mount and the figure on its back. Faces -Z, stands on y = 0.
const makeRider = (mount, m, arm, caparison) => {
  const group = new THREE.Group();

  const spine = new THREE.Group();
  spine.position.y = mount.height;
  group.add(spine);

  const body = add(GEOMETRY.body, m.hide, spine, [0, 0, 0.05]);
  body.rotation.x = Math.PI / 2;
  add(GEOMETRY.chest, m.hideDark, spine, [0, -0.04, -0.4], [Math.PI / 2, 0, 0]);

  // The caparison goes on before the rider, so the rider sits on top of it
  if (caparison) {
    add(GEOMETRY.caparison, m.caparison, spine, [0, 0.22, 0.08], [0.02, 0, 0]);
  }

  const neck = new THREE.Group();
  neck.position.set(0, 0.02, -0.62);
  spine.add(neck);
  add(GEOMETRY.skull, m.hide, neck, [0, 0, -0.16]);
  add(GEOMETRY.snout, m.muzzle, neck, [0, -0.05, -0.48]);
  add(GEOMETRY.ear, m.hideDark, neck, [0.11, 0.17, -0.06]);
  add(GEOMETRY.ear, m.hideDark, neck, [-0.11, 0.17, -0.06]);
  add(GEOMETRY.eye, m.eye, neck, [0.11, 0.06, -0.34]);
  add(GEOMETRY.eye, m.eye, neck, [-0.11, 0.06, -0.34]);
  // The mane: pale, and running the length of the neck toward the camera
  add(GEOMETRY.maneStrip, m.mane, neck, [0, 0.17, -0.1], [0.25, 0, 0]);

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
    add(GEOMETRY.limb, m.hide, hip, [0, -0.18, 0]);
    const shin = new THREE.Group();
    shin.position.y = -mount.legReach;
    hip.add(shin);
    add(GEOMETRY.limb, m.hideDark, shin, [0, -0.13, 0]);
    add(GEOMETRY.paw, m.hideDark, shin, [0, -0.28, -0.02]);
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
    add(
      GEOMETRY.tailSeg,
      mount.brush ? m.hideDark : m.mane,
      seg,
      [0, 0, 0.12],
      [mount.brush ? Math.PI / 2.2 : Math.PI / 3.4, 0, 0]
    );
    tail.push(seg);
    attach = seg;
  }

  const rider = new THREE.Group();
  rider.position.set(0, mount.height * 0.55, -0.12);
  spine.add(rider);
  add(GEOMETRY.torso, m.kit, rider, [0, 0, 0]);
  add(GEOMETRY.head, m.skin, rider, [0, 0.3, -0.03]);
  add(GEOMETRY.cap, m.metalDark ?? m.kit, rider, [0, 0.42, -0.03]);
  add(GEOMETRY.arm, m.skin, rider, [0.19, 0.06, -0.06], [0, 0, -0.7]);
  add(GEOMETRY.arm, m.skin, rider, [-0.19, 0.06, -0.06], [0, 0, 0.7]);

  // The shaft is what makes a formation read from above: six of them pointing
  // the same way is a stronger cue than any single figure
  const weapon = new THREE.Group();
  weapon.position.set(0.22, 0.12, -0.1);
  rider.add(weapon);
  add(shaftFor(arm.length), m.kit, weapon, [0, 0, 0], [Math.PI / 2, 0, 0]);
  if (arm.head) {
    add(GEOMETRY.point, m.metal, weapon, [0, 0, -arm.length / 2 - 0.08], [
      -Math.PI / 2,
      0,
      0,
    ]);
  }

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

  const m = {
    hide: matte(profile.hide),
    hideDark: matte(profile.hideDark),
    muzzle: matte(profile.muzzle),
    mane: matte(profile.mane, 0.8),
    caparison: matte(kit.cloth, 0.8),
    skin: matte(kit.skin),
    kit: matte(kit.kit),
    metal: matte(kit.metal, 0.4),
    metalDark: matte(kit.kit, 0.5),
    eye: new THREE.MeshStandardMaterial({
      color: 0xd8b23a,
      roughness: 0.3,
      emissive: 0x2a2000,
    }),
  };

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
      const made = makeRider(profile, m, weapon, caparison);
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
