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
//
// --- what it costs -------------------------------------------------------
//
// Two separate bills, and they want different treatment. Measured on the Mac
// mini, ten units, native 4K:
//
//   CPU     3ms -> 5ms. GTAO draws the scene a second time into a normal
//           buffer before it can shade anything, so this is 1,601 more meshes
//           submitted. It scales with the board, and it is unavoidable short
//           of building the normal buffer in the main pass.
//   GPU     16ms -> 26ms at full resolution, which is off the 60Hz cap. This
//           is fill-rate: samples per pixel across the whole canvas. It
//           scales with *resolution* rather than with the board, which is the
//           opposite of everything else on this project.
//
// The second is the one that hurt, and halving the resolution is the fix.

// The radius is measured in *screen space* rather than in world units, and
// that is not a detail. The same creature is drawn at three wildly different
// scales here — six units across in the lab, a third of a unit on its stand,
// something else again in the combat panel — so a world-space radius that
// suited one would be meaningless in the others. In pixels it is the same
// effect everywhere.
//
// Screen space here means pixels of the *occlusion buffer*, not of the canvas
// — the shader converts the radius to world units through `1.0 /
// resolution.x`, and `resolution` is the pass's own size. So halving the
// buffer silently doubles how far the effect reaches, which is why the radius
// is scaled to match below. This is worth knowing because it does not look
// like a resolution bug when it happens: it looks like someone widened the
// shading.
const AO = {
  screenSpaceRadius: true,
  radius: 0.9,
  distanceExponent: 1,
  thickness: 1,
  scale: 1,
  samples: 8,
};

// Ambient occlusion is computed at half the canvas's resolution and stretched
// back up.
//
// This is not a compromise so much as the standard way to do it: occlusion is
// a low-frequency signal — broad soft darkening in creases — so it survives
// being computed coarsely and blurred, which is what the denoise pass does to
// it anyway. Quartering the pixels quarters the cost of the one part of this
// that scales with resolution.
//
// It needed doing. Measured on the Mac mini at native 4K, the full-resolution
// version took the frame from 16ms to 26ms — off the 60Hz cap and down to 38
// frames a second. That is roughly 10ms of GPU for an effect that is meant to
// be felt rather than seen.
const RESOLUTION_SCALE = 0.5;

const DENOISE = { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, samples: 8 };

const resizeAo = (gtao, width, height) =>
  gtao.setSize(
    Math.max(1, Math.round(width * RESOLUTION_SCALE)),
    Math.max(1, Math.round(height * RESOLUTION_SCALE))
  );

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
    gtao.updateGtaoMaterial({
      ...AO,
      radius: AO.radius * RESOLUTION_SCALE,
      ...options,
    });
    gtao.updatePdMaterial(DENOISE);
    // How hard the occlusion is applied. A touch under full strength: the
    // effect wants to be felt rather than seen, and at 1.0 the deepest
    // crevices start reading as dirt rather than as shade.
    gtao.blendIntensity = options.intensity ?? 0.9;
    composer.addPass(gtao);

    // Only now. `EffectComposer.addPass` resizes the pass it is handed to the
    // composer's own size, so a pass constructed at half resolution is put
    // back to full the instant it is added — silently, and with no visible
    // difference beyond the frame time. The first attempt at this shipped
    // that way and measured exactly as expensive as no fix at all.
    //
    // The pass's buffers are half size while the composer stays full: the
    // blend samples the smaller AO texture with full-resolution UVs and the
    // hardware filters it back up.
    resizeAo(gtao, width, height);

    // Tone mapping and the sRGB conversion happen here rather than in each
    // material, because the renderer skips both when drawing into a render
    // target. Without this pass the whole board comes back flat and dark.
    composer.addPass(new OutputPass());

    return {
      composer,
      gtao,
      render: () => composer.render(),
      // What the occlusion buffers actually came out as, so a benchmark can
      // report it rather than trust that the setting took. See above for why
      // that distinction earned its own accessor.
      resolution: () => [gtao.width, gtao.height],
      setSize: (w, h) => {
        // Same order, same reason: the composer resizes every pass it holds.
        composer.setSize(w, h);
        resizeAo(gtao, w, h);
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
