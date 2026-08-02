import { find, flatMap, map, range, reject, sumBy } from "lodash";
import { UNITS_BY_UID, damageBoxes } from "../rules/data/index.js";
import { CARD_INCHES_H, CARD_INCHES_W } from "../art/cardFace.js";

// 48" × 27" is a four-foot table at 16:9 — the aspect of the panel or the
// projected image the board is drawn on, so the battlefield fills the
// surface instead of sitting in a letterbox.
export const BOARD_WIDTH_INCHES = 48;
export const BOARD_HEIGHT_INCHES = 27;

// A unit stands on a rectangular card, the way the printed game does: the
// front edge is what a charge has to reach and what the arcs are measured
// from, which a disc cannot express. `halfWidth` runs along the front edge,
// `halfDepth` back from it along the unit's facing.
const SIZE_SCALE = { colossal: 1.55, large: 1.28, default: 1 };

export const unitStand = (unit) => {
  const scale = unit.keywords?.includes("colossal")
    ? SIZE_SCALE.colossal
    : unit.keywords?.includes("large")
      ? SIZE_SCALE.large
      : SIZE_SCALE.default;
  return {
    halfWidth: (CARD_INCHES_W / 2) * scale,
    halfDepth: (CARD_INCHES_H / 2) * scale,
  };
};

// The two seats at the table. A player's colour is theirs whatever faction
// they picked, because it is what tells the two warbands apart from a
// standing player's distance — a job the faction art cannot do from six feet
// up.
// The players stand at the two long edges, which is what makes the cards
// readable: a unit's card faces the enemy, so it faces away from its owner —
// and text drawn away from you on a table lying flat is text the right way up
// when you are the one standing behind it.
export const SIDES = [
  { side: "one", name: "Player One", color: "#ef9f27", edge: "north" },
  { side: "two", name: "Player Two", color: "#378add", edge: "south" },
];

export const sideById = (side) => find(SIDES, { side });

// --- Rosters -------------------------------------------------------------
// A roster is { uid: copies }. Points are what the army list is built
// against, so they are summed straight off the cards.

export const rosterUnits = (roster) =>
  flatMap(Object.entries(roster ?? {}), ([uid, copies]) =>
    map(range(copies), () => UNITS_BY_UID[uid]).filter(Boolean)
  );

export const rosterPoints = (roster) =>
  sumBy(Object.entries(roster ?? {}), ([uid, copies]) =>
    (UNITS_BY_UID[uid]?.points ?? 0) * copies
  );

export const rosterCount = (roster) =>
  sumBy(Object.values(roster ?? {}), (copies) => copies);

// --- Deployment ----------------------------------------------------------

// Both armies form up facing each other across the table. A line that would
// run off the board folds into a second rank behind the first, the way a
// player short of table edge would really deploy.
const deployLine = (units, { side, color, facing, baseY, direction }) => {
  // Cards stand shoulder to shoulder across the table's width; a line too
  // long for the edge folds into a second rank behind the first, the way a
  // player short of table edge would really deploy.
  const perRank = Math.max(
    1,
    Math.floor((BOARD_WIDTH_INCHES - 2) / (CARD_INCHES_W + 0.5))
  );
  const ranks = Math.ceil(units.length / perRank);

  return map(units, (unit, index) => {
    const rank = Math.floor(index / perRank);
    const fileIndex = index % perRank;
    const inThisRank = Math.min(units.length - rank * perRank, perRank);
    const spacing = BOARD_WIDTH_INCHES / (inThisRank + 1);
    const stand = unitStand(unit);
    const x = spacing * (fileIndex + 1);
    const y = baseY + direction * rank * (CARD_INCHES_H + 0.6);

    return {
      id: `${side}:${unit.uid}#${index}`,
      unit,
      side,
      color,
      x,
      y,
      facing,
      ...stand,
      marked: 0,
      orderX: x,
      orderY: y,
      orderFacing: facing,
      // Set once a unit's march this turn ends in contact with an enemy;
      // it is what earns the Charging modifier
      charged: false,
      routing: false,
      boxed: 0,
      lashed: false,
      ranks,
    };
  });
};

/**
 * Deal both warbands onto the table.
 *
 * `players` is { one: { factionId, roster }, two: { … } }.
 */
export const deployTokens = (players) => [
  ...deployLine(rosterUnits(players.one?.roster), {
    side: "one",
    color: sideById("one").color,
    facing: Math.PI / 2, // south, across the table into the enemy
    baseY: 4.5,
    direction: -1, // deeper ranks fall back toward this player's own edge
  }),
  ...deployLine(rosterUnits(players.two?.roster), {
    side: "two",
    color: sideById("two").color,
    facing: -Math.PI / 2, // north
    baseY: BOARD_HEIGHT_INCHES - 4.5,
    direction: 1,
  }),
];

export const tokenById = (tokens, id) => find(tokens, { id });

export const enemiesOf = (tokens, token) =>
  reject(tokens, (other) => other.side === token.side);

// How far this unit has already marched from where the turn found it
export const marchedInches = (token) =>
  Math.hypot(token.x - token.orderX, token.y - token.orderY);

// Clamp a proposed position to the unit's Movement allowance, measured from
// its order anchor — the board enforces the tape measure so the players
// don't have to.
export const clampToMovement = (token, x, y) => {
  const dx = x - token.orderX;
  const dy = y - token.orderY;
  const distance = Math.hypot(dx, dy);
  const allowance = token.unit.move ?? 0;
  if (distance <= allowance || distance === 0) return { x, y };
  const scale = allowance / distance;
  return { x: token.orderX + dx * scale, y: token.orderY + dy * scale };
};

// Keep a unit on the table. A card can be turned to any angle, so the margin
// is its own circumscribed reach rather than a fixed half-width.
export const clampToBoard = (token, x, y) => {
  const margin = Math.hypot(token.halfWidth, token.halfDepth);
  return {
    x: Math.min(Math.max(x, margin), BOARD_WIDTH_INCHES - margin),
    y: Math.min(Math.max(y, margin), BOARD_HEIGHT_INCHES - margin),
  };
};

// A new turn: every unit's Movement allowance resets to where it now stands,
// and the turn-scoped states clear the way BattleDeck's roster clears them.
export const withNewTurn = (tokens) =>
  map(tokens, (token) => ({
    ...token,
    orderX: token.x,
    orderY: token.y,
    orderFacing: token.facing,
    charged: false,
    lashed: false,
  }));

// Rescind this unit's order — it marches back to where the turn found it
export const withOrderRescinded = (token) => ({
  ...token,
  x: token.orderX,
  y: token.orderY,
  facing: token.orderFacing,
  charged: false,
});

export const withDamage = (token, marked) => ({
  ...token,
  marked: Math.min(Math.max(marked, 0), damageBoxes(token.unit)),
});
