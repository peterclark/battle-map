import * as THREE from "three";
import {
  at,
  bevelled,
  merge,
  part,
  spanning,
  surfaceMaterial,
  turned,
} from "./kit.js";

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
//
// `beam` builds its length along +Y, so it has to be turned before it is a
// timber lying on a carriage. **There are only two turns worth knowing, and
// the obvious-looking third one is a trap**, measured rather than reasoned:
//
//   ACROSS  rot [-PI/2,     0, 0]  ->  x = width,  y = depth,  z = length
//   ALONG   rot [-PI/2, PI/2, 0]  ->  x = length, y = depth,  z = width
//
// The trap is `[-PI/2, 0, PI/2]`, which *looks* like "lay it down, then turn it
// a quarter", and is not: rotating about world Z after the first turn spins the
// beam about its own length and leaves it pointing fore-and-aft with its
// section rolled over. Written that way it is a cross-brace that braces
// nothing — which is what this file's cross-braces, and the chariot's top rail
// and yoke, had been doing since they were built. Both are corrected below.
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

/**
 * A band round a point on the line `a`..`b`, at parameter `t` along it.
 *
 * A collar on a bow limb, a ferrule on a shaft, a cap on a tip — all the same
 * shape, and all of them want the axis of the thing they are wrapped round.
 * Straddling the point with a short `spanning` gets that axis for free, where
 * writing the rotation by hand gets it wrong on one side of the machine.
 */
const band = (a, b, t, length, radius) => {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const centre = A.clone().lerp(B, t);
  const step = B.clone().sub(A).normalize().multiplyScalar(length / 2);
  return spanning(
    centre.clone().sub(step).toArray(),
    centre.clone().add(step).toArray(),
    radius,
    radius,
    12
  );
};

/**
 * A ring of rivet heads round a point, in a named plane.
 *
 * Rivets are the cheapest detail on this whole board and the most effective.
 * They are tiny spheres, they merge into their parent's buffer so they cost no
 * draw call, and — this is the part that matters — a bright brass dot on dark
 * iron is one of about three things that survive being viewed from directly
 * above at stand scale. A plate with rivets round it reads as a bolted plate; a
 * plate without them reads as a smudge.
 */
const studs = (p, count, radius, centre, plane, size = 0.018) =>
  Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + 0.3;
    const u = Math.cos(a) * radius;
    const v = Math.sin(a) * radius;
    const offset =
      plane === "xz" ? [u, 0, v] : plane === "xy" ? [u, v, 0] : [0, v, u];
    return part(new THREE.SphereGeometry(size, 8, 6), p.trim, {
      pos: [centre[0] + offset[0], centre[1] + offset[1], centre[2] + offset[2]],
      ...BRASS,
    });
  });

// A wheel: a felloe, an iron tyre, a turned hub, eight spokes and a bolted hub
// plate, all merged.
//
// Be honest about what this camera sees of it: a wheel standing on a vehicle is
// edge-on from directly overhead, so what reads on the board is the tyre — a
// dark bar outboard of the carriage — and almost nothing else. The spokes and
// the hub plate are for the tilted view in the lab and for the moment a wheel
// catches the key light. They are kept because merged geometry costs no draw
// call, not because they carry the stand.
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
  // Spokes radiate in the wheel's own plane, which with the axle on X is YZ.
  // Eight rather than six: from overhead the spokes are the only thing telling
  // a wheel from a disc, and at stand scale six of them at this diameter read
  // as a lumpy circle.
  for (let i = 0; i < 8; i += 1) {
    parts.push(
      part(new THREE.CylinderGeometry(0.026, 0.032, 0.72, 8), p.frame, {
        rot: [(i * Math.PI) / 8, 0, 0],
        ...TIMBER,
      })
    );
  }
  // A runed hub plate bolted over each face. Six-sided, because a hexagon at
  // this size reads as *worked* where a circle reads as another hub.
  //
  // On *both* faces deliberately. Two wheels share one buffer, so anything put
  // on the outboard side of one lands on the inboard side of the other — the
  // same mirroring trap the dragon's wings fell into. A part that is symmetric
  // cannot be mirrored wrongly.
  [0.13, -0.13].forEach((x) => {
    parts.push(
      part(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 6), p.iron, {
        pos: [x, 0, 0],
        rot: [0, 0, Math.PI / 2],
        ...IRON,
      }),
      ...studs(p, 6, 0.15, [x * 1.2, 0, 0], "yz", 0.019)
    );
  });
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
    p.trim,
    // Brass, not iron. There is no environment map on this board — see
    // materials.js — so a metal surface has nothing to reflect and a dark iron
    // one renders very nearly black. At a crewman's scale that is not a helmet,
    // it is a hole: two black dots beside each engine where the crew should be.
    // Brass keeps the specular and keeps a body colour under it.
    { pos: [0, 0.36, -0.02], ...BRASS }
  ),
  ...[0.15, -0.15].map((x) =>
    part(new THREE.CapsuleGeometry(0.042, 0.18, 6, 10), p.crew, {
      pos: [x, 0.06, -0.04],
      rot: [0, 0, x > 0 ? -0.5 : 0.5],
      ...HIDE,
    })
  ),
];

