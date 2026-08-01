#!/usr/bin/env node
// Re-copy the rules core from a BattleDeck checkout into src/rules/.
//
//   node scripts/sync-rules.mjs ../battledeck
//
// src/rules/ is a vendored copy of BattleDeck's rules layer, not a fork: the
// files are taken across unmodified so a card correction made in BattleDeck
// reaches this table by re-running this script, with no merge to reason
// about. Anything this app adds on top lives outside src/rules/ — see
// src/rules/README.md.
import { cp, readdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES = resolve(HERE, "../src/rules");

// [source in BattleDeck, destination in src/rules]
const FILES = [
  ["src/derive.js", "derive.js"],
  ["src/constants.js", "modifiers.js"],
];
const DIRECTORIES = [["src/data", "data"]];
// BattleDeck's own tests for these files stay in BattleDeck
const DROP = ["data/data.test.js"];

const source = process.argv[2];
if (!source) {
  console.error("usage: node scripts/sync-rules.mjs <path-to-battledeck>");
  process.exit(1);
}

const root = resolve(process.cwd(), source);
if (!existsSync(join(root, "src/derive.js"))) {
  console.error(`Not a BattleDeck checkout: ${root}`);
  process.exit(1);
}

for (const [from, to] of DIRECTORIES) {
  await rm(join(RULES, to), { recursive: true, force: true });
  await cp(join(root, from), join(RULES, to), { recursive: true });
}
for (const [from, to] of FILES) {
  await cp(join(root, from), join(RULES, to));
}
for (const path of DROP) {
  await rm(join(RULES, path), { force: true });
}

const factions = await readdir(join(RULES, "data/factions"));
const { size } = await stat(join(RULES, "derive.js"));
console.log(
  `Synced rules from ${root}: ${factions.length} factions, derive.js ${size} bytes.`
);
console.log("Now run: npm test");
