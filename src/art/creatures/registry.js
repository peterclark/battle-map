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
import { buildWarMachines, poseWarMachines } from "./warMachine3d.js";
import {
  buildAbomination,
  buildBrutes,
  poseAbomination,
  poseBrutes,
} from "./brutes3d.js";
import { buildDragon, poseDragon } from "./dragon3d.js";

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

  // Dwarves: short, broad, bearded, and packed tighter than anyone
  "dwarf.axe": { weapon: "axe", palette: "dwarf", build: "dwarf" },
  "dwarf.sword": { weapon: "sword", palette: "dwarf", build: "dwarf" },
  "dwarf.spear": { weapon: "spear", palette: "dwarf", build: "dwarf" },
  "dwarf.bow": { weapon: "bow", palette: "dwarf", build: "dwarf" },
  "dwarf.crossbow": { weapon: "crossbow", palette: "dwarf", build: "dwarf" },

  // High Elves: tall, narrow, cloaked, white and gold
  "elf.sword": { weapon: "sword", palette: "highElf", build: "elf" },
  "elf.spear": { weapon: "spear", palette: "highElf", build: "elf" },
  "elf.bow": { weapon: "bow", palette: "highElf", build: "elf" },

  // The undead foot. Bone against dark turf is the one palette that gets its
  // contrast for nothing.
  "undead.sword": { weapon: "sword", palette: "undead", build: "skeleton" },
  "undead.spear": { weapon: "spear", palette: "undead", build: "skeleton" },
  "undead.bow": { weapon: "bow", palette: "undead", build: "skeleton" },
  // Zombies, ghouls and rats do not dress ranks. They come in a wide
  // shambling crowd, which is the read.
  "undead.shamble": {
    weapon: "sword",
    palette: "undead",
    build: "skeleton",
    files: 7,
    ranks: 3,
    spacing: 1.2,
  },

  // Mercenaries, half-orcs and wildmen: furs, no livery
  "wild.sword": { weapon: "sword", palette: "wildmen", build: "man" },
  "wild.spear": { weapon: "spear", palette: "wildmen", build: "man" },
  "wild.bow": { weapon: "bow", palette: "wildmen", build: "man" },

  // Orc foot gains the weapons everyone else just got
  "infantry.crossbow": { weapon: "crossbow", palette: "orc" },
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
  "cavalry.dwarf": { mount: "horse", rider: "dwarf", arm: "lance" },
  "cavalry.elfKnights": {
    mount: "horse",
    rider: "elf",
    arm: "lance",
    caparison: true,
  },
  "cavalry.elfBowriders": { mount: "horse", rider: "elf", arm: "bow" },
  "cavalry.horseArchers": { mount: "horse", rider: "wildman", arm: "bow" },
  // Dead riders on dead horses
  "cavalry.deathKnights": {
    mount: "bonehorse",
    rider: "wight",
    arm: "lance",
    caparison: true,
  },
  "cavalry.boneRiders": { mount: "bonehorse", rider: "wight", arm: "spear" },
};

// Wheeled engines and the crews around them.
const ENGINES = {
  "engine.ballista": { engine: "heavyBolter", palette: "dwarf", count: 2 },
  "engine.scorpion": { engine: "bolter", palette: "highElf", count: 2 },
  "engine.catapult": { engine: "thrower", palette: "undead", count: 1 },
  "engine.bombChucker": { engine: "thrower", palette: "orc", count: 2 },
  "engine.chariot": { engine: "chariot", palette: "highElf", count: 2 },
};

// Large humanoids -- the shape that has neither a formation nor a frill.
const BRUTES = {
  "brute.troll": { kind: "troll" },
  "brute.ogre": { kind: "ogre" },
  "brute.giant": { kind: "giant" },
  "brute.bone": { kind: "boneBrute" },
  "brute.elemental": { kind: "elemental" },
};

// Wings, and the one that has to manage without them.
const DRAGONS = {
  "dragon.red": { kind: "red" },
  "dragon.redLesser": { kind: "redLesser" },
  "dragon.blue": { kind: "blue" },
  "dragon.hydra": { kind: "hydra" },
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

Object.entries(ENGINES).forEach(([kind, options]) => {
  BUILDERS[kind] = wrap(() => buildWarMachines(options), poseWarMachines);
});

Object.entries(BRUTES).forEach(([kind, options]) => {
  BUILDERS[kind] = wrap(() => buildBrutes(options), poseBrutes);
});

Object.entries(DRAGONS).forEach(([kind, options]) => {
  BUILDERS[kind] = wrap(() => buildDragon(options), poseDragon);
});

// Not a brute and not a beast: a heap of the dead with no skeleton under it
BUILDERS["undead.abomination"] = wrap(buildAbomination, poseAbomination);

/** The builder for a kind resolved by `roster.js`, or null. */
export const builderFor = (kind) => BUILDERS[kind] ?? null;