// --- the ballista ----------------------------------------------------------
//
// Rebuilt against a reference build of a dwarven field ballista, and the thing
// worth recording is what the rebuild was *not* allowed to do.
//
// This engine's footprint is already the right shape. A battery measures about
// 5.55 by 2.29 units, which is 2.42:1, and the stand's art field wants roughly
// 2.4:1 — so the fit binds on width with depth a hair inside it, and the
// rendered size is pinned at the full width of the band either way. Any extent
// added anywhere makes the *whole battery smaller* and gains nothing: a trail
// beam run out properly behind the carriage, the way the reference has it,
// costs about a fifth of the machine's size on the card to buy one spar.
//
// So none of this rebuild is new extent. Every part of it lands inside the
// envelope the old blocked-out version already occupied, and the whole gain is
// density: eight-spoke wheels with bolted hub plates instead of a dark disc, a
// carriage with beams and bearing blocks instead of a slab, a recurved bow with
// collars and caps instead of a flat lath, a windlass with ratchets and cranks,
// and brass rivets wherever a real one would carry them. That is the general
// version of the lesson the wings taught in reverse: when the box is already
// the right shape, detail is the only currency left.

// Where the carriage ends and the trail begins. Both are in one buffer — a
// carriage does not articulate — but the numbers are shared with the crew
// placement below, so they are stated once.
const TRAIL_ROOT = [0, 0.58, 0.62];
const TRAIL_FOOT = [0, 0.13, 0.88];

const bolterBedParts = (p, heavy) => {
  const w = heavy ? 1.12 : 1;
  return [
    // Two side beams running fore and aft, braced across. The old version was
    // a single slab with rails stuck on top of it, which from above is a
    // rectangle — this is a frame, and a frame has holes in it.
    ...[0.3, -0.3].map((x) =>
      part(beam(1.36, 0.13, 0.16), p.frame, {
        pos: [x * w, 0.6, 0.06],
        rot: [-Math.PI / 2, 0, 0],
        ...TIMBER,
      })
    ),
    ...[-0.52, 0.04, 0.6].map((z) =>
      part(beam(0.78 * w, 0.11, 0.1), p.frame, {
        pos: [0, 0.6, z],
        rot: [-Math.PI / 2, Math.PI / 2, 0],
        ...TIMBER,
      })
    ),
    // Bearing blocks carrying the axle, which is what the carriage actually
    // rests on
    ...[0.3, -0.3].map((x) =>
      part(beam(0.34, 0.22, 0.2), p.frame, {
        pos: [x * w, 0.47, 0.18],
        rot: [0, 0, 0],
        ...TIMBER,
      })
    ),
    // Through the hubs, not under them
    part(new THREE.CylinderGeometry(0.048, 0.048, 1.66, 14), p.iron, {
      pos: [0, 0.4, 0.18],
      rot: [0, 0, Math.PI / 2],
      ...IRON,
    }),

    // The trail: a spar sloping back to the ground with a spade on the end,
    // and the struts that stop it folding. Kept short — see the note above —
    // but present, because from overhead a machine with a tail behind it is
    // instantly a *field* piece rather than a table toy.
    part(spanning(TRAIL_ROOT, TRAIL_FOOT, 0.11, 0.085, 12), p.frame, TIMBER),
    ...[0.24, -0.24].map((x) =>
      part(
        spanning([x, 0.54, 0.34], [x * 0.3, 0.2, 0.8], 0.028, 0.028, 8),
        p.iron,
        IRON
      )
    ),
    part(beam(0.22, 0.28, 0.09), p.iron, {
      pos: [0, 0.07, 0.94],
      rot: [-Math.PI / 2, 0, 0],
      ...IRON,
    }),
    ...studs(p, 4, 0.08, [0, 0.12, 0.94], "xz"),
    // Handles for the crew to heave it round, splayed outward so they spend
    // width rather than the depth there is none of
    ...[0.1, -0.1].map((x) =>
      part(
        spanning([x, 0.2, 0.74], [x * 3.4, 0.33, 0.94], 0.03, 0.027, 8),
        p.frame,
        TIMBER
      )
    ),

    // The turntable the whole engine trains on
    part(new THREE.CylinderGeometry(0.25, 0.29, 0.11, 8), p.iron, {
      pos: [0, 0.71, -0.06],
      ...IRON,
    }),
    ...studs(p, 8, 0.21, [0, 0.77, -0.06], "xz"),
  ];
};

