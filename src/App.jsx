import { useCallback, useMemo, useState } from "react";
import { find, forEach, map, omit } from "lodash";
import classNames from "classnames";
import Battlefield from "./table/Battlefield.jsx";
import CombatPanel from "./CombatPanel.jsx";
import { MODIFIERS } from "./rules/modifiers.js";
import { preferredMode, resolveEngagement } from "./engagement.js";
import {
  ARMIES,
  initialTokens,
  withDamage,
  withNewTurn,
} from "./table/board.js";

export default function App() {
  const [tokens, setTokens] = useState(initialTokens);
  const [selectedId, setSelectedId] = useState(null);
  const [turn, setTurn] = useState(1);
  // { attackerId, defenderId, mode, overrides } — the attack currently on
  // the table. Only one at a time: two players resolve one engagement
  // together, then move on.
  const [engagement, setEngagement] = useState(null);

  const attacker = engagement && find(tokens, { id: engagement.attackerId });
  const defender = engagement && find(tokens, { id: engagement.defenderId });

  const result = useMemo(() => {
    if (!attacker || !defender) return null;
    return resolveEngagement(attacker, defender, {
      mode: engagement.mode,
      overrides: engagement.overrides,
      others: tokens,
    });
  }, [attacker, defender, engagement, tokens]);

  const handleEngage = useCallback(
    (attackerId, defenderId) => {
      const from = find(tokens, { id: attackerId });
      const to = find(tokens, { id: defenderId });
      if (!from || !to) return;
      setEngagement({
        attackerId,
        defenderId,
        mode: preferredMode(from, to),
        overrides: {},
      });
      setSelectedId(null);
    },
    [tokens]
  );

  // Switching stance drops any manual override belonging to the stance being
  // left — a Hard Cover tap has no meaning once the units are swinging axes.
  const handleModeChange = (mode) =>
    setEngagement((current) => {
      const overrides = { ...current.overrides };
      forEach(MODIFIERS, (mod, id) => {
        if (mod.category && mod.category !== mode) delete overrides[id];
      });
      return { ...current, mode, overrides };
    });

  const handleOverride = (id, value) =>
    setEngagement((current) => {
      // Tapping a modifier back to exactly what the board already asserted
      // hands control of it back to the board
      const boardValue = result?.auto.includes(id);
      const isBoardValue = typeof value === "boolean" && value === boardValue;
      return {
        ...current,
        overrides: isBoardValue
          ? omit(current.overrides, id)
          : { ...current.overrides, [id]: value },
      };
    });

  const handleMark = (tokenId, marked) =>
    setTokens((current) =>
      map(current, (token) =>
        token.id === tokenId ? withDamage(token, marked) : token
      )
    );

  const handleNewTurn = () => {
    setTokens(withNewTurn);
    setEngagement(null);
    setSelectedId(null);
    setTurn((current) => current + 1);
  };

  const handleReset = () => {
    setTokens(initialTokens());
    setEngagement(null);
    setSelectedId(null);
    setTurn(1);
  };

  return (
    <div className="flex h-full w-full flex-col bg-table-950">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-table-700 px-4 py-2">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-lg tracking-wide text-parchment-100">
            Battle Map
          </h1>
          <div className="flex items-center gap-3">
            {map(ARMIES, (army) => (
              <span
                key={army.side}
                className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-parchment-300"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: army.color }}
                />
                {army.name}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-parchment-400">
            Turn {turn}
          </span>
          <button
            type="button"
            onClick={handleNewTurn}
            className="plate px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
          >
            New Turn
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="plate px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
          >
            Redeploy
          </button>
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
        <Battlefield
          tokens={tokens}
          onTokensChange={setTokens}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onEngage={handleEngage}
          engagement={engagement}
        />
        {!engagement && (
          <p
            className={classNames(
              "pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px]",
              "uppercase tracking-wider text-parchment-400/70"
            )}
          >
            Drag a unit to march it · hold it and touch the board to turn it ·
            march into an enemy or tap one then the other to attack · double-tap
            to rescind the order
          </p>
        )}

        {/* The panel floats over the board rather than squeezing it: units
            must not shift underneath the players' hands when an engagement
            opens. */}
        {result && (
          <div className="absolute inset-x-0 bottom-0">
            <CombatPanel
              result={result}
              attacker={attacker}
              defender={defender}
              mode={engagement.mode}
              onModeChange={handleModeChange}
              overrides={engagement.overrides}
              onOverride={handleOverride}
              onMark={handleMark}
              onClose={() => setEngagement(null)}
            />
          </div>
        )}
      </main>
    </div>
  );
}
