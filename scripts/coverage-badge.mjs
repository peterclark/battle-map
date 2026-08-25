#!/usr/bin/env node
/**
 * Turn `coverage/coverage-summary.json` into a shields.io endpoint badge.
 *
 * shields.io renders a badge from any publicly readable JSON matching its
 * endpoint schema, which means a coverage badge needs no third-party coverage
 * service, no account, and no secret beyond the `GITHUB_TOKEN` every workflow
 * already has. CI writes the output to the orphan `badges` branch and the
 * badge URL points at that file's raw URL.
 *
 * Lifted from the same setup in `peterclark/pointing.page`, so the two
 * repositories publish badges the same way and neither has to be understood
 * twice.
 *
 * Usage: node scripts/coverage-badge.mjs [outDir]   (default: badges/)
 *
 * @see https://shields.io/badges/endpoint-badge
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SUMMARY_PATH = "coverage/coverage-summary.json";
const outDir = process.argv[2] ?? "badges";

/** shields.io's named colours, best to worst. */
const SCALE = [
  { min: 90, color: "brightgreen" },
  { min: 80, color: "green" },
  { min: 70, color: "yellowgreen" },
  { min: 60, color: "yellow" },
  { min: 50, color: "orange" },
  { min: 0, color: "red" },
];

const colorFor = (pct) => SCALE.find((step) => pct >= step.min).color;

let summary;
try {
  summary = JSON.parse(readFileSync(SUMMARY_PATH, "utf8"));
} catch (error) {
  console.error(
    `Could not read ${SUMMARY_PATH}. Run \`npm run test:coverage\` first — ` +
      `the 'json-summary' reporter has to be enabled in vite.config.js.`
  );
  console.error(error.message);
  process.exit(1);
}

const { lines, statements, branches, functions } = summary.total;
const pct = Math.round(lines.pct * 10) / 10;

mkdirSync(outDir, { recursive: true });

const badge = {
  schemaVersion: 1,
  label: "coverage",
  message: `${pct}%`,
  color: colorFor(pct),
};
writeFileSync(join(outDir, "coverage.json"), `${JSON.stringify(badge, null, 2)}\n`);

// The full numbers alongside the badge, so the one figure on the README is
// never the only thing on record.
const detail = {
  lines: lines.pct,
  statements: statements.pct,
  branches: branches.pct,
  functions: functions.pct,
  coveredLines: lines.covered,
  totalLines: lines.total,
  // What the percentage is *of* — see the coverage block in vite.config.js.
  // Without this the number is unfalsifiable.
  scope: "src/**/*.js, excluding the Three.js creature rigs and the tests",
};
writeFileSync(join(outDir, "coverage-detail.json"), `${JSON.stringify(detail, null, 2)}\n`);

console.log(`coverage badge: ${badge.message} (${badge.color}) -> ${outDir}/coverage.json`);
