import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

// The toolkit every rig on this board is built with.
//
// It exists because of one measurement. The benchmark said mesh count is the
// constraint and triangles are effectively free — 344k triangles and 1.9M
// triangles cost the same, because the cost is in submitting draws and walking
// the scene graph, not in rasterising. That inverts the normal way of adding
// detail:
//
//   Detail added as separate meshes spends the scarce resource.
//   Detail merged into one mesh spends the free one.
//
// So a figure here is not twenty little meshes. It is a handful of merged
// buffers, one per *thing that moves independently*, each carrying as much
// geometry as it likes. A swordsman's torso, pauldrons, both arms, his cloak
// and his belt are one buffer; his head is another because it turns; his
// sword is a third because it swings.
//
// The awkward part is materials. Merging collapses everything into one mesh,
// and one mesh normally means one material — which would force skin, cloth,
// bone and steel to look identical. Two mechanisms get round that:
//
//   Vertex colour     every vertex carries its own tint, multiplied into the
//                     material's base colour.
//   A surface attribute   every vertex carries its own metalness and
//                     roughness, injected into MeshStandardMaterial's shader.
//
// Together they mean a single mesh can hold matte bone and polished steel and
// still light correctly. `surfaceMaterial()` is that material; it is the only
// one most rigs need.

// --- placing geometry ------------------------------------------------------

/**
 * Put a geometry where it belongs, in its own local space.
 *
 * Merging bakes transforms, so anything that would have been a mesh's
 * position or rotation has to be applied to the vertices instead. Order is
 * scale, then rotate, then translate — the same order a matrix would compose
 * them in.
 */
export const at = (geometry, { pos, rot, scale } = {}) => {
  const g = geometry.clone();
  if (scale) g.scale(scale[0], scale[1], scale[2]);
  if (rot) {
    if (rot[0]) g.rotateX(rot[0]);
    if (rot[1]) g.rotateY(rot[1]);
    if (rot[2]) g.rotateZ(rot[2]);
  }
  if (pos) g.translate(pos[0], pos[1], pos[2]);
  // `mergeGeometries` refuses a mix of indexed and non-indexed inputs and the
  // built-in generators are not consistent about which they produce.
  // Flattening everything is the cheapest way to guarantee they combine.
  return g.toNonIndexed();
};

const scratch = new THREE.Color();

/**
 * Give a geometry a colour and a surface, so it can be merged with others
 * that have different ones.
 *
 * `metalness` and `roughness` follow the same meanings they have on the
 * material — see `materials.js` for why metalness tops out at 0.72 rather
 * than 1.
 *
 * `mottle` is how blotchy the surface is and `mottleScale` how fine the
 * blotches are. Both are written into a `grain` attribute and evaluated *per
 * pixel* by the shader — see the note above `patch()` for why that matters.
 */
