import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { matte, metal } from "./materials.js";

// An onager, built properly.
//
// Every other rig on this board is capsules and boxes, because the first
// question was whether any of this was affordable and the answer had to come
// quickly. It is affordable, and the benchmark was specific about *why*: mesh
// count is the constraint and triangles are not. That points at a technique
// this project has not used until now.
//
//   Detail added as separate meshes costs the thing that is scarce.
//   Detail merged into one mesh costs the thing that is free.
//
// So this machine is modelled with far more care than anything before it —
// bevelled timber, turned fittings, iron tyres, rope — and then collapsed
// with `mergeGeometries` into a handful of meshes grouped by material and by
// what moves. The result has roughly four times the geometry of the box-and-
// cylinder catapult it replaces and about half the meshes.
//
// The techniques, and what each is for:
//
//   ExtrudeGeometry   the side frames, cut as a 2D profile and extruded with
//                     a bevel. A bevelled edge catches the key light along
//                     its length, which is what makes timber look like timber
//                     rather than like a box.
//   LatheGeometry     the winch drum and the wheel hubs — anything that was
//                     turned on a lathe in life is turned on one here.
//   TorusGeometry     iron tyres round the wheels, and the torsion skein.
//   TubeGeometry      rope, run along a CatmullRomCurve3.
//
// The layout discipline from the rest of the board still applies and is if
// anything sharper here: the stand's band is two and a half times wider than
// it is deep, so this is built wide and short — broad axle, short throwing
// arm, crew out to the sides.

const PALETTES = {
  undead: {
    timber: 0x5c5647,
    timberDark: 0x413c31,
    iron: 0x54574f,
    rope: 0x9a9078,
    crew: 0xcfc6ad,
    cloth: 0x6d6a5c,
  },
  orc: {
    timber: 0x4a3a26,
    timberDark: 0x33281a,
    iron: 0x646b73,
    rope: 0x8a7c5c,
    crew: 0x6a8a3c,
    cloth: 0x7a5c33,
  },
  dwarf: {
    timber: 0x6b4a2c,
    timberDark: 0x4a3320,
    iron: 0x4d5058,
    rope: 0xbaa27e,
    crew: 0xc09274,
    cloth: 0xd9cdb4,
  },
};

// --- geometry helpers ------------------------------------------------------

// Put a geometry where it belongs *before* merging. Merging bakes transforms,
// so position and rotation have to be applied to the vertices rather than to
// a mesh that will not survive the merge.
const at = (geometry, { pos = [0, 0, 0], rot = [0, 0, 0], scale } = {}) => {
  const g = geometry.clone();
  if (scale) g.scale(...scale);
  if (rot[0]) g.rotateX(rot[0]);
  if (rot[1]) g.rotateY(rot[1]);
  if (rot[2]) g.rotateZ(rot[2]);
  g.translate(...pos);
  // mergeGeometries refuses a mix of indexed and non-indexed inputs, and the
  // built-ins are not consistent about it. Flattening everything is the
  // cheapest way to guarantee they combine.
  return g.toNonIndexed();
};

const merge = (parts) => BufferGeometryUtils.mergeGeometries(parts);

// A heavy timber, cut as a profile and extruded. The bevel is the point: it
// is what separates a beam from a box under a raking light.
const beamProfile = (length, depth) => {
  const shape = new THREE.Shape();
  const l = length / 2;
  const d = depth / 2;
  shape.moveTo(-l, -d);
  shape.lineTo(l, -d);
  // The forward end tapers, the way a frame member is cut away to clear the
  // arm's swing
  shape.lineTo(l, d * 0.55);
  shape.lineTo(l * 0.72, d);
  shape.lineTo(-l, d);
  shape.closePath();
  return shape;
};

const BEAM = new THREE.ExtrudeGeometry(beamProfile(1.24, 0.34), {
  depth: 0.13,
  bevelEnabled: true,
  bevelThickness: 0.022,
  bevelSize: 0.022,
  bevelSegments: 2,
  steps: 1,
});
BEAM.center();

const CROSS = new THREE.ExtrudeGeometry(beamProfile(1.15, 0.17), {
  depth: 0.12,
  bevelEnabled: true,
  bevelThickness: 0.018,
  bevelSize: 0.018,
  bevelSegments: 2,
  steps: 1,
});
CROSS.center();

