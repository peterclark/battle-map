import React from "react";
import ReactDOM from "react-dom/client";
import Battlefield from "../src/table/Battlefield.jsx";
import CreatureLayer from "../src/table/CreatureLayer.jsx";
import { UNITS, UNITS_BY_UID } from "../src/rules/data/index.js";
import {
  BOARD_HEIGHT_INCHES,
  BOARD_WIDTH_INCHES,
  sideById,
  unitStand,
} from "../src/table/board.js";
import { hasCreature } from "../src/art/creatures/roster.js";
import "../src/index.css";

// The board, laid out for photographing rather than for playing.
//
// Every unit issue opens with "screenshot the current figures at true stand
// scale", and the army-animation skill is blunt about why that and not the
// creature lab: the lab shows a creature many times the size it is played at,
// where everything looks good, and this project has already judged a creature
// there and been wrong about it twice.
//
// So this mounts the real `Battlefield` and the real `CreatureLayer`, with the
// real tokens, and only changes where the units stand: a grid with one unit per
// cell instead of two armies facing off, so no stand overlaps another and each
// can be cut out of the sheet on its own.
//
// It is a page rather than a Playwright script because the layout maths wants
// to live next to the board constants it depends on. `scripts/board-shoot.mjs`
// drives it.
//
//   ?units=undeadArmy/zombies,undeadArmy/abomination
//   ?faction=undeadArmy          every unit in one list
//   ?gait=idle|march
//
// Gaits come from token data, the way the board derives them: a unit that has
// moved from its order anchor is marching, one that has not is idle. `attack`
// is not offered, because the board reads it off the single open engagement and
// only the two units in it are fighting — a whole sheet of attacking units is
// not a state the board can be in.

// One cell per unit, sized for the largest stand on the board. A Colossal card
// is 1.55x a normal one, so 3.88 x 2.71 inches, and the cell leaves room around
// that for figures that overhang — `fill` above 1 is what makes a monster read
// as a monster, and an overhanging tail still belongs in the photograph.
const CELL_W_INCHES = 5.6;
const CELL_H_INCHES = 4.3;

// How far a marching unit has travelled from its anchor. Anything over 0.05
// reads as marching; this is comfortably clear of that and still leaves the
// unit inside its cell.
const MARCH_OFFSET_INCHES = 0.6;

const params = new URLSearchParams(location.search);

const requested = () => {
  const faction = params.get("faction");
  if (faction) return UNITS.filter((u) => u.factionId === faction);
  const uids = (params.get("units") ?? "").split(",").filter(Boolean);
  return uids.map((uid) => UNITS_BY_UID[uid]).filter(Boolean);
};

const units = requested();
const gait = params.get("gait") === "march" ? "march" : "idle";

// Fit the grid to the board rather than the other way round, so a long list
// stays on one sheet instead of running off the edge.
const MAX_COLUMNS = Math.max(1, Math.floor(BOARD_WIDTH_INCHES / CELL_W_INCHES));
const MAX_ROWS = Math.max(1, Math.floor(BOARD_HEIGHT_INCHES / CELL_H_INCHES));

// Squarish, not as wide as the board allows. Twelve units across a single
// eight-wide row makes a sheet five times wider than it is tall, and a
// before-and-after pair of those is unreadable side by side. Widen past square
// only when the list is too long to fit the board's rows.
const columns = Math.min(
  MAX_COLUMNS,
  Math.max(
    1,
    Math.ceil(Math.sqrt(units.length)),
    Math.ceil(units.length / MAX_ROWS)
  )
);
const rows = Math.max(1, Math.ceil(units.length / columns));

const gridWidth = Math.min(units.length, columns) * CELL_W_INCHES;
const gridHeight = rows * CELL_H_INCHES;
const originX = (BOARD_WIDTH_INCHES - gridWidth) / 2;
const originY = (BOARD_HEIGHT_INCHES - gridHeight) / 2;

