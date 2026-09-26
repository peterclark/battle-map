import * as THREE from "three";
import { bevelled, merge, part, spanning, surfaceMaterial } from "./kit.js";

// The Swarm of Rats, and anything else that is a carpet rather than a unit.
//
// Every other rig on this board asks how to make one figure legible and then
// repeats it. This one is the opposite: no individual rat is meant to be
// picked out, and if you can see one clearly there are not enough of them.
// The read is *texture* — a shifting mat of small bodies covering the whole
// stand, which is a thing nothing else in the game looks like.
//
// That changes what matters. Silhouette per figure is irrelevant; coverage and
// *value variety* are everything. The first version of this rig got the first
// half right and missed the second: sixty-six rats of one colour on a jittered
// lattice, with bare turf showing between them, read as a scatter of pale
// slivers rather than as a carpet. What fixed it was not more rats. It was
// four coats spread either side of the turf's own value, bodies packed close
// enough to overlap, and a second and third tier climbing over the first.
//
// Ported from `docs/reference/rat-swarm.html`, which that folder's README
// records in full. The short version: the anatomy, the four coats, the
// skeletal rats, the tiers and the seeded scatter are the reference's; the
// footprint is not, because the reference is round and this stand is not.

// --- palette ---------------------------------------------------------------

// Four coats, and the point of having four is that they straddle the turf.
// Measured against 0x3f6420: matted fur sits at 1.8:1 *darker*, grave fur and
// mangy fur within a tenth of the turf's own value, bald hide at 1.4
// *lighter*. A mat whose average is the turf's value still reads, as long as
// the individuals in it are not.
//
// None of these leans blue or pink, and both used to. The board tone-maps with
// ACES at 1.25 exposure, which lifts *and* saturates, so a grey with a little
// blue in it and a tan with a little red in it came out of the first render as
// a mat of lavender. Vermin are olive, umber and dust.
const MATTED = 0x3b342f;
const MANGY = 0x655b4e;
const GRAVE = 0x5b5a52;
const HIDE = 0x8a7a64;
// Weighted, not picked evenly. Four coats in equal measure gave a mat that was
// half pale, and a pale rat on dark turf is a rat you can point at — which is
// the one thing this unit is not allowed to be. Dark is the mass and pale is
// the fleck in it, so the dark coats get two thirds of the draw.
const COATS = [MATTED, MATTED, MATTED, MANGY, MANGY, GRAVE, GRAVE, HIDE];

// The tail is the one part that must carry on its own. 1.95:1 against the
// turf, and there are eighty of them pointing in eighty directions.
const TAIL = 0xa39682;
const BONE = 0xd6c9ae;
const TOOTH = 0xe2d9c2;
const SOCKET = 0x231d1d;
// The ground a swarm has already been over. The reference declares this and
// never uses it — it is standing on a studio floor — and it turns out to be
// the part this board needed most. See `trampledParts` below.
const EARTH = 0x4a3f34;
// The reference lights its eyes with an emissive. There is no emissive channel
// in the merged surface attribute, so this is the colour that emissive landed
// on, painted flat — two sub-pixel points of witchlight per rat, which at this
// size is speckle rather than a face, and speckle is the brief.
const WITCH = 0xbcd9a8;

const PELT = { roughness: 0.92, mottle: 0.16, mottleScale: 26 };
const SCALY = { roughness: 0.62, mottle: 0.12, mottleScale: 40 };
const DRY = { roughness: 0.6 };
const CHURNED = { roughness: 0.98, mottle: 0.26, mottleScale: 3.2 };
const WET = { roughness: 0.3 };

// --- one rat ---------------------------------------------------------------

// The reference builds a rat nose-first along +Z with its hips at the origin.
// This board models facing -Z, so every Z below is that one negated, and the
// two rotations that go with it change sign. `S` carries the reference's own
// numbers down to the size a rat is played at: about 0.26 units of body and
// 0.36 of tail, which on a 3.2" stand is a body ten pixels long and four
// across. Four pixels is the floor below which detail stops being visible and
// the floor above which *value* still is, and value is all this unit needs
// from one rat. It was 0.22 and every rat could be pointed at.
const S = 0.19;
const z = (v) => -v * S;
const u = (v) => v * S;

