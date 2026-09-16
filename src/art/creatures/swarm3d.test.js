import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildSwarm, poseSwarm } from "./swarm3d.js";

// The rig is judged by looking at it on the board. These pin the things about
// it that are measurements rather than taste — each one a fault an earlier
// version of this unit had, and each one invisible in a render until you know
// what you are looking for.

const boxOf = (object) => {
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object);
};

const sweep = (rig) => {
  const box = new THREE.Box3();
  ["idle", "march", "attack"].forEach((state) => {
    for (let i = 0; i < 40; i += 1) {
      poseSwarm(rig, i * 0.31, state);
      box.union(boxOf(rig.root));
    }
  });
  return box;
};

describe("the Swarm of Rats", () => {
  it("is wide and shallow enough to fill its stand across the front", () => {
    // Measured on what the rig *sweeps*, not on what it measures at rest,
    // because that is what `CreatureLayer` places it by. A stand's art band is
    // about 2.4:1; rounder than that and the fit binds on depth and the unit
    // renders smaller than its stand allows.
    const size = sweep(buildSwarm()).getSize(new THREE.Vector3());
    expect(size.x / size.z).toBeGreaterThan(2.2);
  });

  it("never drops through the turf in any gait", () => {
    // `CreatureLayer` lifts a rig by the lowest point it ever reaches, so one
    // tail tip through the ground leaves all hundred and thirty rats hovering.
    // This caught a real one: the reference lets a tail curl freely, and at
    // the far end of its range nine segments carry the tip back past its own
    // root, where the sweep then drove it under the turf.
    const rig = buildSwarm();
    const rest = boxOf(rig.root).min.y;
    ["idle", "march", "attack"].forEach((state) => {
      for (let i = 0; i < 40; i += 1) {
        poseSwarm(rig, i * 0.37, state);
        expect(boxOf(rig.root).min.y).toBeGreaterThanOrEqual(rest - 0.005);
      }
    });
  });

  it("keeps every rat pointing the way the layout put it", () => {
    // The heading swing used to be `+=`, which walks a rat's heading away from
    // the one it was built with and never brings it back. A board left running
    // slowly scrambled the layout the whole unit depends on, and nothing about
    // one frame showed it.
    const rig = buildSwarm();
    for (let i = 0; i < 600; i += 1) poseSwarm(rig, i * 0.41, "march");
    rig.rats.forEach((rat) => {
      const drift = Math.abs(rat.group.rotation.y - rat.heading);
      expect(drift).toBeLessThan(0.25);
    });
  });

  it("stays inside the mesh budget a unit this dense can afford", () => {
    // The one brief on this board that invites blowing the budget. Merging is
    // what makes it affordable: a rat in the reference is forty-odd meshes and
    // here it is one, or two if its tail swings. The skill's rule of thumb is
    // about eight meshes a figure over about twenty figures, and the heaviest
    // unit in the game is 216.
    let meshes = 0;
    buildSwarm().root.traverse((o) => {
      if (o.isMesh) meshes += 1;
    });
    expect(meshes).toBeLessThan(200);
  });

  it("fields dozens of rats, not a rank of them", () => {
    const rig = buildSwarm();
    expect(rig.count).toBeGreaterThan(100);
    expect(rig.rats).toHaveLength(rig.count);
  });
});