// Turned on a lathe, as it would have been. The profile is the drum's
// silhouette in half-section: flange, barrel, flange.
const DRUM = new THREE.LatheGeometry(
  [
    new THREE.Vector2(0, -0.26),
    new THREE.Vector2(0.13, -0.26),
    new THREE.Vector2(0.13, -0.21),
    new THREE.Vector2(0.09, -0.18),
    new THREE.Vector2(0.09, 0.18),
    new THREE.Vector2(0.13, 0.21),
    new THREE.Vector2(0.13, 0.26),
    new THREE.Vector2(0, 0.26),
  ],
  16
);

const HUB = new THREE.LatheGeometry(
  [
    new THREE.Vector2(0, -0.1),
    new THREE.Vector2(0.075, -0.1),
    new THREE.Vector2(0.1, -0.05),
    new THREE.Vector2(0.1, 0.05),
    new THREE.Vector2(0.075, 0.1),
    new THREE.Vector2(0, 0.1),
  ],
  14
);

const TYRE = new THREE.TorusGeometry(0.42, 0.045, 8, 22);
const FELLOE = new THREE.CylinderGeometry(0.4, 0.4, 0.09, 22, 1, true);
const SPOKE = new THREE.CylinderGeometry(0.028, 0.034, 0.66, 8);
const SKEIN = new THREE.TorusGeometry(0.135, 0.052, 7, 18);
const ARM_SHAFT = new THREE.CylinderGeometry(0.045, 0.075, 0.74, 10);
const SLING = new THREE.SphereGeometry(0.15, 12, 9, 0, Math.PI * 2, 0, Math.PI / 1.7);
const PAD = new THREE.CylinderGeometry(0.11, 0.11, 0.95, 12);
const AXLE = new THREE.CylinderGeometry(0.05, 0.05, 2.1, 10);
const CRANK = new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8);
const BOLT = new THREE.SphereGeometry(0.035, 8, 6);

// Rope, run along a curve. Two coils on the frame and the torsion binding —
// the parts of a rope that stay put whatever the arm is doing.
const ropeCoil = (radius, turns, thickness) => {
  const points = [];
  const steps = turns * 14;
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * Math.PI * 2 * turns;
    points.push(
      new THREE.Vector3(
        Math.cos(a) * radius,
        (i / steps) * thickness * 1.6,
        Math.sin(a) * radius
      )
    );
  }
  return new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points),
    steps,
    thickness,
    6,
    false
  );
};

const COIL = ropeCoil(0.17, 2.5, 0.028);

// --- the machine -----------------------------------------------------------

/**
 * One onager.
 *
 * Returns the moving parts by name and everything else already merged. The
 * split is by *motion first, material second*: anything that turns or swings
 * has to stay its own mesh, and everything else is fair game to combine.
 */
