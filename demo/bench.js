import * as THREE from "three";
import { buildScene, setTilt } from "../src/art/creatures/trex3d.js";
import { buildInfantry, poseInfantry } from "../src/art/creatures/infantry3d.js";
import { tuneRenderer } from "../src/art/creatures/materials.js";
import { makeOcclusion } from "../src/art/creatures/occlusion.js";

// How much does a board of animated infantry actually cost?
//
// The honest measurement is split in two, because only one half of it
// transfers off this machine:
//
//   CPU  — posing every figure, and Three.js walking the scene graph to
//          submit one draw call per mesh. This is JavaScript and driver
//          overhead, and it scales with the number of meshes rather than the
//          number of pixels. It is roughly representative anywhere.
//   GPU  — actually rasterising. Reported as wall-clock frame time, which is
//          only meaningful on the machine that will drive the table: in a
//          headless container this is SwiftShader, a software rasteriser, and
//          the number says nothing about a real panel. Note that on real
//          hardware a healthy result is the vsync cap rather than the true
//          ceiling, so a comfortable frame time proves the board is *not*
//          GPU-bound and does not say by how much.
//
// Shadows are measured separately from everything else, because they are the
// one cost you can choose not to pay. The shadow pass re-draws every
// casting mesh from the light's point of view, so it roughly doubles the
// submit load — and on a board lit from almost directly overhead, it buys
// less than it does in a three-quarter view. Run it both ways before
// deciding.
//
// Usage: bench.html?units=10&frames=240&shadows=on&ao=on&width=1920&height=1080

const params = new URLSearchParams(location.search);
const UNITS = Number(params.get("units") ?? 10);
const FRAMES = Number(params.get("frames") ?? 240);
const GAIT = params.get("gait") ?? "march";
const SHADOWS = (params.get("shadows") ?? "on") !== "off";
// Ambient occlusion costs a second pass over the geometry — GTAO renders its
// own normal-and-depth buffer before it can shade anything — so it is
// measured separately, the same way shadows are.
const AO = (params.get("ao") ?? "off") !== "off";
const SHADOW_MAP = Number(params.get("shadowmap") ?? 2048);
const WIDTH = Number(params.get("width") ?? 1280);
const HEIGHT = Number(params.get("height") ?? 720);

const canvas = document.getElementById("stage");
canvas.width = WIDTH;
canvas.height = HEIGHT;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.shadowMap.enabled = SHADOWS;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(1);
renderer.setSize(WIDTH, HEIGHT, false);
// Measure what the board actually runs, tone mapping included
tuneRenderer(renderer);

// A board's worth of units, laid out the way they would deploy
const { scene, camera, key } = buildScene(WIDTH, HEIGHT, { span: 46 });
setTilt(camera, 0);
key.castShadow = SHADOWS;

const blocks = [];
const perRow = Math.ceil(Math.sqrt(UNITS));
for (let i = 0; i < UNITS; i += 1) {
  const block = buildInfantry();
  block.root.position.set(
    (-(perRow - 1) / 2 + (i % perRow)) * 9,
    0,
    (-(Math.ceil(UNITS / perRow) - 1) / 2 + Math.floor(i / perRow)) * 7
  );
  scene.add(block.root);
  blocks.push(block);
}

// Size the shadow camera to the army it is lighting.
//
// buildScene's default frustum is ±10 units, which suits one monster on a
// plinth and silently culls most of a board: at twenty blocks only two of
// them fell inside it, so nine tenths of the infantry cast nothing and the
// shadow pass came back almost free. It was not free — it was absent. A
// frustum that covers the content is the only way this number means
// anything.
// The blocks, not the scene: the ground is a 60-unit plane and bounding it
// would hand back the plane rather than the army standing on it.
const bounds = new THREE.Box3();
blocks.forEach((block) => bounds.expandByObject(block.root));
const shadowHalfExtent =
  Math.ceil(
    Math.max(
      Math.abs(bounds.min.x),
      Math.abs(bounds.max.x),
      Math.abs(bounds.min.z),
      Math.abs(bounds.max.z)
    )
  ) + 1;
