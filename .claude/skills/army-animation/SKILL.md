---
name: army-animation
description: Build or revise the animated 3D figures a unit fields on the battle map — new armies, new creature kinds, or fixing figures that read poorly on the table. Use when asked to make a faction's units look right, add figures for units that only have card art, or adjust how figures move. Covers the top-down camera constraints, the roster/registry split, gaits, the performance budget, and how to verify at true stand scale.
---

# Animating an army

The board can show a unit two ways: its printed card, or modelled figures
standing on that card. This skill is about the second.

Read `docs/creature-brief.md` for the per-faction direction that has been
agreed so far. If the army you are working on is not in it, ask for a
paragraph of direction before sculpting — see *Getting direction* below.

## The one rule that is not negotiable

**The art must be original.** Never work from photographs of the printed
cards, and never reproduce Your Move Games' artwork. This is the rule
BattleDeck sets for itself in `scripts/generate-art.mjs`, and it is the
reason this project's art is its own. Work from the unit's *name*, its
*keywords*, its *stat line* and written direction. "Trog Spearmen, squat and
toad-like, 243 points, Spears" is enough to sculpt from. A photo is not
needed and must not be used.

## The camera looks straight down

This constraint dominates every decision, and violating it is the single
most common way a figure fails. The camera is orthographic, directly
overhead, because the table is a flat panel two players stand across and any
tilt favours whoever is on the low side.

**The board will not be tilted, and it is worth knowing why so nobody
re-proposes it.** Any tilt that gives figures volume necessarily favours one
long edge — there is no angle symmetric between the two seats, since the only
rotation that treats them equally is about the vertical and that adds no depth
at all. A tilt would also let tall figures hide short ones, differently for
each player, on a surface whose job is to let you judge contact and frontage
by eye. And straight down, screen position *is* board position; tilted, a
stand's footprint is a trapezoid and a finger on a tall figure lands nowhere
near the base it belongs to.

**The combat panel is the exception**, and it is exempt by construction rather
than by preference: it already opens on the edge belonging to whoever called
the attack, so a tilted portrait inside it is seen by the one player it is
for. `UnitPortrait.jsx` renders each engaged unit at 34° there. That is where
all the compensation in these rigs finally pays off — tilted, none of it is
needed and the models look like what they are.

What follows from that:

**A vertical object has no silhouette.** A spear held upright is a dot. An
axe held high is a dot. This has burned this project twice — spears at 66°
from vertical were invisible, and axes went the same way. Both had to be
shouldered, to roughly 29° and 50°. **Pose weapons for legibility, not for
accuracy.** A shouldered spear reads as a spear; a correctly-held one reads
as nothing.

**Breadth is what you have to work with.** Shields, cloaks, wings, crests,
fanned tails, splayed limbs — anything that presents area to a camera above
it. A shield is the most valuable thing an infantryman carries here, and it
is worth canting forward so it presents its face upward.

**A tail is the cheapest species read there is.** From directly above, a
tail extending behind a body says *reptile* before any other detail
registers. The same trick works for a wolf's brush, a cloak, a banner.

**A formation manufactures a silhouette out of parts that have none.** This
was the finding that decided the whole approach: a single figure built from
capsules reads as nothing from overhead, and twenty of the same capsules in
ranks read unmistakably as infantry. The decisive axis is *one body versus
many*, not hand-drawn versus sculpted. If a single figure is not reading,
consider whether it should be a formation instead of a better sculpt.

## The stand is wide and shallow, and that governs everything

The band a stand gives its figures is about **3.2" wide by 1.3" deep** — near
enough two and a half to one. `CreatureLayer` fits a rig against *both*, so
whichever runs out first sets the scale. A rig that is as deep as it is broad
fits its depth and then occupies a third of the width it was given, which
reads as a small unit rather than a badly-proportioned one — and that is why
it is easy to miss.

This has now caught the same mistake three times: the Large saurians, then
every war machine, then the Tyrannosaurus — which was the worst of them by
far. Straight out nose to tail it measured 3.9 wide by 11.3 deep, so it was
scaled to squeeze its own length into the shallow axis and came out at **a
seventh of the size its stand could carry**: a Colossal rendering smaller than
a spearman, with its tail across the banner.

**Build wide and shallow.** Short tails, compact bodies, broad axles, teams
harnessed close, formations spread across the front rather than stacked back
through the band. Length is the one thing there is no room for.

A quick check before sculpting: divide the intended width by the intended
depth. Under about 2:1 and the unit will come out smaller than it should.

