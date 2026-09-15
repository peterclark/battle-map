// Photograph units on the real board, at the size they are played at.
//
// The army-animation skill allows exactly one test of whether a figure works:
//
//   > Verify at stand scale, not at lab scale. The lab shows a creature many
//   > times the size it will be played at, where everything looks good. That is
//   > not the test.
//
// That test used to mean building the app, driving it to the battlefield by
// hand, flipping the toggle and squinting. This does it in one command, so a
// before-and-after pair costs nothing and every figure change can carry one.
//
//   npm run board:shoot -- --faction undeadArmy
//   npm run board:shoot -- --units undeadArmy/zombies,undeadArmy/abomination
//   npm run board:shoot -- --faction undeadArmy --gait march --label after
//
// Writes one PNG per unit plus a whole-board contact sheet, into
// `.board-shots/<label>/`. Pass `--label before` and `--label after` around a
// change and the two directories line up file for file.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_ROOT = join(ROOT, ".board-shots");
const PORT = Number(process.env.BOARD_SHOOT_PORT) || 5176;

// 48 board inches across this many pixels is about 66 px per inch, which puts a
// 2.5-inch stand at ~166 px — the size the skill quotes for a 4K 55-inch panel,
// and therefore the size the figures have to survive.
const VIEWPORT_WIDTH = 3200;

// Three.js, the rigs and the first frame. Generous rather than tight: this
// exists to fail a hung page, not to pace a healthy one.
const READY_TIMEOUT_MS = 60_000;
// The figures animate. Let the loop run past its first frame so a screenshot
// catches a settled pose rather than the build.
const SETTLE_MS = 1_500;

const usage = `Usage:
  npm run board:shoot -- --faction <factionId>
  npm run board:shoot -- --units <uid,uid,...>

Options:
  --gait idle|march   default idle
  --label <name>      subdirectory under .board-shots, default "shot"
`;

const parseArgs = (argv) => {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    if (!key || argv[i + 1] === undefined) return null;
    args[key] = argv[i + 1];
  }
  if (!args.faction && !args.units) return null;
  return {
    faction: args.faction,
    units: args.units,
    gait: args.gait === "march" ? "march" : "idle",
    label: args.label ?? "shot",
  };
};

/**
 * Chromium to drive.
 *
 * Playwright manages its own download on a developer machine and in CI. Some
 * sandboxes ship a browser at a fixed path and block the download, so an
 * explicit path wins, then a discovered one, then Playwright's own.
 */
const chromiumPath = () => {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const pool = "/opt/pw-browsers";
  if (!existsSync(pool)) return undefined;
  return readdirSync(pool)
    .filter((name) => name.startsWith("chromium-"))
    .map((name) => join(pool, name, "chrome-linux", "chrome"))
    .find(existsSync);
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
  for (let i = 0; i < 60; i += 1) {
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

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error(usage);
    process.exit(1);
  }

  const query = new URLSearchParams({ gait: args.gait });
  if (args.faction) query.set("faction", args.faction);
  if (args.units) query.set("units", args.units);

  const outDir = join(OUT_ROOT, args.label);
  mkdirSync(outDir, { recursive: true });

  const { vite, base } = await startVite();
  const browser = await chromium.launch({
    executablePath: chromiumPath(),
    // No GPU in these containers, and the figures only need to be correct.
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
  });

  const problems = [];
  let shot;
  try {
    const page = await browser.newPage({
      viewport: {
        width: VIEWPORT_WIDTH,
        // The page sizes the board to 48:27 off the viewport width, so the
        // window only has to be tall enough not to clip it.
        height: Math.ceil((VIEWPORT_WIDTH * 27) / 48),
      },
    });
    page.on("pageerror", (e) => problems.push(`threw: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") problems.push(`console: ${m.text()}`);
    });
    page.on("response", (r) => {
      if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`);
    });

    // Vite optimises a dependency on first request and full-reloads the page
    // with a new `?v=` hash, which strands the chunk the first load asked for.
    // Spend that reload before anything is measured.
    await page.goto(`${base}/demo/board-shoot.html?${query}`, {
      waitUntil: "networkidle",
      timeout: READY_TIMEOUT_MS,
    });
    await page.goto(`${base}/demo/board-shoot.html?${query}`, {
      waitUntil: "networkidle",
      timeout: READY_TIMEOUT_MS,
    });

    shot = await page.evaluate(async (settle) => {
      await new Promise((r) => setTimeout(r, settle));
      return window.__shoot ?? null;
    }, SETTLE_MS);

    if (!shot) throw new Error("the page never reported a layout");
    if (shot.units.length === 0) {
      throw new Error("no units matched — check the faction id or the uids");
    }

    // Progress goes to stderr, which Node does not buffer when stdout is a
    // pipe. Each capture re-renders a 3200px board through SwiftShader and
    // takes tens of seconds, so a run without this looks indistinguishable
    // from a hang for minutes at a time.
    const total = shot.units.length + 1;
    let done = 0;
    const tick = (name) => {
      done += 1;
      process.stderr.write(`  [${done}/${total}] ${name}\n`);
    };

    await page.screenshot({
      path: join(outDir, "_sheet.png"),
      clip: shot.sheetClip,
    });
    tick("contact sheet");

    for (const unit of shot.units) {
      const file = `${unit.uid.replace(/\//g, "-")}.png`;
      await page.screenshot({ path: join(outDir, file), clip: unit.clip });
      tick(unit.name);
    }
  } catch (e) {
    problems.push(e.message);
  } finally {
    await browser.close();
    vite.kill();
  }

  if (shot) {
    const stand = `${Math.round(shot.standPx.w)} x ${Math.round(shot.standPx.h)}`;
    console.log(
      `\n${shot.units.length} units, gait ${shot.gait}, ` +
        `${shot.pxPerInch.toFixed(1)} px/inch, a stand is ${stand} px`
    );
    const bare = shot.units.filter((u) => !u.hasFigures);
    if (bare.length) {
      console.log(
        `\nNo figures modelled, photographed as bare cards:\n  ` +
          bare.map((u) => u.name).join("\n  ")
      );
    }
    console.log(`\nPNGs in ${outDir.replace(`${ROOT}/`, "")}/`);
  }

  if (problems.length) {
    console.log(`\nFAILED\n  ${problems.slice(0, 8).join("\n  ")}`);
    process.exit(1);
  }
};

await main();