// Where the tail leaves the body. The tail is the only part with its own
// group, so this is the one joint in the rig.
const TAIL_ROOT = [0, u(0.32), u(0.16)];
// How far round a tail may curl in total. A quarter turn keeps every tail
// pointing broadly away from its owner, which is what "pointing every which
// way" needs — eighty tails that each curl into a spiral are eighty of the
// same shape, and none of them is a direction.
const MAX_CURL = Math.PI / 2;

const HIP_Y = u(0.34);

/**
 * Rearing pivots a body up from its hips, so every point on it moves.
 *
 * Stated as a point transform rather than as a rotation on a group because
 * `rear` is baked into the buffer: a rearing rat also has to *reach* with its
 * fore legs, and a group rotation would carry the planted hind legs up with
 * the rest of it.
 */
const rearing = (rear) => (x, y, zz) => [
  x,
  HIP_Y + (y - HIP_Y) * Math.cos(rear) - zz * Math.sin(rear),
  (y - HIP_Y) * Math.sin(rear) + zz * Math.cos(rear),
];

/**
 * A rat's body, head, legs and — if it is one of the rotted ones — its ribs,
 * all in one buffer.
 *
 * `rear` is baked in rather than applied to a group. A rearing rat pivots up
 * from its hips *and* reaches with its fore legs, so the two have to agree;
 * baking them together means the poser never sees the difference and can leave
 * every rat's body doing the same thing.
 */
