import * as THREE from "three";
import { describe, expect, it } from "vitest";
import undeadArmy from "../../rules/data/factions/undeadArmy.js";
import { buildBrutes } from "./brutes3d.js";
import { creatureKindFor } from "./roster.js";

// The Zombie Trolls and the Skeleton Trolls used to be one kind, so the board
// put the same figure on both stands. These pin that they are now two, and
// that the difference cost nothing.

const unit = (id) => undeadArmy.units.find((u) => u.id === id);

const meshesOf = (rig) => {
  let meshes = 0;
  rig.root.traverse((o) => {
    if (o.isMesh) meshes += 1;
  });
  return meshes;
};

// Mean vertex colour of the torso buffer, weighted by vertex: what the back
// looks like to a camera that cannot resolve anything smaller.
const backColour = (rig) => {
  const c = rig.brutes[0].spine.children[0].geometry.attributes.color;
  const sum = new THREE.Vector3();
  for (let i = 0; i < c.count; i += 1) sum.add(new THREE.Vector3(c.getX(i), c.getY(i), c.getZ(i)));
  return sum.divideScalar(c.count);
};

describe("the Zombie Trolls", () => {
  it("field their own kind, not the Skeleton Trolls'", () => {
    expect(creatureKindFor(unit("zombieTrolls")).kind).toBe("brute.zombie");
    expect(creatureKindFor(unit("skeletonTrolls")).kind).toBe("brute.bone");
  });

  it("are built as a different figure", () => {
    const zombie = backColour(buildBrutes({ kind: "zombieTroll" }));
    const bone = backColour(buildBrutes({ kind: "boneBrute" }));
    // The skeleton is bone all over; the zombie is hide with a dark wound.
    expect(bone.distanceTo(zombie)).toBeGreaterThan(0.1);
  });

  it("cost no more meshes than any other brute", () => {
    // Everything the port added is merged into buffers that already moved on
    // their own: the wound into the spine, shackles into the forearm, spikes
    // into the club.
    expect(meshesOf(buildBrutes({ kind: "zombieTroll" }))).toBe(
      meshesOf(buildBrutes({ kind: "boneBrute" }))
    );
  });
});
