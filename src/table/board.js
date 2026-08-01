import { find, map, reject } from "lodash";
import { UNITS_BY_UID, damageBoxes } from "../rules/data/index.js";

// The board is measured in inches, the same unit the printed cards use, so
// a unit's Movement and its weapon's Range can be read straight off the card
// and drawn to scale. The screen is a window onto that inch grid.
// 48" × 27" is a four-foot table at 16:9 — the aspect of the panel or the
// projected image the board is drawn on, so the battlefield fills the
// surface instead of sitting in a letterbox.
export const BOARD_WIDTH_INCHES = 48;
export const BOARD_HEIGHT_INCHES = 27;

// The disc a unit occupies. The physical game uses rectangular stands of
// varying width; a disc is close enough for contact and arc checks and
// survives being spun by a finger, which a rectangle does not.
const RADIUS_BY_SIZE = { colossal: 2.2, large: 1.6, default: 1.15 };

export const unitRadius = (unit) => {
  if (unit.keywords?.includes("colossal")) return RADIUS_BY_SIZE.colossal;
  if (unit.keywords?.includes("large")) return RADIUS_BY_SIZE.large;
  return RADIUS_BY_SIZE.default;
};

// The two warbands that come set up on the table. Each is a deployment line
// facing the other across the board.
const DEPLOYMENTS = [
  {
    side: "hawkshold",
    name: "Men of Hawkshold",
    // Ember-lit steel for the men, so the two sides read apart at a glance
    // from a standing player's distance
    color: "#c9a227",
    accent: "#f2e7d0",
    facing: 0, // east, into the orcs
    x: 9,
    uids: [
      "menOfHawkshold/knights",
      "menOfHawkshold/greatSwordsmen",
      "menOfHawkshold/spearmen",
      "menOfHawkshold/longbowmen",
      "menOfHawkshold/militia",
    ],
  },
  {
    side: "orcs",
    name: "Orc Army",
    color: "#7a8f3c",
    accent: "#e3f0c0",
    facing: Math.PI, // west, into the men
    x: 39,
    uids: [
      "orcArmy/orcMarauders",
      "orcArmy/orcAxemen",
      "orcArmy/orcSpearmen",
      "orcArmy/goblinBowmen",
      "orcArmy/trolls",
    ],
  },
];

export const ARMIES = map(DEPLOYMENTS, ({ uids, ...army }) => army);

export const armyBySide = (side) => find(ARMIES, { side });

// Deal both warbands onto the table in their deployment lines.
export const initialTokens = () =>
  DEPLOYMENTS.flatMap(({ side, uids, x, facing }) => {
    const spacing = BOARD_HEIGHT_INCHES / (uids.length + 1);
    return map(uids, (uid, index) => {
      const unit = UNITS_BY_UID[uid];
      const y = spacing * (index + 1);
      return {
        id: `${side}:${uid}`,
        unit,
        side,
        x,
        y,
        facing,
        radius: unitRadius(unit),
        marked: 0,
        // Where this unit stood when the turn began — the anchor its
        // Movement allowance is measured from, and the position a rescinded
        // order returns it to
        orderX: x,
        orderY: y,
        orderFacing: facing,
        // Set once a unit's march this turn ends in contact with an enemy;
        // it is what earns the Charging modifier
        charged: false,
        routing: false,
        boxed: 0,
        lashed: false,
      };
    });
  });

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

// Keep a unit on the table
export const clampToBoard = (token, x, y) => ({
  x: Math.min(Math.max(x, token.radius), BOARD_WIDTH_INCHES - token.radius),
  y: Math.min(Math.max(y, token.radius), BOARD_HEIGHT_INCHES - token.radius),
});

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
