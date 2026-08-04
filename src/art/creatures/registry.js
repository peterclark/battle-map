// How each creature kind is built and posed.
//
// This module pulls in Three.js and every builder with it, so it is only ever
// reached through a dynamic import from `CreatureLayer`. The question of
// *whether* a unit has figures lives in `roster.js`, which stays pure.
//
// Most kinds are one rig with different arguments rather than a file of their
// own — a spearman and an archer are the same skeleton carrying different
// things, and the difference belongs in a table, not in a second copy of the
// rig. The `army-animation` skill walks through adding to it.

import { buildInfantry, poseInfantry } from "./infantry3d.js";
import { buildCavalry, poseCavalry } from "./cavalry3d.js";
import { buildTyrannosaur, poseTyrannosaur } from "./trex3d.js";
import { buildLizardfolk, poseLizardfolk } from "./lizardfolk3d.js";
import { buildSaurians, poseSaurians } from "./saurians3d.js";

const wrap = (build, pose) => ({
  build: () => {
    const rig = build();
    return { root: rig.root, rig };
  },
  pose: (built, time, state) => pose(built.rig, time, state),
});

// Foot, by what they carry and who they are. The generic `infantry.*` entries
// are the fall-through for every faction nobody has dressed yet.
const FOOT = {
  "infantry.axe": { weapon: "axe", palette: "orc" },
  "infantry.sword": { weapon: "sword", palette: "orc" },
  "infantry.spear": { weapon: "spear", palette: "orc" },
  "infantry.bow": { weapon: "bow", palette: "orc" },

  "hawkshold.sword": { weapon: "sword", palette: "hawkshold" },
  "hawkshold.spear": { weapon: "spear", palette: "hawkshold" },
  "hawkshold.bow": { weapon: "bow", palette: "hawkshold" },
  // Militia and the Peasant Mob: no mail, no livery, and a mob forms up
  // ragged and wide rather than dressing ranks
  "hawkshold.levy": { weapon: "sword", palette: "levy", files: 6, ranks: 3 },
};

// Horse and wolf.
const HORSE = {
  "cavalry.wolfRiders": { mount: "wolf", rider: "goblin", arm: "spear" },
  "hawkshold.knights": {
    mount: "horse",
    rider: "knight",
    arm: "lance",
    caparison: true,
  },
  "hawkshold.lancers": { mount: "horse", rider: "knight", arm: "lance" },
  "hawkshold.scouts": { mount: "horse", rider: "scout", arm: "sword" },
};

export const BUILDERS = {
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

  "saurians.triceratops": wrap(
    () => buildSaurians({ kind: "triceratops" }),
    poseSaurians
  ),
  "saurians.ancients": wrap(
    () => buildSaurians({ kind: "ancients" }),
    poseSaurians
  ),
};

Object.entries(FOOT).forEach(([kind, options]) => {
  BUILDERS[kind] = wrap(() => buildInfantry(options), poseInfantry);
});

Object.entries(HORSE).forEach(([kind, options]) => {
  BUILDERS[kind] = wrap(() => buildCavalry(options), poseCavalry);
});

/** The builder for a kind resolved by `roster.js`, or null. */
export const builderFor = (kind) => BUILDERS[kind] ?? null;
