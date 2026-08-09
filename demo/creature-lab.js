import * as THREE from "three";
import { buildScene, setTilt } from "../src/art/creatures/trex3d.js";
import { BUILDERS } from "../src/art/creatures/registry.js";
import { tuneRenderer } from "../src/art/creatures/materials.js";
import { makeOcclusion } from "../src/art/creatures/occlusion.js";

// A workbench for one creature at a time.
//
// This replaces the five-panel comparison that used to live here. That page
// existed to answer a question — hand-drawn canvas, sculpted primitives, or a
// bought glTF — and the question is settled: primitives, lit and shadowed,
// under a camera looking straight down. Keeping the losing entries around
// meant keeping their code alive too, so both went.
//
// What remains is the thing that is actually needed while building an army:
// somewhere to see one creature large enough to work on, cycle its gaits, and
// tilt the camera to check the articulation is real rather than a flipbook.
//
// It reads the same registry the board reads, so every creature is here
// automatically and nothing can be modelled but forgotten.
//
// The one thing this page cannot tell you is whether a creature reads at
// stand scale. Nothing here is the size it will be in play. That check only
// happens on the board.

const KINDS = Object.keys(BUILDERS).sort();
const GAITS = ["idle", "march", "attack"];

const params = new URLSearchParams(location.search);
let kind = KINDS.includes(params.get("kind")) ? params.get("kind") : KINDS[0];
let gait = GAITS.includes(params.get("gait")) ? params.get("gait") : "march";
let tilted = params.get("tilt") === "on";
// Figures are modelled facing -Z, so an untilted camera sees their backs.
// Most of the detail worth checking — faces, beards, breastplates, shield
// faces — is on the other side.
let yaw = Number(params.get("yaw")) || 0;
// Ambient occlusion, on by default and switchable so it can be judged against
// itself — the effect is subtle enough that a side-by-side is the only
// honest way to tell whether it is earning its pass.
let ao = params.get("ao") !== "off";
let running = true;

document.getElementById("lab").innerHTML = `
  <style>
    body { margin: 0; background: #0e0c0a; color: #f2ecdd;
           font: 14px/1.5 system-ui, sans-serif; }
    .wrap { max-width: 980px; margin: 0 auto; padding: 20px 16px 40px; }
    h1 { font-size: 15px; letter-spacing: .18em; text-transform: uppercase;
         color: #fac775; margin: 0 0 4px; }
    p.note { color: #8b8172; margin: 0 0 18px; max-width: 62ch; }
    .row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;
           align-items: center; }
    .row b { color: #8b8172; font-weight: 600; text-transform: uppercase;
             letter-spacing: .12em; font-size: 11px; margin-right: 4px; }
    button { background: #241f1a; color: #f2ecdd; border: 1px solid #4a4036;
             border-radius: 5px; padding: 6px 11px; cursor: pointer;
             font: inherit; font-size: 13px; }
    button[aria-pressed="true"] { border-color: #fac775; color: #fac775; }
    canvas { display: block; width: 100%; max-width: 900px; height: auto;
             border: 1px solid #3a332c; border-radius: 8px; background: #10130c; }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 14px;
         margin: 14px 0 0; color: #8b8172; font-size: 13px; }
    dt { color: #f2ecdd; }
  </style>
  <div class="wrap">
    <h1>Creature lab</h1>
    <p class="note">
      One creature, large enough to work on. Whether it reads at the size it
      will actually be played at is a question only the board can answer —
      build, take the field, and flip to Figures.
    </p>
    <div class="row"><b>Creature</b><span id="kinds"></span></div>
    <div class="row"><b>Gait</b><span id="gaits"></span></div>
    <div class="row">
      <button id="tilt">Tilt the camera</button>
      <button id="spin">Turn them round</button>
      <button id="ao">Occlusion</button>
      <button id="play" aria-pressed="true">Pause</button>
    </div>
    <canvas id="stage" width="900" height="560"></canvas>
    <dl id="facts"></dl>
  </div>
`;

const chips = (host, values, current, onPick) => {
  host.innerHTML = "";
  values.forEach((value) => {
    const button = document.createElement("button");
    button.textContent = value;
    button.setAttribute("aria-pressed", String(value === current));
    button.addEventListener("click", () => onPick(value));
    host.append(button);
  });
};

const canvas = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(900, 560, false);
tuneRenderer(renderer);

// The rig is always fitted to the same size; `span` is the camera's window on
// it. Narrowing the span therefore zooms in — which is how you check whether
// the detail on one figure is worth the triangles it costs.
const span = Number(params.get("span")) || 9;
const { scene, camera, key } = buildScene(900, 560, { span });
const occlusion = makeOcclusion(renderer, scene, camera, 900, 560);
key.shadow.mapSize.set(2048, 2048);

