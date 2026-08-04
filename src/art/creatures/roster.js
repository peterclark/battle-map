// Which figures a unit fields — the question, not the answer.
//
// This module is deliberately free of Three.js. The board needs to know
// whether a unit has figures in order to decide how to draw its stand, and
// that question gets asked on every frame in card mode too, where the 3D
// library is never loaded at all. Keeping the lookup pure is what lets the
// 600 KB of Three.js stay behind a dynamic import.
//
// `registry.js` holds the builders these kinds resolve to.

const lower = (unit) => `${unit?.name ?? ""}`.toLowerCase();
const has = (unit, word) => lower(unit).includes(word);
const keyworded = (unit, word) => (unit?.keywords ?? []).includes(word);
const faction = (unit, id) => unit?.factionId === id;

// What a unit carries, read off the card the same way `cardFace.js` reads it.
// The keyword is authoritative where there is one; otherwise the name says so
// plainly, because these lists name their units after their weapons.
const armedWith = (unit) => {
  if (keyworded(unit, "spears")) return "spear";
  if (has(unit, "bow") || has(unit, "archer")) return "bow";
  if (has(unit, "sword") || has(unit, "blade")) return "sword";
  if (has(unit, "axe")) return "axe";
  return null;
};

const mounted = (unit) => keyworded(unit, "cavalry") || has(unit, "rider");

/**
 * A kind, and how much of its stand it should fill.
 *
 * `fill` is a fraction of the stand's own footprint. Below 1 the figures sit
 * inside the printed edge, which is what a rank of infantry does on a real
 * stand. Above 1 a creature overhangs, because a monster that fits neatly
 * inside its card does not read as a monster.
 */
