import * as THREE from "three";
import { drawTyrannosaur } from "../src/art/creatures/trex.js";
import {
  buildScene,
  buildTyrannosaur,
  poseTyrannosaur,
  setTilt,
} from "../src/art/creatures/trex3d.js";
import { loadCreature } from "../src/art/creatures/gltfCreature.js";
import foxUrl from "./assets/Fox.glb";

// Three approaches, one clock, one set of controls. The only way to judge
// them is to watch them do the same thing at the same moment.
//
// The third panel is a stand-in: a fox, not a tyrannosaur, because the model
// marketplaces are unreachable from here and this was the nearest thing that
// is genuinely artist-rigged and freely licensed. It is the right stand-in
// anyway — what it settles is whether a bought model beats primitives, and
// swapping in a purchased T-Rex is a change of two lines.

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
  .wrap { max-width:1240px; margin:0 auto; display:flex; flex-direction:column; gap:26px }
  .eyebrow { font-family:var(--mono); font-size:11px; letter-spacing:.28em;
             text-transform:uppercase; color:var(--accent); margin:0 }
  h1 { font-size:clamp(26px,4vw,40px); letter-spacing:.04em; margin:6px 0 0 }
  .lede { color:var(--dim); max-width:66ch; margin:10px 0 0; line-height:1.65 }
  .trio { display:grid; gap:16px; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)) }
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
  dl { display:grid; grid-template-columns:auto 1fr; gap:5px 16px; margin:0;
       font-family:var(--mono); font-size:11.5px }
  dt { color:var(--dim); text-transform:uppercase; font-size:10px; letter-spacing:.1em;
       align-self:center }
  dd { margin:0; font-variant-numeric:tabular-nums }
  .note { font-size:11.5px; color:var(--dim); font-family:var(--mono); line-height:1.6 }
