import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const errors = [];
const glbResponses = [];
const launchOptions = { headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] };
if (process.env.CHROME_BIN) launchOptions.executablePath = process.env.CHROME_BIN;
const browser = await chromium.launch(launchOptions);
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', error => errors.push('pageerror: ' + error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push('console: ' + message.text());
  });
  page.on('requestfailed', request => errors.push('requestfailed: ' + request.url() + ' — ' + (request.failure()?.errorText || 'unknown')));
  page.on('response', response => {
    if (response.url().includes('garrafa-termica-azul.glb')) {
      glbResponses.push({ status: response.status(), bytes: Number(response.headers()['content-length'] || 0), url: response.url() });
    }
  });

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#products [data-product]', { timeout: 30000 });

  const productCard = page.locator('.product-card').filter({ hasText: 'Garrafa térmica azul com tampa' }).first();
  await productCard.locator('.product-photo-open').click();
  await page.waitForSelector('#customModal.open', { timeout: 10000 });
  if (!(await page.locator('#modalTitle').textContent()).includes('Garrafa térmica azul')) throw new Error('Product photo click did not open the selected product customizer.');
  await page.waitForFunction(() => ['ready', 'error'].includes(window.__SUTIL_3D_STATUS?.state), undefined, { timeout: 60000 });

  const status = await page.evaluate(() => window.__SUTIL_3D_STATUS);
  if (!glbResponses.length || glbResponses.some(response => response.status !== 200)) {
    throw new Error('O arquivo GLB não foi baixado corretamente: ' + JSON.stringify(glbResponses));
  }
  const glbBytes = glbResponses[glbResponses.length - 1].bytes;
  if (glbBytes && glbBytes > 8 * 1024 * 1024) throw new Error('O modelo 3D ultrapassou o orçamento de 8 MB: ' + glbBytes);
  if (status.state !== 'ready') {
    await fs.mkdir('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/bottle-3d-failure.png' });
    throw new Error('3D viewer did not initialize: ' + JSON.stringify(status) + '\nBrowser errors:\n' + errors.join('\n'));
  }

  const canvas = page.locator('#bottle3dCanvas');
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox || canvasBox.width < 250 || canvasBox.height < 250) {
    throw new Error('3D canvas has invalid dimensions: ' + JSON.stringify(canvasBox));
  }
  const gl = await canvas.evaluate(element => {
    const context = element.getContext('webgl2');
    if (!context) return { available: false };
    return {
      available: true,
      version: context.getParameter(context.VERSION),
      width: element.width,
      height: element.height
    };
  });
  if (!gl.available) throw new Error('WebGL2 context is unavailable.');

  await page.locator('#customText').fill('Teste Sútil 3D');
  await page.locator('#customSize').evaluate(element => {
    element.value = '32';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#customPosition').evaluate(element => {
    element.value = '36';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });

  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160"><circle cx="80" cy="80" r="50" fill="#d6bd8d"/><text x="155" y="92" font-size="34" fill="#24335c">SL</text></svg>';
  await page.locator('#customLogo').setInputFiles({
    name: 'logo-teste.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(svg)
  });
  await page.waitForFunction(() => window.__SUTIL_3D_STATUS?.state === 'editing' && window.__SUTIL_3D_STATUS?.updates >= 4, undefined, { timeout: 15000 });
  await page.locator('#modelRotateRight').click();
  await page.locator('#modelViewReset').click();
  await page.locator('#modelRotateLeft').click();
  await page.locator('#bottle3dCanvas').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/bottle-3d-success.png' });

  const finalStatus = await page.evaluate(() => window.__SUTIL_3D_STATUS);
  console.log(JSON.stringify({ result: 'PASS', initialStatus: status, finalStatus, gl, canvas: canvasBox, glbResponses, browserErrors: errors }, null, 2));
} finally {
  await browser.close();
}
