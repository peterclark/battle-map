import { filter, forEach, includes, map, reduce, some } from "lodash";
import {
  MAX_DICE,
  deriveDice,
  deriveRoll,
  sumModifiers,
  sumTriples,
} from "./rules/derive.js";
import { MODIFIERS } from "./rules/modifiers.js";
import {
  activeAbilities,
  attackProfile,
  damageStatus,
} from "./rules/data/index.js";

// BattleDeck asks the player to toggle every situational modifier by hand,
// because a phone sitting next to the table can't see the table. This app
// IS the table: it knows where both units stand, which way they face, how
// far apart they are, and how chewed up they are. So the board asserts the
// modifiers it can see and leaves the rest to the players.
//
// Everything here is pure — board state in, the three numbers out — so the
// math is testable without a canvas and the rules stay in one place.

// The board is modelled in inches, the unit the printed cards use for
// Movement and Range. One inch of board is BOARD_SCALE screen pixels.
export const BOARD_SCALE = 22;

// A unit's front and rear arcs are the 90° wedges centred on its facing and
// its back; the two flanks take the rest. This is the standard Battleground
// arc split and it's what "Flanking" and "Rear Attack" key off.
const ARC_HALF_WIDTH = Math.PI / 4;

// Base contact in the physical game is edge-to-edge between two rectangular
// stands. The tolerance is the slack around that edge — enough that a finger
// on an IR frame does not have to land a card to the thousandth of an inch.
export const CONTACT_TOLERANCE_INCHES = 0.4;

export const distanceInches = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// A token's own axes: `forward` runs along its facing, out through the front
// edge; `side` runs along the front edge itself.
const axes = (token) => ({
  forward: { x: Math.cos(token.facing), y: Math.sin(token.facing) },
  side: { x: -Math.sin(token.facing), y: Math.cos(token.facing) },
});

// How far a stand reaches from its centre along an arbitrary direction
const extentAlong = (token, axis) => {
  const { forward, side } = axes(token);
  return (
    Math.abs((token.halfDepth ?? 0.875) * (forward.x * axis.x + forward.y * axis.y)) +
    Math.abs((token.halfWidth ?? 1.25) * (side.x * axis.x + side.y * axis.y))
  );
};

// Separating-axis test between two rectangular stands, each grown by half the
// contact tolerance. Two rectangles are apart only if some axis separates
// them; if none does, their edges are touching and the units are Engaged.
export const inContact = (a, b) => {
  const slack = CONTACT_TOLERANCE_INCHES / 2;
  const between = { x: b.x - a.x, y: b.y - a.y };
  const candidates = [axes(a).forward, axes(a).side, axes(b).forward, axes(b).side];
  return !candidates.some((axis) => {
    const gap = Math.abs(between.x * axis.x + between.y * axis.y);
    return gap > extentAlong(a, axis) + extentAlong(b, axis) + slack * 2;
  });
};

// Which of `target`'s arcs `origin` sits in — the angle from the target to
// the origin, measured against the way the target is facing.
export const arcFrom = (target, origin) => {
  const bearing = Math.atan2(origin.y - target.y, origin.x - target.x);
  // Normalised to (-PI, PI]: 0 = dead ahead of the target, ±PI = dead astern
  let offset = bearing - target.facing;
  offset = Math.atan2(Math.sin(offset), Math.cos(offset));
  const magnitude = Math.abs(offset);
  if (magnitude <= ARC_HALF_WIDTH) return "front";
  if (magnitude >= Math.PI - ARC_HALF_WIDTH) return "rear";
  return "flank";
};

