import { expect, test } from '@playwright/test';
import { openWorkbench } from './openWorkbench';

test('all three blends use a CAD mesh and the same STEP solid', async ({ page }) => {
  test.setTimeout(360000);
  await openWorkbench(page);
  await page.getByRole('button', { name: 'Návrh z parametrov', exact: true }).click();
  await page.getByLabel('Zaobliť hrany po šírke', { exact: true }).check();
  await expect(page.getByLabel('Zaobliť hlavu zuba', { exact: true })).toBeChecked();
  const drawing = page.getByRole('img', { name: /Geometricky kótovaný zub/ });
  await expect(drawing).toContainText('R hlavy = 0,2');
  await expect(drawing).toContainText('R šírky = 0,1');
  const cad = page.locator('[data-cad-model="face"]');
  await expect(cad).toBeVisible();
  await page.getByLabel('Povoliť návrhový STEP', { exact: false }).check();
  await expect
    .poll(() => cad.getAttribute('data-cad-state'), { timeout: 305000 })
    .toMatch(/ready|error/);
  const diagnostic = await page.getByRole('alert').allTextContents();
  expect(await cad.getAttribute('data-cad-state'), diagnostic.join('; ')).toBe('ready');
  await expect(page.getByRole('alert')).not.toBeVisible();
  await page.screenshot({ path: '../output/screenshots/all-three-blends.png', fullPage: true });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Stiahnuť STEP/ }).click();
  await (await download).saveAs('../output/samples/gear-pair-all-blends.stp');
});

test('rounded roots, dimensioned tooth/space SVG and actual rounded STEP export', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  await openWorkbench(page);
  await page.getByRole('button', { name: 'Návrh z parametrov', exact: true }).click();
  await expect(page.getByText('Geometrické kontroly vyhovujú')).toBeVisible();
  const detail = page.getByRole('region', { name: 'Kótovaný detail zuba', exact: true });
  const drawing = detail.getByRole('img', { name: /Geometricky kótovaný zub/ });
  await expect(drawing).toContainText('BEZ ZAOBLENIA');
  await page.getByLabel('S navrhovaným zaoblením päty', { exact: true }).check();
  await expect(drawing).toContainText('KRUHOVÉ ZAOBLENIE PÄTY');
  await expect(drawing).toContainText('R päty = 0,6');
  await expect(drawing).toContainText('Ø d / Dr = 48');
  await expect(drawing).toContainText('Ø dᶠ = 43');
  await detail.screenshot({ path: '../output/screenshots/dimensioned-tooth-rounded.png' });
  const svgWait = page.waitForEvent('download');
  await detail.getByRole('button', { name: 'Stiahnuť kótovaný SVG' }).click();
  const svg = await svgWait;
  expect(svg.suggestedFilename()).toBe('gear-1-dimensioned-tooth.svg');
  await svg.saveAs('../output/drawings/gear-1-dimensioned-tooth.svg');
  await detail.getByRole('button', { name: 'Koleso · z₂', exact: true }).click();
  await expect(drawing).toContainText('Ø d / Dr = 96');
  await expect(drawing).toContainText('Ø dᶠ = 91');
  await page.getByLabel('Povoliť návrhový STEP', { exact: false }).check();
  const stepWait = page.waitForEvent('download');
  await page.getByRole('button', { name: /Stiahnuť STEP/ }).click();
  await (await stepWait).saveAs('../output/samples/gear-pair-rounded.stp');
  await page.getByLabel('Bez zaoblenia päty', { exact: true }).check();
  await expect(drawing).toContainText('BEZ ZAOBLENIA');
  await expect(drawing).toContainText('R päty = 0');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
