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

describe("the Skeleton Spearmen", () => {
  const phalanx = () =>
    buildInfantry({
      weapon: "spear",
      palette: "undead",
      build: "skeleton",
      files: 8,
      ranks: 3,
      spacing: 0.88,
      grips: ["braced", "levelled"],
    });

  // Where a figure's heels are, from its legs alone
  const heels = (figure) => {
    const box = new THREE.Box3();
    figure.legs.forEach(({ hip }) => box.expandByObject(hip));
    return box.min.y;
  };

  it("is wide and shallow enough to fill its stand across the front", () => {
    // A braced spear runs forward, and every unit of that is depth. Five by
    // five with shouldered spears measured 1.2:1 and used half the stand.
    const rig = phalanx();
    const rest = boxOf(rig.root).getSize(new THREE.Vector3());
    expect(rest.x / rest.z).toBeGreaterThan(2.4);

    const swept = new THREE.Box3();
    ["idle", "march", "attack"].forEach((state) => {
      for (let i = 0; i < 12; i += 1) {
        poseInfantry(rig, i * 0.41, state);
        swept.union(boxOf(rig.root));
      }
    });
    const size = swept.getSize(new THREE.Vector3());
    expect(size.x / size.z).toBeGreaterThan(2.4);
  });

  it("plants the front rank's butts on the ground and never through it", () => {
    // Too short and the spear floats; too long and it sinks, and a rig is
    // lifted by its lowest point, so one butt in the turf leaves the whole
    // block hovering.
    const rig = phalanx();
    const front = rig.figures.filter((f) => f.grip?.planted);
    expect(front).toHaveLength(8);
    // The heel line at rest. Heels lift as the legs move, so the ground is
    // taken once, before anything poses.
    rig.root.updateMatrixWorld(true);
    const ground = Math.min(...front.map(heels));
    ["idle", "attack"].forEach((state) => {
      for (let i = 0; i < 20; i += 1) {
        poseInfantry(rig, i * 0.37, state);
        rig.root.updateMatrixWorld(true);
        front.forEach((figure) => {
          const butt = new THREE.Box3().setFromObject(figure.weapon).min.y;
          expect(butt).toBeGreaterThanOrEqual(ground - 0.02);
          // A braced man barely bobs, and the butt only ever lifts with him
          expect(butt).toBeLessThan(ground + 0.05);
        });
      }
    });
  });

  it("holds no spear upright, in any gait", () => {
    // The trap on this unit. An upright spear is a dot from directly above,
    // which is how the reference holds its rear ranks and why this does not.
    const rig = phalanx();
    const up = new THREE.Vector3();
    ["idle", "march", "attack"].forEach((state) => {
      for (let i = 0; i < 20; i += 1) {
        poseInfantry(rig, i * 0.37, state);
        rig.root.updateMatrixWorld(true);
        rig.figures.forEach((figure) => {
          up.set(0, 1, 0).transformDirection(figure.weapon.matrixWorld);
          // Leaning forward, and at least ~37° off the vertical
          expect(up.z).toBeLessThan(0);
          expect(Math.acos(up.y)).toBeGreaterThan(0.65);
        });
      }
    });
  });

  it("stays inside the mesh budget a block of foot is allowed", () => {
    // The braced spear is a second weapon buffer, not a second mesh
    const rig = phalanx();
    let meshes = 0;
    rig.root.traverse((o) => {
      if (o.isMesh) meshes += 1;
    });
    expect(meshes).toBe(rig.count * 8 + 1);
  });

  it("leaves every other spear block holding its spear as it did", () => {
    const rig = buildInfantry({ weapon: "spear", palette: "hawkshold" });
    rig.figures.forEach((figure) => {
      expect(figure.grip).toBeUndefined();
      expect(figure.weapon.rotation.x).toBe(0);
    });
  });
});
