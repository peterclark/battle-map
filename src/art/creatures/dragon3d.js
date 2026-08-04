import * as THREE from "three";

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

const matte = (color, roughness = 0.8) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

const KINDS = {
  red: {
    hide: 0x7e2820,
    hideDark: 0x511713,
    membrane: 0xb8543c,
    belly: 0xd9a25c,
    horn: 0xe8dcc0,
    wings: true,
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
    necks: 1,
    scale: 1.15,
  },
  hydra: {
    // No wings, so the necks do all of it
    hide: 0x3f5f4a,
    hideDark: 0x2a4232,
    membrane: 0x6f8f6a,
    belly: 0xbfc98f,
    horn: 0xe4dcbd,
    wings: false,
    necks: 5,
    scale: 1.05,
  },
};

const GEOMETRY = {
  body: new THREE.CapsuleGeometry(0.52, 1.05, 5, 12),
  chest: new THREE.SphereGeometry(0.52, 12, 9),
  // A dorsal ridge, the same device the lizardfolk use, at ten times the size
  ridge: new THREE.BoxGeometry(0.14, 0.1, 1.5),
  spine: new THREE.ConeGeometry(0.1, 0.3, 4),

  neckSeg: new THREE.CapsuleGeometry(0.16, 0.34, 4, 8),
  skull: new THREE.ConeGeometry(0.24, 0.66, 7),
  jaw: new THREE.BoxGeometry(0.22, 0.09, 0.38),
  horn: new THREE.ConeGeometry(0.07, 0.42, 5),

  // The wing: an upper spar, a lower spar, and the membrane between them.
  // Flat boxes rather than a real membrane — from directly above a flat box
  // and a curved sheet are the same thing, and one of them is free.
  wingSpar: new THREE.CylinderGeometry(0.075, 0.045, 1.9, 6),
  wingInner: new THREE.BoxGeometry(1.7, 0.05, 1.15),
  wingOuter: new THREE.BoxGeometry(1.5, 0.045, 0.95),
  wingClaw: new THREE.ConeGeometry(0.06, 0.26, 4),

  thigh: new THREE.CapsuleGeometry(0.22, 0.42, 4, 8),
  shin: new THREE.CapsuleGeometry(0.17, 0.38, 4, 7),
  foot: new THREE.BoxGeometry(0.36, 0.14, 0.5),
  talon: new THREE.ConeGeometry(0.06, 0.22, 4),
  armUpper: new THREE.CapsuleGeometry(0.13, 0.3, 4, 7),
  armLower: new THREE.CapsuleGeometry(0.1, 0.28, 4, 7),

  tailSeg: new THREE.CylinderGeometry(0.3, 0.16, 0.8, 8),
  tailTip: new THREE.CylinderGeometry(0.16, 0.03, 0.9, 6),
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

// A neck with a head on it. The hydra gets five, fanned; a dragon gets one.
const makeNeck = (parent, spec, m, angle, reach) => {
  const root = new THREE.Group();
  root.position.set(0, 0.42, -0.72);
  root.rotation.y = angle;
  parent.add(root);

  const lower = new THREE.Group();
  lower.rotation.x = -0.5;
  root.add(lower);
  add(GEOMETRY.neckSeg, m.hide, lower, [0, 0, -0.28 * reach], [Math.PI / 2, 0, 0]);

  const upper = new THREE.Group();
  upper.position.z = -0.58 * reach;
  lower.add(upper);
  upper.rotation.x = 0.55;
  add(GEOMETRY.neckSeg, m.hide, upper, [0, 0, -0.28 * reach], [Math.PI / 2, 0, 0]);

  const head = new THREE.Group();
  head.position.z = -0.6 * reach;
  upper.add(head);
  add(GEOMETRY.skull, m.hide, head, [0, 0, -0.2], [-Math.PI / 2, 0, 0]);
  add(GEOMETRY.jaw, m.hideDark, head, [0, -0.1, -0.3]);
  add(GEOMETRY.horn, m.horn, head, [0.12, 0.1, 0.06], [-0.9, 0, 0.3]);
  add(GEOMETRY.horn, m.horn, head, [-0.12, 0.1, 0.06], [-0.9, 0, -0.3]);

  return { root, lower, upper, head, angle };
};

// One dragon, facing -Z, standing on y = 0.
const makeDragon = (spec, m) => {
  const group = new THREE.Group();

  const body = new THREE.Group();
  body.position.y = 1.15;
  group.add(body);

  add(GEOMETRY.body, m.hide, body, [0, 0, 0.1], [Math.PI / 2, 0, 0]);
  add(GEOMETRY.chest, m.hideDark, body, [0, -0.05, -0.5], null, [1, 0.85, 1]);
  add(GEOMETRY.ridge, m.belly, body, [0, 0.46, 0.1]);
  [-0.5, 0, 0.5].forEach((z, i) => {
    add(GEOMETRY.spine, m.horn, body, [0, 0.56, z], [0.6 + i * 0.06, 0, 0]);
  });

  const necks = [];
  if (spec.necks === 1) {
    necks.push(makeNeck(body, spec, m, 0, 1.15));
  } else {
    // Fanned across the front, longest in the middle
    for (let i = 0; i < spec.necks; i += 1) {
      const spread = (i / (spec.necks - 1) - 0.5) * 1.5;
      necks.push(makeNeck(body, spec, m, spread, 1 - Math.abs(spread) * 0.18));
    }
  }

  // The wings. Held out and back at a shallow angle so they lie almost flat
  // to the ground — which is what makes this animal readable at all.
  const wings = spec.wings
    ? [1, -1].map((side) => {
        const shoulder = new THREE.Group();
        shoulder.position.set(side * 0.4, 0.34, -0.1);
        body.add(shoulder);
        shoulder.rotation.z = side * 0.28;
        shoulder.rotation.y = side * -0.25;

        add(GEOMETRY.wingSpar, m.hideDark, shoulder, [side * 0.9, 0, 0], [0, 0, Math.PI / 2]);
        add(GEOMETRY.wingInner, m.membrane, shoulder, [side * 0.85, -0.03, 0.42]);

        const outer = new THREE.Group();
        outer.position.set(side * 1.75, 0, 0);
        shoulder.add(outer);
        add(GEOMETRY.wingSpar, m.hideDark, outer, [side * 0.72, 0, 0.2], [0.25, 0, Math.PI / 2], [1, 0.85, 1]);
        add(GEOMETRY.wingOuter, m.membrane, outer, [side * 0.7, -0.04, 0.58]);
        add(GEOMETRY.wingClaw, m.horn, outer, [side * 1.4, 0, -0.05], [0, 0, side * -1.3]);

        return { shoulder, outer, side };
      })
    : [];

  // Hind legs take the weight; forelimbs are small and tucked
  const legs = [1, -1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.42, -0.16, 0.36);
    body.add(hip);
    hip.rotation.z = side * 0.2;
    add(GEOMETRY.thigh, m.hide, hip, [0, -0.3, 0]);
    const shin = new THREE.Group();
    shin.position.y = -0.62;
    hip.add(shin);
    shin.rotation.x = -0.55;
    add(GEOMETRY.shin, m.hide, shin, [0, -0.28, 0]);
    const foot = new THREE.Group();
    foot.position.y = -0.54;
    shin.add(foot);
    add(GEOMETRY.foot, m.hideDark, foot, [0, -0.05, -0.12]);
    add(GEOMETRY.talon, m.horn, foot, [0.11, -0.05, -0.34], [-1.5, 0, 0]);
    add(GEOMETRY.talon, m.horn, foot, [-0.11, -0.05, -0.34], [-1.5, 0, 0]);
    return { hip, shin, foot, side };
  });

  const arms = [1, -1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.36, -0.1, -0.44);
    body.add(shoulder);
    shoulder.rotation.z = side * 0.5;
    add(GEOMETRY.armUpper, m.hide, shoulder, [0, -0.2, 0]);
    const lower = new THREE.Group();
    lower.position.y = -0.38;
    shoulder.add(lower);
    lower.rotation.x = -0.9;
    add(GEOMETRY.armLower, m.hide, lower, [0, -0.18, 0]);
    return { shoulder, lower, side };
  });

  const tail = new THREE.Group();
  tail.position.set(0, -0.02, 0.62);
  body.add(tail);
  add(GEOMETRY.tailSeg, m.hide, tail, [0, 0, 0.36], [Math.PI / 2.1, 0, 0]);
  const tailTip = new THREE.Group();
  tailTip.position.z = 0.74;
  tail.add(tailTip);
  add(GEOMETRY.tailTip, m.hide, tailTip, [0, -0.06, 0.4], [Math.PI / 2.2, 0, 0]);

  return { group, body, necks, wings, legs, arms, tail, tailTip };
};

/**
 * One dragon on the stand. Colossal units come alone — the count trick that
 * carries infantry and brutes works against a monster, and a Colossal that
 * shares its stand stops being colossal.
 */
export const buildDragon = ({ kind = "red" } = {}) => {
  const spec = KINDS[kind] ?? KINDS.red;
  const m = {
    hide: matte(spec.hide),
    hideDark: matte(spec.hideDark),
    membrane: matte(spec.membrane, 0.95),
    belly: matte(spec.belly, 0.75),
    horn: matte(spec.horn, 0.55),
  };

  const root = new THREE.Group();
  const dragon = makeDragon(spec, m);
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

  d.tail.rotation.y = Math.sin(t * 0.9) * 0.3 * gait.tail;
  d.tailTip.rotation.y = Math.sin(t * 0.9 - 0.8) * 0.35 * gait.tail;
};
