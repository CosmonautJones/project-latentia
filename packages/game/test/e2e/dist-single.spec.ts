// The single-file build as it will be published as a Claude artifact: `pnpm e2e` builds dist-single/index.html (JS,
// CSS, sprites and favicon all inlined). The artifact host may frame it in a sandbox without allow-same-origin (an
// opaque origin), where module scripts with `crossorigin` and Phaser's XHR image loads would need CORS headers, and
// localStorage throws. This server sends no CORS headers at all. Checked: the file is one self-contained page under
// 16 MiB; it plays from a plain nested path, and inside <iframe sandbox="allow-scripts"> on a phone (with the one
// "saves unavailable" notice), from the title into the lab and the first battle, with no console errors, no failed
// requests, and no request but the HTML itself.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { resolve } from 'node:path';
import { expect, test, type Page, type Request } from '@playwright/test';

const FILE = resolve(import.meta.dirname, '../../dist-single/index.html');
const PORT = 4319;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const GAME = '/some/sub/dir/index.html';
const HOST = '/host/index.html';
const HOST_PAGE = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><style>html,body{margin:0;height:100%;overflow:hidden}iframe{border:0;width:100%;height:100%;display:block}</style></head><body><iframe sandbox="allow-scripts" src="${GAME}"></iframe></body></html>`;
const PORTRAIT = { width: 390, height: 844 };

let server: Server;
test.beforeAll(async () => {
  server = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    // text/html only, and no Access-Control-* headers.
    if (path === GAME) res.writeHead(200, { 'content-type': 'text/html' }).end(readFileSync(FILE));
    else if (path === HOST) res.writeHead(200, { 'content-type': 'text/html' }).end(HOST_PAGE);
    else res.writeHead(404).end();
  });
  await new Promise<void>((done) => server.listen(PORT, '127.0.0.1', done));
});
test.afterAll(() => new Promise<void>((done) => server.close(() => done())));

/** Console errors, uncaught errors in any frame, failed or 4xx/5xx requests, and every URL requested (data: and blob: aside). */
function watch(page: Page): { errors: string[]; requests: string[] } {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || (m.type() === 'warning' && /fail|error/i.test(m.text()))) errors.push(`console.${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`failed: ${r.url().slice(0, 80)} ${r.failure()?.errorText ?? ''}`));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  page.on('request', (r: Request) => {
    if (!/^(data|blob):/.test(r.url())) requests.push(r.url());
  });
  return { errors, requests };
}

/** Uncaught errors and rejections in every frame, the sandboxed one included, reach the console as errors. */
const reportFrameErrors = (page: Page) =>
  page.addInitScript(() => {
    window.addEventListener('error', (e) => console.error(`uncaught: ${e.message}`));
    window.addEventListener('unhandledrejection', (e) => console.error(`unhandled: ${String(e.reason)}`));
  });

