// Capture the creature lab at a fixed animation time for design comparisons.
// Start Vite first, then: node scripts/swarm-design-shoot.mjs <label> [base-url]
import { mkdirSync, existsSync } from 'node:fs';
import { chromium } from 'playwright';
const label = process.argv[2];
if (!label || !/^[a-z0-9-]+$/.test(label)) throw new Error('Provide a lowercase capture label.');
const base = process.argv[3] ?? 'http://localhost:5173';
const out = 'docs/comparisons/rat-swarm';
mkdirSync(out, { recursive: true });
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? (existsSync(chrome) ? chrome : undefined),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1100 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await page.goto(`${base}/demo/creature-lab.html?kind=undead.swarm&gait=idle&tilt=on&yaw=180`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__lab?.facts?.figures > 100);
  await page.clock.runFor(1250);
  const png = await page.locator('#stage').screenshot({ path: `${out}/${label}-tilted.png` });
  // A discarded WebGL drawing buffer can still produce a valid, blank PNG.
  if (png.byteLength < 10_000) throw new Error('Lab capture is blank; retry the capture.');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(label, await page.evaluate(() => window.__lab.facts));
} finally {
  await browser.close();
}
