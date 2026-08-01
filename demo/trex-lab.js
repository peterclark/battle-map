import * as THREE from "three";
import { drawTyrannosaur } from "../src/art/creatures/trex.js";
import {
  buildScene,
  buildTyrannosaur,
  poseTyrannosaur,
  setTilt,
} from "../src/art/creatures/trex3d.js";

// Side by side, on one clock, driven by one set of controls — the only way to
// judge the two approaches is to watch them do the same thing at the same
// moment.

const PALETTE = `
  :root {
    --ground:#0e0c0a; --panel:#171411; --rule:#4a4238;
    --ink:#f2ecdd; --dim:#a99f8a; --accent:#ef9f27;
    --display: Georgia, "Times New Roman", serif;
    --mono: ui-monospace, SFMono-Regular, Menlo, monospace;
    color-scheme: dark;
  }
  * { box-sizing:border-box }
  body { margin:0; background:var(--ground); color:var(--ink);
         font-family:var(--display); padding:clamp(18px,3vw,40px) }
  .wrap { max-width:1180px; margin:0 auto; display:flex; flex-direction:column; gap:26px }
  .eyebrow { font-family:var(--mono); font-size:11px; letter-spacing:.28em;
             text-transform:uppercase; color:var(--accent); margin:0 }
  h1 { font-size:clamp(26px,4vw,40px); letter-spacing:.04em; margin:6px 0 0 }
  .lede { color:var(--dim); max-width:64ch; margin:10px 0 0; line-height:1.65 }
  .pair { display:grid; gap:18px; grid-template-columns:repeat(auto-fit,minmax(330px,1fr)) }
  .cell { background:var(--panel); border:1px solid var(--rule); border-radius:12px;
          padding:12px; display:flex; flex-direction:column; gap:10px }
  .cell h2 { font-family:var(--mono); font-size:11px; letter-spacing:.2em;
             text-transform:uppercase; color:var(--accent); margin:0 }
  .cell p { margin:0; font-size:12.5px; color:var(--dim); line-height:1.55 }
  canvas { width:100%; height:auto; display:block; border-radius:8px; background:#3f6420 }
  .controls { display:flex; gap:10px; flex-wrap:wrap; align-items:center }
  button { font-family:var(--mono); font-size:11px; letter-spacing:.18em;
           text-transform:uppercase; padding:9px 16px; cursor:pointer; color:#d8ceb8;
           border-radius:8px; border:1px solid var(--rule);
           background:linear-gradient(180deg,#332d26,#241f1a 45%,#1c1815);
           box-shadow:inset 0 1px 0 rgba(255,235,200,.08) }
  button[aria-pressed="true"] { background:linear-gradient(180deg,#5a3c10,#3a2a10);
           border-color:var(--accent); color:#fbe3b5 }
  button:focus-visible { outline:2px solid var(--accent); outline-offset:2px }
  dl { display:grid; grid-template-columns:auto 1fr; gap:4px 14px; margin:0;
       font-family:var(--mono); font-size:11.5px }
  dt { color:var(--dim); text-transform:uppercase; font-size:10px; letter-spacing:.1em }
  dd { margin:0; font-variant-numeric:tabular-nums }
`;