const ratBodyParts = ({ coat, skeletal, rear, headPitch }) => {
  const parts = [];
  const bone = skeletal ? BONE : coat;
  const hips = rearing(rear);

  // The torso: rump, belly, shoulder. Three swelling spheres rather than a
  // tapered curve, because at five pixels across the seam a curve saves is one
  // the eye was never going to find.
  parts.push(
    part(new THREE.SphereGeometry(u(0.34), 9, 7), coat, {
      pos: hips(0, HIP_Y, z(0.3)),
      scale: [0.82, 0.86, 1.55],
      ...PELT,
    })
  );
  parts.push(
    part(new THREE.SphereGeometry(u(0.3), 9, 7), coat, {
      pos: [0, HIP_Y, 0],
      scale: [0.9, 0.92, 1.0],
      ...PELT,
    })
  );
  const shoulder = hips(0, u(0.4), z(0.62));
  parts.push(
    part(new THREE.SphereGeometry(u(0.26), 9, 7), coat, {
      pos: shoulder,
      scale: [0.92, 0.9, 1.0],
      ...PELT,
    })
  );

  // Ribs laid bare where the hide has rotted off the flank. Four pale arcs and
  // a spine: a dotted bright line down a dark body, which is the same trick
  // the lizardfolk get from osteoderms and costs as little here.
  //
  // A torus is already in the plane a rib wants — the body runs along Z and
  // that is the torus's own axis — so the only turn it needs is the one that
  // centres its 207° of arc over the back, and then the rear pitch. Written as
  // a `rot` array those two would compose the wrong way round: `at` applies X
  // before Z, and the pitch has to come last.
  if (skeletal) {
    for (let i = 0; i < 4; i += 1) {
      const rib = new THREE.TorusGeometry(
        u(0.19 - i * 0.012),
        u(0.018),
        4,
        8,
        Math.PI * 1.15
      );
      rib.rotateZ(Math.PI / 2 - Math.PI * 0.575);
      rib.rotateX(rear);
      parts.push(part(rib, BONE, { pos: hips(0, HIP_Y, z(0.16 + i * 0.13)), ...DRY }));
    }
    parts.push(
      part(spanning([0, HIP_Y, 0], shoulder, u(0.03), u(0.03), 5), BONE, DRY)
    );
  }

  // The head. A wedge skull, a long snout, ears held wide, sockets, witchlight
  // and two incisors. None of it is legible on its own; together it is the
  // difference between a mat of rats and a mat of lozenges.
  const neck = hips(0, u(0.42), z(0.88));
  const tilt = rear * 0.5 + headPitch;
  // Everything on the head is stated in the head's own frame and then carried
  // through one tilt, so the head turns as a piece. `at` cannot do this with a
  // `rot` array: it composes as Rz·Ry·Rx, and the tilt has to be applied after
  // whatever turn the part already carries, not before it.
  const onHead = (geometry, color, { pos = [0, 0, 0], rot, scale }, surface) => {
    const g = geometry.clone();
    if (scale) g.scale(...scale);
    if (rot) {
      if (rot[0]) g.rotateX(rot[0]);
      if (rot[2]) g.rotateZ(rot[2]);
    }
    g.translate(...pos);
    g.rotateX(tilt);
    g.translate(...neck);
    parts.push(part(g, color, surface));
  };

  onHead(
    new THREE.SphereGeometry(u(0.21), 9, 7),
    coat,
    { pos: [0, 0, z(0.06)], scale: [0.86, 0.84, 1.15] },
    PELT
  );
  onHead(
    new THREE.ConeGeometry(u(0.15), u(0.4), 7),
    coat,
    { pos: [0, u(-0.03), z(0.3)], rot: [-Math.PI / 2, 0, 0] },
    PELT
  );
  onHead(
    new THREE.SphereGeometry(u(0.035), 5, 4),
    TAIL,
    { pos: [0, u(-0.03), z(0.49)] },
    SCALY
  );

  [1, -1].forEach((s) => {
    // Ears laid back and nearly flat, which is not how the reference holds
    // them and not how a rat holds them either.
    //
    // A rat's ear is a paddle standing upright, and from directly overhead an
    // upright paddle is a line — the same reason a spear held properly on this
    // board is a dot. Raked back instead, each one is a pale ellipse two or
    // three pixels across, in the palest colour on the figure, and there are
    // two hundred and seventy of them. That is the single cheapest piece of
    // texture in the unit, and it is the brief.
    onHead(
      new THREE.SphereGeometry(u(0.115), 7, 6),
      HIDE,
      {
        pos: [u(s * 0.2), u(0.1), z(-0.06)],
        scale: [0.95, 0.26, 1.0],
        rot: [-0.3, 0, s * 0.45],
      },
      PELT
    );
    onHead(
      new THREE.SphereGeometry(u(0.06), 6, 5),
      SOCKET,
      { pos: [u(s * 0.14), u(0.04), z(0.17)] },
      PELT
    );
    onHead(
      new THREE.SphereGeometry(u(0.042), 6, 5),
      skeletal ? SOCKET : WITCH,
      { pos: [u(s * 0.145), u(0.04), z(0.2)] },
      WET
    );
    onHead(
      new THREE.ConeGeometry(u(0.022), u(0.11), 4),
      TOOTH,
      { pos: [u(s * 0.035), u(-0.1), z(0.42)], rot: [2.75, 0, 0] },
      DRY
    );
  });

  // Four two-segment legs, stated by their endpoints so no angle is written by
  // hand. The hind pair stays planted whatever the body is doing, because that
  // is what a rearing animal stands on; the fore pair lifts and reaches.
  const lift = rear * 0.9;
  const paw = (x, y, zz, wide) =>
    parts.push(
      part(new THREE.SphereGeometry(u(0.055), 6, 5), TAIL, {
        pos: [x, y, zz],
        scale: [0.9, wide ? 0.7 : 0.55, 1.5],
        ...SCALY,
      })
    );

  [1, -1].forEach((s) => {
    const hip = [u(s * 0.19), u(0.32), z(-0.02)];
    const knee = [u(s * 0.23), u(0.17), z(-0.14)];
    const foot = [u(s * 0.21), u(0.05), z(0.02)];
    parts.push(part(spanning(hip, knee, u(0.075), u(0.055), 5), bone, PELT));
    parts.push(part(spanning(knee, foot, u(0.05), u(0.035), 5), bone, PELT));
    paw(u(s * 0.21), u(0.045), z(0), false);

    const fore = hips(u(s * 0.16), u(0.38), z(0.56));
    const elbow = [
      u(s * 0.18) + lift * u(s * 0.05),
      u(0.22 - lift * 0.02 + lift * 0.34),
      z(0.6 + lift * 0.3),
    ];
    const pad = [
      u(s * 0.17) + lift * u(s * 0.08),
      u(0.05 + lift * 0.62),
      z(0.66 + lift * 0.42),
    ];
    parts.push(part(spanning(fore, elbow, u(0.055), u(0.042), 5), bone, PELT));
    parts.push(part(spanning(elbow, pad, u(0.04), u(0.03), 5), bone, PELT));
    paw(pad[0], pad[1], pad[2], rear >= 0.15);
  });

  return parts;
};

