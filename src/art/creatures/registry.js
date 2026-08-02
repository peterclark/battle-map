// How each creature kind is built and posed.
//
// This module pulls in Three.js and every builder with it, so it is only ever
// reached through a dynamic import from `CreatureLayer`. The question of
// *whether* a unit has figures lives in `roster.js`, which stays pure.
//
// Adding an army means adding builders and pointing kinds at them here. The
// `army-animation` skill walks through that.

import { buildInfantry, poseInfantry } from "./infantry3d.js";
import { buildWolfRiders, poseWolfRiders } from "./wolfRiders3d.js";
import { buildTyrannosaur, poseTyrannosaur } from "./trex3d.js";
import { buildLizardfolk, poseLizardfolk } from "./lizardfolk3d.js";

const wrap = (build, pose) => ({
  build: (unit) => {
    const rig = build(unit);
    return { root: rig.root, rig };
  },
  pose: (built, time, state) => pose(built.rig, time, state),
});

export const BUILDERS = {
  infantry: wrap(() => buildInfantry(), poseInfantry),
  wolfRiders: wrap(() => buildWolfRiders(), poseWolfRiders),
  tyrannosaur: wrap(() => buildTyrannosaur(), poseTyrannosaur),
  "lizardfolk.swarmling": wrap(
    () => buildLizardfolk({ breed: "swarmling" }),
    poseLizardfolk
  ),
  "lizardfolk.trog": wrap(() => buildLizardfolk({ breed: "trog" }), poseLizardfolk),
  "lizardfolk.tyrant": wrap(
    () => buildLizardfolk({ breed: "tyrant" }),
    poseLizardfolk
  ),
  "lizardfolk.raptor": wrap(
    () => buildLizardfolk({ breed: "raptor" }),
    poseLizardfolk
  ),
  "lizardfolk.hatchling": wrap(
    () => buildLizardfolk({ breed: "hatchling" }),
    poseLizardfolk
  ),
};

/** The builder for a kind resolved by `roster.js`, or null. */
export const builderFor = (kind) => BUILDERS[kind] ?? null;