// Where each unit's cell centre sits, in board inches.
const cellCentre = (index) => ({
  x: originX + (0.5 + (index % columns)) * CELL_W_INCHES,
  y: originY + (0.5 + Math.floor(index / columns)) * CELL_H_INCHES,
});

const tokens = units.map((unit, index) => {
  const { x, y } = cellCentre(index);
  // Facing north. A card faces the enemy, so it is upside down to the player
  // who owns it, and a sheet of upside-down cards is hard to read against a
  // unit list. Both facings occur in play and the figures are symmetric about
  // this choice, so the tie goes to the legible one.
  const facing = -Math.PI / 2;
  return {
    id: `shot:${unit.uid}`,
    unit,
    side: "one",
    color: sideById("one").color,
    x,
    y,
    facing,
    ...unitStand(unit),
    marked: 0,
    // The anchor is what the board measures a march from, so moving it back is
    // what makes the unit read as marching.
    orderX: x,
    orderY: gait === "march" ? y - MARCH_OFFSET_INCHES : y,
    orderFacing: facing,
    charged: false,
    routing: false,
    boxed: 0,
    lashed: false,
    ranks: 1,
  };
});

/**
 * What the driver needs to cut the sheet up, in CSS pixels.
 *
 * The board is fitted with `min(width / 48, height / 27)` and centred, so a
 * container at the board's own 48:27 leaves no letterboxing and the scale is
 * just the width over the board's. The page sizes itself that way, which is
 * what makes this arithmetic safe to repeat here.
 */
const report = (element) => {
  const pxPerInch = element.clientWidth / BOARD_WIDTH_INCHES;
  const used = Math.min(units.length, columns);
  window.__shoot = {
    pxPerInch,
    gait,
    // The grid, not the board. A dozen stands occupy a fifth of 48 by 27
    // inches, and a contact sheet that is four fifths empty turf is a sheet
    // nobody can compare against its pair.
    sheetClip: {
      x: originX * pxPerInch,
      y: originY * pxPerInch,
      width: used * CELL_W_INCHES * pxPerInch,
      height: rows * CELL_H_INCHES * pxPerInch,
    },
    // A stand is 2.5 x 1.75 inches, so this is what "true stand scale" came
    // out as. The skill's reference point is about 66 px per inch, which is a
    // 3200px-wide viewport.
    standPx: { w: 2.5 * pxPerInch, h: 1.75 * pxPerInch },
    units: units.map((unit, index) => {
      const { x, y } = cellCentre(index);
      return {
        uid: unit.uid,
        name: unit.name,
        // Whether the board has figures for this unit at all. A unit with none
        // photographs as a bare card, which is a real answer rather than a
        // failure, but the driver should not report it as a figure.
        hasFigures: hasCreature(unit),
        clip: {
          x: (x - CELL_W_INCHES / 2) * pxPerInch,
          y: (y - CELL_H_INCHES / 2) * pxPerInch,
          width: CELL_W_INCHES * pxPerInch,
          height: CELL_H_INCHES * pxPerInch,
        },
      };
    }),
  };
};

function Sheet() {
  const [tokenState, setTokenState] = React.useState(tokens);
  const frameRef = React.useRef(null);

  React.useEffect(() => {
    if (frameRef.current) report(frameRef.current);
  }, []);

  return (
    <div
      ref={frameRef}
      className="relative"
      style={{
        width: "100vw",
        // The board's own aspect. Matching it means `fitTransform` centres
        // nothing and board inches map to pixels by a single factor.
        height: `calc(100vw * ${BOARD_HEIGHT_INCHES} / ${BOARD_WIDTH_INCHES})`,
      }}
    >
      <Battlefield
        tokens={tokenState}
        onTokensChange={setTokenState}
        selectedId={null}
        onSelect={() => {}}
        onEngage={() => {}}
        engagement={null}
        figures
      />
      <CreatureLayer tokens={tokenState} engagement={null} enabled />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Sheet />);