/**
 * A tail, built in rat-local space and then moved so its root is the origin.
 *
 * Nine shrinking segments, each turned a little further than the last, so the
 * tail curls the way one does when its owner is being shoved. `dir` is how
 * hard it swings sideways and `lift` how far off the ground it rides.
 *
 * The clamp is the reference's: a tail that follows its own curve downhill
 * ends up under the turf, and one rat's tail through the ground would hold
 * every planted foot in the unit a hair above it — `CreatureLayer` lifts a rig
 * by the lowest point it ever reaches.
 */
const ratTailParts = (dir, lift) => {
  const parts = [];
  const floor = u(0.035);
  let p = new THREE.Vector3(0, u(0.32), z(-0.16));
  let d = new THREE.Vector3(Math.sin(dir) * 0.22, lift * 0.5, 1).normalize();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const xAxis = new THREE.Vector3(1, 0, 0);

  // The curl is capped rather than free-running. The reference lets nine
  // segments each turn by `dir * 0.22`, which at the far end of its range
  // carries a tail through 159° — far enough that the tip comes back past its
  // own root. On an orbit camera that is a tail curled round a body. Here it
  // put the tip *under* the rat, where the sweep then drove it through the
  // turf and held every planted foot in the unit a hair above the ground.
  let curl = 0;
  for (let i = 0; i < 9; i += 1) {
    const len = u(0.22 - i * 0.008);
    const step = THREE.MathUtils.clamp(dir * 0.22, -MAX_CURL - curl, MAX_CURL - curl);
    curl += step;
    d.applyAxisAngle(yAxis, step)
      .applyAxisAngle(xAxis, -lift * 0.1)
      .normalize();
    const q = p.clone().add(d.clone().multiplyScalar(len));
    if (q.y < floor) q.y = floor;
    parts.push(
      part(
        spanning(
          [p.x - TAIL_ROOT[0], p.y - TAIL_ROOT[1], p.z - TAIL_ROOT[2]],
          [q.x - TAIL_ROOT[0], q.y - TAIL_ROOT[1], q.z - TAIL_ROOT[2]],
          u(0.042 - i * 0.0035),
          u(0.038 - i * 0.0035),
          5
        ),
        TAIL,
        SCALY
      )
    );
    p = q;
  }
  return parts;
};

// --- the swarm ------------------------------------------------------------

// Hashed, never random. The reference's own seed and generator, so the scatter
// this board shows is the scatter that page shows — and so a rat never moves
// between one frame and the next, which would boil rather than scurry.
const rng = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const hang = (parent, geometry, material) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

// The variants every rat is drawn from. Buffers are the cheap thing here and
// meshes are the scarce one, so there are plenty of these and they are shared:
// a hundred and twenty rats cost twenty-eight buffers' worth of memory.
const VARIANTS = 10;
const REARED = 6;
const TAILS = 8;
const WEDGED = 10;

const buildBuffers = () => {
  const r = rng(90210773);
  const pick = (a) => a[Math.floor(r() * a.length) % a.length];
  const between = (a, b) => a + r() * (b - a);
  const coat = () => ({
    coat: pick(COATS),
    skeletal: r() < 0.24,
    headPitch: between(-0.12, 0.22),
  });

  // Rats whose tails swing. These get a joint and so cost two meshes each.
  const bodies = [];
  for (let i = 0; i < VARIANTS; i += 1) {
    bodies.push(
      merge(ratBodyParts({ ...coat(), rear: r() < 0.14 ? between(0.2, 0.5) : 0 }))
    );
  }
  const tails = [];
  for (let i = 0; i < TAILS; i += 1) {
    tails.push(merge(ratTailParts(between(-1.4, 1.4), between(-0.2, 0.6))));
  }

  // Rats whose tails do not. A rat wedged into the middle of the press has its
  // tail under three other rats, and a joint spent there buys a sweep nobody
  // can see. Baking it costs a buffer, which is free, and saves a mesh, which
  // is not — and the mesh is what pays for the twenty extra bodies that make
  // the press a press.
  const baked = (rear) => {
    const tail = ratTailParts(between(-1.2, 1.2), between(-0.2, 1.1));
    return merge([
      ...ratBodyParts({ ...coat(), rear }),
      ...tail.map((g) => g.translate(...TAIL_ROOT)),
    ]);
  };
  const wedged = [];
  for (let i = 0; i < WEDGED; i += 1) wedged.push(baked(r() < 0.2 ? between(0.15, 0.4) : 0));
  const reared = [];
  for (let i = 0; i < REARED; i += 1) reared.push(baked(between(0.4, 1.05)));

  return { bodies, tails, wedged, reared };
};