// The head: stock, trough, bow, bolt, windlass and ironwork. It trains and
// elevates as one piece, which is why it is a buffer of its own.
const bolterArmParts = (p, heavy) => {
  const w = heavy ? 1.12 : 1;
  // The recurve, and it has to be *large* to survive this camera. A first pass
  // swept the tip a tenth of a unit forward of the joint over three quarters of
  // a span, which is what a real limb does and which rendered as a straight
  // bar. Sweeping the joint back instead of the tip forward doubles the visible
  // bend without costing anything at the muzzle, where the depth is spent.
  const tip = (side) => [side * 1.3 * w, 0.24, -0.79];
  const mid = (side) => [side * 0.55 * w, 0.14, -0.52];
  const claw = [0, 0.2, 0.34];

  return [
    // Stock, with rails either side of the groove and an iron floor in it
    part(beam(1.58, 0.26, 0.13), p.frame, {
      pos: [0, 0.06, -0.04],
      rot: [-Math.PI / 2, 0, 0],
      ...TIMBER,
    }),
    ...[0.1, -0.1].map((x) =>
      part(beam(1.58, 0.055, 0.1), p.frame, {
        pos: [x, 0.16, -0.04],
        rot: [-Math.PI / 2, 0, 0],
        ...TIMBER,
      })
    ),
    part(beam(1.3, 0.19, 0.03), p.iron, {
      pos: [0, 0.14, -0.06],
      rot: [-Math.PI / 2, 0, 0],
      ...IRON,
    }),
    // Iron straps banding the stock, each with a pair of rivets. These are the
    // rungs that tell an overhead eye the stock has length.
    ...[-0.58, -0.2, 0.16, 0.5].flatMap((z) => [
      part(beam(0.32, 0.05, 0.2), p.iron, {
        pos: [0, 0.08, z],
        rot: [-Math.PI / 2, Math.PI / 2, 0],
        ...IRON,
      }),
      ...studs(p, 2, 0.15, [0, 0.14, z], "xz"),
    ]),

    // The bow. Two segments a side rather than one flat lath: out and *back*
    // to the mid joint, then out and forward again to the tip, which is the
    // recurve. A straight bar across the front was the single most model-kit
    // thing on this machine.
    ...[1, -1].flatMap((side) => [
      part(spanning([side * 0.13, 0.11, -0.6], mid(side), 0.082, 0.06, 12), p.iron, IRON),
      part(spanning(mid(side), tip(side), 0.06, 0.03, 12), p.iron, IRON),
      // A collar at the joint and a cap on the tip, both turned onto the
      // limb's own direction rather than onto a guessed axis — which is the
      // whole reason to say *where a thing starts and ends* instead of how far
      // to rotate it. A short span straddling a point is a band round it.
      part(band(mid(side), tip(side), 0, 0.06, 0.075), p.trim, BRASS),
      part(band(mid(side), tip(side), 1, 0.07, 0.042), p.iron, IRON),
      // The string, drawn back from the tip to the claw
      part(spanning(tip(side), [side * 0.06, claw[1], claw[2]], 0.017, 0.017, 6), p.trim, CLOTH),
      // …and the windlass rope running back from the claw to the drum
      part(
        spanning([side * 0.07, 0.24, 0.38], [side * 0.11, 0.25, 0.62], 0.014, 0.014, 6),
        p.trim,
        CLOTH
      ),
    ]),
    // Bow block, and the plate under it
    part(beam(0.24, 0.3, 0.22), p.frame, {
      pos: [0, 0.11, -0.62],
      rot: [0, 0, 0],
      ...TIMBER,
    }),
    ...studs(p, 4, 0.11, [0, 0.23, -0.62], "xz"),
    part(beam(0.44, 0.2, 0.1), p.iron, {
      pos: [0, -0.01, -0.64],
      rot: [-Math.PI / 2, Math.PI / 2, 0],
      ...IRON,
    }),
    // The claw holding the string
    part(beam(0.24, 0.22, 0.15), p.iron, {
      pos: claw,
      rot: [-Math.PI / 2, Math.PI / 2, 0],
      ...IRON,
    }),

    // The bolt lying in the trough: shaft, collar, head and three flights
    part(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 12), p.trim, {
      pos: [0, 0.22, -0.2],
      rot: [Math.PI / 2, 0, 0],
      ...TIMBER,
    }),
    part(new THREE.CylinderGeometry(0.052, 0.052, 0.06, 12), p.trim, {
      pos: [0, 0.22, -0.66],
      rot: [Math.PI / 2, 0, 0],
      ...BRASS,
    }),
    part(
      turned(
        [
          [0.062, 0],
          [0.05, 0.08],
          [0, 0.24],
        ],
        12
      ),
      p.iron,
      { pos: [0, 0.22, -0.72], rot: [-Math.PI / 2, 0, 0], ...IRON }
    ),
    ...[0, 1, 2].map((i) =>
      part(
        bevelled(
          [
            [-0.009, 0],
            [0.009, 0],
            [0.045, 0.045],
            [0.045, 0.14],
            [-0.009, 0.16],
          ],
          0.009,
          0
        ),
        p.trim,
        {
          pos: [0, 0.22, 0.2],
          rot: [-Math.PI / 2, 0, (i * Math.PI * 2) / 3],
          ...CLOTH,
        }
      )
    ),

    // The windlass: a turned drum on posts, a ratchet wheel each side, and
    // crank arms with handles for the crew to wind against
    part(
      turned(
        [
          [0.1, -0.24],
          [0.14, -0.21],
          [0.13, -0.11],
          [0.13, 0.11],
          [0.14, 0.21],
          [0.1, 0.24],
        ],
        14
      ),
      p.frame,
      { pos: [0, 0.26, 0.62], rot: [0, 0, Math.PI / 2], ...TIMBER }
    ),
    ...[1, -1].flatMap((side) => [
      part(new THREE.CylinderGeometry(0.17, 0.17, 0.035, 12), p.iron, {
        pos: [side * 0.27, 0.26, 0.62],
        rot: [0, 0, Math.PI / 2],
        ...IRON,
      }),
      part(beam(0.34, 0.07, 0.05), p.iron, {
        pos: [side * 0.33, 0.39, 0.62],
        ...IRON,
      }),
      part(new THREE.CylinderGeometry(0.03, 0.03, 0.17, 10), p.frame, {
        pos: [side * 0.41, 0.53, 0.62],
        rot: [0, 0, Math.PI / 2],
        ...TIMBER,
      }),
      part(beam(0.3, 0.1, 0.08), p.frame, {
        pos: [side * 0.19, 0.16, 0.62],
        ...TIMBER,
      }),
    ]),

    // Dwarven ironwork: runed plates bolted along both flanks of the stock.
    // Brass on iron on timber is three values, and three values along a length
    // is what stops a stock reading as one brown bar.
    ...[1, -1].flatMap((side) => [
      part(beam(0.52, 0.04, 0.16), p.iron, {
        pos: [side * 0.145, 0.08, -0.22],
        rot: [-Math.PI / 2, 0, 0],
        ...IRON,
      }),
      ...[-0.18, 0, 0.18].map((dz) =>
        part(new THREE.SphereGeometry(0.02, 8, 6), p.trim, {
          pos: [side * 0.168, 0.08, -0.22 + dz],
          ...BRASS,
        })
      ),
    ]),
  ];
};