Two levers when an animal is long by nature:

- **Curl it.** Sweep the tail hard to one side and turn the head the other, so
  the same length becomes width. It is what a sculptor does with a long animal
  on a shallow base, and it reads as alive rather than as a plank. The
  Tyrannosaurus went from 3.9 × 11.3 to 5.1 × 5.6 this way, at no cost. Give
  each joint a **rest** rotation and have the poser add its motion *on top*
  rather than overwrite it.
- **`depth` in `roster.js`**, which is `fill` for the front-to-back axis and
  lets a big creature overhang. `CreatureLayer` sends the excess off the front
  edge rather than back across the banner. Use it after curling, not instead
  of it: overhang past about one card depth starts covering the enemy's stand.

## Large units: where the detail belongs

The budget is allocated backwards by default, and it is worth seeing the two
numbers side by side:

| | meshes | figures | size on a 4K 55" panel |
|---|---|---|---|
| a spear block | 200 | 25 | ~30 px each |
| a Tyrannosaurus | 17 | 1 | ~280 px, alone |
| a Hill Giant | 13 | 1 | ~280 px, alone |

A Colossal costs about **7% of what a rank of foot costs** and gets roughly a
hundred times the pixels per creature. It is also the unit most likely to be
looked at closely. **Spend the geometry here.** On a single large creature,
detail merged into the buffers that already exist per joint costs nothing
measurable at all — only a new *articulated* part costs a mesh.

Three traps come with them, and all three were live on this board until the
large units were gone over deliberately.

**A lone monster has no formation to carry it, so its own colour has to do
the work.** A rank of twenty reads from its pattern whatever its palette; one
animal reads only if it separates from the turf. The Tyrannosaurus was
`0x3f5a2a` on a field of `0x3f6420` — a contrast ratio of **1.13**, which is
to say invisible, and it was the biggest thing in the game. Measure the
contrast rather than trusting the eye; the working numbers are that anything
under about 1.5 against the turf will disappear, and going *darker* than the
field works as well as going lighter. It is now countershaded — pale sand
flanks, a dark banded saddle, cream belly — at 2.33.

**Detail sunk inside its own parent is invisible, with nothing to show it is
there.** This is the one that cost the most time, because it looks like the
code never ran. `at()` applies scale *before* rotation, so a capsule declared
with radius 1.15 and `scale: [1, 0.82, 1.05]` has its top surface at y = 1.21,
not the 0.94 the scale factor suggests. Every osteoderm, cross-band and flank
scute on the Tyrannosaurus was placed against the wrong number and buried; so
were the trolls' back plates, the Triceratops' spine plates, the Ancients'
growth rings and the dragons' dorsal ridge. **Work out where the surface
actually is, or place detail by angle** — `[r·sin(a), r·cos(a), z]` round the
body — which is self-correcting and reads better anyway.

**A rig's resting size is not the space it occupies.** `CreatureLayer` now
samples the three gaits at build time and places each rig by the box it
actually sweeps, because the gap is large: a spear block sweeps **39% deeper**
than it measures at rest, a Tyrannosaurus 23%. Before that, the excess was
drawn straight across the name banner. The lab reports both numbers — the
`swept by its gaits` line — so check it when a rig is long or its weapons
swing wide, and prefer motion that grows toward the tip of a chain rather than
swinging the whole chain.

## What actually reads from above

Ranked by how much silhouette they buy, which is roughly the reverse of how
much work they cost:

1. **Wings.** A spread wing is a broad flat membrane held out horizontally.
   Nothing else comes close, and a winged Colossal reads from across the
   table. Keep them spread even at rest — a dragon with folded wings is a
   lizard, and this project already has lizards.
2. **A frill or a crown.** A plate of pale bone behind the skull, laid nearly
   flat. The Triceratops is legible at any size because of it.
3. **A formation.** Twenty small silhouettes make a pattern where one makes
   nothing. Free, and available to any unit that fields more than a few.
4. **A cloak, a caparison, a shield, a carapace.** Any broad pale sheet
   turned upward. The High Elves are the most legible foot on the board and
   it is almost entirely their cloaks.
5. **A dorsal ridge or a mane.** One pale strip tracing the length of a body.
   Cheap and surprisingly strong.
6. **Everything else** — heads, weapons, faces, detail. Nearly worthless.

## Brutes: the shape with none of the above