let current = null;
let facts = null;

const mount = () => {
  if (current) {
    scene.remove(current.holder);
    current = null;
  }
  const builder = BUILDERS[kind];
  const made = builder.build();
  const holder = new THREE.Group();
  holder.add(made.root);

  // Frame whatever was built, so a twenty-strong block and a single monster
  // both arrive at a workable size without the page knowing their dimensions
  const box = new THREE.Box3().setFromObject(made.root);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const fit = 6.2 / Math.max(size.x, size.z, 0.001);
  made.root.scale.setScalar(fit);
  made.root.position.set(-centre.x * fit, -box.min.y * fit, -centre.z * fit);

  holder.rotation.y = (yaw * Math.PI) / 180;
  scene.add(holder);
  current = { holder, made, builder };

  let meshes = 0;
  let triangles = 0;
  made.root.traverse((o) => {
    if (!o.isMesh) return;
    meshes += 1;
    triangles += o.geometry.attributes.position.count / 3;
  });
  // The size a rig reports at rest is not the size it occupies once it is
  // moving, and the stand fit is measured from the resting box. Sweep the
  // gaits and report both, because a pose that leaves its own box is what
  // puts a tail across the name banner.
  const swept = new THREE.Box3();
  const probe = new THREE.Box3();
  GAITS.forEach((g) => {
    for (let i = 0; i < 10; i += 1) {
      builder.pose(made, i * 0.41, g);
      made.root.updateMatrixWorld(true);
      swept.union(probe.setFromObject(made.root));
    }
  });
  const sweptSize = swept.getSize(new THREE.Vector3());
  builder.pose(made, 0, gait);

  facts = {
    meshes,
    triangles,
    figures: made.rig.count ?? 1,
    size: [Number(size.x.toFixed(2)), Number(size.z.toFixed(2))],
    swept: [Number((sweptSize.x / fit).toFixed(2)), Number((sweptSize.z / fit).toFixed(2))],
  };
  document.getElementById("facts").innerHTML = `
    <dt>meshes</dt><dd>${meshes}</dd>
    <dt>modelled size</dt><dd>${size.x.toFixed(2)} × ${size.z.toFixed(2)} units</dd>
    <dt>swept by its gaits</dt><dd>${(sweptSize.x / fit).toFixed(2)} × ${(sweptSize.z / fit).toFixed(2)} units</dd>
    <dt>figures</dt><dd>${made.rig.count ?? 1}</dd>
    <dt>triangles</dt><dd>${triangles.toLocaleString()}</dd>
  `;
};

const sync = () => {
  chips(document.getElementById("kinds"), KINDS, kind, (value) => {
    kind = value;
    mount();
    sync();
  });
  chips(document.getElementById("gaits"), GAITS, gait, (value) => {
    gait = value;
    sync();
  });
  document.getElementById("tilt").setAttribute("aria-pressed", String(tilted));
  document.getElementById("ao").setAttribute("aria-pressed", String(ao && Boolean(occlusion)));
  setTilt(camera, tilted ? 34 : 0);
  const url = new URL(location.href);
  url.searchParams.set("kind", kind);
  url.searchParams.set("gait", gait);
  url.searchParams.set("tilt", tilted ? "on" : "off");
  url.searchParams.set("yaw", String(yaw));
  url.searchParams.set("ao", ao ? "on" : "off");
  history.replaceState(null, "", url);
};

document.getElementById("tilt").addEventListener("click", () => {
  tilted = !tilted;
  sync();
});

document.getElementById("ao").addEventListener("click", () => {
  ao = !ao;
  sync();
});

document.getElementById("spin").addEventListener("click", () => {
  yaw = (yaw + 45) % 360;
  if (current) current.holder.rotation.y = (yaw * Math.PI) / 180;
  sync();
});

const play = document.getElementById("play");
play.addEventListener("click", () => {
  running = !running;
  play.textContent = running ? "Pause" : "Play";
  play.setAttribute("aria-pressed", String(running));
});

mount();
sync();

const start = performance.now();
let clock = 0;
let previous = start;

const frame = (now) => {
  if (running) clock += (now - previous) / 1000;
  previous = now;
  if (current) current.builder.pose(current.made, clock, gait);
  if (ao && occlusion) occlusion.render();
  else renderer.render(scene, camera);
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);

// A handle for driving this page from a browser test
window.__lab = {
  get kind() { return kind; },
  get ao() { return ao && Boolean(occlusion); },
  get gait() { return gait; },
  get facts() { return facts; },
  KINDS,
};
