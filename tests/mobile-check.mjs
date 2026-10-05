// Usage: node tests/mobile-check.mjs <path-to-playwright> [base-url]
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
await page.addInitScript(() => localStorage.clear());
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
    smallInputs: [...document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), select')].filter(el => el.checkVisibility() && el.getBoundingClientRect().width > 0 && parseFloat(getComputedStyle(el).fontSize) < 16).length,
  }));
  assert.ok(result.scroll <= result.width + 1, `${label}: page overflow ${JSON.stringify(result)}`);
  if (result.width <= 700) assert.equal(result.smallInputs, 0, `${label}: input font below 16px`);
}
try {
  for (const width of [320, 375, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const view of ['login','list','edit','create','detail','template','force','forceCreate']) {
      await page.goto(`${base}/tests/mobile-preview.html?view=${view}`);
      await page.locator('#app > *').waitFor();
      await check(`${width}/${view}`);
      if (view === 'list') { await page.getByRole('button', { name: 'Afficher les séries' }).click(); await check(`${width}/expanded`); }
      if (view === 'create' || view === 'edit') {
        const initialCount = await page.locator('.exercise-block').count();
        for (let index = 1; index <= 3; index++) {
          await page.getByRole('button', { name: '+ Ajouter un exercice', exact: true }).click();
          assert.equal(await page.locator('.exercise-block').count(), initialCount + index);
          const input = page.getByRole('combobox', { name: `Nom de l'exercice ${initialCount + index}`, exact: true });
          if (width <= 700) {
            assert.equal(await input.evaluate(el => el === document.activeElement), false, 'Adding on mobile must not open the keyboard automatically');
            const bounds = await input.boundingBox();
            assert.ok(bounds.y >= 0 && bounds.y + bounds.height < 844 - 84, 'New exercise field must be visible above navigation');
          } else assert.equal(await input.evaluate(el => el === document.activeElement), true, 'Desktop retains automatic focus');
          await input.fill(`Bench ${index}`);
          await page.locator('.exercise-block').last().getByRole('button', { name: '+ Ajouter une série', exact: true }).click();
          await check(`${width}/${view}/added-${index}`);
        }
      }
      if (view === 'force') {
        const originalWeights = await page.locator('.force-prescription > label input').evaluateAll(inputs => inputs.map(input => input.value));
        assert.equal(await page.locator('.force-load-editor input').last().inputValue(), '1', 'The default reduction must be 1%');
        if (width <= 700) {
          await page.getByRole('button', { name: 'Sem. 3', exact: true }).click();
          assert.equal(await page.locator('.force-week:visible').count(), 1);
          await page.getByRole('heading', { name: 'Semaine 3' }).waitFor({ state: 'visible' });
        }
        await page.getByRole('button', { name: '+ Enregistrer une série', exact: true }).filter({ visible: true }).first().click();
        await check(`${width}/performance`);
        const sets = page.getByRole('combobox', { name: 'Nombre de séries · Tractions · Semaine 3 · 5 reps', exact: true });
        const activeWeek = width <= 700 ? 3 : 1;
        const activeSets = activeWeek === 3 ? sets : page.getByRole('combobox', { name: 'Nombre de séries · Tractions · Semaine 1 · 5 reps', exact: true });
        const weight = page.getByRole('textbox', { name: `Charge prévue Tractions semaine ${activeWeek}, 5 reps (kg)`, exact: true });
        const before = Number(await weight.inputValue());
        await activeSets.selectOption('5');
        assert.ok(Number(await weight.inputValue()) < before, 'More sets must lower the planned load');
        assert.equal(await activeSets.inputValue(), '5');
        await check(`${width}/volume`);
        const otherSets = page.getByRole('combobox', { name: `Nombre de séries · Tractions · Semaine ${activeWeek} · 3 reps`, exact: true });
        await otherSets.selectOption('7');
        const countsBefore = await page.locator('.force-prescription select').evaluateAll(elements => elements.map(element => element.value));
        const adjustedWeight = Number(await weight.inputValue());
        await page.locator('.force-load-editor input').first().fill('50');
        await page.getByRole('button', { name: 'Recalculer les charges', exact: true }).click();
        assert.deepEqual(await page.locator('.force-prescription select').evaluateAll(elements => elements.map(element => element.value)), countsBefore, 'Recalculating must preserve every selected set count');
        assert.equal(await activeSets.inputValue(), '5');
        assert.equal(await otherSets.inputValue(), '7');
        assert.ok(Number(await weight.inputValue()) > adjustedWeight, 'Recalculation must update weights using the new 1RM');
        await page.locator('.force-load-editor input').last().fill('0.5');
        await page.getByRole('button', { name: 'Recalculer les charges', exact: true }).click();
        assert.deepEqual(await page.locator('.force-prescription select').evaluateAll(elements => elements.map(element => element.value)), countsBefore, 'Changing the fatigue reduction must preserve set counts');
        await page.locator('.force-load-editor input').first().fill('45');
        await page.locator('.force-load-editor input').last().fill('0');
        await page.getByRole('button', { name: 'Recalculer les charges', exact: true }).click();
        assert.deepEqual(await page.locator('.force-prescription > label input').evaluateAll(inputs => inputs.map(input => input.value)), originalWeights, 'Zero reduction must restore the original loads regardless of chosen set counts');
        assert.deepEqual(await page.locator('.force-prescription select').evaluateAll(elements => elements.map(element => element.value)), countsBefore);
      }
      if (view === 'template') { await page.locator('.template-card').first().click(); await check(`${width}/template-options`); }
      if (view === 'forceCreate') {
        for (const name of ['Tractions', 'Dips', 'Squat']) await page.getByRole('checkbox', { name, exact: true }).uncheck();
        await page.locator('.force-targets input').fill('100');
        await page.getByRole('combobox', { name: 'Nombre de séries · Bench · 5 reps', exact: true }).selectOption('5');
        await page.getByRole('combobox', { name: 'Nombre de séries · Bench · 3 reps', exact: true }).selectOption('7');
        const previewRow = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Bench ×5', exact: true }) });
        assert.match(await previewRow.innerText(), /77[.,]5/);
        assert.match(await previewRow.innerText(), /5 × 5/);
        const triplesRow = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Bench ×3', exact: true }) });
        assert.match(await triplesRow.innerText(), /7 × 3/);
        await page.getByRole('combobox', { name: 'Nombre de séries · Bench · 5 reps', exact: true }).selectOption('2');
        assert.match(await previewRow.innerText(), /2 × 5/);
        assert.match(await triplesRow.innerText(), /7 × 3/);
        await check(`${width}/forceCreate-volume`);
      }
    }
    console.log(`OK ${width}px: all screens, expanded cards, performance form and template options`);
  }
  assert.deepEqual(errors, []);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/tests/mobile-preview.html?view=force`);
  await page.locator('.force-week:visible').waitFor();
  await page.screenshot({ path: process.env.TEMP + '/mygymtracker-mobile-force.png', fullPage: true });
  await page.goto(`${base}/tests/mobile-preview.html?view=create`);
  await page.getByRole('button', { name: '+ Ajouter un exercice', exact: true }).click();
  await page.screenshot({ path: process.env.TEMP + '/mygymtracker-mobile-exercise.png', fullPage: true });
  const touchPage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await touchPage.route('**/*.supabase.co/**', route => route.abort());
  await touchPage.goto(`${base}/tests/mobile-preview.html?view=create`);
  await touchPage.getByRole('button', { name: '+ Ajouter un exercice', exact: true }).tap();
  const touchInput = touchPage.getByRole('combobox', { name: "Nom de l'exercice 1", exact: true });
  assert.equal(await touchInput.evaluate(el => el === document.activeElement), false);
  await touchInput.tap();
  await touchInput.fill('Bench tactile');
  await touchPage.getByRole('button', { name: '+ Ajouter une série', exact: true }).tap();
  assert.equal(await touchPage.locator('.set-row').count(), 1);
  await touchPage.close();
  console.log('OK touch: adding an exercise, editing its name and adding a set');
} finally { await browser.close(); }
