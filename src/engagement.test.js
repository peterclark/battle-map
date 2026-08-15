import { describe, expect, it } from "vitest";
import { UNITS_BY_UID, damageBoxes } from "./rules/data/index.js";
import { stillStanding, unitStand } from "./table/board.js";
import {
  arcFrom,
  distanceInches,
  inContact,
  preferredMode,
  rangeBand,
  rangedReach,
  resolveEngagement,
  sideFrom,
} from "./engagement.js";

// Facings are radians, and the board's y axis runs down the screen, so a
// facing of 0 points right (+x) and PI/2 points down (+y).
const EAST = 0;
const SOUTH = Math.PI / 2;
const WEST = Math.PI;

// A regular stand is 2.5" along its front edge by 1.75" deep, so two cards
// meeting front to front touch at 1.75" between centres and are still inside
// the contact tolerance at 2".
const CONTACT_X = 2;
// Meeting edge-on across the front edge instead, the reach is 1.25" a side
const CONTACT_Y = 2.5;

const token = (uid, props) => {
  const unit = UNITS_BY_UID[uid];
  return {
    unit,
    x: 0,
    y: 0,
    facing: EAST,
    marked: 0,
    ...unitStand(unit),
    side: "attacker",
    ...props,
  };
};

describe("geometry", () => {
  it("measures distance in board inches", () => {
    expect(distanceInches({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("puts an attacker dead ahead of the defender in its front arc", () => {
    expect(arcFrom({ x: 0, y: 0, facing: EAST }, { x: 5, y: 0 })).toBe("front");
  });

  it("puts an attacker behind the defender in its rear arc", () => {
    expect(arcFrom({ x: 0, y: 0, facing: EAST }, { x: -5, y: 0 })).toBe("rear");
  });

  it("puts an attacker off the defender's shoulder in its flank arc", () => {
    expect(arcFrom({ x: 0, y: 0, facing: EAST }, { x: 0, y: 5 })).toBe("flank");
    expect(arcFrom({ x: 0, y: 0, facing: EAST }, { x: 0, y: -5 })).toBe("flank");
  });

  it("reads arcs relative to the defender's own facing", () => {
    expect(arcFrom({ x: 0, y: 0, facing: SOUTH }, { x: 0, y: 5 })).toBe("front");
  });

  it("bands range the way the modifier cards name it", () => {
    expect(rangeBand(6.9)).toBe("short");
    expect(rangeBand(7)).toBe("long");
    expect(rangeBand(14)).toBe("long");
    expect(rangeBand(15)).toBe("extreme");
  });
});

describe("contact between rectangular stands", () => {
  it("engages two cards meeting front to front", () => {
    const a = token("orcArmy/orcSwordsmen", { facing: EAST });
    expect(inContact(a, { ...a, x: CONTACT_X, facing: WEST })).toBe(true);
    expect(inContact(a, { ...a, x: 3.5, facing: WEST })).toBe(false);
  });

  it("reaches further across the front edge than through the depth", () => {
    const a = token("orcArmy/orcSwordsmen", { facing: EAST });
    // Both cards face east, so they meet along their long edges
    expect(inContact(a, { ...a, y: CONTACT_Y })).toBe(true);
    expect(inContact(a, { ...a, y: 3.2 })).toBe(false);
  });

  it("depends on how the cards are turned, not just how far apart they are", () => {
    const a = token("orcArmy/orcSwordsmen", { facing: EAST });
    const gap = 2.3;
    // Presenting its narrow depth, the second card is out of reach...
    expect(inContact(a, { ...a, x: gap, facing: WEST })).toBe(false);
    // ...but turned side-on, its long edge closes the same gap
    expect(inContact(a, { ...a, x: gap, facing: SOUTH })).toBe(true);
  });

  it("gives a Large stand a longer reach than a regular one", () => {
    const trolls = token("orcArmy/trolls", { facing: EAST }); // Large
    const goblins = token("orcArmy/goblinBowmen", { facing: WEST });
    expect(trolls.halfWidth).toBeGreaterThan(goblins.halfWidth);
    expect(inContact(trolls, { ...goblins, x: 2.3 })).toBe(true);
  });
});

describe("resolveEngagement — the printed numbers", () => {
  it("derives dice, hit and wound from the two cards alone", () => {
    // Orc Swordsmen (5 dice, OS 5, OP 5) charge-free into the front of Orc
    // Spearmen (DS 2, DP 3), so nothing modifies the roll.
    const attacker = token("orcArmy/orcSwordsmen", { x: 0, y: 0 });
    const defender = token("orcArmy/orcSpearmen", {
      x: CONTACT_X,
      y: 0,
      facing: WEST, // facing back at the attacker: front arc
      side: "defender",
    });

    const result = resolveEngagement(attacker, defender, { mode: "melee" });

    expect(result.arc).toBe("front");
    expect(result.engaged).toBe(true);
    expect(result.diceToRoll).toBe(5);
    expect(result.rollToHit).toBe(3); // OS 5 - DS 2
    expect(result.rollToWound).toBe(2); // OP 5 - DP 3
    expect(result.auto).toEqual([]);
  });

  it("clamps the roll to 5 and reports Overkill above it", () => {
    // Trolls (OP 7) against Goblin Bowmen (DP 1) is 6 — one point of Overkill
    const attacker = token("orcArmy/trolls", { x: 0, y: 0 });
    const defender = token("orcArmy/goblinBowmen", {
      x: 2.3,
      y: 0,
      facing: WEST,
      side: "defender",
    });

    const result = resolveEngagement(attacker, defender, { mode: "melee" });

    expect(result.rollToWound).toBe(5);
    expect(result.woundOverkill).toBe(1);
  });
});

describe("resolveEngagement — what the board asserts", () => {
  it("asserts Rear Attack when the attacker is behind the defender", () => {
    const attacker = token("orcArmy/orcSwordsmen", { x: 0, y: 0 });
    // Defender facing east with the attacker behind it to the west
    const defender = token("orcArmy/orcSpearmen", {
      x: CONTACT_X,
      y: 0,
      facing: EAST,
      side: "defender",
    });

    const result = resolveEngagement(attacker, defender, { mode: "melee" });

    expect(result.arc).toBe("rear");
    expect(result.auto).toContain("rearAttacking");
    // Rear Attack is +0/+1/+1, so both rolls improve by one
    expect(result.rollToHit).toBe(4);
    expect(result.rollToWound).toBe(3);
    expect(result.reasons.rearAttacking).toMatch(/rear/i);
  });

  it("asserts Flanking when the attacker is off the defender's shoulder", () => {
    const attacker = token("orcArmy/orcSwordsmen", { x: 0, y: 0 });
    const defender = token("orcArmy/orcSpearmen", {
      x: 0,
      y: CONTACT_Y,
      facing: EAST,
      side: "defender",
    });

    const result = resolveEngagement(attacker, defender, { mode: "melee" });

    expect(result.arc).toBe("flank");
    expect(result.auto).toContain("flanking");
    expect(result.rollToHit).toBe(4); // +1 OS
    expect(result.rollToWound).toBe(2); // Flanking carries no OP bonus
  });

  it("asserts the range band for a ranged attack", () => {
    const attacker = token("orcArmy/goblinBowmen", { x: 0, y: 0 });
    const defender = token("orcArmy/orcSpearmen", {
      x: 10,
      y: 0,
      facing: WEST,
      side: "defender",
    });

    const result = resolveEngagement(attacker, defender, { mode: "ranged" });

    expect(result.band).toBe("long");
    expect(result.auto).toContain("longRange");
    // OS 5 - DS 2 - 1 Long Range
    expect(result.rollToHit).toBe(2);
    expect(result.legal).toBe(true);
  });

  it("flags a shot beyond the weapon's printed range", () => {
    const attacker = token("orcArmy/goblinBowmen", { x: 0, y: 0 }); // range 14
    const defender = token("orcArmy/orcSpearmen", {
      x: 20,
      y: 0,
      side: "defender",
    });

    const result = resolveEngagement(attacker, defender, { mode: "ranged" });

    expect(result.outOfRange).toBe(true);
    expect(result.legal).toBe(false);
  });

  it("asserts the attacker's own damage state", () => {
    // Orc Swordsmen have 4 green boxes: a fifth mark puts them In the Yellow
    const attacker = token("orcArmy/orcSwordsmen", { x: 0, y: 0, marked: 4 });
    const defender = token("orcArmy/orcSpearmen", {
      x: CONTACT_X,
      y: 0,
      facing: WEST,
      side: "defender",
    });

    const result = resolveEngagement(attacker, defender, { mode: "melee" });

    expect(result.auto).toContain("inTheYellow");
    expect(result.diceToRoll).toBe(4); // 5 dice, -1 In the Yellow
  });

  it("asserts Charging and picks the band from the attacker's dice", () => {
    const attacker = token("orcArmy/orcSwordsmen", { x: 0, y: 0, charged: true });
    const defender = token("orcArmy/orcSpearmen", {
      x: CONTACT_X,
      y: 0,
      facing: WEST,
      side: "defender",
    });

    const result = resolveEngagement(attacker, defender, { mode: "melee" });

    // 5 attack dice, so the 4+ Charge band: +2 dice
    expect(result.auto).toContain("chargingFourOrMoreDice");
    expect(result.diceToRoll).toBe(7);
  });

  it("sees an enemy on the attacker's flank that isn't the one being fought", () => {
    const attacker = token("orcArmy/orcSwordsmen", { x: 0, y: 0, facing: EAST });
    const defender = token("orcArmy/orcSpearmen", {
      x: CONTACT_X,
      y: 0,
      facing: WEST,
      side: "defender",
    });
    // A second enemy in contact with the attacker's southern flank
    const harasser = token("orcArmy/goblinRaiders", {
      x: 0,
      y: CONTACT_Y,
      side: "defender",
    });

    const result = resolveEngagement(attacker, defender, {
      mode: "melee",
      others: [attacker, defender, harasser],
    });

    expect(result.auto).toContain("attackingToMyFlank");
    expect(result.diceToRoll).toBe(4); // 5 dice, -1
  });

  it("stops seeing a flanker once it has been destroyed", () => {
    const attacker = token("orcArmy/orcSwordsmen", { x: 0, y: 0, facing: EAST });
    const defender = token("orcArmy/orcSpearmen", {
      x: CONTACT_X,
      y: 0,
      facing: WEST,
      side: "defender",
    });
    // The same harasser as above, but every damage box is marked off
    const harasser = token("orcArmy/goblinRaiders", {
      x: 0,
      y: CONTACT_Y,
      side: "defender",
    });
    const dead = { ...harasser, marked: damageBoxes(harasser.unit) };

    const result = resolveEngagement(attacker, defender, {
      mode: "melee",
      others: stillStanding([attacker, defender, dead]),
    });

    expect(result.auto).not.toContain("attackingToMyFlank");
    expect(result.diceToRoll).toBe(5); // the full five: nothing is pinning it
  });

  it("fires a unit's own card ability off an asserted modifier", () => {
    // Goblin Spearmen carry the Spears keyword: -1 die when Charging
    const attacker = token("orcArmy/goblinSpearmen", {
      x: 0,
      y: 0,
      charged: true,
    });
    const defender = token("orcArmy/orcSpearmen", {
      x: CONTACT_X,
      y: 0,
      facing: WEST,
      side: "defender",
    });

    const result = resolveEngagement(attacker, defender, { mode: "melee" });

    // 6 dice, +2 Charging 4+, -1 Spears-while-charging
    expect(result.diceToRoll).toBe(7);
    expect(result.abilities).toHaveLength(1);
  });

  it("fires a Spears bonus off the defender's keywords", () => {
    const attacker = token("orcArmy/goblinSpearmen", { x: 0, y: 0 });
    // Goblin Wolf Riders are Cavalry — Spears get +1 OS against them
    const defender = token("orcArmy/goblinWolfRiders", {
      x: CONTACT_X,
      y: 0,
      facing: WEST,
      side: "defender",
    });

    const result = resolveEngagement(attacker, defender, { mode: "melee" });

    expect(result.rollToHit).toBe(5); // OS 5 - DS 1 + 1 Spears
  });
});

describe("resolveEngagement — players overrule the board", () => {
  it("lets a player switch off a modifier the board asserted", () => {
    const attacker = token("orcArmy/orcSwordsmen", { x: 0, y: 0 });
    const defender = token("orcArmy/orcSpearmen", {
      x: CONTACT_X,
      y: 0,
      facing: EAST, // rear arc
      side: "defender",
    });

    const result = resolveEngagement(attacker, defender, {
      mode: "melee",
      overrides: { rearAttacking: false },
    });

    expect(result.modifiers.rearAttacking.on).toBe(false);
    expect(result.auto).not.toContain("rearAttacking");
    expect(result.rollToHit).toBe(3); // back to the unmodified OS 5 - DS 2
  });

  it("lets a player switch on a modifier the board cannot see", () => {
    const attacker = token("orcArmy/goblinBowmen", { x: 0, y: 0 });
    const defender = token("orcArmy/orcSpearmen", {
      x: 5,
      y: 0,
      facing: WEST,
      side: "defender",
    });

    const result = resolveEngagement(attacker, defender, {
      mode: "ranged",
      overrides: { hardCover: true },
    });

    expect(result.rollToHit).toBe(1); // OS 5 - DS 2 - 2 Hard Cover
  });

  it("honours a stacking modifier's count", () => {
    const attacker = token("orcArmy/orcSwordsmen", { x: 0, y: 0 });
    const defender = token("orcArmy/orcSpearmen", {
      x: CONTACT_X,
      y: 0,
      facing: WEST,
      side: "defender",
    });

    const result = resolveEngagement(attacker, defender, {
      mode: "melee",
      overrides: { pinching: 2 },
    });

    // Pinching is +0/+1/+1 per stack, twice over
    expect(result.rollToHit).toBe(5);
    expect(result.rollToWound).toBe(4);
  });

  it("drops a modifier the rules say cannot coexist with another", () => {
    const attacker = token("orcArmy/goblinBowmen", { x: 0, y: 0 });
    const defender = token("orcArmy/orcSpearmen", {
      x: 16,
      y: 0,
      facing: WEST,
      side: "defender",
    });

    // The board asserts Extreme Range; a player asking for Long Range too
    // must not get both, because each card excludes the other.
    const result = resolveEngagement(attacker, defender, {
      mode: "ranged",
      overrides: { longRange: true },
    });

    expect(
      result.modifiers.longRange.on && result.modifiers.extremeRange.on
    ).toBe(false);
  });
});

describe("resolveEngagement — attack legality", () => {
  it("refuses a stance the unit has no profile for", () => {
    const attacker = token("orcArmy/orcSwordsmen", { x: 0, y: 0 }); // no ranged
    const defender = token("orcArmy/orcSpearmen", {
      x: 10,
      y: 0,
      side: "defender",
    });

    const result = resolveEngagement(attacker, defender, { mode: "ranged" });

    expect(result.legal).toBe(false);
    expect(result.profile).toBeNull();
  });

  it("picks melee in contact and shooting at a distance", () => {
    const attacker = token("orcArmy/goblinBowmen", { x: 0, y: 0 });
    expect(
      preferredMode(attacker, { ...attacker, x: CONTACT_X, facing: WEST })
    ).toBe("melee");
    expect(preferredMode(attacker, { ...attacker, x: 10 })).toBe("ranged");
  });

  it("falls back to melee for a unit that cannot shoot", () => {
    const attacker = token("orcArmy/orcSwordsmen", { x: 0, y: 0 });
    expect(preferredMode(attacker, { ...attacker, x: 10 })).toBe("melee");
  });
});

describe("pinching", () => {
  // A defender held front and back, with the attacker on its front edge and a
  // second unit behind it. One enemy to a side, so two enemies is two sides.
  const pincer = (extra = []) => {
    const attacker = token("orcArmy/orcSwordsmen", { x: 0, y: 0, facing: EAST });
    const defender = token("orcArmy/orcSpearmen", {
      x: CONTACT_X,
      y: 0,
      facing: WEST,
      side: "defender",
    });
    // Behind the defender, which faces west — so this one is on its rear edge
    const behind = token("orcArmy/goblinRaiders", {
      x: CONTACT_X * 2,
      y: 0,
      facing: WEST,
    });
    return { attacker, defender, others: [attacker, defender, behind, ...extra] };
  };

  it("counts sides rather than reading a card the players tapped", () => {
    const { attacker, defender, others } = pincer();
    const result = resolveEngagement(attacker, defender, { mode: "melee", others });

    expect(result.auto).toContain("pinching");
    expect(result.modifiers.pinching.count).toBe(1);
    // The reason names the unit doing the holding, so an asserted modifier is
    // never a black box
    expect(result.reasons.pinching).toContain("held by");
    expect(result.reasons.pinching).toContain(
      UNITS_BY_UID["orcArmy/goblinRaiders"].name
    );
  });

  it("leaves the card off when the attacker is the only one in contact", () => {
    const attacker = token("orcArmy/orcSwordsmen", { x: 0, y: 0, facing: EAST });
    const defender = token("orcArmy/orcSpearmen", {
      x: CONTACT_X,
      y: 0,
      facing: WEST,
      side: "defender",
    });

    const result = resolveEngagement(attacker, defender, {
      mode: "melee",
      others: [attacker, defender],
    });

    expect(result.auto).not.toContain("pinching");
    expect(result.modifiers.pinching.on).toBe(false);
    expect(result.modifiers.pinching.count).toBe(0);
  });

  it("stacks once per extra side, and counts only what is touching", () => {
    // Every side of the defender occupied — attacker in front, one behind, one
    // on each flank — plus a fifth unit sitting a stand's width beyond the
    // left-hand one, close enough to look involved and too far to be.
    const { attacker, defender, others } = pincer([
      token("orcArmy/goblinRaiders", { x: CONTACT_X, y: CONTACT_Y, facing: WEST }),
      token("orcArmy/goblinRaiders", { x: CONTACT_X, y: -CONTACT_Y, facing: WEST }),
      token("orcArmy/goblinRaiders", { x: CONTACT_X, y: CONTACT_Y * 2, facing: WEST }),
    ]);

    const result = resolveEngagement(attacker, defender, { mode: "melee", others });

    // Three, not four: the outlier is out of contact
    expect(result.pinchers).toHaveLength(3);
    expect(result.modifiers.pinching.count).toBe(3);
    expect(result.reasons.pinching).toContain("4 sides");
  });

  it("clamps a player's count to what the card can stack to", () => {
    const { attacker, defender, others } = pincer();

    const result = resolveEngagement(attacker, defender, {
      mode: "melee",
      others,
      overrides: { pinching: 9 },
    });

    // Overrides win over the board, but not over the printed rules
    expect(result.modifiers.pinching.count).toBe(3);
  });

  it("ignores a pincer that has been destroyed", () => {
    const { attacker, defender, others } = pincer();
    const dead = others.map((t) =>
      t === others[2] ? { ...t, marked: damageBoxes(t.unit) } : t
    );

    const result = resolveEngagement(attacker, defender, {
      mode: "melee",
      others: stillStanding(dead),
    });

    expect(result.auto).not.toContain("pinching");
  });

  it("is a melee modifier and stays off a shot", () => {
    const attacker = token("orcArmy/goblinBowmen", { x: 0, y: 0, facing: EAST });
    const defender = token("orcArmy/orcSpearmen", {
      x: 10,
      y: 0,
      facing: WEST,
      side: "defender",
    });
    const behind = token("orcArmy/goblinRaiders", {
      x: 10 + CONTACT_X,
      y: 0,
      facing: WEST,
    });

    const result = resolveEngagement(attacker, defender, {
      mode: "ranged",
      others: [attacker, defender, behind],
    });

    expect(result.auto).not.toContain("pinching");
  });

  it("hands the card back to the board when a player taps to agree with it", () => {
    const { attacker, defender, others } = pincer();
    const board = resolveEngagement(attacker, defender, { mode: "melee", others });
    // The board's claim is readable even once a player has overridden it,
    // which is what lets App tell "agrees with the table" from "insists"
    const overridden = resolveEngagement(attacker, defender, {
      mode: "melee",
      others,
      overrides: { pinching: 3 },
    });

    expect(board.asserted.pinching).toBe(1);
    expect(overridden.asserted.pinching).toBe(1);
    expect(overridden.modifiers.pinching.count).toBe(3);
    expect(overridden.auto).not.toContain("pinching");
  });
});

describe("sideFrom", () => {
  const target = token("orcArmy/orcSpearmen", { x: 0, y: 0, facing: EAST });

  it("names the edge an enemy is standing on", () => {
    expect(sideFrom(target, { x: 5, y: 0 })).toBe("front");
    expect(sideFrom(target, { x: -5, y: 0 })).toBe("rear");
    // y runs down the screen, so +y is clockwise of a unit facing east —
    // its own right
    expect(sideFrom(target, { x: 0, y: 5 })).toBe("right");
    expect(sideFrom(target, { x: 0, y: -5 })).toBe("left");
  });

  it("splits the flanks that arcFrom merges", () => {
    const left = { x: 0, y: -5 };
    const right = { x: 0, y: 5 };
    expect(arcFrom(target, left)).toBe(arcFrom(target, right));
    expect(sideFrom(target, left)).not.toBe(sideFrom(target, right));
  });
});

describe("rangedReach", () => {
  it("gives a shooter its printed range", () => {
    const bowmen = token("orcArmy/goblinBowmen", { x: 10, y: 10 });
    expect(rangedReach(bowmen, [bowmen])).toBe(
      UNITS_BY_UID["orcArmy/goblinBowmen"].ranged.range
    );
  });

  it("gives nothing to a unit that cannot shoot", () => {
    const swordsmen = token("orcArmy/orcSwordsmen", { x: 10, y: 10 });
    expect(rangedReach(swordsmen, [swordsmen])).toBe(null);
  });

  it("gives nothing to a shooter already in contact", () => {
    // A unit this close cannot make a ranged attack, so a reach drawn round
    // it would invite an attack the board would then refuse
    const bowmen = token("orcArmy/goblinBowmen", { x: 0, y: 0, facing: EAST });
    const enemy = token("orcArmy/orcSwordsmen", {
      x: CONTACT_X,
      y: 0,
      facing: WEST,
      side: "defender",
    });

    expect(rangedReach(bowmen, [bowmen, enemy])).toBe(null);
    // A friend standing just as close is not a reason to stop shooting
    const friend = { ...enemy, side: "attacker" };
    expect(rangedReach(bowmen, [bowmen, friend])).toBeGreaterThan(0);
  });

  it("agrees with the resolver about who is in range", () => {
    const bowmen = token("orcArmy/goblinBowmen", { x: 0, y: 0, facing: EAST });
    const reach = rangedReach(bowmen, [bowmen]);

    const inside = token("orcArmy/orcSwordsmen", {
      x: reach - 0.5,
      y: 0,
      side: "defender",
    });
    const outside = token("orcArmy/orcSwordsmen", {
      x: reach + 0.5,
      y: 0,
      side: "defender",
    });

    expect(
      resolveEngagement(bowmen, inside, { mode: "ranged", others: [] }).outOfRange
    ).toBe(false);
    expect(
      resolveEngagement(bowmen, outside, { mode: "ranged", others: [] }).outOfRange
    ).toBe(true);
  });
});
