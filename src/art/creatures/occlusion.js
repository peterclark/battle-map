import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// Ambient occlusion — the darkening where surfaces meet.
//
// Everything on this board is lit by one directional light and a flat ambient
// term, and a flat ambient term reaches everywhere equally. A crevice gets
// exactly as much of it as an open flank, so nothing on a figure has any
// contact shadow: no dark seam where an arm meets a torso, none under a shield
// rim, none between two bodies pressed together in the Abomination's heap.
// Forms come out inflated rather than dense, and touching objects read as
// floating slightly apart.
//
// This is also the effect that was hand-faked and failed. The first pass at
// the Abomination drew shadow into the seams as dark swept tubes, which sat
// proud of the surface and read as logs laid across the pile — because shadow
// is an absence and cannot be *added* as geometry. Computed properly it lands
// in every crevice on every creature for nothing but a screen pass.
//
// Ground Truth Ambient Occlusion reads the depth and normals of what has
// already been drawn and, for each pixel, estimates how much of the sky that
// point can actually see. It is called ground truth because its integral
// matches the analytically correct answer more closely than the older
// approximations — `SSAOPass` and `SAOPass`, both also in the box.

// The radius is measured in *screen space* rather than in world units, and
// that is not a detail. The same creature is drawn at three wildly different
// scales here — six units across in the lab, a third of a unit on its stand,
// something else again in the combat panel — so a world-space radius that
// suited one would be meaningless in the others. In pixels it is the same
// effect everywhere.
const AO = {
  screenSpaceRadius: true,
  radius: 0.9,
  distanceExponent: 1,
  thickness: 1,
  scale: 1,
  // The first knob to turn if this costs too much. GTAO is fill-rate work —
  // it takes this many samples for every pixel on the canvas — so its cost
  // scales with resolution rather than with how many figures are on the
  // board, which is the opposite of everything else here. It could not be
  // measured honestly on the build machine: a headless container rasterises
  // in software, where this pass came back at two seconds a frame and the
  // number means nothing. `demo/bench.html?units=10&ao=on` on the real panel
  // is the only measurement worth having.
  samples: 12,
};

const DENOISE = { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, samples: 8 };

/**
 * A composer that renders the scene and then multiplies ambient occlusion
 * into it.
 *
 * Returns `null` if anything in the chain fails to build, and the caller is
 * expected to fall back to a direct render — occlusion is an enhancement, and
 * a board that draws without it is still a board.
 */
export const makeOcclusion = (renderer, scene, camera, width, height, options = {}) => {
  try {
    const composer = new EffectComposer(renderer);
    composer.setSize(width, height);
    composer.addPass(new RenderPass(scene, camera));

    const gtao = new GTAOPass(scene, camera, width, height);
    gtao.updateGtaoMaterial({ ...AO, ...options });
    gtao.updatePdMaterial(DENOISE);
    // How hard the occlusion is applied. A touch under full strength: the
    // effect wants to be felt rather than seen, and at 1.0 the deepest
    // crevices start reading as dirt rather than as shade.
    gtao.blendIntensity = options.intensity ?? 0.9;
    composer.addPass(gtao);

    // Tone mapping and the sRGB conversion happen here rather than in each
    // material, because the renderer skips both when drawing into a render
    // target. Without this pass the whole board comes back flat and dark.
    composer.addPass(new OutputPass());

    return {
      composer,
      gtao,
      render: () => composer.render(),
      setSize: (w, h) => {
        composer.setSize(w, h);
        gtao.setSize(w, h);
      },
      dispose: () => {
        gtao.dispose?.();
        composer.dispose?.();
      },
    };
  } catch (error) {
    // Nothing here is load-bearing. If the pass cannot be built — an old
    // driver, a missing extension — the caller renders straight to the canvas
    // and loses a lighting cue rather than the game.
    if (typeof console !== "undefined") {
      console.warn("ambient occlusion unavailable:", error?.message ?? error);
    }
    return null;
  }
};
