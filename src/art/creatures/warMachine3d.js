import * as THREE from "three";
import { matte, metal } from "./materials.js";

// War machines: ballistae, scorpions and chariots.
//
// The throwing engines used to live here too, blocked out from the same box
// vocabulary. They have moved to catapult3d.js, which builds them properly —
// see the note at the top of that file for why it was worth the trouble.
//
// These are the easiest units on the board to make read from above, and it is
// worth saying why, because it is the opposite of every other problem here.
// A machine is mostly horizontal by nature — a frame lying on the ground, a
// beam across it, wheels standing out at the sides. Where a swordsman has to
// be talked into presenting area upward, a catapult has nothing else to
// present. The wheels alone are a signature no formation of foot can produce.
//
// So the rule is inverted: keep them low, keep them wide, and let the crew be
// the small thing rather than the subject.
//
// "Wide" is not a figure of speech. The band a stand gives its figures is
// about two and a half times wider than it is deep, and the fit is measured
// against both — so a machine that is as deep as it is broad gets scaled down
// until it fits the depth, and then occupies a third of the width it was
// given. Every engine here is therefore built much wider than it is long:
// broad axles, short throwing arms, teams harnessed close. The first pass had
// them roughly square and they came out too small to identify.

const PALETTES = {
  dwarf: { frame: 0x6b4a2c, iron: 0x4d5058, trim: 0xb8a05e, crew: 0xc09274, cloth: 0xd9cdb4 },
  highElf: { frame: 0xd8d2c2, iron: 0xc9cdd4, trim: 0xe0c877, crew: 0xd6b394, cloth: 0xeef1f5 },
};

