# Third-party assets

These live under `demo/` and are used only by the animation spike page. **None
of them ship in the app**, which has no 3D dependency and loads no models.

## Fox.glb

A rigged, skinned quadruped with three animation clips (`Survey`, `Walk`,
`Run`), used as a **stand-in** in `demo/trex-lab.html` to answer one question:
whether an artist's model is worth buying compared with geometry built by hand.
It is a fox rather than a tyrannosaur because the model marketplaces are not
reachable from the build environment and this was the nearest freely licensed
model that is genuinely artist-rigged.

Taken from the Khronos glTF Sample Assets repository:
<https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox>

| Part | Author | Licence |
| --- | --- | --- |
| Model | PixelMannen | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/legalcode) |
| Rigging & animation | tomkranis | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode) |
| Conversion to glTF | @AsoboStudio and @scurest | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode) |

CC BY 4.0 requires attribution, which is why this file exists and why the
credit is also printed on the demo page itself.

## If a purchased model replaces it

`src/art/creatures/gltfCreature.js` is not specific to any animal. Swapping in
a bought T-Rex means changing the import and the clip-name map in
`demo/trex-lab.js`:

```js
import trexUrl from "./assets/YourTrex.glb";
const CLIPS = { idle: "Idle", march: "Walk", attack: "Attack" };
```

Sellers do not agree on clip names, so `creature.clipNames` reports what the
file actually contains — check the console if a swapped-in model stands still.

Delete this section and the Fox entry once nothing here is CC BY, and remember
that a purchased model carries its own licence, which usually forbids
redistribution. A commercial `.glb` committed to a public repository is a
licence breach in most cases; keep it out of git or keep the repository
private.