`;

document.head.insertAdjacentHTML("beforeend", `<style>${PALETTE}</style>`);
document.getElementById("lab").innerHTML = `
  <div class="wrap">
    <header>
      <p class="eyebrow">Battle Map · animation approaches</p>
      <h1>The same job, done three ways</h1>
      <p class="lede">One clock, one set of controls, all three running now.
      Hand-drawn shapes, hand-built geometry, and an artist's rigged model with
      its own animation clips.</p>
      <p class="lede"><strong>Read panel 3 with care.</strong> The model works —
      its bones move and its clips cross-fade — but a fox seen from directly
      overhead is 4.3 units long and 0.7 wide, a 6:1 sliver, so it reads as an
      orange arrow. Tilt the cameras and it becomes a fox immediately. That is a
      fact about foxes, not about bought models: a bipedal theropod has its legs
      out to the sides and a broad back, which is a far better top-down subject.
      <strong>This does not settle the question for a tyrannosaur.</strong></p>
    </header>

    <div class="controls">
      <button data-gait="idle">Idle</button>
      <button data-gait="march" aria-pressed="true">March</button>
      <button data-gait="attack">Attack</button>
      <button id="play" aria-pressed="true">Pause</button>
      <button id="tilt" aria-pressed="false">Tilt the 3D cameras</button>
    </div>

    <div class="trio">
      <div class="cell">
        <h2>1 · Canvas rig — hand-drawn</h2>
        <canvas id="two" width="420" height="400"></canvas>
        <p>Spine nodes and sine curves painted onto the board's own canvas.
        No dependency, ~7 KB, scales to any size. Every creature is hand-coded,
        and the shading responds to nothing.</p>
      </div>
      <div class="cell">
        <h2>2 · Three.js — hand-built primitives</h2>
        <canvas id="three" width="420" height="400"></canvas>
        <p>Capsules and boxes on a joint hierarchy under a real light. The
        shadow is cast rather than drawn — but from directly overhead a capsule
        body is a blob, and lighting cannot rescue a shape nobody sculpted.</p>
      </div>
      <div class="cell">
        <h2>3 · Three.js — an artist's model</h2>
        <canvas id="gltf" width="420" height="400"></canvas>
        <p>A rigged, skinned .glb with the animator's own Survey / Walk / Run
        clips, cross-fading between gaits. Sculpting and animation beat
        primitives — but only where the silhouette survives the camera. Straight
        down, this quadruped does not. Press <em>Tilt</em> to see the same model
        read properly.</p>
      </div>
    </div>

    <div class="cell">
      <h2>What each costs</h2>
      <dl>
        <dt>Payload</dt><dd>~7 KB · ~460 KB (Three.js) · ~460 KB + 160 KB a model</dd>
        <dt>Per creature</dt><dd>Hand-coded · Hand-built · Bought or commissioned</dd>
        <dt>Animation</dt><dd>Sine curves · Sine curves on joints · The animator's own clips, with blending</dd>
        <dt>Lighting</dt><dd>Painted · Real, cast shadow · Real, cast shadow</dd>
        <dt>Facing</dt><dd>Rotate the canvas · Rotate the model · Rotate the model</dd>
        <dt>Runs on</dt><dd>CPU only · Needs a GPU · Needs a GPU</dd>
        <dt>Top-down</dt><dd>Drawn for it · Blob · Depends entirely on the animal</dd>
      </dl>
      <p class="note">Model: “Fox” — © 2014 PixelMannen (CC0 1.0); rigging and
      animation © 2014 tomkranis (CC BY 4.0); glTF conversion © 2017
      @AsoboStudio and @scurest (CC BY 4.0). Used here as a stand-in under
      those terms.</p>
    </div>
  </div>`;

// Fox clip names, mapped onto the board's three gaits
const FOX_CLIPS = { idle: "Survey", march: "Walk", attack: "Run" };

let gait = "march";
let running = true;
let tilt = 0;
let clock = 0;
let last = null;

// --- 1: the canvas rig ----------------------------------------------------
const two = document.getElementById("two");
const twoCtx = two.getContext("2d");

const field = (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#4d7a2a");
  g.addColorStop(1, "#2f4d19");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

const drawFlat = (t) => {
  const dpr = window.devicePixelRatio || 1;
  const w = two.clientWidth;
  const h = w * (400 / 420);
  two.width = Math.round(w * dpr);
  two.height = Math.round(h * dpr);
  two.style.height = `${h}px`;
  twoCtx.save();
  twoCtx.scale(dpr, dpr);
  field(twoCtx, w, h);
  twoCtx.translate(w / 2, h / 2);
  drawTyrannosaur(twoCtx, { time: t, size: Math.min(w, h) * 0.8, state: gait });
  twoCtx.restore();
};

// --- shared 3D panel plumbing --------------------------------------------
const makePanel = (id, span) => {
  const canvas = document.getElementById(id);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const { scene, camera } = buildScene(420, 400, { span });
  setTilt(camera, 0);
  return {
    canvas,
    renderer,
    scene,
    camera,
    span,
    resize() {
      const w = canvas.clientWidth;
      const h = w * (400 / 420);
      canvas.style.height = `${h}px`;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      const aspect = w / h;
      camera.left = (-this.span * aspect) / 2;
      camera.right = (this.span * aspect) / 2;
      camera.top = this.span / 2;
      camera.bottom = -this.span / 2;
      camera.updateProjectionMatrix();
    },
  };
};

// --- 2: hand-built primitives --------------------------------------------
const built = makePanel("three", 13);
const rig = buildTyrannosaur();
built.scene.add(rig.root);

// --- 3: the artist's model ------------------------------------------------
const bought = makePanel("gltf", 5.2);
let creature = null;
loadCreature(foxUrl, { clips: FOX_CLIPS, height: 2.2 })
  .then((loaded) => {
    creature = loaded;
    bought.scene.add(creature.root);
    creature.play(gait, 0);
    // A handle for driving this page from a test — the lab is a spike, and
    // proving the clips actually run beats eyeballing a screenshot
    window.__lab = { creature, built: rig };
    // Report what the file actually contained, so a swapped-in model that
    // names its clips differently says so rather than standing still
    console.info("clips in model:", creature.clipNames.join(", "));
  })
  .catch((error) => console.error("model failed to load", error));

// --- the loop -------------------------------------------------------------
const frame = (ms) => {
  if (last === null) last = ms;
  const delta = (ms - last) / 1000;
  if (running) clock += delta;
  last = ms;

  drawFlat(clock);

  built.resize();
  poseTyrannosaur(rig, clock, gait);
  built.renderer.render(built.scene, built.camera);

  bought.resize();
  if (creature && running) creature.update(delta);
  bought.renderer.render(bought.scene, bought.camera);

  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);

// --- controls -------------------------------------------------------------
document.querySelectorAll("[data-gait]").forEach((btn) => {
  btn.addEventListener("click", () => {
    gait = btn.dataset.gait;
    creature?.play(gait);
    document
      .querySelectorAll("[data-gait]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
  });
});

const tiltBtn = document.getElementById("tilt");
tiltBtn.addEventListener("click", () => {
  tilt = tilt === 0 ? 26 : 0;
  setTilt(built.camera, tilt);
  setTilt(bought.camera, tilt);
  tiltBtn.setAttribute("aria-pressed", String(tilt !== 0));
  tiltBtn.textContent = tilt === 0 ? "Tilt the 3D cameras" : "Back to straight down";
});

const play = document.getElementById("play");
play.addEventListener("click", () => {
  running = !running;
  play.textContent = running ? "Pause" : "Play";
  play.setAttribute("aria-pressed", String(running));
});
