# Battle Map

A digital war table for **Battleground: Fantasy Warfare** (Your Move Games).
Two armies stand on a shared surface — a TV lying flat under an IR touch
frame, or a projected image with the same frame around it — and both players
march their units with their hands. When two units engage, the table works out
the attack.

It is the table half of [BattleDeck](https://github.com/peterclark/battledeck).
BattleDeck is a calculator you hold: you tap in the dice, the Skill and Power
ranks, and every situational modifier, and it tells you what to roll. Battle
Map runs BattleDeck's rules core unchanged, but the board supplies the inputs
itself — because unlike a phone sitting next to the table, the table can see
the table.

## What the board works out on its own

March a regiment into an enemy and the engagement opens with the modifiers
already asserted, each one labelled with the board fact behind it:

- **Charging**, and which band — the unit marched into contact this turn, and
  the 4+/3− split comes off its attack dice
- **Flanking** and **Rear Attack** — from where the attacker stands in the
  defender's 90° arcs, which the board draws so nobody has to argue about them
- **Long Range** (7–14") and **Extreme Range** (15"+), and whether the shot is
  inside the weapon's printed range at all
- **In the Yellow** / **In the Red** — from the attacker's own damage track
- **Cavalry / Large / Colossal Target** — from the defender's keywords
- **Attack my Flank** / **Attack my Rear** — from *other* enemies in contact
  with the attacker, which only something seeing the whole board can spot
- **Foe Damaged**, **Foe Routing**

A unit's own card rules fire off those assertions the same way they do in
BattleDeck — Spears lose a die when charging and gain Skill against Cavalry,
archers take their penalty while Engaged — and each shows up as its own line
in the breakdown.

Everything the board asserts is marked with a gold rule and its reason. Tapping
any modifier overrules the board: it is a model of the game, and where the
model and the players disagree, the players are right.

## Getting to the table

A title screen, then both players choose from every faction BattleDeck has
transcribed, then each builds a list from that faction with a running points
total and how far it sits from the other's — the number two players actually
negotiate over. The pickers use BattleDeck's own UI: same plates, same stat
abbreviations, same damage track, same rules text under each unit, so a player
moving from the phone to the table does not have to relearn the screen.

## The cards

A unit is a card, not a counter. Each is drawn as SVG — a field of figures
seen from above, the unit's name on a banner, a bar of stat glyphs, the
green/yellow/red damage track and the standing-order disc — and blitted onto
the board as that unit's token. What a unit fields is read off its own card
rather than hand-listed: Cavalry get riders, Spears get long hafts, a Large or
Colossal unit gets a single behemoth instead of a rank, and archers form up
looser than heavy infantry.

The artwork is original. It follows the shape rank-and-file wargame cards have
used for decades, but nothing traces or derives from Your Move Games' printed
art — the same rule BattleDeck's own art script sets for itself.

Because a card is a rectangular stand, contact is a separating-axis test
between two oriented rectangles rather than two circles overlapping: a card
turned side-on reaches further than one presenting its narrow depth, exactly
as the printed stands do.

## Cards or figures

The header switches the board between the two. Cards are the default, because
every unit has one; figures are modelled army by army and a unit without a
sculpt keeps its card art rather than borrowing someone else's.

With figures on, a stand gives up its drawn ranks and keeps its banner, stat
bar and damage track — one army to a card, and the players still read what
they need off it. The figures stand in the band the ranks were drawn in.

Everything is built for a camera looking straight down, which is a harsher
constraint than it sounds: a spear held upright is a dot, a dark figure on
dark turf disappears, and a lone sculpt reads far worse than twenty of the
same parts in ranks. `.claude/skills/army-animation/` is the working guide,
and `docs/creature-brief.md` holds the agreed direction per faction.

Three.js loads on the first switch and not before, so a player who never turns
figures on never pays for them.

## Handling the table

| Gesture | What it does |
| --- | --- |
| Drag a card | March it. The board holds the tape measure — the march clamps to the unit's printed Movement, measured from where the turn found it |
| Hold a card, touch the board with a second finger | Turn it to face where you touched |
| March into an enemy | Opens the engagement, and counts as a charge |
| Tap your unit, then tap an enemy | Declares an attack without marching — this is how you shoot |
| Double-tap a unit | Rescind its order; it marches back to where the turn began |
| **New Turn** | Every unit's Movement allowance resets to where it now stands; charges and turn-scoped buffs clear |

Input is the Pointer Events API keyed by `pointerId`, so every contact the
touch frame reports is tracked independently and both players can march at the
same time without stealing each other's grip. A mouse arrives down the same
path, which is what makes this testable on a desk.

## Running it

```sh
npm install
npm run dev      # Vite dev server
npm test         # the engagement suite
npm run lint
npm run build    # production build to dist/
```

Node 20 (`.nvmrc`).

## Layout

```
src/
  engagement.js       board geometry -> BattleDeck modifiers -> the three numbers
  engagement.test.js  real printed numbers off real unit cards
  App.jsx             the screen flow, board state, turns, the open engagement
  CombatPanel.jsx     the cards, the three numbers, the breakdown, the grid
  UnitCard.jsx        one unit's stat bar and damage track
  art/
    cardFace.js       original SVG card art, and the damage-box geometry the
                      board draws its marks over
    cardImage.js      rasterises a card face once and caches it
    creatures/
      roster.js       which figures a unit fields -- no Three.js, so the board
                      can ask on every frame in card mode
      registry.js     which builder each kind maps to -- dynamically imported
      lizardfolk3d.js the Lizardmen: three peoples and their beasts
      infantry3d.js   the generic block of foot
      wolfRiders3d.js the generic cavalry
      trex3d.js       the Tyrannosaurus Rex, and the shared scene and camera
  setup/
    TitleScreen.jsx   BattleMap, and the way in
    ArmySelect.jsx    both players choose a faction
    UnitSelect.jsx    both players build a list, with running points
    UnitRow.jsx       one unit on the army list, BattleDeck's row layout
  table/
    board.js          the inch board, rosters, deployment, movement, turns
    Battlefield.jsx   canvas rendering and multi-touch pointer handling
    CreatureLayer.jsx the figures, on a second canvas sharing the board's frame
  rules/              VENDORED FROM BATTLEDECK — see src/rules/README.md
```

The board is modelled in inches, the unit the printed cards use, so a unit's
Movement and a weapon's Range are drawn to scale and read straight off the
card. 48" × 27" is a four-foot table at 16:9, the aspect of the panel or the
projected image it is drawn on.

The two players stand at the long edges, and that is what makes the cards
readable: a unit's card faces the enemy, so it faces away from its owner — and
text drawn away from you, on a table lying flat, is text the right way up when
you are the one standing behind it. Each player reads their own regiments
without the table having to take sides.

`src/rules/` is a verbatim copy of BattleDeck's rules layer and is never edited
here; `node scripts/sync-rules.mjs ../battledeck` re-copies it.

## Hardware

The app is a plain web page and assumes nothing beyond a browser with Pointer
Events, so either build works:

- **Flat TV table.** A 55" 4K panel laid flat on a leg frame, a 55" 10-point
  IR touch overlay on top, tempered glass over that. Avoid OLED — the panel
  sags when it lies flat.
- **Projection.** The same IR frame mounted around a projected image on a
  wall. IR frames sense an infrared grid rather than the display, so they work
  over any flat surface, and a vertical surface needs no protective glass.

## Known rough edges

- Only one engagement is open at a time.
- Command Cards are plumbed through `resolveEngagement` but have no UI yet.
- The standing-order disc is drawn on every card but nothing writes to it yet;
  orders are still something the players hold between them.
- Rosters live in memory, so a reload starts a fresh muster.
- Every stand is the same 2.5" × 1.75" card, scaled up for Large and Colossal.
  The physical game varies stand width by unit, so frontages are close rather
  than exact.
- Figures exist for the Lizardmen, plus generic infantry and cavalry and the
  Tyrannosaurus Rex. Every other faction falls back to those archetypes, and
  Large units other than the T-Rex keep their card art.
- The Orc Axemen block is too dark to read at stand scale against the turf and
  wants a palette pass.

## Credit

*Battleground: Fantasy Warfare* is a game by Your Move Games. The unit cards
transcribed under `src/rules/data/` are their work; this is an unofficial
table for playing it.