document.head.insertAdjacentHTML("beforeend", `<style>${PALETTE}</style>`);
document.getElementById("lab").innerHTML = `
  <div class="wrap">
    <header>
      <p class="eyebrow">Battle Map · animation approaches</p>
      <h1>The same animal, built two ways</h1>
      <p class="lede">One clock, one set of controls, both running now. On the left
      the canvas rig: shapes and a travelling wave, no dependency. On the right
      Three.js with the camera straight down: real geometry, a real light, and a
      shadow that is cast rather than drawn.</p>
    </header>

    <div class="controls">
      <button data-gait="idle">Idle</button>
      <button data-gait="march" aria-pressed="true">March</button>
      <button data-gait="attack">Attack</button>
      <button id="play" aria-pressed="true">Pause</button>
      <button id="tilt" aria-pressed="false">Tilt the 3D camera</button>
    </div>

    <div class="pair">
      <div class="cell">
        <h2>Canvas rig — 2D</h2>
        <canvas id="two" width="520" height="470"></canvas>
        <p>Spine nodes and sine curves, drawn straight onto the board's own
        canvas. Nothing to install, nothing to load, and it scales to any size
        because it is redrawn rather than sampled. The shading is painted by
        hand, so it does not respond to anything.</p>
      </div>
      <div class="cell">
        <h2>Three.js — 3D, orthographic top-down</h2>
        <canvas id="three" width="520" height="470"></canvas>
        <p>A joint hierarchy under a directional light. The shadow falls where
        the light puts it, the flanks shade themselves, and turning the unit is
        just rotating the model. Costs a WebGL context and a bundled
        dependency.</p>
      </div>
    </div>

    <div class="cell">
      <h2>What each costs</h2>
      <dl>
        <dt>Payload</dt><dd>Canvas rig ~7 KB · Three.js ~460 KB bundled</dd>
        <dt>Per creature</dt><dd>Both need one authored creature; 3D can take a bought glTF instead</dd>
        <dt>Lighting</dt><dd>Painted · Actual, with a cast shadow</dd>
        <dt>Facing</dt><dd>Rotate the canvas · Rotate the model, and it relights itself</dd>
        <dt>Runs on</dt><dd>Any browser, CPU only · Needs a working GPU on the table's box</dd>
      </dl>
    </div>
  </div>`;

let gait = "march";
let running = true;
let clock = 0;
let last = null;

// --- left: the canvas rig -------------------------------------------------
const two = document.getElementById("two");
const twoCtx = two.getContext("2d");

const drawFlat = (t) => {
  const dpr = window.devicePixelRatio || 1;
  const w = two.clientWidth;
  const h = w * (470 / 520);
  two.width = Math.round(w * dpr);
  two.height = Math.round(h * dpr);
  two.style.height = `${h}px`;
  twoCtx.save();
  twoCtx.scale(dpr, dpr);
  const g = twoCtx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#4d7a2a");
  g.addColorStop(1, "#2f4d19");
  twoCtx.fillStyle = g;
  twoCtx.fillRect(0, 0, w, h);
  twoCtx.translate(w / 2, h / 2);
  drawTyrannosaur(twoCtx, { time: t, size: Math.min(w, h) * 0.8, state: gait });
  twoCtx.restore();
};

// --- right: the 3D scene --------------------------------------------------
const threeCanvas = document.getElementById("three");
const renderer = new THREE.WebGLRenderer({
  canvas: threeCanvas,
  antialias: true,
  alpha: false,
});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const { scene, camera } = buildScene(520, 470, { span: 13 });
let tilt = 0;
setTilt(camera, tilt);
const rig = buildTyrannosaur();
scene.add(rig.root);

const sizeThree = () => {
  const w = threeCanvas.clientWidth;
  const h = w * (470 / 520);
  threeCanvas.style.height = `${h}px`;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  const aspect = w / h;
  const span = 13;
  camera.left = (-span * aspect) / 2;
  camera.right = (span * aspect) / 2;
  camera.top = span / 2;
  camera.bottom = -span / 2;
  camera.updateProjectionMatrix();
};

const frame = (ms) => {
  if (last === null) last = ms;
  if (running) clock += (ms - last) / 1000;
  last = ms;

  drawFlat(clock);
  sizeThree();
  poseTyrannosaur(rig, clock, gait);
  renderer.render(scene, camera);

  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);

document.querySelectorAll("[data-gait]").forEach((btn) => {
  btn.addEventListener("click", () => {
    gait = btn.dataset.gait;
    document
      .querySelectorAll("[data-gait]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
  });
});
const tiltBtn = document.getElementById("tilt");
tiltBtn.addEventListener("click", () => {
  tilt = tilt === 0 ? 26 : 0;
  setTilt(camera, tilt);
  tiltBtn.setAttribute("aria-pressed", String(tilt !== 0));
  tiltBtn.textContent = tilt === 0 ? "Tilt the 3D camera" : "Back to straight down";
});

const play = document.getElementById("play");
play.addEventListener("click", () => {
  running = !running;
  play.textContent = running ? "Pause" : "Play";
  play.setAttribute("aria-pressed", String(running));
});
