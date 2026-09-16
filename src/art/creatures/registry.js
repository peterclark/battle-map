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
import { buildCatapults, poseCatapults } from "./catapult3d.js";
import { buildBrutes, poseBrutes } from "./brutes3d.js";
import { buildAbomination, poseAbomination } from "./abomination3d.js";
import { buildDragon, poseDragon } from "./dragon3d.js";
import { buildSwarm, poseSwarm } from "./swarm3d.js";

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
  //
  // The Horde forms seven across and three deep rather than five by four,
  // which is not a taste decision: five by four measured 1.6:1 against a band
  // that is nearer 2.4:1, so it was scaled to fit its own depth and left a
  // third of the width of the stand empty.
  "undead.sword": {
    weapon: "sword",
    palette: "undead",
    build: "skeleton",
    files: 7,
    ranks: 3,
    spacing: 0.88,
  },
  "undead.spear": { weapon: "spear", palette: "undead", build: "skeleton" },
  "undead.bow": { weapon: "bow", palette: "undead", build: "skeleton" },
  // Zombies and ghouls do not dress ranks. They come in a wide shambling
  // crowd, which is the read — and now that the skeletons are bone rather
  // than narrow men, this is the read that has to carry the difference twice
  // over: these still have their meat on. Neither is the rebuild they are
  // owed; see the Zombie and Ghoul Pack issues.
  "undead.shamble": {
    weapon: "sword",
    palette: "undead",
    build: "man",
    files: 7,
    ranks: 3,
    spacing: 1.2,
    dressing: "ragged",
  },

  // Mercenaries, half-orcs and wildmen: furs, no livery
  "wild.sword": { weapon: "sword", palette: "wildmen", build: "man" },
  "wild.spear": { weapon: "spear", palette: "wildmen", build: "man" },
  "wild.bow": { weapon: "bow", palette: "wildmen", build: "man" },

  // A named company: fewer men, better kit, and the colours flying. Foot --
  // see the note in the creature brief.
  "hawkshold.company": {
    weapon: "sword",
    palette: "hawkshold",
    files: 4,
    ranks: 3,
    banner: true,
  },

  // Spellcasters. Robed, staved, and standing well apart.
  "elf.mage": { weapon: "staff", palette: "highElf", build: "mage" },
  "wild.mage": { weapon: "staff", palette: "wildmen", build: "mage" },

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

// The throwing engines have their own rig, modelled rather than blocked out
const CATAPULTS = {
  "engine.catapult": { palette: "undead", count: 1 },
  "engine.bombChucker": { palette: "orc", count: 2 },
};
Object.entries(CATAPULTS).forEach(([kind, options]) => {
  BUILDERS[kind] = wrap(() => buildCatapults(options), poseCatapults);
});

Object.entries(BRUTES).forEach(([kind, options]) => {
  BUILDERS[kind] = wrap(() => buildBrutes(options), poseBrutes);
});

Object.entries(DRAGONS).forEach(([kind, options]) => {
  BUILDERS[kind] = wrap(() => buildDragon(options), poseDragon);
});

// Not a brute and not a beast: a heap of the dead with no skeleton under it
BUILDERS["undead.abomination"] = wrap(buildAbomination, poseAbomination);

// A carpet rather than a unit: no ranks, no weapons, and no single rat
// meant to be picked out
BUILDERS["undead.swarm"] = wrap(() => buildSwarm(), poseSwarm);

/** The builder for a kind resolved by `roster.js`, or null. */
export const builderFor = (kind) => BUILDERS[kind] ?? null;