test('dist-single is one self-contained index.html under 16 MiB: inline script and style, every image a data: URI', () => {
  const dir = resolve(FILE, '..');
  expect(readdirSync(dir)).toEqual(['index.html']);
  const bytes = statSync(FILE).size;
  console.log(`dist-single/index.html: ${bytes} bytes (${(bytes / 1024 / 1024).toFixed(2)} MiB)`);
  expect(bytes).toBeLessThan(16 * 1024 * 1024);
  const html = readFileSync(FILE, 'utf8');
  expect(html).toContain('<title>Latentia v0</title>');
  // One inline module script, no chunk imports, no external stylesheet, no src= or url() to fetch.
  const scripts = html.match(/<script\b[^>]*>/g) ?? [];
  expect(scripts).toEqual(['<script type="module">']);
  expect(html).not.toMatch(/<link[^>]+rel="(stylesheet|modulepreload)"/);
  expect(html).not.toMatch(/\bimport\s*\(\s*["'`]\.|\bfrom\s*["']\.\.?\//);
  // The markup around the inlined code: every src/href in it is a data: URI.
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '');
  expect(markup.length).toBeLessThan(10_000);
  for (const ref of markup.match(/\b(?:src|href)="[^"]{0,40}/g) ?? []) expect(ref).toMatch(/^(src|href)="data:/);
  expect(html).not.toMatch(/url\(\s*["']?(?!data:)[^)"']+\.(png|svg|woff2?|ttf|otf)/);
  // The three starter sheets are in as PNG data: URIs; the favicon as an SVG one.
  for (const sheet of ['sagelet', 'blitzr', 'forkling']) expect(html).toMatch(new RegExp(`"assets/${sheet}-idle\\.png":"data:image/png;base64,`));
  expect(html).toContain('<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,');
  for (const devOnly of ['__latentia', 'installHook', 'plannedMs', 'actualMs']) expect(html, devOnly).not.toContain(devOnly);
  const urls = new Set(html.match(/https?:\/\/[^\s"'`)]+/g) ?? []);
  for (const url of urls) expect(url).toMatch(/^(http:\/\/www\.w3\.org\/|https:\/\/phaser\.io\/?$)/);
});

test('from a plain nested path it plays from the title into the lab and the first battle, fetching only the HTML', async ({ page }) => {
  await reportFrameErrors(page);
  const { errors, requests } = watch(page);
  const saved = () => page.evaluate(() => JSON.parse(window.localStorage.getItem('latentia.save.v0') ?? 'null')?.progress?.step ?? null);
  await page.goto(`${ORIGIN}${GAME}`);
  await expect(page).toHaveTitle('Latentia v0');
  await expect(page.locator('#frame canvas')).toBeVisible();
  await expect.poll(async () => (await page.keyboard.press('Enter'), saved())).toBe('lab');
  await expect.poll(async () => (await page.keyboard.press('KeyZ'), saved()), { timeout: 20_000 }).toBe('rival');
  await page.waitForTimeout(800);
  await expect(page.locator('#notice')).toHaveCount(0);
  expect(requests).toEqual([`${ORIGIN}${GAME}`]);
  expect(errors).toEqual([]);
});

test('inside <iframe sandbox="allow-scripts"> (opaque origin, no CORS) on a phone it plays into the lab and battle, saves unavailable', async ({ browser }) => {
  const context = await browser.newContext({ viewport: PORTRAIT, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await reportFrameErrors(page);
  const { errors, requests } = watch(page);
  await page.goto(`${ORIGIN}${HOST}`);
  const game = page.frameLocator('iframe');
  // The frame really is opaque: its origin serializes as "null", and localStorage throws there.
  const frame = page.frames().find((f) => f.url().endsWith(GAME));
  expect(frame).toBeDefined();
  await expect(game.locator('#frame canvas')).toBeVisible();
  expect(await frame?.evaluate(() => window.origin)).toBe('null');
  expect(
    await frame?.evaluate(() => {
      try {
        void window.localStorage;
        return 'ok';
      } catch {
        return 'throws';
      }
    }),
  ).toBe('throws');
  // Exactly one "saves unavailable" notice.
  await expect(game.locator('#notice')).toHaveCount(1);
  await expect(game.locator('#notice')).toHaveAttribute('aria-label', 'SAVES UNAVAILABLE');

  // The title's band button starts a new game (no save, so no confirm); A through the professor until the starter
  // panel's band buttons appear, which only happens in the lab.
  await game.locator('#band-panel [data-menu="title"][data-index="0"]').click();
  await expect
    .poll(
      async () => {
        if ((await game.locator('#band-panel [data-menu="starter"]').count()) > 0) return true;
        await game.locator('[data-control="btn-a"]').click();
        return false;
      },
      { timeout: 20_000 },
    )
    .toBe(true);
  // Pick Sagelet: the rival battle (its starter sprite came from a data: URI); A through the intro to the command menu.
  await game.locator('#band-panel [data-menu="starter"][data-index="0"]').click();
  await expect
    .poll(
      async () => {
        if ((await game.locator('#band-panel [data-menu="battle-root"]').count()) > 0) return true;
        await game.locator('[data-control="btn-a"]').click();
        return false;
      },
      { timeout: 20_000 },
    )
    .toBe(true);
  await page.waitForTimeout(500);
  await expect(game.locator('#notice')).toHaveCount(1);
  expect(requests).toEqual([`${ORIGIN}${HOST}`, `${ORIGIN}${GAME}`]);
  expect(errors).toEqual([]);
  await context.close();
});

