import * as THREE from "three";
import { at, bevelled, merge, part, surfaceMaterial, swept, turned } from "./kit.js";

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

const TIMBER = { roughness: 0.8 };
const IRON = { metalness: 0.55, roughness: 0.55 };
const BRASS = { metalness: 0.68, roughness: 0.32 };
const CLOTH = { roughness: 0.92 };
const HIDE = { roughness: 0.85 };

const prone = (points, thickness, bevel = 0.014) =>
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

// A bevelled beam. The bevel is the whole point: it catches the key light
// along the beam's length, which is what stops timber reading as a box.
const beam = (length, width, depth) =>
  bevelled(
    [
      [-width / 2, -length / 2],
      [width / 2, -length / 2],
      [width / 2, length / 2],
      [-width / 2, length / 2],
    ],
    depth,
    Math.min(width, depth) * 0.16
  );

// A wheel: a felloe, an iron tyre, a turned hub and six spokes, all merged.
// From above the spokes are what tells a wheel from a disc.
//
// **The axle runs along X**, side to side across the hull, which is the only
// orientation a wheel on a vehicle can have. Getting this wrong is easy and
// was: a `LatheGeometry` spins about Y and a `TorusGeometry` lies in XY about
// Z, so the three components of a wheel start on two different axes and both
// are wrong. Turning them consistently onto the *same* wrong axis looks fine
// in isolation and puts the whole wheel a quarter turn out on the vehicle.
// The rule to check against is the poser: it rolls a wheel with
// `rotation.x`, and that only spins the thing if X is the axle.
const wheelParts = (p) => {
  const parts = [
    // A felloe rather than a solid disc. This matters more than it sounds:
    // the spokes were always modelled and were always buried inside a solid
    // cylinder, so every wheel on the board has been rendering as a plain
    // dark circle since the day it was built.
    part(
      turned(
        [
          [0.33, -0.045],
          [0.4, -0.045],
          [0.4, 0.045],
          [0.33, 0.045],
          [0.33, -0.045],
        ],
        20
      ),
      p.frame,
      { rot: [0, 0, Math.PI / 2], ...TIMBER }
    ),
    // A torus is built about Z, so it takes a different quarter turn from the
    // lathes to arrive on the same axle
    part(new THREE.TorusGeometry(0.4, 0.032, 7, 24), p.iron, {
      rot: [0, Math.PI / 2, 0],
      ...IRON,
    }),
    part(
      turned(
        [
          [0, -0.1],
          [0.09, -0.095],
          [0.12, -0.05],
          [0.125, 0.05],
          [0.09, 0.095],
          [0, 0.1],
        ],
        14
      ),
      p.iron,
      { rot: [0, 0, Math.PI / 2], ...IRON }
    ),
  ];
  // Spokes radiate in the wheel's own plane, which with the axle on X is YZ
  for (let i = 0; i < 6; i += 1) {
    parts.push(
      part(new THREE.CylinderGeometry(0.028, 0.034, 0.72, 8), p.frame, {
        rot: [(i * Math.PI) / 6, 0, 0],
        ...TIMBER,
      })
    );
  }
  return parts;
};

// A crewman: a body, a head, a cap and two arms. Small, and meant to be —
// a machine is the subject and the people are the scale reference.
const crewParts = (p) => [
  part(new THREE.CapsuleGeometry(0.13, 0.26, 8, 14), p.cloth, { ...CLOTH }),
  part(new THREE.SphereGeometry(0.105, 12, 10), p.crew, {
    pos: [0, 0.3, -0.02],
    ...HIDE,
  }),
  part(
    turned(
      [
        [0, -0.06],
        [0.11, -0.05],
        [0.115, 0.0],
        [0.09, 0.06],
        [0, 0.09],
      ],
      12
    ),
    p.iron,
    { pos: [0, 0.36, -0.02], ...IRON }
  ),
  ...[0.15, -0.15].map((x) =>
    part(new THREE.CapsuleGeometry(0.042, 0.18, 6, 10), p.crew, {
      pos: [x, 0.06, -0.04],
      rot: [0, 0, x > 0 ? -0.5 : 0.5],
      ...HIDE,
    })
  ),
];