/**
 * The ground the swarm is standing on, churned to mud.
 *
 * This is one mesh and it does more for the read than the last forty rats did.
 *
 * A hundred and twenty rats scattered over a stand cover about two thirds of
 * it, because randomly-placed bodies leave randomly-placed gaps however many
 * you add — getting to nine tenths would take three hundred, which is twice
 * the mesh budget of the heaviest unit in the game. And what showed through
 * those gaps was *pasture*: bright, even green, the one colour that says
 * nothing has happened here. The mat read as a scatter of vermin on a lawn.
 *
 * Churned earth under them changes what a gap means. The same two thirds of
 * bodies now sit on their own wake, the gaps read as shadow and mud, and the
 * whole stand reads as one thing that has been walked over by something.
 *
 * It is raggedly outlined rather than an ellipse, because a clean edge reads
 * as a decal laid on the turf, and bevelled rather than flat, because from
 * directly overhead a flat plate takes the key light square on and outshines
 * everything standing on it. The bevel puts that highlight on the rim, where
 * it reads as the lip of a scrape.
 */
const trampledParts = (rx, rz, noise) => {
  const points = [];
  const N = 48;
  for (let i = 0; i < N; i += 1) {
    const a = (i / N) * Math.PI * 2;
    // Two octaves, so the outline has bays in it rather than a even scallop
    const ragged = 1 + 0.15 * Math.sin(a * 3 + noise) + 0.09 * Math.sin(a * 7 - noise * 2);
    points.push([Math.cos(a) * rx * ragged, Math.sin(a) * rz * ragged]);
  }
  // `bevelled` extrudes in the XY plane and this has to lie in XZ, which is
  // the `prone` case: one negative quarter turn about X and no second turn.
  return [
    // `bevelled` centres what it extrudes on its own middle, so the lift is
    // half the thickness and the underside lands on zero. Getting that wrong
    // sinks the patch below the turf, and `CreatureLayer` then lifts the whole
    // rig by the depth of the hole — a hundred and thirty rats hovering.
    part(bevelled(points, 0.014, 0.005), EARTH, {
      rot: [-Math.PI / 2, 0, 0],
      pos: [0, 0.007, 0],
      ...CHURNED,
    }),
  ];
};

/**
 * A carpet of vermin.
 *
 * `spread` is how wide the mat runs and `band` how deep. The ratio between
 * them is the only number in this file that is about the stand rather than
 * about rats: the reference swarm is round, and a round unit fits its depth
 * first and then occupies a third of the width it was given.
 *
 * These two are tuned against what the rig *sweeps*, not what it measures at
 * rest, because that is what `CreatureLayer` places it by. At rest the mat is
 * 2.70:1; scurrying it is 2.42:1, against a stand band of about 2.46:1. So the
 * fit binds on width with depth a hair inside it, which is where it should be.
 *
 * The rig this replaced measured 1.99:1 at rest and 1.91:1 swept, which is to
 * say it bound on depth and rendered narrower than its stand could carry —
 * and nothing about the render said so, because a carpet that is too small is
 * still a carpet.
 */