// Which *edge* of a stand an enemy is on, rather than which arc. The arcs
// merge both flanks into one because the modifier cards treat them alike; a
// pinch does not, because two enemies on opposite flanks are on two sides and
// the board has to be able to draw them separately.
//
// The frame runs the same way the canvas draws it: +x across the front edge,
// y down the screen. A positive angular offset is therefore clockwise on
// screen, which for a unit facing up the board is its own right.
export const sideFrom = (target, origin) => {
  const bearing = Math.atan2(origin.y - target.y, origin.x - target.x);
  const offset = Math.atan2(
    Math.sin(bearing - target.facing),
    Math.cos(bearing - target.facing)
  );
  const magnitude = Math.abs(offset);
  if (magnitude <= ARC_HALF_WIDTH) return "front";
  if (magnitude >= Math.PI - ARC_HALF_WIDTH) return "rear";
  return offset > 0 ? "right" : "left";
};

/**
 * Every enemy in base contact with a unit.
 *
 * A stand has four sides and the rules allow one enemy on each, so the length
 * of this list is both a count of bodies and a count of sides — which is what
 * lets the Pinching modifier be derived from it directly. Pass only the
 * living: a destroyed unit standing where it fell pins nobody.
 */
export const engagedBy = (token, others) =>
  filter(
    others,
    (other) =>
      other !== token && other.side !== token.side && inContact(token, other)
  );

// The same list as the sides it occupies, for drawing.
export const contactSides = (token, others) =>
  map(engagedBy(token, others), (other) => sideFrom(token, other));

// Range bands as the modifier cards name them: 7–14" is Long Range, 15" and
// out is Extreme Range. Anything closer is unmodified short range.
export const rangeBand = (inches) => {
  if (inches >= 15) return "extreme";
  if (inches >= 7) return "long";
  return "short";
};

// Every modifier the board can assert on its own, with the board fact that
// justifies it. `reason` is shown to the players so an asserted modifier is
// never a black box — they can see why the table thinks it applies, and
// override it if the table is wrong.
const autoRules = [
  {
    id: "inTheYellow",
    reason: (ctx) => `${ctx.attacker.unit.name} is In the Yellow`,
    when: (ctx) => ctx.attackerStatus === "yellow",
  },
  {
    id: "inTheRed",
    reason: (ctx) => `${ctx.attacker.unit.name} is In the Red`,
    when: (ctx) =>
      ctx.attackerStatus === "red" || ctx.attackerStatus === "destroyed",
  },
  {
    id: "flanking",
    reason: (ctx) => `Attacking ${ctx.defender.unit.name}'s flank`,
    when: (ctx) => ctx.mode === "melee" && ctx.arc === "flank",
  },
  {
    id: "rearAttacking",
    reason: (ctx) => `Attacking ${ctx.defender.unit.name}'s rear`,
    when: (ctx) => ctx.mode === "melee" && ctx.arc === "rear",
  },
  // The attacker's own exposure: an enemy other than the one it is swinging
  // at, in contact with its flank or rear. The board can see these because
  // it can see every unit, not just the two in the engagement.
  {
    id: "attackingToMyFlank",
    reason: (ctx) => `${ctx.flankThreats[0]?.unit.name} is on the flank`,
    when: (ctx) => ctx.mode === "melee" && ctx.flankThreats.length > 0,
  },
  {
    id: "attackingToMyRear",
    reason: (ctx) => `${ctx.rearThreats[0]?.unit.name} is to the rear`,
    when: (ctx) => ctx.mode === "melee" && ctx.rearThreats.length > 0,
  },
  // The defender's exposure, which is the mirror of the two above: enemies
  // other than this attacker, in contact with the unit being attacked.
  //
  // This one is a count rather than a flag. One enemy per side, so a defender
  // held by three units is pinched on three sides and the card stacks twice —
  // hence `pinchers.length` rather than `true`, and the clamp to the card's
  // own `maxCount` lives in `buildModifierState`.
  {
    id: "pinching",
    reason: (ctx) =>
      ctx.pinchers.length === 1
        ? `${ctx.defender.unit.name} is also held by ${ctx.pinchers[0].unit.name}`
        : `${ctx.defender.unit.name} is engaged on ${ctx.pinchers.length + 1} sides`,
    when: (ctx) => (ctx.mode === "melee" ? ctx.pinchers.length : 0),
  },
  {
    id: "chargingFourOrMoreDice",
    reason: () => "Charged into contact with 4+ dice",
    when: (ctx) =>
      ctx.mode === "melee" && ctx.attacker.charged && ctx.baseDice >= 4,
  },
  {
    id: "chargingThreeOrLessDice",
    reason: () => "Charged into contact with 3 or fewer dice",
    when: (ctx) =>
      ctx.mode === "melee" && ctx.attacker.charged && ctx.baseDice < 4,
  },
  {
    id: "targetDamaged",
    reason: (ctx) => `${ctx.defender.unit.name} has taken damage`,
    when: (ctx) => ctx.mode === "melee" && ctx.defender.marked > 0,
  },
  {
    id: "targetRouting",
    reason: (ctx) => `${ctx.defender.unit.name} is routing`,
    when: (ctx) => ctx.defender.routing === true,
  },
  {
    id: "longRange",
    reason: (ctx) => `${ctx.distance.toFixed(1)}" — Long Range`,
    when: (ctx) => ctx.mode === "ranged" && ctx.band === "long",
  },
  {
    id: "extremeRange",
    reason: (ctx) => `${ctx.distance.toFixed(1)}" — Extreme Range`,
    when: (ctx) => ctx.mode === "ranged" && ctx.band === "extreme",
  },
  // The Cavalry keyword's ranged penalty. Melee attacks on cavalry take no
  // such hit, so this is asserted for shooting only.
  {
    id: "cavalryTarget",
    reason: (ctx) => `${ctx.defender.unit.name} is Cavalry`,
    when: (ctx) =>
      ctx.mode === "ranged" && includes(ctx.defender.unit.keywords, "cavalry"),
  },
  {
    id: "largeTarget",
    reason: (ctx) => `${ctx.defender.unit.name} is Large`,
    when: (ctx) => includes(ctx.defender.unit.keywords, "large"),
  },
  {
    id: "colossalTarget",
    reason: (ctx) => `${ctx.defender.unit.name} is Colossal`,
    when: (ctx) => includes(ctx.defender.unit.keywords, "colossal"),
  },
];

