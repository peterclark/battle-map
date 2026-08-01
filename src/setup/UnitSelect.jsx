import { map, omit } from "lodash";
import classNames from "classnames";
import { FaArrowLeft } from "react-icons/fa";
import { FACTIONS_BY_ID } from "../rules/data/index.js";
import { SIDES, rosterCount, rosterPoints } from "../table/board.js";
import UnitRow from "./UnitRow.jsx";

const PlayerColumn = ({ seat, player, opponentPoints, onChange }) => {
  const faction = FACTIONS_BY_ID[player.factionId];
  const points = rosterPoints(player.roster);
  const units = rosterCount(player.roster);
  const difference = points - opponentPoints;

  // A unit dropped to zero leaves the roster entirely rather than lingering
  // as a zero entry, so the points and unit counts stay honest
  const setCopies = (uid, copies) =>
    onChange(
      copies > 0 ? { ...player.roster, [uid]: copies } : omit(player.roster, uid)
    );

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-2" aria-label={seat.name}>
      <header
        className="sticky top-0 z-10 flex flex-col gap-1 border-b-2 bg-iron-900/95 pb-2 pt-1 backdrop-blur-sm"
        style={{ borderColor: seat.color }}
      >
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: seat.color }}
            aria-hidden
          />
          <h2 className="min-w-0 flex-1 truncate font-display text-sm font-bold uppercase tracking-[0.2em] text-bone-100">
            {faction?.name ?? seat.name}
          </h2>
        </div>
        <div className="flex items-baseline gap-3 pl-5 font-mono text-[11px]">
          <span className="font-display text-lg tracking-wider text-ember-400">
            {points} pts
          </span>
          <span className="text-bone-500">
            {units} unit{units === 1 ? "" : "s"}
          </span>
          {/* Battleground is played to an agreed points total, so what
              matters is not a cap but how far apart the two lists are */}
          {units > 0 && difference !== 0 && (
            <span
              className={difference > 0 ? "text-moss-300" : "text-blood-300"}
            >
              {difference > 0 ? "+" : ""}
              {difference} vs opponent
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-1.5">
        {map(faction?.abilities, ({ name, text }) => (
          <div
            key={name}
            className="border-l-2 border-ember-600 pl-2.5 text-[10px] leading-snug text-bone-500"
          >
            <span className="font-bold text-ember-500">{name}.</span> {text}
          </div>
        ))}
        {map(faction?.units, (unit) => {
          const uid = `${faction.id}/${unit.id}`;
          const copies = player.roster[uid] ?? 0;
          return (
            <UnitRow
              key={uid}
              unit={unit}
              copies={copies}
              onAdd={() => setCopies(uid, copies + 1)}
              onRemove={() => setCopies(uid, Math.max(copies - 1, 0))}
            />
          );
        })}
      </div>
    </section>
  );
};

/**
 * Both players build their list from their chosen faction, each column
 * carrying its own running points total and how far it sits from the other's
 * — the number two players actually negotiate over when agreeing a game.
 */
export default function UnitSelect({ players, onRosterChange, onBack, onConfirm }) {
  const ready =
    rosterCount(players.one.roster) > 0 && rosterCount(players.two.roster) > 0;

  return (
    <div className="flex h-full w-full flex-col bg-iron-900">
      <header className="flex shrink-0 items-center gap-3 border-b border-iron-500 px-4 py-2.5">
        <button
          type="button"
          onClick={onBack}
          className="plate flex h-9 w-9 items-center justify-center text-bone-300"
          aria-label="Back to army choice"
        >
          <FaArrowLeft />
        </button>
        <h1 className="flex-1 text-center font-display text-base font-bold uppercase tracking-[0.25em] text-ember-400">
          Muster your regiments
        </h1>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!ready}
          className={classNames(
            "plate px-5 py-2 font-display text-xs font-bold uppercase tracking-[0.2em]",
            ready && "plate-on-ember"
          )}
        >
          Take the field
        </button>
      </header>

      <div className="flex min-h-0 flex-1 gap-4 overflow-y-auto p-4">
        {map(SIDES, (seat) => {
          const other = seat.side === "one" ? "two" : "one";
          return (
            <PlayerColumn
              key={seat.side}
              seat={seat}
              player={players[seat.side]}
              opponentPoints={rosterPoints(players[other].roster)}
              onChange={(roster) => onRosterChange(seat.side, roster)}
            />
          );
        })}
      </div>
    </div>
  );
}
