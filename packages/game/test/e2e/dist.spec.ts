// The production build as it will be published: a static page served from an arbitrary sub-path (a Claude artifact).
// `pnpm e2e` builds it into dist/ first. Checks the bundle (no dev hook, no test-only code, no external URLs, few
// files, a phone viewport) and plays it from /some/sub/dir/: the title, then into the lab and the first battle, with
// no console errors, no failed requests, and every request under that path.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const DIST = resolve(import.meta.dirname, '../../dist');
const BASE = '/some/sub/dir/';
const PORT = 4318;
const ORIGIN = `http://127.0.0.1:${PORT}`;

const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

let server: Server;
test.beforeAll(async () => {
  server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
    if (!path.startsWith(BASE)) {
      res.writeHead(404).end();
      return;
    }
    const rel = normalize(path.slice(BASE.length) || 'index.html');
    const file = join(DIST, rel);
    if (!file.startsWith(DIST) || !files(DIST).includes(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
  });
  await new Promise<void>((done) => server.listen(PORT, '127.0.0.1', done));
});
test.afterAll(() => new Promise<void>((done) => server.close(() => done())));

test('the production bundle has no dev hook or test-only code, no external URLs, few files and a phone viewport', () => {
  const all = files(DIST);
  expect(all.length).toBeLessThanOrEqual(20);
  const text = all.filter((f) => /\.(js|css|html)$/.test(f)).map((f) => readFileSync(f, 'utf8'));
  const bundle = text.join('\n');
  // The hook (dev/hook.ts) and the battle/overworld probes' bookkeeping exist only in dev and test builds.
  for (const devOnly of ['__latentia', 'installHook', 'plannedMs', 'actualMs', 'shouldExposeHook']) expect(bundle, devOnly).not.toContain(devOnly);
  // The only absolute URLs are XML namespaces and Phaser's own (unused: banner off) homepage string; nothing is fetched.
  const urls = new Set(bundle.match(/https?:\/\/[^\s"'`)]+/g) ?? []);
  for (const url of urls) expect(url).toMatch(/^(http:\/\/www\.w3\.org\/|https:\/\/phaser\.io\/?$)/);
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  expect(html).toContain('<title>Latentia v0</title>');
  expect(html).toMatch(/<meta name="viewport" content="[^"]*maximum-scale=1[^"]*user-scalable=no/);
  for (const ref of html.match(/(?:src|href)="[^"]+"/g) ?? []) expect(ref).toMatch(/^(src|href)="\.\//);
});

test('served from a nested path, the build plays from the title into the lab and the first battle', async ({ page }) => {
  const errors: string[] = [];
  const offPath: string[] = [];
  const sprites: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`failed: ${r.url()} ${r.failure()?.errorText ?? ''}`));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`);
    else if (r.url().endsWith('-idle.png')) sprites.push(r.url().slice(ORIGIN.length));
  });
  page.on('request', (r) => {
    const url = r.url();
    if (!url.startsWith(`${ORIGIN}${BASE}`) && !url.startsWith('data:') && !url.startsWith('blob:')) offPath.push(url);
  });
  const saved = () => page.evaluate(() => JSON.parse(window.localStorage.getItem('latentia.save.v0') ?? 'null')?.progress?.step ?? null);

  await page.goto(`${ORIGIN}${BASE}`);
  await expect(page).toHaveTitle('Latentia v0');
  await expect(page.locator('#frame canvas')).toBeVisible();
  expect(await page.evaluate(() => 'latentia' in window || '__latentia' in window)).toBe(false);
  // The title's menu takes Enter once it is up; entering the lab saves the step.
  await expect
    .poll(async () => {
      await page.keyboard.press('Enter');
      return saved();
    })
    .toBe('lab');
  // A through the professor's lines, then A on the starter panel picks Sagelet: the rival battle loads its sprites.
  await expect
    .poll(
      async () => {
        await page.keyboard.press('KeyZ');
        return saved();
      },
      { timeout: 20_000 },
    )
    .toBe('rival');
  // The starter sprites come from the sub-path too (relative asset URLs).
  await expect.poll(() => sprites.length, { timeout: 10_000 }).toBeGreaterThan(0);
  for (const s of sprites) expect(s.startsWith(`${BASE}assets/`)).toBe(true);
  await page.waitForTimeout(500);
  expect(offPath).toEqual([]);
  expect(errors).toEqual([]);
});
