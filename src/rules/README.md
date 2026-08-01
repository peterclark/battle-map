# src/rules — vendored from BattleDeck

Everything in this directory is a **verbatim copy** of the rules layer from
[`peterclark/battledeck`](https://github.com/peterclark/battledeck), the
tap-friendly attack calculator for *Battleground: Fantasy Warfare*. Nothing
here is edited locally.

| Here | In BattleDeck | What it is |
| --- | --- | --- |
| `derive.js` | `src/derive.js` | The attack math: dice clamping, roll clamping, Overkill |
| `modifiers.js` | `src/constants.js` | The situational-modifier cards and their `[dice, OS, OP]` triples |
| `data/` | `src/data/` | Every faction's unit cards, the keyword cards, and the helpers over them |

## Why a copy and not a dependency

BattleDeck is a private repo and publishes no package, so there is nothing to
depend on. Copying rather than forking is the deliberate choice: because these
files are never edited here, a card transcription fixed in BattleDeck reaches
this table by re-running the sync, with no merge to reason about.

```sh
node scripts/sync-rules.mjs ../battledeck
npm test
```

`src/engagement.test.js` asserts real printed numbers off real unit cards
(Trolls' Overkill, Goblin Spearmen's Spears bonus, Orc Swordsmen's stat line),
so a sync that changes a card's stats fails the suite loudly rather than
quietly changing what the table tells the players to roll.

## The line between the two apps

This directory answers *"given these numbers, what do I roll?"*. It knows
nothing about a board.

`src/engagement.js` — which is **not** vendored — answers *"what are the
numbers?"* by reading them off the board: how far apart the units stand, which
arc the attack comes from, how chewed up the attacker is, what the defender's
keywords are. It hands the result to `derive.js` and gets back the same three
numbers BattleDeck would have shown, had a player toggled every modifier by
hand.

That split is the whole point of the port. Keep new rules logic out of this
directory.
