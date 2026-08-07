import * as THREE from "three";
import { part, meshOf, surfaceMaterial } from "../src/art/creatures/kit.js";

const canvas = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.debug.checkShaderErrors = true;
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 4 / 3, 0.1, 50);
camera.position.set(0, 2, 4);
camera.lookAt(0, 0, 0);
const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(3, 6, 2);
key.castShadow = true;
scene.add(key, new THREE.AmbientLight(0xffffff, 0.5));

const errors = [];
console.error = ((original) => (...args) => {
  errors.push(args.map(String).join(" "));
  original(...args);
})(console.error);

// One mesh holding a matte sphere and a polished metal box
const mesh = meshOf(
  [
    part(new THREE.SphereGeometry(0.5, 24, 18), 0xcfc6ad, { pos: [-0.7, 0, 0] }),
    part(new THREE.BoxGeometry(0.8, 0.8, 0.8), 0xc3cad2, {
      pos: [0.7, 0, 0],
      metalness: 0.72,
      roughness: 0.3,
    }),
  ],
  surfaceMaterial()
);
scene.add(mesh);

renderer.render(scene, camera);
const gl = renderer.getContext();
const pixels = new Uint8Array(320 * 240 * 4);
gl.readPixels(0, 0, 320, 240, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
let lit = 0;
for (let i = 0; i < pixels.length; i += 4) {
  if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 30) lit += 1;
}
const attrs = Object.keys(mesh.geometry.attributes).sort();
window.__probe = {
  glError: gl.getError(),
  shaderErrors: errors,
  attributes: attrs,
  vertices: mesh.geometry.attributes.position.count,
  litPixels: lit,
};
document.getElementById("out").textContent = JSON.stringify(window.__probe, null, 1);