const makeBolter = (p, material, heavy) => {
  const group = new THREE.Group();
  const bed = new THREE.Group();
  group.add(bed);
  hang(bed, merge(bolterBedParts(p, heavy)), material);

  const wheelBuffer = merge(wheelParts(p));
  const wheels = [0.72, -0.72].map((x) => {
    const wheel = new THREE.Group();
    wheel.position.set(x * (heavy ? 1.12 : 1), 0.4, 0.18);
    group.add(wheel);
    hang(wheel, wheelBuffer, material);
    return wheel;
  });

  // The bow lies across the machine and the bolt lies along it: a cross, flat
  // to the ground, which is exactly what an overhead camera wants. The head
  // sits on the turntable and is elevated a touch above level — a positive
  // rotation about X lifts a muzzle pointing at -Z, which is the opposite of
  // the sign that reads as obvious.
  const arm = new THREE.Group();
  arm.position.set(0, 0.76, -0.06);
  arm.rotation.x = 0.14;
  bed.add(arm);
  hang(arm, merge(bolterArmParts(p, heavy)), material);

  const crewBuffer = merge(crewParts(p));
  const crew = [
    [0.6, 0.62],
    [-0.58, 0.48],
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
  part(beam(1.0, 0.07, 0.06), p.trim, {
    pos: [0, 0.18, -0.08],
    rot: [-Math.PI / 2, Math.PI / 2, 0],
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
  part(beam(0.86, 0.07, 0.06), p.frame, {
    pos: [0, 0.04, -0.94],
    rot: [-Math.PI / 2, Math.PI / 2, 0],
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
  // Far enough apart that two engines do not overlap at the bow tips. The
  // battery's own aspect is what the stand fit reads, and at this spacing it
  // lands on 2.5:1 — which is the art field's shape, so the fit binds on width
  // and the machines come out as large as the band can carry them.
  const spanX = count > 1 ? 3.1 : 0;

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