// Modifier cards rule each other out (you cannot be at both Long and Extreme
// Range, nor Charging while being hit in the rear). Whenever one is on, every
// id in its `disabled` list is forced off — the same guard BattleDeck's grid
// applies when a player taps two contradictory modifiers.
const withExclusionsResolved = (state) => {
  const resolved = { ...state };
  let changed = true;
  // One pass can switch a modifier off and thereby lift the exclusion it was
  // imposing, so settle to a fixed point rather than sweeping once.
  while (changed) {
    changed = false;
    forEach(resolved, (mod) => {
      if (!mod.on) return;
      forEach(mod.disabled, (id) => {
        if (resolved[id]?.on) {
          resolved[id] = { ...resolved[id], on: false, ...(resolved[id].maxCount ? { count: 0 } : {}) };
          changed = true;
        }
      });
    });
  }
  return resolved;
};

// Fold the board's assertions and then the players' overrides into a
// BattleDeck-shaped modifier record. Overrides win: the table is a model of
// the game, and where the model and the players disagree, the players are
// right.
const buildModifierState = (ctx, overrides) => {
  const asserted = {};
  const reasons = {};
  // A rule may claim a modifier outright or claim it a number of times over.
  // Anything falsy — `false` or a count of zero — is no claim at all.
  forEach(autoRules, ({ id, when, reason }) => {
    const claim = when(ctx);
    if (!claim) return;
    const max = MODIFIERS[id]?.maxCount;
    asserted[id] = max ? Math.min(Number(claim) || 1, max) : true;
    reasons[id] = reason(ctx);
  });

  let state = reduce(
    MODIFIERS,
    (acc, mod, id) => {
      const claim = asserted[id];
      const isOn = id === "reset" ? mod.on : Boolean(claim);
      acc[id] = {
        ...mod,
        on: isOn,
        ...(mod.maxCount ? { count: isOn ? Number(claim) : 0 } : {}),
      };
      return acc;
    },
    {}
  );

  forEach(overrides, (value, id) => {
    if (!state[id]) return;
    const on = typeof value === "number" ? value > 0 : Boolean(value);
    const count = typeof value === "number" ? value : on ? 1 : 0;
    state[id] = {
      ...state[id],
      on,
      // Clamped to what the card can actually stack to. Overrides win over the
      // board, but not over the printed rules.
      ...(state[id].maxCount ? { count: Math.min(count, state[id].maxCount) } : {}),
    };
  });

  state = withExclusionsResolved(state);

  // An assertion the exclusion pass switched back off is no longer the
  // board's claim, and an override that turned something off isn't either.
  const auto = filter(
    Object.keys(asserted),
    (id) => state[id]?.on && !(id in (overrides ?? {}))
  );
  // What the board claimed, kept separate from what came out. An override
  // hides the claim from `modifiers`, and the panel still needs it to know
  // when a player has tapped their way back to agreeing with the table.
  return { modifiers: state, auto, reasons, asserted };
};

