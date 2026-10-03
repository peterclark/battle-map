# Swarm of Rats: PR #42 and alternate design

The before images are rendered from PR #42 at `c097cf8afc2d99eb94d68ab2a800d7986050bcd8`.
This branch builds on that implementation and retains its reference, merged
geometry, deterministic scatter, articulated tails, and three animation states.
The PR against main is a complete alternative to #42; merging both is unnecessary.

Open `index.html` through Vite for the comparison gallery. The PNGs are actual
Three.js renders, not generated concept art. The game card and rules are unchanged.

## Changes

- Charcoal and grey-green fur against darker earth, with dusty rose-grey tails.
- Skeletal variants have smaller flesh cores, external rib cages, dorsal spines,
  and bone-coloured skulls. Previously the rib arcs were mostly inside the torso.
- Eye sockets sit farther out on the skull; small fur tufts break the smooth pelts.
- More bodies and climbers; fewer hidden tail joints fund that density.
- A smaller earth patch stays beneath the bodies, reducing the exposed plate edge.
- A slightly wider scatter maintains the shallow footprint the art band needs.

| Measured in the creature lab | PR #42 | Alternate |
|---|---:|---:|
| Rats | 133 | 150 |
| Meshes | 184 | 189 |
| Triangles | 188,968 | 215,680 |
| Rest footprint | 3.79 × 1.40 | 3.85 × 1.43 |
| Sampled animated footprint | 3.89 × 1.57 | 3.98 × 1.61 |

The extra geometry is a ~14% triangle increase. Mesh count remains below 200.
These are geometry measurements, not a frame-rate benchmark.

## Captures

The board images use the existing capture driver at 66.7 px/inch, producing a
167 × 117 px stand. Idle and march captures settle for 1.5 seconds; their exact
animation phases can differ. The gallery enlarges the same source card pixels
3× without smoothing. Native captures are included for judging the actual size.

```sh
npm run board:shoot -- --units undeadArmy/swarmOfRats --label alternative-idle
npm run board:shoot -- --units undeadArmy/swarmOfRats --gait march --label alternative-march
```

The tilted lab captures use identical cameras, yaw 180°, idle gait, and a
Playwright-controlled clock advanced 1.25 seconds. Start Vite and then run:

```sh
npm run dev -- --port 5177
node scripts/swarm-design-shoot.mjs alternative http://localhost:5177
```

The lab images are for anatomy inspection; the board is the design acceptance
view. To reproduce the before images, run the same capture settings with
`swarm3d.js` from the snapshot above. The gallery overview images are screenshots
of its board and anatomy sections.

## Validation

`npm test` (62 passed), `npm run lint`, `npm run build`, and real-board idle/march
captures passed. The swarm checks cover animated footprint, ground clearance,
heading drift, density, mesh budget, and repeatable poses that preserve placement.