// A shooting engine: bed, wheels, a prod across the front, a bolt on it.
const bolterBedParts = (p, heavy) => {
  const w = heavy ? 1.15 : 1;
  return [
    part(beam(1.05, 1.15 * w, 0.14), p.frame, {
      rot: [-Math.PI / 2, 0, 0],
      ...TIMBER,
    }),
    ...[0.44, -0.44].map((x) =>
      part(beam(0.98, 0.1, 0.12), p.frame, {
        pos: [x * w, 0.12, 0],
        rot: [-Math.PI / 2, 0, 0],
        ...TIMBER,
      })
    ),
    // Cross-braces between the rails, which is what a frame actually has
    ...[-0.3, 0.3].map((z) =>
      part(beam(0.9 * w, 0.07, 0.08), p.frame, {
        pos: [0, 0.14, z],
        rot: [-Math.PI / 2, 0, Math.PI / 2],
        ...TIMBER,
      })
    ),
    // Through the hubs, not under them: the bed sits at y 0.26 and the wheel
    // centres at 0.34
    part(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 14), p.iron, {
      pos: [0, 0.08, 0.34],
      rot: [0, 0, Math.PI / 2],
      ...IRON,
    }),
    // A turned winch drum with a crank
    part(
      turned(
        [
          [0.1, -0.25],
          [0.14, -0.22],
          [0.13, -0.12],
          [0.125, 0.12],
          [0.14, 0.22],
          [0.1, 0.25],
        ],
        14
      ),
      p.iron,
      { pos: [0, 0.14, 0.44], rot: [0, 0, Math.PI / 2], ...IRON }
    ),
    part(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8), p.trim, {
      pos: [0.32, 0.14, 0.44],
      rot: [0, 0, Math.PI / 2],
      ...BRASS,
    }),
    // Rope wound on the drum and run forward to the prod
    part(
      swept(
        [
          [0, 0.14, 0.44],
          [0, 0.2, 0.1],
          [0, 0.18, -0.3],
        ],
        0.016
      ),
      p.trim,
      { ...CLOTH }
    ),
  ];
};

const bolterArmParts = (p, heavy) => [
  // The prod lies across the frame: a lath, thick at the middle and tapering
  // to the tips, which is how a real one is cut
  part(
    prone(
      [
        [-1.15, -0.035],
        [-0.5, -0.05],
        [0.5, -0.05],
        [1.15, -0.035],
        [1.15, 0.035],
        [0.5, 0.05],
        [-0.5, 0.05],
        [-1.15, 0.035],
      ],
      0.09,
      0.01
    ),
    p.iron,
    { scale: [heavy ? 1.15 : 1, 1, 1], ...IRON }
  ),
  // The string, drawn back
  part(
    swept(
      [
        [-1.13, 0, 0],
        [0, 0, 0.22],
        [1.13, 0, 0],
      ],
      0.012,
      { segments: 12, sides: 5 }
    ),
    p.trim,
    { scale: [heavy ? 1.15 : 1, 1, 1], ...CLOTH }
  ),
  // A bolt in the groove, with a head and flights
  part(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 12), p.trim, {
    pos: [0, 0.07, -0.3],
    rot: [Math.PI / 2, 0, 0],
    ...TIMBER,
  }),
  part(
    turned(
      [
        [0.05, 0],
        [0.04, 0.06],
        [0, 0.16],
      ],
      10
    ),
    p.iron,
    { pos: [0, 0.07, -0.62], rot: [-Math.PI / 2, 0, 0], ...IRON }
  ),
  ...[0, 1, 2].map((i) =>
    part(
      bevelled(
        [
          [-0.008, 0],
          [0.008, 0],
          [0.04, 0.04],
          [0.04, 0.13],
          [-0.008, 0.15],
        ],
        0.008,
        0
      ),
      p.trim,
      {
        pos: [0, 0.07, -0.02],
        rot: [-Math.PI / 2, 0, (i * Math.PI * 2) / 3],
        ...CLOTH,
      }
    )
  ),
];