if (SHADOWS) {
  key.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
  key.shadow.camera.left = -shadowHalfExtent;
  key.shadow.camera.right = shadowHalfExtent;
  key.shadow.camera.top = shadowHalfExtent;
  key.shadow.camera.bottom = -shadowHalfExtent;
  key.shadow.camera.updateProjectionMatrix();
}

const occlusion = AO ? makeOcclusion(renderer, scene, camera, WIDTH, HEIGHT) : null;

let meshes = 0;
let casters = 0;
scene.traverse((o) => {
  if (!o.isMesh) return;
  meshes += 1;
  if (o.castShadow) casters += 1;
});

const samples = { pose: [], submit: [], frame: [] };
let frame = 0;
let previous = performance.now();

const median = (list) => {
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};
const round = (n) => Math.round(n * 100) / 100;

const step = (now) => {
  const frameMs = now - previous;
  previous = now;

  const t = now / 1000;

  const poseStart = performance.now();
  blocks.forEach((block) => poseInfantry(block, t, GAIT));
  const poseEnd = performance.now();

  if (occlusion) occlusion.render();
  else renderer.render(scene, camera);
  const submitEnd = performance.now();

  // Discard the first 30 frames: shader compilation and shadow-map warmup
  // land there and would swamp the median
  if (frame > 30) {
    samples.pose.push(poseEnd - poseStart);
    samples.submit.push(submitEnd - poseEnd);
    samples.frame.push(frameMs);
  }

  frame += 1;
  if (frame < FRAMES) {
    requestAnimationFrame(step);
    return;
  }

  const info = renderer.info.render;
  const result = {
    units: UNITS,
    figures: UNITS * 20,
    resolution: `${WIDTH}x${HEIGHT}`,
    meshesInScene: meshes,
    // renderer.info counts the main pass only. With shadows on, the light
    // re-draws every caster into the shadow map on top of this — so the
    // submitted total is nearer meshes + casters than the figure below.
    //
    // With ambient occlusion on these two are meaningless: the composer's
    // last pass is a fullscreen quad, so `info.calls` reports 1 rather than
    // the scene. Read `cpuMsMedian` instead, which is measured rather than
    // counted.
    drawCallsMainPass: occlusion ? null : info.calls,
    shadowCasters: SHADOWS ? casters : 0,
    approxTotalDrawCalls: occlusion ? null : info.calls + (SHADOWS ? casters : 0),
    triangles: info.triangles,
    shadows: SHADOWS
      ? { mapSize: SHADOW_MAP, halfExtent: shadowHalfExtent }
      : false,
    // GTAO draws the scene a second time into a normal buffer, so with it on
    // the real submitted total is nearer twice the figure above again
    ambientOcclusion: occlusion ? "gtao" : false,
    // Read back from the pass rather than assumed, because assuming it cost a
    // whole measurement once: EffectComposer resizes any pass added to it, so
    // occlusion asked for at half resolution silently ran at full, and the
    // only symptom was a frame time that refused to improve. If this does not
    // say half of `resolution`, the run is not measuring what it claims to.
    occlusionResolution: occlusion ? occlusion.resolution().join("x") : null,
    // CPU, and the part that transfers to other machines
    poseMsMedian: round(median(samples.pose)),
    submitMsMedian: round(median(samples.submit)),
    cpuMsMedian: round(median(samples.pose) + median(samples.submit)),
    // Wall clock on whatever is running this. On the target Mac it is real
    // and usually the vsync cap; in a headless container it is SwiftShader
    // and means nothing.
    frameMsMedian: round(median(samples.frame)),
    fps: round(1000 / median(samples.frame)),
    sampled: samples.frame.length,
  };

  document.getElementById("bench").textContent = JSON.stringify(result, null, 2);
  window.__bench = result;
};

requestAnimationFrame(step);