// Label each non-zero contribution so the panel can show its working, the
// way BattleDeck's breakdown does.
const contributions = (modifiers, abilities, cards, index) => {
  const lines = [];
  forEach(filter(modifiers, "on"), (mod) => {
    const stack = mod.maxCount ? mod.count ?? 0 : 1;
    const amount = mod.modifier[index] * (mod.maxCount ? stack : 1);
    if (amount) lines.push({ label: mod.name.replace(/\n/g, ""), code: mod.code, amount });
  });
  forEach(abilities, (ability) => {
    const amount = ability.bonus[index];
    if (amount) lines.push({ label: ability.name, code: ability.code, amount });
  });
  forEach(cards, (card) => {
    const amount = card.mod[index];
    if (amount) lines.push({ label: "Command Card", code: card.id, amount });
  });
  return lines;
};

/**
 * Resolve an attack between two units standing on the board.
 *
 * `attacker` and `defender` are board tokens:
 *   { unit, x, y, facing, marked, radius, boxed, lashed, charged, routing }
 * where x/y/facing describe the token's position in inches and radians, and
 * `unit` is the BattleDeck unit record it was placed from.
 *
 * `options.others` is every other token on the board — used to spot enemies
 * on the attacker's flank and rear.
 */
export const resolveEngagement = (
  attacker,
  defender,
  { mode = "melee", overrides = {}, cards = [], others = [] } = {}
) => {
  const profile = attackProfile(attacker.unit, mode);
  if (!profile) {
    return { mode, profile: null, legal: false, reason: `${attacker.unit.name} has no ${mode} attack` };
  }

  const distance = distanceInches(attacker, defender);
  const band = rangeBand(distance);
  const engaged = inContact(attacker, defender);
  const arc = arcFrom(defender, attacker);

  // Enemies of the attacker, in contact with it, that aren't the unit it is
  // attacking — these are what expose its own flank and rear.
  const threats = filter(
    engagedBy(attacker, others),
    (other) => other !== defender
  );
  const threatArc = (want) =>
    filter(threats, (threat) => arcFrom(attacker, threat) === want);

  // And the same question asked of the defender: everyone else holding it in
  // place while this attacker swings. That is the pinch.
  const pinchers = filter(
    engagedBy(defender, others),
    (other) => other !== attacker
  );

  const ctx = {
    mode,
    attacker,
    defender,
    distance,
    band,
    arc,
    baseDice: profile.dice,
    attackerStatus: damageStatus(attacker.unit, attacker.marked ?? 0),
    flankThreats: threatArc("flank"),
    rearThreats: threatArc("rear"),
    pinchers,
  };

  const { modifiers, auto, reasons, asserted } = buildModifierState(ctx, overrides);

  // A Frightened unit and some special attacks refuse Command Cards outright
  const ccLocked = modifiers.frightened.on || Boolean(profile.noCommandCards);
  const playedCards = ccLocked ? [] : cards;

  const abilities = activeAbilities(
    attacker.unit,
    modifiers,
    mode,
    defender.unit,
    { boxed: attacker.boxed ?? 0, lashed: attacker.lashed === true }
  );

  const [modDice, modOS, modOP] = sumModifiers(modifiers);
  const [ccDice, ccOS, ccOP] = sumTriples(map(playedCards, "mod"));
  const [abilityDice, abilityOS, abilityOP] = sumTriples(map(abilities, "bonus"));

  // A locked-dice special attack pins the pool at its printed count
  const diceToRoll = profile.lockedDice
    ? Math.min(profile.dice, MAX_DICE)
    : deriveDice(profile.dice, ccDice, modDice + abilityDice);

  const hit = deriveRoll(
    profile.offensiveSkill - defender.unit.defensiveSkill + ccOS + modOS + abilityOS
  );
  const wound = deriveRoll(
    profile.offensivePower - defender.unit.defensivePower + ccOP + modOP + abilityOP
  );

  return {
    mode,
    profile,
    legal: mode === "ranged" ? !engaged && (!profile.range || distance <= profile.range) : engaged,
    engaged,
    distance,
    band,
    arc,
    outOfRange: mode === "ranged" && Boolean(profile.range) && distance > profile.range,
    diceToRoll,
    diceLocked: Boolean(profile.lockedDice),
    ccLocked,
    rollToHit: hit.value,
    hitOverkill: hit.overkill,
    rollToWound: wound.value,
    woundOverkill: wound.overkill,
    modifiers,
    auto,
    reasons,
    asserted,
    abilities,
    threats,
    pinchers,
    breakdown: {
      dice: [
        { label: "Attack Dice", code: "BASE", amount: profile.dice, base: true },
        ...contributions(modifiers, abilities, playedCards, 0),
      ],
      hit: [
        { label: "Offensive Skill", code: "OS", amount: profile.offensiveSkill, base: true },
        { label: `${defender.unit.name} Defensive Skill`, code: "DS", amount: -defender.unit.defensiveSkill },
        ...contributions(modifiers, abilities, playedCards, 1),
      ],
      wound: [
        { label: "Offensive Power", code: "OP", amount: profile.offensivePower, base: true },
        { label: `${defender.unit.name} Defensive Power`, code: "DP", amount: -defender.unit.defensivePower },
        ...contributions(modifiers, abilities, playedCards, 2),
      ],
    },
  };
};

