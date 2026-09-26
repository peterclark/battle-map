import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildInfantry, poseInfantry } from "./infantry3d.js";

// A block of foot is judged by looking at it on the board. These pin the
// things about the bone build that are measurements rather than taste — each
// of which the version before it got wrong without the render saying so.

const boxOf = (object) => {
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object);
};

const horde = () =>
  buildInfantry({
    weapon: "sword",
    palette: "undead",
    build: "skeleton",
    files: 7,
    ranks: 3,
    spacing: 0.88,
  });

describe("the Skeleton Horde", () => {
  it("is wide and shallow enough to fill its stand across the front", () => {
    const size = boxOf(horde().root).getSize(new THREE.Vector3());
    // `CreatureLayer` fits against both axes and takes the smaller, so a
    // block rounder than the band's ~2.4:1 is scaled to fit its own depth and
    // leaves the width of the stand empty. Five files by four ranks measured
    // 1.6:1 and did exactly that.
    expect(size.x / size.z).toBeGreaterThan(2.4);
  });

  it("never drops through the turf in any gait", () => {
    // A rig is lifted by the lowest point it ever reaches, so one foot
    // swinging below the ground leaves every other figure hovering.
    const rig = horde();
    const rest = boxOf(rig.root).min.y;
    ["idle", "march", "attack"].forEach((state) => {
      for (let i = 0; i < 40; i += 1) {
        poseInfantry(rig, i * 0.37, state);
        expect(boxOf(rig.root).min.y).toBeGreaterThanOrEqual(rest - 0.02);
      }
    });
  });

  it("stays inside the mesh budget a block of foot is allowed", () => {
    // Eight meshes a figure is the rule, and the bone build adds no part that
    // moves on its own — only the ground litter, which is one more mesh for
    // the whole stand.
    const rig = horde();
    let meshes = 0;
    rig.root.traverse((o) => {
      if (o.isMesh) meshes += 1;
    });
    expect(meshes).toBe(rig.count * 8 + 1);
  });
});

describe("dressing", () => {
  // The Horde and the Zombies field near enough the same figures at the same
  // spacing. What has to tell them apart at stand scale is that one dresses
  // its ranks and the other does not, so this pins the difference rather than
  // leaving it to a render nobody re-runs.
  const headings = (dressing) =>
    buildInfantry({ palette: "undead", dressing, files: 7, ranks: 3 }).figures.map(
      (f) => f.group.rotation.y
    );

  it("turns a ranked block barely at all and a ragged one a long way", () => {
    const ranked = Math.max(...headings("ranked").map(Math.abs));
    const ragged = Math.max(...headings("ragged").map(Math.abs));
    expect(ranked).toBeLessThan(0.12);
    expect(ragged).toBeGreaterThan(0.4);
  });

  it("leaves a ranked block exactly as it was before dressings existed", () => {
    // The table's default row is all zeroes on purpose: every other block on
    // the board goes through it, and a default that changes anything would
    // move forty units this was never aimed at.
    const rig = buildInfantry({ palette: "hawkshold" });
    rig.figures.forEach((figure) => {
      expect(figure.lean).toBe(0);
      expect(figure.group.scale.x).toBe(rig.build.breadth);
    });
  });

  it("is stable across builds, so a block never shimmers", () => {
    const once = headings("ragged");
    const twice = headings("ragged");
    expect(twice).toEqual(once);
  });
});
