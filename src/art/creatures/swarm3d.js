import * as THREE from "three";
import { matte } from "./materials.js";

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

const MATERIALS = {
  fur: matte(0x6f6455),
  furPale: matte(0x8d8271),
  tail: matte(0xc4b49c, 0.8),
  eye: new THREE.MeshStandardMaterial({
    color: 0xc23a2a,
    roughness: 0.3,
    emissive: 0x2a0603,
  }),
};

// Four meshes a rat, and deliberately coarse ones. This is the one rig that
// was left out of the density pass: no rat is ever looked at closely, there
// are four hundred meshes of them, and segments spent here buy nothing at all.
const GEOMETRY = {
  body: new THREE.CapsuleGeometry(0.055, 0.11, 3, 6),
  head: new THREE.ConeGeometry(0.045, 0.11, 5),
  tail: new THREE.CylinderGeometry(0.012, 0.006, 0.2, 4),
  ear: new THREE.SphereGeometry(0.022, 5, 4),
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

// One rat, nose along -Z, on the ground.
const makeRat = (pale) => {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.075;
  group.add(body);

  add(GEOMETRY.body, pale ? MATERIALS.furPale : MATERIALS.fur, body, [0, 0, 0], [
    Math.PI / 2,
    0,
    0,
  ]);
  const head = new THREE.Group();
  head.position.z = -0.12;
  body.add(head);
  add(GEOMETRY.head, pale ? MATERIALS.furPale : MATERIALS.fur, head, [0, 0, -0.03], [
    -Math.PI / 2,
    0,
    0,
  ]);
  add(GEOMETRY.ear, MATERIALS.furPale, head, [0.035, 0.035, 0.03]);
  add(GEOMETRY.ear, MATERIALS.furPale, head, [-0.035, 0.035, 0.03]);
  add(GEOMETRY.eye, MATERIALS.eye, head, [0.025, 0.015, -0.03]);

  // The tail: pale, and laid almost flat so its whole length shows from above
  const tail = new THREE.Group();
  tail.position.z = 0.12;
  body.add(tail);
  add(GEOMETRY.tail, MATERIALS.tail, tail, [0, -0.01, 0.1], [Math.PI / 2.1, 0, 0]);

  return { group, body, head, tail };
};

/**
 * A carpet of vermin.
 *
 * `across` and `deep` are how many rats, not how many ranks — there are no
 * ranks. They are scattered on a jittered lattice, which gives even coverage
 * without the regularity reading as a formation.
 */
export const buildSwarm = ({ across = 11, deep = 6, spread = 3.0 } = {}) => {
  const root = new THREE.Group();
  const rats = [];

  for (let row = 0; row < deep; row += 1) {
    for (let col = 0; col < across; col += 1) {
      const index = row * across + col;
      // Hashed jitter, never random: a swarm that reshuffled every frame
      // would boil rather than scurry
      const jx = (((index * 13) % 17) / 17 - 0.5) * 1.4;
      const jz = (((index * 29) % 11) / 11 - 0.5) * 1.4;
      const rat = makeRat(index % 5 === 0);
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
    rat.head.rotation.x = Math.sin(t * 1.6) * 0.2;
    rat.tail.rotation.y = Math.sin(t * 1.1) * 0.55;
  });
};