const GEOMETRY = {
  bed: new THREE.BoxGeometry(1.15, 0.14, 1.05),
  rail: new THREE.BoxGeometry(0.1, 0.12, 0.98),
  axle: new THREE.CylinderGeometry(0.05, 0.05, 1.9, 18),
  // Standing proud of the frame, and the one part of a machine nothing else
  // on the board has
  wheel: new THREE.CylinderGeometry(0.4, 0.4, 0.11, 18),
  hub: new THREE.CylinderGeometry(0.11, 0.11, 0.16, 18),
  spoke: new THREE.BoxGeometry(0.05, 0.06, 0.72),
  // A ballista's prod, across the frame
  prod: new THREE.BoxGeometry(2.3, 0.07, 0.1),
  bolt: new THREE.CylinderGeometry(0.035, 0.035, 0.66, 18),
  winch: new THREE.CylinderGeometry(0.13, 0.13, 0.5, 18),
  // Chariot: an open car rather than a bed
  car: new THREE.BoxGeometry(1.05, 0.34, 0.66),
  pole: new THREE.CylinderGeometry(0.05, 0.045, 1.0, 18),
  crew: new THREE.CapsuleGeometry(0.13, 0.26, 8, 16),
  crewHead: new THREE.SphereGeometry(0.11, 18, 14),
  horseBody: new THREE.CapsuleGeometry(0.26, 0.5, 8, 16),
  horseNeck: new THREE.BoxGeometry(0.2, 0.18, 0.46),
  horseLeg: new THREE.CapsuleGeometry(0.06, 0.34, 8, 16),
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

// A wheel on its axle. Spokes are four boxes rather than real geometry —
// from above they are what tells a wheel from a disc.
const makeWheel = (parent, x, m) => {
  const wheel = new THREE.Group();
  wheel.position.set(x, 0.34, 0.34);
  wheel.rotation.z = Math.PI / 2;
  parent.add(wheel);
  add(GEOMETRY.wheel, m.frame, wheel, [0, 0, 0]);
  add(GEOMETRY.hub, m.iron, wheel, [0, 0, 0]);
  [0, Math.PI / 2].forEach((a) => {
    add(GEOMETRY.spoke, m.frame, wheel, [0, 0, 0], [a, 0, 0]);
    add(GEOMETRY.spoke, m.frame, wheel, [0, 0, 0], [0, 0, a]);
  });
  return wheel;
};

const makeCrew = (parent, x, z, m) => {
  const crew = new THREE.Group();
  crew.position.set(x, 0.44, z);
  parent.add(crew);
  add(GEOMETRY.crew, m.crew, crew, [0, 0, 0]);
  add(GEOMETRY.crewHead, m.crew, crew, [0, 0.3, -0.02]);
  return crew;
};

// A shooting engine: bed, wheels, a prod across the front, a bolt on it.
const makeBolter = (m, heavy) => {
  const group = new THREE.Group();
  const bed = new THREE.Group();
  bed.position.y = 0.26;
  group.add(bed);

  add(GEOMETRY.bed, m.frame, bed, [0, 0, 0], null, heavy ? [1.15, 1, 1.15] : null);
  add(GEOMETRY.rail, m.frame, bed, [0.44, 0.12, 0]);
  add(GEOMETRY.rail, m.frame, bed, [-0.44, 0.12, 0]);
  add(GEOMETRY.axle, m.iron, bed, [0, -0.1, 0.34], [0, 0, Math.PI / 2]);

  const wheels = [makeWheel(group, 0.78, m), makeWheel(group, -0.78, m)];

  // The prod lies across the frame and the bolt lies along it: a cross, flat
  // to the ground, which is exactly what an overhead camera wants
  const arm = new THREE.Group();
  arm.position.set(0, 0.16, -0.32);
  bed.add(arm);
  add(GEOMETRY.prod, m.iron, arm, [0, 0, 0], null, heavy ? [1.15, 1, 1] : null);
  add(GEOMETRY.bolt, m.trim, arm, [0, 0.07, -0.3], [Math.PI / 2, 0, 0]);
  add(GEOMETRY.winch, m.iron, bed, [0, 0.14, 0.44], [0, 0, Math.PI / 2]);

  const crew = [makeCrew(group, 0.42, 0.62, m), makeCrew(group, -0.4, 0.7, m)];
  return { group, bed, arm, wheels, crew, kind: "bolter" };
};

// A chariot: a car, a pole, and a pair of horses in front of it.
const makeChariot = (m) => {
  const group = new THREE.Group();
  const car = new THREE.Group();
  car.position.y = 0.36;
  group.add(car);

  add(GEOMETRY.car, m.frame, car, [0, 0, 0.2]);
  add(GEOMETRY.rail, m.trim, car, [0.44, 0.18, 0.2], [0, Math.PI / 2, 0], [1, 1, 0.6]);
  add(GEOMETRY.axle, m.iron, car, [0, -0.14, 0.36], [0, 0, Math.PI / 2]);
  add(GEOMETRY.pole, m.frame, car, [0, -0.06, -0.5], [Math.PI / 2.1, 0, 0]);

  const wheels = [makeWheel(group, 0.76, m), makeWheel(group, -0.76, m)];

  const team = [0.44, -0.44].map((x) => {
    const horse = new THREE.Group();
    horse.position.set(x, 0.56, -0.98);
    group.add(horse);
    add(GEOMETRY.horseBody, m.cloth, horse, [0, 0, 0], [Math.PI / 2, 0, 0]);
    add(GEOMETRY.horseNeck, m.cloth, horse, [0, 0.1, -0.5], [0.4, 0, 0]);
    const legs = [-0.4, 0.4].map((z) => {
      const leg = new THREE.Group();
      leg.position.set(0, -0.1, z);
      horse.add(leg);
      add(GEOMETRY.horseLeg, m.cloth, leg, [0.13, -0.2, 0]);
      add(GEOMETRY.horseLeg, m.cloth, leg, [-0.13, -0.2, 0]);
      return leg;
    });
    return { horse, legs };
  });

  const crew = [makeCrew(group, 0.18, 0.3, m), makeCrew(group, -0.2, 0.38, m)];
  return { group, bed: car, arm: null, wheels, crew, team, kind: "chariot" };
};

const ENGINES = {
  bolter: makeBolter,
  heavyBolter: (m) => makeBolter(m, true),
  chariot: makeChariot,
};

/**
 * A battery of engines, or a squadron of chariots.
 *
 * Two or three to a stand rather than a rank — a war machine is a piece of
 * equipment with people around it, and a dozen of them would read as
 * scenery rather than as a unit.
 */
export const buildWarMachines = ({
  engine = "bolter",
  palette = "dwarf",
  count = 2,
} = {}) => {
  const make = ENGINES[engine] ?? ENGINES.bolter;
  const p = PALETTES[palette] ?? PALETTES.dwarf;
  const m = {
    frame: matte(p.frame),
    iron: metal(p.iron, 0.5),
    trim: metal(p.trim, 0.38),
    crew: matte(p.crew),
    cloth: matte(p.cloth, 0.8),
  };

  const root = new THREE.Group();
  const engines = [];
  const spanX = count > 1 ? 2.9 : 0;

  for (let i = 0; i < count; i += 1) {
    const built = make(m);
    built.group.position.set(
      count === 1 ? 0 : -spanX / 2 + (i * spanX) / (count - 1),
      0,
      ((i % 2) - 0.5) * 0.22
    );
    built.group.rotation.y = (((i * 5) % 3) - 1) * 0.06;
    built.phase = i * 1.7;
    root.add(built.group);
    engines.push(built);
  }

  return { root, engines, engine, count: engines.length };
};

const GAITS = {
  // Standing to the engine: crew shifting, wheels still
  idle: { rate: 1.2, roll: 0, crew: 0.5, loose: 0 },
  // Being manhandled forward. A machine does not march; it is dragged.
  march: { rate: 2.4, roll: 1, crew: 1, loose: 0 },
  // Shooting. The arm is the whole animation.
  attack: { rate: 2.2, roll: 0, crew: 1.4, loose: 1 },
};

/**
 * Pose a battery.
 *
 * Machines have almost no idle motion of their own, which is a hazard rather
 * than a saving: a unit that does not move at all reads as a bug. The crew
 * carry it — they lean, haul and duck — and on the attack the arm swings,
 * which is the largest single movement anything on this board makes.
 */
export const poseWarMachines = (rig, time, state = "idle") => {
  const gait = GAITS[state] ?? GAITS.idle;

  rig.engines.forEach((engine) => {
    const t = time * gait.rate + engine.phase;

    engine.wheels.forEach((wheel, i) => {
      wheel.rotation.x += 0.055 * gait.roll * (i === 0 ? 1 : 1);
    });

    // Crew work: bobbing at the winch, ducking as it looses
    engine.crew.forEach((hand, i) => {
      const own = t + i * 1.3;
      hand.position.y = 0.44 + Math.abs(Math.sin(own)) * 0.05 * gait.crew;
      hand.rotation.x = Math.sin(own * 0.8) * 0.16 * gait.crew;
      hand.rotation.z = Math.sin(own * 0.5) * 0.08;
    });

    if (engine.arm) {
      // Winds slowly back, looses fast. `pow` on the rising half is what
      // makes a release read as a release rather than as a pendulum.
      const cycle = (Math.sin(t) + 1) / 2;
      const wind = cycle ** 0.4;
      engine.arm.rotation.x = -gait.loose * wind * 1.35;
    }

    if (engine.team) {
      engine.team.forEach(({ horse, legs }, i) => {
        const own = t * 2 + i * Math.PI;
        horse.position.y = 0.56 + Math.abs(Math.sin(own)) * 0.03 * gait.roll;
        legs.forEach((leg, j) => {
          leg.rotation.x = Math.sin(own + j * Math.PI) * 0.5 * gait.roll;
        });
      });
    }

    engine.bed.rotation.z = Math.sin(t * 1.3) * 0.012 * (gait.roll + 0.3);
  });
};