Trolls, ogres, giants. One lump of roughly man-shaped meat: no formation, no
frill, no wings. Three things rescue them, and all three are width:

- **Hunch them hard.** Upright, a brute is a head and two shoulders. Bent
  forward it is a whole back.
- **Hang the arms wide and long.** Doubles the silhouette and reads as
  unmistakably inhuman proportion.
- **Put something pale across the shoulders** — hide, bone, moss, stone slab.
  Whatever it is thematically, its job is to be the bright thing on the
  widest part.

Three or four to a stand, never one. Even at this size the count carries more
than the modelling does; the Hill Giant is alone only because a giant that
came three to a stand would not be a giant.

## Value contrast beats detail

At true table scale a stand is 2.5" × 1.75" — about 165 × 115 px on a 4K
55" panel. Twenty figures in that space gives each one roughly 30 px. At
that size:

- Detail below about 4 px is wasted work.
- **A dark figure on the dark green field disappears.** The Orc Axemen block
  suffers from exactly this: `0x2f2a24` armour reads as a black lump. Give
  each figure at least one element that is clearly lighter or clearly darker
  than the turf beneath it — a pale shield face, a bone crest, a bright
  weapon head.
- Silhouette and value do the work. Texture and small geometry do not.

**Metal needs help.** The creature rigs get their surfaces from `kit.js`
rather than from `materials.js` — see *Detail without meshes* below — but the
constraint `materials.js` documents still governs both: image-based lighting
is *not* available here, because Three's prefiltered-environment path emits
GLSL that ANGLE and SwiftShader reject, and when it fails every standard
material in the scene fails to compile — the board goes black, not just the
reflections. So metals top out at 0.72 metalness and are carried by the key
and rim lights instead of by reflections. Do not reintroduce
`scene.environment` without testing on a strict validator first.

**Verify at stand scale, not at lab scale.** The lab shows a creature many
times the size it will be played at, where everything looks good. That is not
the test. The test is a screenshot of the actual board with the figures on
their stands. This project has already made the mistake of judging a creature
at lab scale and being wrong about it — twice, counting the Ancients.

`demo/creature-lab.html` takes `kind`, `gait`, `tilt`, `span` and `yaw`.
`span` narrows the camera to zoom in on one or two figures; `yaw` turns the
rig, which you will need — figures are modelled facing away from the camera
and most of the detail worth checking is on the front.

## Detail without meshes: merge the geometry

The budget below says mesh count is the constraint and triangles are not.
That has a consequence worth stating on its own, because it inverts how you
would normally add detail:

> Detail added as **separate meshes** costs the thing that is scarce.
> Detail merged into **one mesh** costs the thing that is free.

**`src/art/creatures/kit.js` is the toolkit, and every rig on the board is
built with it.** Do not go back to one-mesh-per-limb; there is nothing left in
the codebase to copy that pattern from.

### The rule

**One merged buffer per part that moves independently. Everything else inside
that part merges into it.**

A man has eight such parts — body, head, two thighs, two shins, shield, weapon
— so an infantryman is eight meshes, not nineteen. Before merging a part in,
check the *poser*: an upper arm that is never rotated belongs in the body
buffer, and a foot that never turns belongs in the shin's.

The buffers are built **once per block** and shared by every figure in it, so
twenty men still cost one man's worth of memory. Only the transforms differ.

An earlier draft of this section said merging was "wrong for a block of
twenty, where merging would forfeit per-figure posing". That is wrong and the
rebuild proved it: merging happens *within* a figure and the merged buffers
are then shared *across* figures, so posing is untouched and the saving
applies to the largest units on the board — which are exactly the ones that
needed it. Across all sixty-one kinds the pass went from **13,473 meshes to
6,111**, the worst single unit from 456 to 216, and the ten-unit benchmark
from ~3,600 meshes to 1,601 — with triangles slightly *up*, at 2.0M.

### Surfaces in one mesh

One mesh normally means one material, which would force skin, cloth, bone and
steel to look identical. `surfaceMaterial()` gets round that with two
mechanisms: **vertex colour** for the tint, and a **`surface` attribute**
carrying metalness and roughness, injected into MeshStandardMaterial's shader
by `onBeforeCompile`. So one merged mesh can hold matte bone and polished
steel and still light correctly, in one draw call.

There is exactly one such material for the whole board.

### Grade the metalness by area