// Which stance the board would pick for this pair: in contact it's a melee,
// apart it's a shot — falling back to whichever profile the unit actually has.
export const preferredMode = (attacker, defender) => {
  const contact = inContact(attacker, defender);
  const wanted = contact ? "melee" : "ranged";
  if (attackProfile(attacker.unit, wanted)) return wanted;
  return attackProfile(attacker.unit, "melee") ? "melee" : "ranged";
};

export const hasAnyAttack = (unit) => Boolean(unit.melee || unit.ranged);

export const anyThreatened = (token, others) =>
  some(others, (other) => other.side !== token.side && inContact(token, other));

/**
 * How far a unit can shoot from where it now stands, or `null` if it cannot
 * shoot at all.
 *
 * Three ways to get nothing back, and they are different situations that
 * happen to want the same answer on the table:
 *
 *   - no ranged profile. Most of the board: swordsmen, cavalry, monsters.
 *   - a ranged profile with no printed range. A handful of attacks are
 *     written without one, and `resolveEngagement` treats those as always in
 *     range, so there is no circle to draw.
 *   - in base contact with an enemy. A unit that close cannot shoot — the
 *     same `!engaged` test that decides whether a ranged attack is legal —
 *     and a reach drawn around it would be an invitation to an attack the
 *     board would then refuse.
 *
 * Measured from the unit's centre, because that is where `distanceInches`
 * measures from, and a ring that disagreed with the resolver about the range
 * would be worse than no ring.
 */
export const rangedReach = (token, others = []) => {
  const profile = attackProfile(token.unit, "ranged");
  if (!profile?.range) return null;
  if (anyThreatened(token, others)) return null;
  return profile.range;
};
