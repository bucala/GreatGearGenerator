import { expect, test } from '@playwright/test';
import { openWorkbench } from './openWorkbench';

test('manual radii control both gears, validate input and reach CAD and exports', async ({
  page,
}) => {
  test.setTimeout(360000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  await openWorkbench(page);
  await page.getByRole('button', { name: 'Návrh z parametrov', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Od parametrov/ })).not.toBeVisible();
  await expect(
    page.locator('.topbar').getByRole('button', { name: 'Obnoviť návrh' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '2D náčrt', exact: true }).click();
  await page.getByLabel('S navrhovaným zaoblením päty', { exact: true }).check();
  await page.getByLabel('Zaobliť hlavu zuba', { exact: true }).check();
  const manual = page.getByLabel('Ručne zadať rádiusy', { exact: true });
  await manual.check();
  const root = page.getByLabel('Rádus päty R', { exact: true });
  const tip = page.getByLabel('Rádus hlavy R', { exact: true });
  const face = page.getByLabel('Rádus hrán po šírke R', { exact: true });
  await expect(face).toBeDisabled();
  await root.fill('0.4');
  await tip.fill('0.12');
  await page.getByLabel('Zaobliť hrany po šírke', { exact: true }).check();
  await face.fill('0.03');
  const drawing = page.getByRole('img', { name: /Geometricky kótovaný zub/ });
  await expect(drawing).toContainText('R päty = 0,4');
  await expect(drawing).toContainText('R hlavy = 0,12');
  await expect(drawing).toContainText('R šírky = 0,03');
  await page.getByRole('button', { name: 'Koleso · z₂', exact: true }).click();
  await expect(drawing).toContainText('R päty = 0,4');
  await expect(drawing).toContainText('R hlavy = 0,12');
  await expect(drawing).toContainText('R šírky = 0,03');
  await page.getByRole('button', { name: 'Pastorok · z₁', exact: true }).click();
  const status = page.getByRole('status', { name: 'Stav výpočtu' });
  await root.fill('100');
  await expect(status).toContainText('R päty');
  await expect(page.getByRole('button', { name: /Stiahnuť STEP/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Výpočtová správa/ })).toBeDisabled();
  await root.fill('');
  await expect(status).toContainText('Vyplňte všetky parametre');
  await manual.uncheck();
  await expect(drawing).toContainText('R päty = 0,6');
  await manual.check();
  await root.fill('0.4');
  await face.fill('0.2');
  await expect(status).toContainText('R hrán po šírke');
  await face.fill('0.03');
  await expect(drawing).toContainText('R šírky = 0,03');
  await manual.uncheck();
  await expect(drawing).toContainText('R päty = 0,6');
  await expect(drawing).toContainText('R hlavy = 0,2');
  await expect(drawing).toContainText('R šírky = 0,1');
  await manual.check();
  await expect(root).toHaveValue('0.4');
  await expect(tip).toHaveValue('0.12');
  await expect(face).toHaveValue('0.03');
  await expect(drawing).toContainText('R päty = 0,4');
  const gearField = (await page.locator('#bore2').boundingBox())!;
  const fillets = (await page.locator('.model-selection').boundingBox())!;
  // The blend controls follow both gear parameter groups.
  expect(fillets.y).toBeGreaterThan(gearField.y);
  await page.screenshot({ path: '../output/screenshots/manual-radii-desktop.png', fullPage: true });
  const svg = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Stiahnuť kótovaný SVG' }).click();
  await (await svg).saveAs('../output/drawings/gear-manual-radii.svg');
  const pdf = page.waitForEvent('download');
  await page.getByRole('button', { name: /Výpočtová správa/ }).click();
  await (await pdf).saveAs('../output/pdf/gear-manual-radii.pdf');
  await page.setViewportSize({ width: 390, height: 844 });
  await root.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page
    .locator('.model-selection')
    .screenshot({ path: '../output/screenshots/manual-radii-mobile.png' });
  await page.getByRole('button', { name: '3D model', exact: true }).click();
  const cad = page.locator('[data-cad-model="face"]');
  await expect
    .poll(() => cad.getAttribute('data-cad-state'), { timeout: 305000 })
    .toMatch(/ready|error/);
  expect(
    await cad.getAttribute('data-cad-state'),
    (await page.getByRole('alert').allTextContents()).join('; '),
  ).toBe('ready');
  await page.getByLabel('Povoliť návrhový STEP', { exact: false }).check();
  const step = page.waitForEvent('download');
  await page.getByRole('button', { name: /Stiahnuť STEP/ }).click();
  await (await step).saveAs('../output/samples/gear-pair-manual-radii.stp');
  await page.getByRole('button', { name: 'Obnoviť návrh', exact: true }).click();
  await expect(manual).not.toBeChecked();
  await expect(page.getByLabel('Bez zaoblenia päty', { exact: true })).toBeChecked();
  expect(errors).toEqual([]);
});