export const buildSwarm = ({ spread = 3.1, band = 0.98 } = {}) => {
  const material = surfaceMaterial();
  const buffers = buildBuffers();
  const root = new THREE.Group();
  const rats = [];
  const r = rng(24681357);
  const between = (a, b) => a + r() * (b - a);

  // Rejection-sampled spots on an ellipse, so bodies overlap without lying on
  // top of each other. Denser at the middle than at the ends: the reference's
  // "press of bodies, fraying at the edge", squashed onto a shallow band.
  const taken = [];
  const spot = (rx, rz, gap) => {
    for (let t = 0; t < 40; t += 1) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r());
      const x = Math.cos(a) * d * rx;
      const zz = Math.sin(a) * d * rz;
      if (taken.every(([px, pz]) => (x - px) ** 2 + (zz - pz) ** 2 > gap * gap)) {
        taken.push([x, zz]);
        return [x, zz];
      }
    }
    return null;
  };

  const place = (x, y, zz, geometry, tail, heading, scale) => {
    const group = new THREE.Group();
    group.position.set(x, y, zz);
    group.rotation.y = heading;
    group.scale.setScalar(scale);

    const body = new THREE.Group();
    group.add(body);
    hang(body, geometry, material);

    const rat = { group, body, base: y, heading, home: new THREE.Vector3(x, y, zz) };
    if (tail) {
      const joint = new THREE.Group();
      joint.position.set(...TAIL_ROOT);
      body.add(joint);
      hang(joint, tail, material);
      rat.tail = joint;
    }
    rat.phase = (rats.length * 0.83) % (Math.PI * 2);
    root.add(group);
    rats.push(rat);
    return rat;
  };

  const rx = spread / 2;
  const rz = band / 2;

  // Sized just inside the rats rather than just outside them: the fringe has
  // to straddle the edge, or the patch reads as a mat laid down for them to
  // stand on rather than as ground they have been over.
  hang(root, merge(trampledParts(rx * 0.99, rz * 1.02, 2.1)), material);

  // Which way a rat points, and this is the one decision in the layout that is
  // about the stand rather than about rats.
  //
  // A rat is six times longer than it is wide, so its heading is what it
  // spends depth on. Pointed down-range — the obvious reading of "a swarm
  // flooding forward" — each one lays 0.6 units across a band 0.9 deep, and
  // the mat comes out one rat thick with turf above and below it. Turned
  // across, the same rat costs 0.1 of depth and covers six times the width.
  //
  // It is the curl the skill prescribes for a long animal on a shallow base,
  // applied to a hundred small ones, and it costs nothing: the brief asks for
  // rats pointing every which way, so there is no heading this has to give up.
  // The bias is toward the flanks and the spread is wide enough to reach all
  // the way round, which is what keeps it a swarm instead of a rank turned
  // sideways.
  const heading = (i) =>
    (i % 2 ? 1 : -1) * (Math.PI / 2) + between(-1.15, 1.15);

  // Tier one, the floor of the swarm, in two halves that differ only in what
  // they cost: a third with a tail joint and the rest with the tail baked in.
  // They are interleaved rather than grouped, so the sweep is spread through
  // the mat instead of being all down one end of it.
  for (let i = 0; i < 86; i += 1) {
    const p = spot(rx, rz, 0.095);
    if (!p) continue;
    const swings = i % 13 < 5;
    place(
      p[0],
      0,
      p[1],
      swings ? buffers.bodies[i % VARIANTS] : buffers.wedged[i % WEDGED],
      swings ? buffers.tails[(i * 3) % TAILS] : null,
      heading(i) + Math.atan2(p[0], 5.2),
      between(0.8, 1.06)
    );
  }

  // Tier two: climbers riding the backs of the ones below
  for (let i = 0; i < 30; i += 1) {
    const p = spot(rx * 0.82, rz * 0.82, 0.07);
    if (!p) continue;
    place(
      p[0],
      between(0.04, 0.062),
      p[1],
      buffers.reared[i % REARED],
      null,
      heading(i) + Math.atan2(p[0], 4.4),
      between(0.8, 0.98)
    );
  }

  // Tier three: four on the crest, up on their haunches. The whole reason for
  // the tiers is that a climber shades the rat beneath it, and a mat with
  // shadows inside it reads as a mass rather than as a decal. It is also what
  // stops a rat being picked out: a body with another body lying across it has
  // no outline of its own.
  for (let i = 0; i < 4; i += 1) {
    const p = spot(rx * 0.44, rz * 0.44, 0.1);
    if (!p) continue;
    place(
      p[0],
      between(0.08, 0.105),
      p[1],
      buffers.reared[(i + 3) % REARED],
      null,
      heading(i),
      between(0.86, 0.96)
    );
  }

  // Stragglers: the fringe, facing every which way. They are what stops the mat
  // having an edge you could draw round, and they keep their tail joints —
  // these are the tails with nothing lying on top of them.
  //
  // Spaced evenly round the ellipse rather than scattered on it. Fourteen
  // random angles decide the whole unit's bounding box between them, and they
  // swung the measured ratio between 2.1:1 and 2.7:1 on nothing but which way
  // the generator happened to fall — which is to say the unit's size on the
  // card was being set by luck. Even spacing makes the fringe a number that can
  // be tuned, and it frays the outline just as well.
  const FRINGE = 14;
  for (let i = 0; i < FRINGE; i += 1) {
    const a = ((i + 0.5) / FRINGE) * Math.PI * 2 + between(-0.16, 0.16);
    const d = between(0.94, 1.06);
    place(
      Math.cos(a) * d * rx * 1.06,
      0,
      Math.sin(a) * d * rz * 0.98,
      buffers.bodies[(i * 4) % VARIANTS],
      buffers.tails[(i * 5) % TAILS],
      heading(i) + between(-0.5, 0.5),
      between(0.74, 0.94)
    );
  }

  // A scatter of gnawed bone in the swarm's wake, all in one buffer. Pale
  // flecks between the bodies, which is the cheapest texture on the board.
  const scraps = [];
  for (let i = 0; i < 16; i += 1) {
    const a = r() * Math.PI * 2;
    const d = between(0.5, 1.15);
    const p = new THREE.Vector3(Math.cos(a) * d * rx, 0.012, Math.sin(a) * d * rz);
    const q = p
      .clone()
      .add(new THREE.Vector3(between(-0.07, 0.07), between(0, 0.012), between(-0.05, 0.05)));
    scraps.push(
      part(spanning([p.x, p.y, p.z], [q.x, q.y, q.z], 0.009, 0.0075, 5), BONE, DRY)
    );
  }
  hang(root, merge(scraps), material);

  return { root, rats, count: rats.length };
};

