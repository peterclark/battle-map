import { describe, expect, it } from "vitest";
import { UNITS_BY_UID } from "./rules/data/index.js";
import {
  arcFrom,
  distanceInches,
  inContact,
  preferredMode,
  rangeBand,
  resolveEngagement,
} from "./engagement.js";

// Facings are radians, and the board's y axis runs down the screen, so a
// facing of 0 points right (+x) and PI/2 points down (+y).
const EAST = 0;
const SOUTH = Math.PI / 2;
const WEST = Math.PI;

const token = (uid, props) => ({
  unit: UNITS_BY_UID[uid],
  x: 0,
  y: 0,
  facing: EAST,
  marked: 0,
  radius: 1,
  side: "attacker",
  ...props,
});

describe("geometry", () => {
  it("measures distance in board inches", () => {
    expect(distanceInches({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("puts an attacker dead ahead of the defender in its front arc", () => {
    // Defender at the origin facing east; attacker further east
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
    // Same attacker position, defender turned to face it
    expect(arcFrom({ x: 0, y: 0, facing: SOUTH }, { x: 0, y: 5 })).toBe("front");
  });

  it("bands range the way the modifier cards name it", () => {
    expect(rangeBand(6.9)).toBe("short");
    expect(rangeBand(7)).toBe("long");
    expect(rangeBand(14)).toBe("long");
    expect(rangeBand(15)).toBe("extreme");
  });

  it("treats units within their combined footprints as engaged", () => {
    const a = { x: 0, y: 0, radius: 1 };
    expect(inContact(a, { x: 2.5, y: 0, radius: 1 })).toBe(true);
    expect(inContact(a, { x: 4, y: 0, radius: 1 })).toBe(false);
  });
});

describe("resolveEngagement — the printed numbers", () => {
  it("derives dice, hit and wound from the two cards alone", () => {
    // Orc Swordsmen (5 dice, OS 5, OP 5) charge-free into the front of Orc
    // Spearmen (DS 2, DP 3), so nothing modifies the roll.
    const attacker = token("orcArmy/orcSwordsmen", { x: 0, y: 0 });
    const defender = token("orcArmy/orcSpearmen", {
      x: 2.5,
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
      x: 2.5,
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
      x: 2.5,
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
      y: 2.5,
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
      x: 2.5,
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
      x: 2.5,
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
      x: 2.5,
      y: 0,
      facing: WEST,
      side: "defender",
    });
    // A second enemy in contact with the attacker's southern flank
    const harasser = token("orcArmy/goblinRaiders", {
      x: 0,
      y: 2.5,
      side: "defender",
    });

    const result = resolveEngagement(attacker, defender, {
      mode: "melee",
      others: [attacker, defender, harasser],
    });

    expect(result.auto).toContain("attackingToMyFlank");
    expect(result.diceToRoll).toBe(4); // 5 dice, -1
  });

  it("fires a unit's own card ability off an asserted modifier", () => {
    // Goblin Spearmen carry the Spears keyword: -1 die when Charging
    const attacker = token("orcArmy/goblinSpearmen", { x: 0, y: 0, charged: true });
    const defender = token("orcArmy/orcSpearmen", {
      x: 2.5,
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
      x: 2.5,
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
      x: 2.5,
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
      x: 2.5,
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
    const defender = token("orcArmy/orcSpearmen", { x: 10, y: 0, side: "defender" });

    const result = resolveEngagement(attacker, defender, { mode: "ranged" });

    expect(result.legal).toBe(false);
    expect(result.profile).toBeNull();
  });

  it("picks melee in contact and shooting at a distance", () => {
    const attacker = token("orcArmy/goblinBowmen", { x: 0, y: 0 });
    expect(
      preferredMode(attacker, { ...attacker, x: 2.5, side: "defender" })
    ).toBe("melee");
    expect(
      preferredMode(attacker, { ...attacker, x: 10, side: "defender" })
    ).toBe("ranged");
  });

  it("falls back to melee for a unit that cannot shoot", () => {
    const attacker = token("orcArmy/orcSwordsmen", { x: 0, y: 0 });
    expect(
      preferredMode(attacker, { ...attacker, x: 10, side: "defender" })
    ).toBe("melee");
  });
});