const makeOnager = (m) => {
  const group = new THREE.Group();

  // --- the static frame, merged ------------------------------------------
  const timber = [
    // Two heavy side beams, laid on their sides so the extruded depth is the
    // beam's thickness
    at(BEAM, { pos: [0.52, 0.38, 0], rot: [0, Math.PI / 2, 0] }),
    at(BEAM, { pos: [-0.52, 0.38, 0], rot: [0, Math.PI / 2, 0] }),
    // Cross members fore and aft
    at(CROSS, { pos: [0, 0.34, -0.46], rot: [Math.PI / 2, 0, 0] }),
    at(CROSS, { pos: [0, 0.34, 0.46], rot: [Math.PI / 2, 0, 0] }),
    // The stop beam: the padded bar the arm slams into, and the reason an
    // onager throws at the angle it does
    at(CROSS, { pos: [0, 0.72, -0.34], rot: [Math.PI / 2, 0, 0], scale: [1.05, 1, 1.3] }),
    // Uprights carrying it
    at(CROSS, { pos: [0.5, 0.56, -0.34], rot: [0, 0, Math.PI / 2], scale: [0.42, 1, 0.7] }),
    at(CROSS, { pos: [-0.5, 0.56, -0.34], rot: [0, 0, Math.PI / 2], scale: [0.42, 1, 0.7] }),
    // Winch posts at the rear
    at(CROSS, { pos: [0.42, 0.52, 0.42], rot: [0, 0, Math.PI / 2], scale: [0.34, 1, 0.6] }),
    at(CROSS, { pos: [-0.42, 0.52, 0.42], rot: [0, 0, Math.PI / 2], scale: [0.34, 1, 0.6] }),
  ];
  const frame = new THREE.Mesh(merge(timber), m.timber);
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);

  // --- ironwork, merged ---------------------------------------------------
  const ironwork = [
    at(AXLE, { pos: [0, 0.42, 0.22], rot: [0, 0, Math.PI / 2] }),
    // Bolt heads down the beams — pure detail, and free once merged
    ...[-0.4, -0.1, 0.18, 0.44].flatMap((z) => [
      at(BOLT, { pos: [0.6, 0.38, z] }),
      at(BOLT, { pos: [-0.6, 0.38, z] }),
    ]),
    // The pad on the stop beam
    at(PAD, { pos: [0, 0.72, -0.42], rot: [0, 0, Math.PI / 2], scale: [1.1, 1, 0.7] }),
  ];
  const iron = new THREE.Mesh(merge(ironwork), m.iron);
  iron.castShadow = true;
  iron.receiveShadow = true;
  group.add(iron);

  // --- rope: the torsion skein and two coils, merged ----------------------
  const ropes = [
    // The skein: several bindings side by side across the frame, which is
    // where an onager's power actually comes from
    ...[-0.09, -0.03, 0.03, 0.09].map((x) =>
      at(SKEIN, { pos: [x, 0.5, 0.06], rot: [0, Math.PI / 2, 0] })
    ),
    at(COIL, { pos: [0.4, 0.44, 0.36] }),
    at(COIL, { pos: [-0.42, 0.44, -0.16], scale: [0.85, 1, 0.85] }),
  ];
  const rope = new THREE.Mesh(merge(ropes), m.rope);
  rope.castShadow = true;
  rope.receiveShadow = true;
  group.add(rope);

  // --- the throwing arm, merged, and it moves -----------------------------
  const arm = new THREE.Group();
  arm.position.set(0, 0.5, 0.06);
  group.add(arm);
  // The arm stands *up* from the pivot rather than lying along the frame.
  // Built pointing forward it was horizontal at rest, buried inside its own
  // machine and invisible — and a catapult whose arm cannot be seen is a
  // handcart. Upright, a positive rotation winds it back and a negative one
  // throws it onto the stop beam, which is also the largest single movement
  // anything on this board makes.
  const armParts = [
    at(ARM_SHAFT, { pos: [0, 0.37, 0] }),
    at(SLING, { pos: [0, 0.76, 0], rot: [Math.PI, 0, 0] }),
    at(BOLT, { pos: [0, 0.04, 0], scale: [1.6, 1.6, 1.6] }),
  ];
  const armMesh = new THREE.Mesh(merge(armParts), m.timber);
  armMesh.castShadow = true;
  armMesh.receiveShadow = true;
  arm.add(armMesh);

  // --- the winch drum, merged, and it turns -------------------------------
  const winch = new THREE.Group();
  winch.position.set(0, 0.62, 0.42);
  group.add(winch);
  const winchMesh = new THREE.Mesh(
    merge([
      at(DRUM, { rot: [0, 0, Math.PI / 2] }),
      at(CRANK, { pos: [0.34, 0.11, 0], rot: [Math.PI / 2, 0, 0] }),
      at(CRANK, { pos: [0.34, 0.2, 0.1], rot: [0, 0, Math.PI / 2], scale: [1, 0.7, 1] }),
    ]),
    m.timberDark
  );
  winchMesh.castShadow = true;
  group.add(winch);
  winch.add(winchMesh);

  // --- wheels, each merged, and they turn ---------------------------------
  const wheels = [1, -1].map((side) => {
    const wheel = new THREE.Group();
    wheel.position.set(side * 0.94, 0.42, 0.22);
    wheel.rotation.z = Math.PI / 2;
    group.add(wheel);

    const spokes = [];
    for (let i = 0; i < 6; i += 1) {
      spokes.push(at(SPOKE, { rot: [0, 0, (i / 6) * Math.PI * 2] }));
    }
    const body = new THREE.Mesh(
      merge([at(FELLOE, {}), at(HUB, {}), ...spokes]),
      m.timber
    );
    body.castShadow = true;
    body.receiveShadow = true;
    wheel.add(body);

    // The iron tyre is a different material, so it stays a second mesh —
    // merging is per material, not per object
    const tyre = new THREE.Mesh(at(TYRE, { rot: [Math.PI / 2, 0, 0] }), m.iron);
    tyre.castShadow = true;
    wheel.add(tyre);

    return wheel;
  });

  return { group, arm, winch, wheels };
};

const CREW = {
  body: new THREE.CapsuleGeometry(0.13, 0.28, 5, 10),
  head: new THREE.SphereGeometry(0.11, 12, 9),
  arm: new THREE.CapsuleGeometry(0.045, 0.2, 4, 7),
};

