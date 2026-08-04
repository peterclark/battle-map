import * as THREE from "three";

// Shared materials, and the lighting they need.
//
// Everything here was previously `MeshStandardMaterial` with `metalness: 0`,
// which is why steel read as grey plastic: a metal surface is defined by what
// it reflects, and a material told it is not metal has no specular response
// worth the name.
//
// The obvious fix is image-based lighting — give the scene an environment and
// let full-metalness surfaces reflect it. That is what this file did first,
// and it does not work here. Three's prefiltered-environment path emits GLSL
// that strict validators reject:
//
//   ERROR: 0:619: 'assign' : cannot convert from 'const int' to 'highp float'
//   uv.x += face * faceSize;   // cube_uv_reflection_fragment
//
// Desktop GL drivers let it pass. ANGLE and SwiftShader do not, and when it
// fails *every* standard material in the scene fails to compile — the board
// goes black, not just the reflections. That is too severe a failure mode to
// ship on the hope that the driver in front of it happens to be lenient, so
// the environment is gone and the metals are lit by lights alone.
//
// Which forces a compromise worth naming. With nothing to reflect, a surface
// at full metalness has no diffuse term and renders nearly black — physically
// correct and visually useless. These sit at 0.72: high enough for a strong
// specular roll across a helm as it turns, low enough to keep some body
// colour underneath. The rim light in `buildScene` is doing the other half of
// the work.

/** A non-metal surface: cloth, hide, bone, wood, stone. */
export const matte = (color, roughness = 0.85) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

/**
 * A metal surface — steel, mail, brass, a weapon head.
 *
 * Roughness is the character: 0.3 is a polished helm, 0.5 campaign-worn mail,
 * 0.7 a rusted engine fitting. See the note above on why metalness is 0.72
 * and not 1.
 */
export const metal = (color, roughness = 0.35) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.72 });

/**
 * Renderer settings that go with the above.
 *
 * Filmic tone mapping is doing more work here than it looks. Specular
 * highlights on metal run far brighter than white, and with no curve to roll
 * them off they clip to flat patches — which is worse than no highlight at
 * all, because a clipped highlight has no shape.
 */
export const tuneRenderer = (renderer) => {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  return renderer;
};
