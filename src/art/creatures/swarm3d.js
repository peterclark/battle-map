import * as THREE from "three";
import { merge, part, surfaceMaterial } from "./kit.js";

// The Swarm of Rats, and anything else that is a carpet rather than a unit.
//
// Every other rig on this board asks how to make one figure legible and then
// repeats it. This one is the opposite: no individual rat is meant to be
// picked out, and if you can see one clearly there are not enough of them.
// The read is *texture* — a shifting mat of small bodies covering the whole
// stand, which is a thing nothing else in the game looks like.
//
// That changes what matters. Silhouette per figure is irrelevant; density and
// coverage are everything. The rats are laid out on a jittered lattice rather
// than in ranks, at four to five times the count of an infantry block, and
// each is four meshes so the total stays affordable.
//
// Contrast still applies, and it is the one thing that nearly sank this: a
// mat of small dark bodies on dark turf is a smudge. The tails do the work —
// pale, thin, and pointing every which way, they break up the mass into
// something that reads as *many* rather than as one grey blanket.

const FUR = 0x6f6455;
const FUR_PALE = 0x8d8271;
const TAIL = 0xc4b49c;
const EYE = 0xc23a2a;

const PELT = { roughness: 0.95 };
const WET = { metalness: 0.3, roughness: 0.25 };

// Two buffers a rat, and deliberately coarse ones. This is the one rig that
// was left out of the density pass and stays out of it: no rat is ever looked
// at closely, there are more of them than of anything else on the board, and
// segments spent here buy nothing at all.
//
// What the merge buys here is not detail — it is the mesh count itself. A rat
// used to be six meshes and sixty-six rats were four hundred of them, easily
// the heaviest single unit in the game. Body, head, ears and eyes now share
// one buffer because none of them moves independently at this size; only the
// tail keeps its own, because the tail sweep is the whole read.
const ratBodyParts = (pale) => [
  part(new THREE.CapsuleGeometry(0.055, 0.11, 3, 6), pale ? FUR_PALE : FUR, {
    pos: [0, 0, 0],
    rot: [Math.PI / 2, 0, 0],
    ...PELT,
  }),
  part(new THREE.ConeGeometry(0.045, 0.11, 5), pale ? FUR_PALE : FUR, {
    pos: [0, 0, -0.15],
    rot: [-Math.PI / 2, 0, 0],
    ...PELT,
  }),
  ...[0.035, -0.035].map((x) =>
    part(new THREE.SphereGeometry(0.022, 5, 4), FUR_PALE, {
      pos: [x, 0.035, -0.09],
      ...PELT,
    })
  ),
  ...[0.025, -0.025].map((x) =>
    part(new THREE.SphereGeometry(0.012, 4, 3), EYE, {
      pos: [x, 0.015, -0.15],
      ...WET,
    })
  ),
];

// The tail: pale, and laid almost flat so its whole length shows from above
const ratTailParts = () => [
  part(new THREE.CylinderGeometry(0.012, 0.006, 0.2, 4), TAIL, {
    pos: [0, -0.01, 0.1],
    rot: [Math.PI / 2.1, 0, 0],
    ...PELT,
  }),
];

const hang = (parent, geometry, material) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

// One rat, nose along -Z, on the ground.
const makeRat = (buffers, material, pale) => {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.075;
  group.add(body);
  hang(body, pale ? buffers.pale : buffers.body, material);

  const tail = new THREE.Group();
  tail.position.z = 0.12;
  body.add(tail);
  hang(tail, buffers.tail, material);

  return { group, body, tail };
};

/**
 * A carpet of vermin.
 *
 * `across` and `deep` are how many rats, not how many ranks — there are no
 * ranks. They are scattered on a jittered lattice, which gives even coverage
 * without the regularity reading as a formation.
 */
export const buildSwarm = ({ across = 11, deep = 6, spread = 3.0 } = {}) => {
  const material = surfaceMaterial();
  const buffers = {
    body: merge(ratBodyParts(false)),
    pale: merge(ratBodyParts(true)),
    tail: merge(ratTailParts()),
  };
  const root = new THREE.Group();
  const rats = [];

  for (let row = 0; row < deep; row += 1) {
    for (let col = 0; col < across; col += 1) {
      const index = row * across + col;
      // Hashed jitter, never random: a swarm that reshuffled every frame
      // would boil rather than scurry
      const jx = (((index * 13) % 17) / 17 - 0.5) * 1.4;
      const jz = (((index * 29) % 11) / 11 - 0.5) * 1.4;
      const rat = makeRat(buffers, material, index % 5 === 0);
      rat.group.position.set(
        (col / (across - 1) - 0.5) * spread + jx * (spread / across),
        0,
        (row / (deep - 1) - 0.5) * (spread * 0.42) + jz * 0.14
      );
      // Facing every which way, but biased forward — a swarm has a direction
      // even though no rat in it is marching
      rat.group.rotation.y = (((index * 7) % 13) / 13 - 0.5) * 2.2;
      rat.phase = (index * 0.83) % (Math.PI * 2);
      rat.home = rat.group.position.clone();
      root.add(rat.group);
      rats.push(rat);
    }
  }

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
 */
export const poseSwarm = (rig, time, state = "idle") => {
  const gait = GAITS[state] ?? GAITS.idle;

  rig.rats.forEach((rat) => {
    const t = time * gait.rate + rat.phase;

    // A small orbit around home, different radius per rat
    const r = 0.03 + (rat.phase % 0.05);
    rat.group.position.x = rat.home.x + Math.cos(t) * r * gait.scurry;
    rat.group.position.z =
      rat.home.z + Math.sin(t * 1.3) * r * gait.scurry - gait.surge * 0.04;

    // Nose swinging, and the body bobbing over its feet
    rat.group.rotation.y += Math.sin(t * 0.7) * 0.02 * gait.turn;
    rat.body.position.y = 0.075 + Math.abs(Math.sin(t * 2)) * 0.012 * gait.scurry;
    // The whole body pitches instead of the head alone: at four pixels a rat
    // the difference is invisible and it saves a buffer on every one of them
    rat.body.rotation.x = Math.sin(t * 1.6) * 0.12;
    rat.tail.rotation.y = Math.sin(t * 1.1) * 0.55;
  });
};