export const skin = (
  geometry,
  color,
  { metalness = 0, roughness = 0.85, mottle = 0, mottleScale = 6 } = {}
) => {
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const surfaces = new Float32Array(count * 2);
  const grain = new Float32Array(count * 2);
  // `Color.set` already converts a hex literal out of sRGB and into the
  // renderer's linear working space — the same thing `material.color` does
  // with the same number. Converting again here is a second gamma pass, and
  // it costs about two and a half stops: the first version of this file did
  // exactly that, and every figure on the board came out near black while
  // looking, convincingly, like a lighting problem.
  scratch.set(color);
  for (let i = 0; i < count; i += 1) {
    colors[i * 3] = scratch.r;
    colors[i * 3 + 1] = scratch.g;
    colors[i * 3 + 2] = scratch.b;
    surfaces[i * 2] = metalness;
    surfaces[i * 2 + 1] = roughness;
    grain[i * 2] = mottle;
    grain[i * 2 + 1] = mottleScale;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("surface", new THREE.BufferAttribute(surfaces, 2));
  geometry.setAttribute("grain", new THREE.BufferAttribute(grain, 2));
  return geometry;
};

/** `at` and `skin` in one call, which is how rigs actually use them. */
export const part = (geometry, color, placement = {}) =>
  skin(at(geometry, placement), color, placement);

/**
 * Collapse parts into one buffer.
 *
 * Returns null for an empty list so a caller can write
 * `const g = merge(parts); if (g) ...` without guarding every optional
 * cluster separately.
 */
export const merge = (parts) => {
  const kept = parts.filter(Boolean);
  if (!kept.length) return null;
  if (kept.length === 1) return kept[0];
  return BufferGeometryUtils.mergeGeometries(kept);
};

/** A merged cluster, ready to hang on a group. */
export const meshOf = (parts, material) => {
  const geometry = merge(parts);
  if (!geometry) return null;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

/** `meshOf`, parented and positioned. Returns the mesh, or null. */
export const attach = (parent, parts, material, position) => {
  const mesh = meshOf(parts, material);
  if (!mesh) return null;
  if (position) mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
};

// --- the material ----------------------------------------------------------

// MeshStandardMaterial reads metalness and roughness from uniforms. These
// injections make it read them from vertex attributes instead — which is what
// lets one merged mesh hold both bone and steel — and then compute the
// surface blotching per *pixel*.
//
// That last part is the whole reason this is worth the excursion. The first
// version varied colour per vertex on the CPU, and the vertex counts here are
// tiny: a head is 195 vertices, an arm 442. 195 samples across a whole head
// is a fourteen-pixel texture; it can shift a part's overall tone and do
// nothing else. The same noise evaluated per fragment, on a creature drawn at
// 280 px, gets on the order of 78,000 samples. Four hundred times finer, for
// no memory and no extra draw calls.
//
// It also sidesteps the reason this pipeline cannot take an ordinary texture
// map at all: geometries are merged from a dozen generators whose UVs are
// unrelated to each other, so any shared map smears. Noise taken from
// object-space position needs no UVs.
//
// This is deliberately the smallest possible change to the stock shader: one
// attribute, one varying, two assignments after the stock chunks have run.
// The last time this project touched Three's shader graph — the prefiltered
// environment map — the generated GLSL was rejected by ANGLE and SwiftShader
// and every material in the scene failed to compile at once. An `attribute`
// and a `varying` are the two constructs least likely to repeat that: Three
// rewrites both for WebGL2 itself, and neither depends on a code path the
// stock materials do not already exercise.
const patch = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
attribute vec2 surface;
attribute vec2 grain;
varying vec2 vSurface;
varying vec2 vGrain;
varying vec3 vGrainPos;`
    )
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
vSurface = surface;
vGrain = grain;
// Object space, which for a merged rig is the space its geometry was baked
// in — so the pattern is fixed to the model and does not swim when a limb
// rotates or the unit turns on the board.
vGrainPos = position;`
    );

  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      `#include <common>
varying vec2 vSurface;
varying vec2 vGrain;
varying vec3 vGrainPos;

// Domain-warped sine, three octaves. Not a true value noise, but it is
// continuous, costs no texture lookup, and has no tiling to give it away.
float bmWobble(vec3 p) {
  return sin(p.x * 5.1 + sin(p.z * 3.3) * 1.4)
       * sin(p.y * 4.3 + sin(p.x * 2.7) * 1.1)
       * sin(p.z * 5.7 + sin(p.y * 3.9) * 1.3);
}
float bmGrain(vec3 p) {
  return bmWobble(p) * 0.62
       + bmWobble(p * 2.7 + 4.1) * 0.26
       + bmWobble(p * 6.3 + 1.3) * 0.12;
}`
    )
    // After the stock chunk has applied the vertex colour, so the blotching
    // modulates the tint rather than being averaged into it
    .replace(
      "#include <color_fragment>",
      `#include <color_fragment>
float bmN = vGrain.x > 0.0 ? bmGrain(vGrainPos * vGrain.y) : 0.0;
diffuseColor.rgb *= 1.0 + bmN * vGrain.x;`
    )
    // Both stock chunks declare their factor and then modify it from a map.
    // Assigning afterwards overrides the uniform without disturbing either.
    .replace(
      "#include <roughnessmap_fragment>",
      `#include <roughnessmap_fragment>
// Damp patches read as damp. On flesh the roughness variation carries more
// than the colour does.
roughnessFactor = clamp(vSurface.y - bmN * vGrain.x * 0.5, 0.04, 1.0);`
    )
    .replace(
      "#include <metalnessmap_fragment>",
      `#include <metalnessmap_fragment>
metalnessFactor = vSurface.x;`
    );
};

let shared = null;

/**
 * The material a merged figure wears.
 *
 * There is exactly one of these for the whole board. Colour, metalness and
 * roughness all come from the geometry, so nothing distinguishes one rig's
 * material from another's — and a single material means Three can sort and
 * batch the whole board's figures together.
 */
export const surfaceMaterial = () => {
  if (shared) return shared;
  shared = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.85,
    metalness: 0,
  });
  shared.onBeforeCompile = patch;
  // Two materials with the same program need the same cache key, and two with
  // different injected source must not share one. This material is a
  // singleton with a fixed patch, so a constant is both correct and cheap.
  shared.customProgramCacheKey = () => "surface-grain";
  return shared;
};

// --- shapes ----------------------------------------------------------------

/**
 * A bevelled solid, extruded from a 2D outline in the XY plane.
 *
 * This is the workhorse for anything cut from stock — plank, plate, blade,
 * shield board. The bevel is the point: a bevelled edge catches the key light
 * along its whole length, and that highlight is what stops a slab reading as
 * a box. It costs triangles, which are free.
 */
export const bevelled = (points, depth, bevel = 0.012) => {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 8,
  });
  // Extrude builds from z = 0 forward; centre it so callers can place by
  // middle rather than by face
  geometry.translate(0, 0, -depth / 2 + bevel);
  return geometry;
};

/**
 * A turned solid, revolved from a half-profile.
 *
 * Anything that was made on a lathe in life — a helm bowl, a winch drum, a
 * wheel hub, a shield boss, a pommel — should be made on one here. Profiles
 * are `[radius, height]` pairs.
 *
 * **Direction matters and is easy to get wrong.** `LatheGeometry` winds its
 * triangles from the order it is given, so a profile written top-down comes
 * out inside-out: the front faces point into the solid, and with backface
 * culling on the object renders black. That mistake took a whole infantry
 * pass — helms, shields, pauldrons and robes all authored downward, all
 * rendering as dark lumps, and all looking like a lighting problem rather
 * than a winding one. So this normalises instead of trusting the caller:
 * write the profile whichever way reads naturally and it will be turned the
 * right way out.
 */
export const turned = (profile, segments = 20) => {
  const ordered =
    profile[0][1] > profile[profile.length - 1][1] ? [...profile].reverse() : profile;
  return new THREE.LatheGeometry(
    ordered.map(([r, y]) => new THREE.Vector2(r, y)),
    segments
  );
};

/**
 * A swept tube along a path — rope, chain, cable, strap, vine, gut.
 *
 * Points are `[x, y, z]`; the curve is smoothed through them, so three or
 * four are usually enough for a convincing hang.
 */
export const swept = (points, radius, { segments = 24, sides = 7 } = {}) =>
  new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
    segments,
    radius,
    sides,
    false
  );
