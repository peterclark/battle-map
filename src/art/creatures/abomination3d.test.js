import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildAbomination, poseAbomination } from "./abomination3d.js";

// The rig is judged by looking at it on the board. These pin the three things
// about it that are measurements rather than taste, each of which an earlier
// version of this creature got wrong without it being visible in a render.

const boxOf = (object) => {
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object);
};

describe("the Abomination", () => {
  it("is wide and shallow enough to fill its stand across the front", () => {
    const size = boxOf(buildAbomination().root).getSize(new THREE.Vector3());
    // A stand's art band is about 2.4:1. Rounder than 2:1 and the fit binds
    // on depth, and the creature renders smaller than its stand allows.
    expect(size.x / size.z).toBeGreaterThan(2.2);
  });

  it("never drops through the turf in any gait", () => {
    // `CreatureLayer` lifts a rig by the lowest point it ever reaches, so one
    // limb swinging below the ground leaves every planted foot hovering. The
    // previous rig dipped a tenth of its own width and did exactly that.
    const rig = buildAbomination();
    const rest = boxOf(rig.root).min.y;
    ["idle", "march", "attack"].forEach((state) => {
      for (let i = 0; i < 40; i += 1) {
        poseAbomination(rig, i * 0.37, state);
        // A few hundredths of slack: a box around a turned part grows by a
        // hair even when the part itself does not move down
        expect(boxOf(rig.root).min.y).toBeGreaterThanOrEqual(rest - 0.02);
      }
    });
  });

  it("moves its limbs out of phase with each other", () => {
    // Anything synchronised would imply one animal underneath. No two limbs
    // may trace the same motion over a stretch of time.
    const rig = buildAbomination();
    const { limbs } = rig.mass;
    const traces = limbs.map(() => []);
    for (let i = 0; i < 60; i += 1) {
      poseAbomination(rig, i * 0.2, "march");
      limbs.forEach(({ upper }, k) => traces[k].push(upper.quaternion.clone()));
    }
    for (let a = 0; a < limbs.length; a += 1) {
      for (let b = a + 1; b < limbs.length; b += 1) {
        const apart = Math.max(
          ...traces[a].map((q, i) => {
            const angleA = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
            const angleB = 2 * Math.acos(Math.min(1, Math.abs(traces[b][i].w)));
            return Math.abs(angleA - angleB);
          })
        );
        expect(apart).toBeGreaterThan(0.05);
      }
    }
  });
});