`materials.js` explains why metalness tops out at 0.72 rather than 1. What it
does not say, and what the infantry rebuild learned the hard way, is that
**0.72 is only safe on small parts**. A blade or a brow band at 0.72 catches
the key light and flashes. A breastplate at 0.72 fills the middle of a figure
with a surface that has nothing to reflect, and the whole man goes black from
above. The tiers the rigs use:

| Tier | metalness / roughness | For |
|---|---|---|
| `PLATE` | 0.3 / 0.44 | breastplates, pauldrons, greaves, helm bowls |
| `BLADE` | 0.5 / 0.26 | blades, axe heads, spear points |
| `STEEL` | 0.68 / 0.3 | brow bands, bosses, finials, small fittings |
| `IRON` | 0.55 / 0.55 | sockets, ferrules, rims |

### Three traps that all look like lighting bugs

Each of these cost real time, and each presents as "the figures came out too
dark" or "the shading is wrong" rather than as what it is.

- **Double colour conversion.** `Color.set(0x6b727c)` already converts out of
  sRGB into the renderer's linear working space — the same thing
  `material.color` does with the same number. Converting again is a second
  gamma pass worth about two and a half stops. `kit.js` does not do it; do
  not add it back.
- **LatheGeometry winding.** A profile written top-down comes out inside-out
  and the object renders black. `turned()` normalises the direction, so write
  profiles whichever way reads naturally — but if you build a lathe by hand,
  order it bottom to top.
- **Double rotation on an extruded outline.** An outline can be laid down two
  ways, and the helpers are named for them: `flat` for things carried along a
  haft (width fore-and-aft, thickness side to side) and `prone` for things
  lying along the ground pointing forward (width across, thickness as height).
  Applying both stands a skull on edge. `prone` also means a **positive**
  rotation about X lifts the far end — the negative one buried a horse's head
  in the turf.

### Wheels, and rotating a group you already rotated

A wheel is the one part on this board where the axis is not a matter of taste,
and it caught both engine files at once. Three generators start on three
different axes — `CylinderGeometry` and `LatheGeometry` about Y,
`TorusGeometry` about Z — so a felloe, a hub and a tyre need *different*
quarter turns to arrive on the same axle. Turn them all the same way and they
agree with each other while sitting a quarter turn out on the vehicle, which
looks plausible in isolation and wrong the moment it is on a hull.

**Bake the axle onto X in the geometry, and let the poser roll `rotation.x`.**

The reason not to correct it with a rotation on the group instead is worth
knowing, because it is a general trap. Three's default Euler order composes as
`Rx · Ry · Rz`, so a group carrying `rotation.z = PI/2` to stand a wheel up and
then rolling on `rotation.y` applies the roll *after* the stand-up, about world
Y — the wheel yaws like a turntable rather than spinning. **Whenever a poser
animates a rotation on a group that already carries a fixed one, check the
order.** Bake the fixed part into the geometry and leave the group carrying
only what moves.

Both of these hid behind the solid-cylinder bug: while the spokes were buried
inside a disc there was nothing on a wheel that could show it was turning the
wrong way, or turning at all.

### Mottle everything

Every surface here used to be one flat colour, and that — not the geometry —
is the main reason figures read as plastic. Real hide, flesh, stone and timber
are blotchy, and the eye reads blotchiness as *material* long before it reads
any shape.

The usual answer is a texture map, and this pipeline cannot easily take one:
geometries are merged from a dozen generators whose UVs are unrelated, so a
shared map smears. `skin()` takes `mottle` and `mottleScale` instead, which
perturb the colour attribute that is already there with two octaves of noise
sampled from the vertex position. No UVs, no image, no memory, no second
material, and nothing to draw.

**`mottleScale` has to match the size of the thing.** The noise is sampled in
model units, so a limb 0.1 across needs a scale near 30 while a torso half a
unit across wants 9. Set it too low on a small part and the whole part lands
inside one lobe of the noise and just shifts colour uniformly, which looks
like nothing at all. Amounts of 0.12–0.2 are plenty; past that it reads as
camouflage.

Note that it varies **roughness** as well as colour, and on flesh that does
more work than the colour does — damp patches read as damp.

### The shape vocabulary

Once merging is on the table, stop reaching for capsules and boxes:

| `kit.js` helper | Use it for |
|---|---|
| `bevelled(points, depth)` | timber, plate, blades, shield boards, cloaks, wings. The bevel catches the key light along the edge, which is what makes a slab read as a made object. |
| `turned(profile)` | anything turned in life — helm bowls, drums, hubs, bosses, pommels, horns, hooves, beards. |
| `swept(points, radius)` | rope, reins, chain, bowstrings, ribs, straps. |
| `TorusGeometry` | rims, tyres, belts, brow bands, collars. |
| `OctahedronGeometry` | osteoderms and scutes — a dotted pale line along a flank is what scaly hide looks like when it is too small to model. |

