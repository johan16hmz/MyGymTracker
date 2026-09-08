// Usage: node tests/mobile-check.mjs <path-to-playwright> [base-url]
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
await page.emulateMedia({ reducedMotion: 'reduce' });
const base = process.argv[3] ?? 'http://127.0.0.1:5173';
const errors = [];
page.on('pageerror', error => errors.push(error.message));
// The fixture must never write to a real backend.
await page.route('**/*.supabase.co/**', route => route.abort());
async function check(label) {
  const result = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    smallInputs: [...document.querySelectorAll('input, select')].filter(el => el.getBoundingClientRect().width > 0 && parseFloat(getComputedStyle(el).fontSize) < 16).length,
  }));
  assert.ok(result.scroll <= result.width + 1, `${label}: page overflow ${JSON.stringify(result)}`);
  if (result.width <= 768) assert.equal(result.smallInputs, 0, `${label}: input font below 16px`);
}
try {
  for (const width of [320, 375, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const view of ['login','list','edit','create','detail','template','force','forceCreate']) {
      await page.goto(`${base}/tests/mobile-preview.html?view=${view}`);
      await page.locator('#app > *').waitFor();
      await check(`${width}/${view}`);
      if (view === 'list') { await page.getByRole('button', { name: 'Afficher les séries' }).click(); await check(`${width}/expanded`); }
      if (view === 'force') {
        if (width <= 768) {
          await page.getByRole('button', { name: 'Sem. 3', exact: true }).click();
          assert.equal(await page.locator('.force-week:visible').count(), 1);
          await page.getByRole('heading', { name: 'Semaine 3' }).waitFor({ state: 'visible' });
        }
        await page.getByRole('button', { name: '+ Enregistrer une série', exact: true }).filter({ visible: true }).first().click();
        await check(`${width}/performance`);
      }
      if (view === 'template') { await page.locator('.template-card').first().click(); await check(`${width}/template-options`); }
    }
    console.log(`OK ${width}px: all screens, expanded cards, performance form and template options`);
  }
  assert.deepEqual(errors, []);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/tests/mobile-preview.html?view=force`);
  await page.locator('.force-week:visible').waitFor();
  await page.screenshot({ path: process.env.TEMP + '/mygymtracker-mobile-force.png', fullPage: true });
} finally { await browser.close(); }
