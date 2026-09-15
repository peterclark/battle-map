// Render every reference build headlessly and say what came out.
//
// The reference pages under `docs/reference/` are the direction a rig was built
// against, and until now the one thing nobody could check without a browser and
// a human was whether they still render. They pulled Three.js from unpkg behind
// integrity pins, so anywhere egress is filtered — which is every agent session
// that works on this board — the most that could be verified was that the files
// parsed. A reference build that silently stopped rendering would have looked
// exactly like one that was fine.
//
// They now import the copy of Three.js in `node_modules`, the same version
// `src/` builds against, which makes this script possible: start Vite, load
// each page, wait for the stage, count what got built, and write a PNG.
//
// Counting is the part that matters. A page that throws before it adds anything
// still paints a background and still screenshots, so "produced an image" is not
// evidence of anything. Zero meshes fails the run.
//
//   npm run reference:shoot            all of them
//   npm run reference:shoot dragon     just this one

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REFERENCE_DIR = join(ROOT, "docs", "reference");
const OUT_DIR = join(ROOT, ".reference-shots");
const PORT = Number(process.env.REFERENCE_PORT) || 5178;

// Wait this long for a page to build its geometry. The heaviest reference is a
// few hundred meshes of procedural geometry, so this is generous rather than
// tight; it exists to fail a hung page rather than to pace a healthy one.
const READY_TIMEOUT_MS = 45_000;
// The stage animates, and a turntable that has not stepped yet can screenshot
// mid-construction. One settle beat after ready.
const SETTLE_MS = 1_200;

/**
 * Chromium to drive.
 *
 * Playwright normally manages its own download, which is what happens on a
 * developer machine and in CI after `npx playwright install chromium`. Some
 * sandboxes ship a browser at a fixed path instead and block the download, so
 * an explicit path wins, then a discovered one, then Playwright's own.
 */
const chromiumPath = () => {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const pool = "/opt/pw-browsers";
  if (!existsSync(pool)) return undefined;
  const found = readdirSync(pool)
    .filter((name) => name.startsWith("chromium-"))
    .map((name) => join(pool, name, "chrome-linux", "chrome"))
    .find(existsSync);
  return found;
};

const startVite = async () => {
  const vite = spawn(
    "npx",
    ["vite", "--port", String(PORT), "--strictPort", "--clearScreen", "false"],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }
  );
  const log = [];
  vite.stdout.on("data", (d) => log.push(String(d)));
  vite.stderr.on("data", (d) => log.push(String(d)));

  const base = `http://localhost:${PORT}`;
  for (let i = 0; i < 60; i++) {
    if (vite.exitCode !== null) {
      throw new Error(`vite exited (${vite.exitCode}):\n${log.join("")}`);
    }
    try {
      const res = await fetch(base, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return { vite, base };
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  vite.kill();
  throw new Error(`vite did not come up on ${base}:\n${log.join("")}`);
};

/**
 * Make Vite pre-bundle Three.js before anything is measured.
 *
 * Vite optimises a dependency the first time a page asks for it, and then
 * full-reloads that page with a new `?v=` hash. Whichever reference happened to
 * load first wore the stranded chunk as a 404 and failed a run that was really
 * about nothing. Asking for the page once, and throwing the answer away, moves
 * that reload somewhere it cannot be mistaken for a broken reference.
 */
const warmUp = async (browser, base, name) => {
  const page = await browser.newPage();
  try {
    await page.goto(`${base}/docs/reference/${name}.html`, {
      waitUntil: "networkidle",
      timeout: READY_TIMEOUT_MS,
    });
  } catch {
    // A warm-up failure is not a result. If the page is genuinely broken the
    // measured pass below will say so, with the detail attached.
  } finally {
    await page.close();
  }
};

/** Load one reference page, measure what it built, and screenshot it. */
const shoot = async (browser, base, name) => {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 800 },
    deviceScaleFactor: 2,
  });

  // Anything the page could not fetch, threw, or logged as an error. A
  // reference that renders but logs a failed import is still broken.
  const problems = [];
  page.on("pageerror", (e) => problems.push(`threw: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
  page.on("response", (r) => {
    if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`);
  });
  page.on("requestfailed", (r) => problems.push(`request failed: ${r.url()}`));

  let built = { meshes: 0, triangles: 0 };
  try {
    await page.goto(`${base}/docs/reference/${name}.html`, {
      waitUntil: "networkidle",
      timeout: READY_TIMEOUT_MS,
    });
    built = await page.evaluate(async (settle) => {
      const stage = document.querySelector("three-d-stage");
      if (!stage) throw new Error("no <three-d-stage> on the page");
      await stage.ready;
      await new Promise((r) => setTimeout(r, settle));
      const scene = stage._scene ?? stage.scene;
      if (!scene) throw new Error("stage exposes no scene to measure");
      let meshes = 0;
      let triangles = 0;
      scene.traverse((o) => {
        if (!o.isMesh) return;
        meshes++;
        const g = o.geometry;
        const count = g.index ? g.index.count : g.attributes.position.count;
        triangles += count / 3;
      });
      return { meshes, triangles: Math.round(triangles) };
    }, SETTLE_MS);

    mkdirSync(OUT_DIR, { recursive: true });
    await page.screenshot({ path: join(OUT_DIR, `${name}.png`) });
  } catch (e) {
    problems.push(`${e.message}`);
  } finally {
    await page.close();
  }

  // An empty scene screenshots just as happily as a full one.
  if (built.meshes === 0) problems.push("built nothing — the scene has no meshes");

  return { name, ...built, problems };
};

const main = async () => {
  const wanted = process.argv.slice(2);
  const names = readdirSync(REFERENCE_DIR)
    .filter((f) => f.endsWith(".html"))
    .map((f) => f.replace(/\.html$/, ""))
    .filter((n) => wanted.length === 0 || wanted.includes(n))
    .sort();

  if (names.length === 0) {
    console.error(
      wanted.length
        ? `No reference page matches ${wanted.join(", ")}.`
        : `No .html pages in ${REFERENCE_DIR}.`
    );
    process.exit(1);
  }

  const { vite, base } = await startVite();
  const browser = await chromium.launch({
    executablePath: chromiumPath(),
    // SwiftShader: these containers have no GPU, and the reference pages only
    // need the geometry to be real, not the pixels to be fast.
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
  });

  let results = [];
  try {
    await warmUp(browser, base, names[0]);
    for (const name of names) results.push(await shoot(browser, base, name));
  } finally {
    await browser.close();
    vite.kill();
  }

  const pad = Math.max(...results.map((r) => r.name.length), 9);
  console.log(`\n${"reference".padEnd(pad)}  meshes  triangles  result`);
  for (const r of results) {
    const ok = r.problems.length === 0;
    console.log(
      `${r.name.padEnd(pad)}  ${String(r.meshes).padStart(6)}  ` +
        `${String(r.triangles).padStart(9)}  ${ok ? "ok" : "FAILED"}`
    );
    for (const p of r.problems) console.log(`${" ".repeat(pad)}  ${p}`);
  }

  const failed = results.filter((r) => r.problems.length > 0);
  console.log(
    failed.length
      ? `\n${failed.length} of ${results.length} failed.`
      : `\nAll ${results.length} rendered. PNGs in ${OUT_DIR.replace(ROOT + "/", "")}/`
  );
  process.exit(failed.length ? 1 : 0);
};

await main();