### What the freed budget actually bought

Worth reading as a list of what "detail" means at this scale, because most of
it is not what you would guess:

turned helms with brow bands and nasals; domed shield boards with raised rims
and turned bosses; forged axe heads with a beard and a horn; leaf-bladed
spears with pennons; crossbows with tillers, nuts and strings; recurve bows
with strings on them; bridles, reins, girths and saddles; lance vamplates;
spiked collars and hackles on war-wolves; knotted muscle and torn hide mantles
on brutes; ribcages surfacing out of the Abomination; osteoderms and crests on
lizardfolk; scalloped frills; wing membranes with finger spars and a scalloped
trailing edge; and — the one that had been wrong since the day it was built —
**wheels with visible spokes**, because the spokes had always been modelled
inside a solid cylinder and every wheel on the board had been rendering as a
plain dark circle.

## How the pieces fit together

Three files, and the split matters:

| File | Holds | Loads Three.js |
|---|---|---|
| `src/art/creatures/roster.js` | which *kind* a unit fields, and how much of its stand to fill | no |
| `src/art/creatures/registry.js` | which *builder* each kind maps to | yes |
| `src/art/creatures/kit.js` | the shared toolkit: `at`, `part`, `merge`, `surfaceMaterial`, `bevelled`, `turned`, `swept` | yes |
| `src/art/creatures/<name>3d.js` | the builder and poser themselves | yes |

`roster.js` must stay free of Three.js. The board asks "does this unit have
figures?" on every frame in card mode too, and that question has to be
answerable without loading a renderer. Breaking this puts 600 KB back into
the app's own bundle.

`CreatureLayer.jsx` does the rest: it scales each rig to the stand it
occupies by measuring its bounding box, so builders can model at whatever
size reads best on their own.

## Adding a creature kind

1. **Write the builder** in `src/art/creatures/<name>3d.js`, exporting
   `build<Name>()` and `pose<Name>(rig, time, state)`.
   - Model facing **-Z**, standing on **y = 0**. `CreatureLayer` handles
     board placement and heading.
   - Build with `kit.js`, one merged buffer per part that moves independently,
     and share those buffers across every figure in the unit. Twenty men cost
     one man's worth of memory; only the transforms differ. See
     `infantry3d.js` for the pattern and *Detail without meshes* for the rule.
   - **Prefer a parameter to a new file.** Fifty-seven creature kinds come
     out of nine rigs, and adding an army is mostly adding rows to tables. A spearman and an archer are the
     same skeleton carrying different things; `infantry3d.js` covers four
     weapons and three palettes in one rig. A second copy of a rig drifts
     from the first the day someone fixes a bug in only one of them.
   - Return the parts the poser needs: `{ root, ... }`.
   - **A poser must not touch anything on `root`** — not `scale`, not
     `position`, not `rotation`. `CreatureLayer` owns all three: the scale is
     what fits the rig to its stand, and the position is what places it inside
     the card's art field rather than over the name banner. A poser that
     writes either silently discards that placement, every frame, and the
     symptom looks like a layout bug rather than an animation one. Move a
     child group instead. Two rigs have shipped with this: the cavalry wrote
     `root.scale` and straddled half the board, and the Tyrannosaurus wrote
     `root.position.z` for its lunge and sat with its tail across the banner.
2. **Add the kind** to `KINDS` in `roster.js`, with a `match` predicate and
   a `fill`. Order matters — named units first, archetypes after. Below 1,
   figures sit inside the printed edge; above 1 they overhang, which is what
   makes a monster read as a monster.
3. **Point the kind at the builder** in `registry.js`.
4. **Verify** — see below.

## Gaits

Every poser takes a state. The board supplies it from what it already knows:
`attack` if the unit is in the open engagement, `march` if it has moved from
its order anchor this turn, `idle` otherwise.

A `GAITS` table of scalar multipliers, with the pose written once in terms of
those scalars, is how the existing builders do it and is worth copying.

**Phase, not lockstep.** Give every figure in a block its own phase, hashed
from its position, spread tightly around a common rhythm. Perfect unison
reads as a machine; random phase reads as a crowd; a tight spread reads as
soldiers. Never use `Math.random()` — jitter must be stable across frames or
the block shimmers.