const makeBolter = (p, material, heavy) => {
  const group = new THREE.Group();
  const bed = new THREE.Group();
  bed.position.y = 0.26;
  group.add(bed);
  hang(bed, merge(bolterBedParts(p, heavy)), material);

  const wheelBuffer = merge(wheelParts(p));
  const wheels = [0.78, -0.78].map((x) => {
    const wheel = new THREE.Group();
    wheel.position.set(x, 0.34, 0.34);
    group.add(wheel);
    hang(wheel, wheelBuffer, material);
    return wheel;
  });

  // The prod lies across the frame and the bolt lies along it: a cross, flat
  // to the ground, which is exactly what an overhead camera wants
  const arm = new THREE.Group();
  arm.position.set(0, 0.16, -0.32);
  bed.add(arm);
  hang(arm, merge(bolterArmParts(p, heavy)), material);

  const crewBuffer = merge(crewParts(p));
  const crew = [
    [0.42, 0.62],
    [-0.4, 0.7],
  ].map(([x, z]) => {
    const hand = new THREE.Group();
    hand.position.set(x, 0.44, z);
    group.add(hand);
    hang(hand, crewBuffer, material);
    return hand;
  });

  return { group, bed, arm, wheels, crew, kind: "bolter" };
};

// A chariot: a car, a pole, and a pair of horses in front of it.
const chariotCarParts = (p) => [
  // An open car, cut as a profile so it has a floor and a curved front
  part(
    prone(
      [
        [-0.52, -0.33],
        [0.52, -0.33],
        [0.54, 0.14],
        [0.4, 0.3],
        [-0.4, 0.3],
        [-0.54, 0.14],
      ],
      0.34,
      0.018
    ),
    p.frame,
    { pos: [0, 0, 0.2], ...TIMBER }
  ),
  // A rail round the top, which is what a chariot is mostly made of
  ...[0.5, -0.5].map((x) =>
    part(beam(0.6, 0.06, 0.07), p.trim, {
      pos: [x, 0.18, 0.22],
      rot: [-Math.PI / 2, 0, 0],
      ...BRASS,
    })
  ),
  part(beam(1.0, 0.06, 0.07), p.trim, {
    pos: [0, 0.18, -0.08],
    rot: [-Math.PI / 2, 0, Math.PI / 2],
    ...BRASS,
  }),
  // Through the hubs: the car sits at y 0.36 and the wheel centres at 0.34
  part(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 14), p.iron, {
    pos: [0, -0.02, 0.34],
    rot: [0, 0, Math.PI / 2],
    ...IRON,
  }),
  part(new THREE.CylinderGeometry(0.045, 0.055, 1.0, 12), p.frame, {
    pos: [0, -0.06, -0.5],
    rot: [Math.PI / 2.1, 0, 0],
    ...TIMBER,
  }),
  // A yoke across the pole
  part(beam(0.86, 0.06, 0.07), p.frame, {
    pos: [0, 0.04, -0.94],
    rot: [-Math.PI / 2, 0, Math.PI / 2],
    ...TIMBER,
  }),
];