const GAITS = {
  // Boiling in place
  idle: { rate: 3.2, scurry: 0.35, turn: 1, surge: 0 },
  // Flooding forward
  march: { rate: 5.4, scurry: 1, turn: 0.6, surge: 1 },
  // Swarming over something
  attack: { rate: 7.2, scurry: 1.3, turn: 1.6, surge: 0.4 },
};

/**
 * Pose the swarm.
 *
 * Rats are the one thing here posed by moving whole bodies around rather than
 * by rotating joints — at this size a leg cycle is invisible and a body that
 * shifts a tenth of an inch is not. Each rat runs a small loop around its own
 * spot, so the mat crawls without any rat ever leaving the stand.
 *
 * Nothing here pitches a body. It is tempting — a rat that dips its nose looks
 * alive — and it puts the tail tip through the turf, which costs the whole
 * unit its ground contact rather than one rat its tail. The sweep lives in the
 * tail joint instead, where it can only ever lift.
 */
export const poseSwarm = (rig, time, state = "idle") => {
  const gait = GAITS[state] ?? GAITS.idle;

  rig.rats.forEach((rat) => {
    const t = time * gait.rate + rat.phase;

    // A small orbit around home, different radius per rat
    const radius = 0.024 + (rat.phase % 0.04);
    rat.group.position.x = rat.home.x + Math.cos(t) * radius * gait.scurry;
    rat.group.position.z =
      rat.home.z + Math.sin(t * 1.3) * radius * gait.scurry - gait.surge * 0.03;

    // Nose swinging, and the body bobbing over its feet. Set rather than
    // added: `+=` walks the heading away from the one the layout gave the rat
    // and never brings it back, so a swarm left running slowly scrambles the
    // forward bias it was built with.
    rat.group.rotation.y = rat.heading + Math.sin(t * 0.7) * 0.09 * gait.turn;
    rat.body.position.y = Math.abs(Math.sin(t * 2)) * 0.01 * gait.scurry;

    // The sweep is in Y and stays in Y. Lifting a tail looks alive from any
    // other angle and from this one it only makes the tail shorter — the same
    // reason an upright spear on this board is a dot.
    if (rat.tail) rat.tail.rotation.y = Math.sin(t * 1.1) * 0.55;
  });
};