## The performance budget

Measured on the target Mac mini, shadows on, ten units on the board — a
1,250-point army is about five units, so ten is a full game.

| | before the merge | after the merge |
|---|---|---|
| CPU, at native 4K | 6ms | **3ms** |
| of which posing 200 figures | ~1ms | **below the timer's resolution** |
| meshes | ~3,600 | **1,601** |
| submitted draw calls | ~7,200 | **3,201** |
| triangles | 1.9M | 2.0M |

Against a 16.7ms frame budget, so CPU is now about a fifth of the frame. That
is what halving the mesh count predicted, and it confirms that submit cost
tracks meshes rather than geometry.

Two measurements now say the same thing from opposite directions: the density
pass quadrupled triangles for nothing, and the merge pass halved meshes for
half the CPU.

**The board is not GPU-bound, and 4K is free.** Run at 1280×720 and at
3840×2160 the numbers are the same — 3ms of CPU either way, and a frame time
of 16–17ms, which is the vsync cap in every case rather than a real
difference. Nine times the pixels and two million triangles cost nothing
measurable on this machine. Everything that matters here is on the CPU side,
submitting draws.

That held across three runs, one of them against the built and deployed site
rather than the dev server. **A production build measures the same as `npm run
dev`**, which is worth knowing before anyone goes looking for a difference:
the cost is in the renderer, not in the module graph, so minification and
bundling move none of it.

Two things the runs still do not show. A frame time at the vsync cap proves
the board has GPU headroom without saying how much. And `poseMsMedian` comes
back as 0 because browsers coarsen `performance.now()` — read that as "too
small to measure", not as free.

Headroom is real but not unlimited. Rules of thumb:

- **~8 meshes per figure, ~20 figures per unit.** It was ~20 meshes a figure
  before the merge pass.
- Doubling to twenty units reached 90% of budget *at the old mesh counts*. The
  same twenty would now sit near 6ms, so the ceiling is real but has moved out
  by about a factor of two — and it is a ceiling on **meshes**, not on pixels
  or triangles.
- Pose cost is not the constraint; **mesh count is**. If you need more
  figures, cut meshes per figure rather than reaching for instancing.
- **Triangles are cheap; meshes are not.** The density pass took the rigs from
  344k triangles to 1.9M for ten units with the mesh and draw-call counts
  unchanged, and cost nothing. The merge pass then took the *meshes* from
  ~3,600 to 1,601 while triangles went slightly up again, and halved the CPU.
  Two measurements, one conclusion: spend segments freely, and count meshes.
  See **Detail without meshes** above.
- Shadows cost about 1.5ms at real board size. Keep them — they are what
  makes figures sit on the ground rather than float above it.

`demo/bench.html?units=10` measures this, and it takes `width` and `height`.
It must be run on the target hardware; a headless container uses a software
rasteriser and its frame times mean nothing. Run it at the panel's real
resolution — `&width=3840&height=2160` — since that is the only setting whose
GPU figure means anything, and compare the CPU number, which is
resolution-independent and is the part that transfers between machines.

## Verifying

Always do both:

1. **The lab** — `demo/creature-lab.html?kind=<kind>` for working on a
   creature in isolation, where you can actually see what you are doing. It
   is driven by the registry, so every kind appears there automatically.
2. **The board at stand scale** — build, preview, drive the app to the
   battlefield, flip the toggle to Figures, and screenshot. This is the only
   test that counts. Use a large viewport (3200 × 1800 or more) so a stand
   renders near its true size, and clip the screenshot to a few stands
   rather than squinting at the whole board.

Check specifically:

- Can you tell what the unit *is* from the silhouette alone?
- Does it read against the turf, or vanish into it?
- Are the weapons visible?
- Does it stay inside its stand, and does it turn with it?
- Do the three gaits look different from each other?

## Getting direction

If the faction has no entry in `docs/creature-brief.md`, ask for a paragraph
before building. What is useful:

- **Body plan** — upright, hunched, quadruped, serpentine
- **Proportions** — squat and broad, tall and lean
- **The distinguishing feature** — crest, tail, carapace, extra limbs
- **Palette** — and remember it has to hold up against dark green turf
- **How the breeds within a faction differ** from each other

What is not useful, and must not be requested: photographs of the printed
cards.

Write what you are told into `docs/creature-brief.md` before building, so
the next revision starts from the agreed direction rather than re-deriving
it.