const KINDS = [
  // Units that have earned their own sculpt, matched by name. These come
  // first: a Tyrannosaurus Rex is not a re-tinted infantryman.
  { kind: "tyrannosaur", fill: 1.15, match: (u) => has(u, "tyrannosaurus") },

  // --- Lizardmen ---------------------------------------------------------
  // Three peoples rather than one, and the list says which by name.
  {
    kind: "lizardfolk.tyrant",
    fill: 0.94,
    match: (u) => faction(u, "lizardmen") && has(u, "tyrant"),
  },
  {
    kind: "lizardfolk.trog",
    fill: 0.94,
    match: (u) => faction(u, "lizardmen") && has(u, "trog"),
  },
  {
    kind: "lizardfolk.swarmling",
    fill: 0.94,
    match: (u) => faction(u, "lizardmen") && has(u, "swarmling"),
  },
  // The beasts of the same list. Named rather than keyworded, because nothing
  // on the card says "this one is an animal".
  {
    kind: "lizardfolk.raptor",
    fill: 0.96,
    match: (u) => faction(u, "lizardmen") && has(u, "raptor"),
  },
  {
    kind: "lizardfolk.hatchling",
    fill: 0.96,
    match: (u) => faction(u, "lizardmen") && has(u, "hatchling"),
  },
  // The Large saurians, matched before the Large fall-through below.
  {
    kind: "saurians.triceratops",
    fill: 1.06,
    match: (u) => faction(u, "lizardmen") && has(u, "triceratops"),
  },
  {
    kind: "saurians.ancients",
    fill: 1.06,
    match: (u) => faction(u, "lizardmen") && has(u, "ancients"),
  },

  // --- Men of Hawkshold --------------------------------------------------
  // Mail and livery, and the three cavalry units differ enough to be worth
  // telling apart on the table.
  {
    kind: "hawkshold.knights",
    fill: 0.95,
    match: (u) => faction(u, "menOfHawkshold") && has(u, "knights") && mounted(u),
  },
  {
    kind: "hawkshold.lancers",
    fill: 0.95,
    match: (u) => faction(u, "menOfHawkshold") && has(u, "lancer"),
  },
  {
    kind: "hawkshold.scouts",
    fill: 0.95,
    match: (u) => faction(u, "menOfHawkshold") && mounted(u),
  },
  // Levies before the weapon rules: a Peasant Mob carries blades too, but it
  // is not a swordsman and should not muster as one.
  {
    kind: "hawkshold.levy",
    fill: 0.92,
    match: (u) =>
      faction(u, "menOfHawkshold") && (has(u, "militia") || has(u, "peasant")),
  },
  {
    kind: "hawkshold.spear",
    fill: 0.92,
    match: (u) => faction(u, "menOfHawkshold") && armedWith(u) === "spear",
  },
  {
    kind: "hawkshold.bow",
    fill: 0.92,
    match: (u) => faction(u, "menOfHawkshold") && armedWith(u) === "bow",
  },
  {
    // Everything else on foot in the list fights with a blade — swordsmen,
    // great swordsmen, and the Free Company
    kind: "hawkshold.sword",
    fill: 0.92,
    match: (u) => faction(u, "menOfHawkshold"),
  },

  // --- Monsters, wherever they are fielded -------------------------------
  // Matched on name before any faction rule, because a dragon is a dragon.
  { kind: "dragon.hydra", fill: 1.2, match: (u) => has(u, "hydra") },
  {
    kind: "dragon.blue",
    fill: 1.2,
    match: (u) => has(u, "dragon") && has(u, "blue"),
  },
  {
    kind: "dragon.red",
    fill: 1.2,
    match: (u) => has(u, "dragon") && has(u, "ancient"),
  },
  { kind: "dragon.redLesser", fill: 1.15, match: (u) => has(u, "dragon") },

  { kind: "brute.giant", fill: 1.12, match: (u) => has(u, "giant") && !has(u, "catapult") },
  { kind: "brute.elemental", fill: 1.08, match: (u) => has(u, "elemental") && keyworded(u, "large") },
  { kind: "brute.abomination", fill: 1.08, match: (u) => has(u, "abomination") },
  {
    // Skeleton and Zombie Trolls -- the same brute with the meat off
    kind: "brute.bone",
    fill: 1.08,
    match: (u) => has(u, "troll") && (has(u, "skeleton") || has(u, "zombie")),
  },
  { kind: "brute.troll", fill: 1.08, match: (u) => has(u, "troll") },
  { kind: "brute.ogre", fill: 1.08, match: (u) => has(u, "ogre") },

  // --- War machines ------------------------------------------------------
  { kind: "engine.ballista", fill: 1.0, match: (u) => has(u, "ballista") },
  { kind: "engine.scorpion", fill: 1.0, match: (u) => has(u, "scorpion") },
  { kind: "engine.catapult", fill: 1.0, match: (u) => has(u, "catapult") },
  { kind: "engine.bombChucker", fill: 1.0, match: (u) => has(u, "chucker") },
  { kind: "engine.chariot", fill: 1.0, match: (u) => has(u, "chariot") },

  // --- Dwarves of Runegard -----------------------------------------------
  // Antonian Horsemen are the one mounted unit and are men, not dwarves.
  {
    kind: "cavalry.dwarf",
    fill: 0.95,
    match: (u) => faction(u, "dwarvesOfRunegard") && mounted(u),
  },
  {
    kind: "dwarf.crossbow",
    fill: 0.92,
    match: (u) => faction(u, "dwarvesOfRunegard") && has(u, "crossbow"),
  },
  {
    kind: "dwarf.bow",
    fill: 0.92,
    match: (u) => faction(u, "dwarvesOfRunegard") && armedWith(u) === "bow",
  },
  {
    kind: "dwarf.spear",
    fill: 0.92,
    match: (u) => faction(u, "dwarvesOfRunegard") && armedWith(u) === "spear",
  },
  {
    kind: "dwarf.axe",
    fill: 0.92,
    match: (u) => faction(u, "dwarvesOfRunegard"),
  },

  // --- High Elves --------------------------------------------------------
  {
    kind: "cavalry.elfBowriders",
    fill: 0.95,
    match: (u) => faction(u, "highElves") && has(u, "bowrider"),
  },
  {
    kind: "cavalry.elfKnights",
    fill: 0.95,
    match: (u) => faction(u, "highElves") && mounted(u),
  },
  {
    kind: "elf.bow",
    fill: 0.92,
    match: (u) => faction(u, "highElves") && armedWith(u) === "bow",
  },
  {
    kind: "elf.spear",
    fill: 0.92,
    match: (u) => faction(u, "highElves") && armedWith(u) === "spear",
  },
  {
    // Blades, guards, mages and rangers all fight on foot with a blade
    kind: "elf.sword",
    fill: 0.92,
    match: (u) => faction(u, "highElves"),
  },

  // --- Undead ------------------------------------------------------------
  {
    kind: "cavalry.deathKnights",
    fill: 0.95,
    match: (u) => faction(u, "undeadArmy") && has(u, "death knight"),
  },
  {
    kind: "cavalry.boneRiders",
    fill: 0.95,
    match: (u) => faction(u, "undeadArmy") && mounted(u),
  },
  {
    kind: "undead.bow",
    fill: 0.92,
    match: (u) => faction(u, "undeadArmy") && armedWith(u) === "bow",
  },
  {
    kind: "undead.spear",
    fill: 0.92,
    match: (u) => faction(u, "undeadArmy") && armedWith(u) === "spear",
  },
  {
    // Zombies, ghouls and rats shamble in a crowd rather than a rank
    kind: "undead.shamble",
    fill: 0.94,
    match: (u) =>
      faction(u, "undeadArmy") &&
      (has(u, "zombie") || has(u, "ghoul") || has(u, "swarm")),
  },
  {
    kind: "undead.sword",
    fill: 0.92,
    match: (u) => faction(u, "undeadArmy"),
  },

  // --- Monsters and Mercenaries ------------------------------------------
  {
    kind: "cavalry.horseArchers",
    fill: 0.95,
    match: (u) => faction(u, "monstersAndMercenaries") && mounted(u),
  },
  {
    kind: "wild.bow",
    fill: 0.92,
    match: (u) => faction(u, "monstersAndMercenaries") && armedWith(u) === "bow",
  },
  {
    kind: "wild.spear",
    fill: 0.92,
    match: (u) => faction(u, "monstersAndMercenaries") && armedWith(u) === "spear",
  },
  {
    kind: "wild.sword",
    fill: 0.92,
    match: (u) => faction(u, "monstersAndMercenaries"),
  },

  // --- Orc Army ----------------------------------------------------------
  {
    kind: "infantry.crossbow",
    fill: 0.92,
    match: (u) => faction(u, "orcArmy") && has(u, "crossbow"),
  },

  // --- Generic archetypes ------------------------------------------------
  // What a faction nobody has dressed yet musters as.
  { kind: "cavalry.wolfRiders", fill: 0.95, match: mounted },

  // Large and Colossal units deliberately fall through to nothing rather than
  // to infantry: twenty footmen standing in for a Triceratops Herd is worse
  // than the card face they replaced.
  {
    kind: null,
    fill: 1,
    match: (u) => keyworded(u, "colossal") || keyworded(u, "large"),
  },

  { kind: "infantry.spear", fill: 0.92, match: (u) => armedWith(u) === "spear" },
  { kind: "infantry.bow", fill: 0.92, match: (u) => armedWith(u) === "bow" },
  { kind: "infantry.sword", fill: 0.92, match: (u) => armedWith(u) === "sword" },
  { kind: "infantry.axe", fill: 0.92, match: () => true },
];

/** The creature kind for a unit, or null if nothing is modelled for it. */
export const creatureKindFor = (unit) => {
  if (!unit) return null;
  const found = KINDS.find(({ match }) => match(unit));
  return found?.kind ? found : null;
};

/** Whether the board has figures for this unit at all. */
export const hasCreature = (unit) => Boolean(creatureKindFor(unit));
