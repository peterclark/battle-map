import * as THREE from "three";
import { buildScene, setTilt } from "../src/art/creatures/trex3d.js";
import { buildInfantry, poseInfantry } from "../src/art/creatures/infantry3d.js";

// How much does a board of animated infantry actually cost?
//
// The honest measurement is split in two, because only one half of it
// transfers off this machine:
//
//   CPU  — posing every figure, and Three.js walking the scene graph to
//          submit one draw call per mesh. This is JavaScript and driver
//          overhead, and it scales with the number of meshes rather than the
//          number of pixels. It is roughly representative anywhere.
//   GPU  — actually rasterising. On a headless container this is SwiftShader,
//          a software rasteriser, and the number means nothing about a real
//          panel. Reported, but do not read anything into it.
//
// Usage: bench.html?units=10&frames=240

const params = new URLSearchParams(location.search);
const UNITS = Number(params.get("units") ?? 10);
const FRAMES = Number(params.get("frames") ?? 240);
const GAIT = params.get("gait") ?? "march";

const canvas = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(1);
renderer.setSize(1280, 720, false);

// A board's worth of units, laid out the way they would deploy
const { scene, camera } = buildScene(1280, 720, { span: 46 });
setTilt(camera, 0);

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

let meshes = 0;
scene.traverse((o) => {
  if (o.isMesh) meshes += 1;
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

  renderer.render(scene, camera);
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
    meshesInScene: meshes,
    drawCalls: info.calls,
    triangles: info.triangles,
    // CPU, and the part that transfers to other machines
    poseMsMedian: round(median(samples.pose)),
    submitMsMedian: round(median(samples.submit)),
    cpuMsMedian: round(median(samples.pose) + median(samples.submit)),
    // Wall clock on THIS machine, which is a software rasteriser
    frameMsMedian: round(median(samples.frame)),
    fpsOnSoftwareRasteriser: round(1000 / median(samples.frame)),
    sampled: samples.frame.length,
  };

  document.getElementById("bench").textContent = JSON.stringify(result, null, 2);
  window.__bench = result;
};

requestAnimationFrame(step);
