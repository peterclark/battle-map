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

  // Then the archetypes, read off the card the same way `cardFace.js` reads
  // it, so a faction nobody has modelled yet still musters something.
  {
    kind: "wolfRiders",
    fill: 0.95,
    match: (u) => keyworded(u, "cavalry") || has(u, "rider"),
  },

  // Large and Colossal units deliberately fall through to nothing rather
  // than to infantry: twenty footmen standing in for a Triceratops Herd is
  // worse than the card face they replaced.
  {
    kind: null,
    fill: 1,
    match: (u) => keyworded(u, "colossal") || keyworded(u, "large"),
  },

  { kind: "infantry", fill: 0.92, match: () => true },
];

/** The creature kind for a unit, or null if nothing is modelled for it. */
export const creatureKindFor = (unit) => {
  if (!unit) return null;
  const found = KINDS.find(({ match }) => match(unit));
  return found?.kind ? found : null;
};

/** Whether the board has figures for this unit at all. */
export const hasCreature = (unit) => Boolean(creatureKindFor(unit));