const chariotHorseParts = (p) => [
  part(new THREE.CapsuleGeometry(0.26, 0.5, 8, 14), p.cloth, {
    rot: [Math.PI / 2, 0, 0],
    ...HIDE,
  }),
  // The neck and head, carried forward and a little up. `prone` lays an
  // outline down pointing -Z, so a *positive* rotation about X lifts the far
  // end — the negative one this had buried the horse's head in the turf.
  part(
    prone(
      [
        [-0.11, -0.3],
        [0.11, -0.3],
        [0.09, 0.12],
        [0.05, 0.3],
        [0, 0.36],
        [-0.05, 0.3],
        [-0.09, 0.12],
      ],
      0.22,
      0.012
    ),
    p.cloth,
    { pos: [0, 0.14, -0.46], rot: [0.42, 0, 0], ...HIDE }
  ),
  // Ears
  ...[0.06, -0.06].map((x) =>
    part(new THREE.ConeGeometry(0.035, 0.1, 8), p.cloth, {
      pos: [x, 0.34, -0.66],
      rot: [-0.2, 0, 0],
      ...HIDE,
    })
  ),
  // A mane down the neck — the pale strip that traces the animal's length
  part(
    at(
      bevelled(
        [
          [-0.04, 0.24],
          [0.04, 0.24],
          [0.045, 0],
          [0.03, -0.24],
          [-0.03, -0.24],
          [-0.045, 0],
        ],
        0.07,
        0.006
      ),
      { rot: [Math.PI / 2, 0, 0] }
    ),
    p.trim,
    { pos: [0, 0.3, -0.5], rot: [0.42, 0, 0], ...HIDE }
  ),
];

const chariotLegParts = (p) => [
  ...[0.13, -0.13].map((x) =>
    part(new THREE.CapsuleGeometry(0.06, 0.34, 6, 12), p.cloth, {
      pos: [x, -0.2, 0],
      ...HIDE,
    })
  ),
  ...[0.13, -0.13].map((x) =>
    part(
      turned(
        [
          [0, 0],
          [0.065, 0.012],
          [0.07, 0.06],
          [0, 0.09],
        ],
        12
      ),
      p.iron,
      { pos: [x, -0.42, -0.01], ...HIDE }
    )
  ),
];

const makeChariot = (p, material) => {
  const group = new THREE.Group();
  const car = new THREE.Group();
  car.position.y = 0.36;
  group.add(car);
  hang(car, merge(chariotCarParts(p)), material);

  const wheelBuffer = merge(wheelParts(p));
  const wheels = [0.76, -0.76].map((x) => {
    const wheel = new THREE.Group();
    wheel.position.set(x, 0.34, 0.34);
    group.add(wheel);
    hang(wheel, wheelBuffer, material);
    return wheel;
  });

  const horseBuffer = merge(chariotHorseParts(p));
  const legBuffer = merge(chariotLegParts(p));
  const team = [0.44, -0.44].map((x) => {
    const horse = new THREE.Group();
    horse.position.set(x, 0.56, -0.98);
    group.add(horse);
    hang(horse, horseBuffer, material);
    const legs = [-0.4, 0.4].map((z) => {
      const leg = new THREE.Group();
      leg.position.set(0, -0.1, z);
      horse.add(leg);
      hang(leg, legBuffer, material);
      return leg;
    });
    return { horse, legs };
  });

  const crewBuffer = merge(crewParts(p));
  const crew = [
    [0.18, 0.3],
    [-0.2, 0.38],
  ].map(([x, z]) => {
    const hand = new THREE.Group();
    hand.position.set(x, 0.44, z);
    group.add(hand);
    hang(hand, crewBuffer, material);
    return hand;
  });

  return { group, bed: car, arm: null, wheels, crew, team, kind: "chariot" };
};

const ENGINES = {
  bolter: (p, material) => makeBolter(p, material, false),
  heavyBolter: (p, material) => makeBolter(p, material, true),
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
  const material = surfaceMaterial();

  const root = new THREE.Group();
  const engines = [];
  const spanX = count > 1 ? 2.9 : 0;

  for (let i = 0; i < count; i += 1) {
    const built = make(p, material);
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

    engine.wheels.forEach((wheel) => {
      // About X, which is the axle — see the note where they are built
      wheel.rotation.x += 0.055 * gait.roll;
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