// One crew figure, merged into a single mesh. Three of them cost three meshes
// rather than nine.
const makeCrew = (m) => {
  const crew = new THREE.Group();
  const mesh = new THREE.Mesh(
    merge([
      at(CREW.body, { pos: [0, 0, 0] }),
      at(CREW.head, { pos: [0, 0.3, -0.02] }),
      at(CREW.arm, { pos: [0.15, 0.06, -0.06], rot: [0, 0, -0.8] }),
      at(CREW.arm, { pos: [-0.15, 0.06, -0.06], rot: [0, 0, 0.8] }),
    ]),
    m.crew
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  crew.add(mesh);
  return crew;
};

/**
 * A battery of catapults.
 *
 * One engine to a stand unless asked otherwise — a catapult is a piece of
 * equipment with people round it, and a row of them reads as scenery.
 */
export const buildCatapults = ({ palette = "undead", count = 1 } = {}) => {
  const p = PALETTES[palette] ?? PALETTES.undead;
  const m = {
    timber: matte(p.timber, 0.9),
    timberDark: matte(p.timberDark, 0.88),
    iron: metal(p.iron, 0.55),
    rope: matte(p.rope, 0.95),
    crew: matte(p.crew),
    cloth: matte(p.cloth, 0.85),
  };

  const root = new THREE.Group();
  const engines = [];
  const spanX = count > 1 ? 2.6 : 0;

  for (let i = 0; i < count; i += 1) {
    const onager = makeOnager(m);
    onager.group.position.set(
      count === 1 ? 0 : -spanX / 2 + (i * spanX) / (count - 1),
      0,
      ((i % 2) - 0.5) * 0.3
    );
    onager.group.rotation.y = (((i * 5) % 3) - 1) * 0.05;

    // Crew out to the sides rather than fore and aft: the stand has width to
    // spare and no depth at all
    onager.crew = [
      [1.42, 0.06],
      [-1.44, 0.2],
      [0.24, 0.5],
    ].map(([x, z], j) => {
      const hand = makeCrew(m);
      hand.position.set(x, 0.44, z);
      hand.rotation.y = j * 1.1;
      onager.group.add(hand);
      return hand;
    });

    onager.phase = i * 1.7;
    root.add(onager.group);
    engines.push(onager);
  }

  return { root, engines, count: engines.length };
};

const GAITS = {
  // Standing to the engine. A machine has no idle motion of its own, which is
  // a hazard rather than a saving: something that stops dead reads as a bug.
  // The crew carry it.
  idle: { rate: 1.2, roll: 0, crew: 0.5, loose: 0, wind: 0.4 },
  // Being manhandled forward. A catapult does not march; it is dragged.
  march: { rate: 2.4, roll: 1, crew: 1, loose: 0, wind: 0.2 },
  // Shooting. The arm is the largest single movement anything on this board
  // makes.
  attack: { rate: 2.2, roll: 0, crew: 1.4, loose: 1, wind: 1 },
};

/**
 * Pose a battery.
 *
 * The arm winds slowly back and looses fast — `pow` on the rising half is
 * what makes a release read as a release rather than as a pendulum. The winch
 * turns while it winds and spins free when it lets go.
 */
export const poseCatapults = (rig, time, state = "idle") => {
  const gait = GAITS[state] ?? GAITS.idle;

  rig.engines.forEach((engine) => {
    const t = time * gait.rate + engine.phase;

    // Winds slowly back, looses fast. The `pow` on the rising half is what
    // makes a release read as a release rather than as a pendulum.
    const cycle = (Math.sin(t) + 1) / 2;
    const wind = cycle ** 0.4;
    // Between two hard limits: winched back at WOUND, and stopped dead at
    // THROWN by the padded beam. Left unbounded it swung straight through
    // its own bed, which is both wrong and — since the frame hides it — the
    // kind of wrong that is easy to miss.
    const WOUND = 0.95;
    const THROWN = -0.4;
    engine.arm.rotation.x = gait.loose
      ? THROWN + (WOUND - THROWN) * wind
      : WOUND + Math.sin(t * 0.5) * 0.02;
    engine.winch.rotation.x = -wind * 6 * gait.wind;

    engine.wheels.forEach((wheel) => {
      wheel.rotation.y += 0.05 * gait.roll;
    });

    engine.crew.forEach((hand, i) => {
      const own = t + i * 1.3;
      hand.position.y = 0.44 + Math.abs(Math.sin(own)) * 0.05 * gait.crew;
      hand.rotation.x = Math.sin(own * 0.8) * 0.16 * gait.crew;
      hand.rotation.z = Math.sin(own * 0.5) * 0.08;
    });

    engine.group.rotation.z = Math.sin(t * 1.3) * 0.01 * (gait.roll + 0.3);
  });
};
