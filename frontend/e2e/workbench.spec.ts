import { expect, test } from '@playwright/test';
import { openWorkbench } from './openWorkbench';

test('3D zoom, reset and rotation work on desktop and mobile', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openWorkbench(page);
  await page.getByRole('button', { name: 'Návrh z parametrov', exact: true }).click();
  const canvas = page.locator('canvas');
  const zoom = page.getByLabel('Priblíženie', { exact: true });
  const closer = page.getByRole('button', { name: 'Priblížiť 3D model', exact: true });
  const farther = page.getByRole('button', { name: 'Oddialiť 3D model', exact: true });
  const reset = page.getByRole('button', { name: 'Obnoviť 3D pohľad', exact: true });
  await expect(closer).toBeEnabled();
  await expect(zoom).toHaveText('100 %');
  const initial = await canvas.screenshot();
  await closer.click();
  await expect(zoom).toHaveText('125 %');
  expect((await canvas.screenshot()).equals(initial)).toBe(false);
  await farther.click();
  await expect(zoom).toHaveText('100 %');
  await canvas.hover();
  await page.mouse.wheel(0, -200);
  await expect
    .poll(async () => Number((await zoom.textContent())?.replace(/\D/g, '')))
    .toBeGreaterThan(100);
  await reset.click();
  await expect(zoom).toHaveText('100 %');
  const resting = await canvas.screenshot();

  const play = page.getByRole('button', { name: 'Spustiť otáčanie', exact: true });
  const pause = page.getByRole('button', { name: 'Pozastaviť otáčanie', exact: true });
  await play.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await canvas.screenshot()).equals(resting)).toBe(false);
  await pause.click();
  const stopped = await canvas.screenshot();
  // Check that a paused frame remains unchanged across several display frames.
  await page.evaluate(async () => {
    for (let i = 0; i < 12; i++) await new Promise(requestAnimationFrame);
  });
  expect((await canvas.screenshot()).equals(stopped)).toBe(true);
  expect(stopped.equals(resting)).toBe(false);
  await play.click();
  await expect.poll(async () => (await canvas.screenshot()).equals(stopped)).toBe(false);
  await pause.click();
  await page.locator('.viewer-panel').screenshot({
    path: '../output/screenshots/viewer-controls-desktop.png',
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await closer.click();
  await expect(zoom).toHaveText('125 %');
  await play.click();
  await expect(pause).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.viewer-panel').screenshot({
    path: '../output/screenshots/viewer-controls-mobile.png',
  });
  await pause.click();
  await page.getByRole('button', { name: '2D náčrt', exact: true }).click();
  await expect(closer).not.toBeVisible();
  await expect(play).not.toBeVisible();
  expect(errors).toEqual([]);
});

test('static hosting: design, 3D, 2D, validation, themes and real exports', async ({ page }) => {
  const errors: string[] = [];
  const apiCalls: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiCalls.push(request.url());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await openWorkbench(page);
  await page.getByRole('button', { name: 'Návrh z parametrov', exact: true }).click();
  await expect(page.getByText('Geometrické kontroly vyhovujú')).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Spustiť otáčanie' }).click();
  await expect(page.getByRole('button', { name: 'Pozastaviť otáčanie' })).toBeVisible();
  await page.screenshot({ path: '../output/screenshots/workbench-desktop.png', fullPage: true });
  await page.getByRole('button', { name: '2D náčrt' }).click();
  await expect(page.getByRole('img', { name: /2D náčrt/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Stiahnuť STEP/ })).toBeDisabled();
  await page.getByLabel('Povoliť návrhový STEP', { exact: false }).check();
  const stepWait = page.waitForEvent('download');
  await page.getByRole('button', { name: /Stiahnuť STEP/ }).click();
  const step = await stepWait;
  expect(step.suggestedFilename()).toBe('gear-pair-approximate.stp');
  await step.saveAs('../output/samples/gear-pair-approximate.stp');
  await expect(page.getByRole('button', { name: /Výpočtová správa/ })).toBeEnabled();
  const pdfWait = page.waitForEvent('download');
  await page.getByRole('button', { name: /Výpočtová správa/ }).click();
  const pdf = await pdfWait;
  expect(pdf.suggestedFilename()).toBe('gear-report.pdf');
  await pdf.saveAs('../output/pdf/gear-report.pdf');
  await page.getByLabel('Počet zubov z₁', { exact: true }).fill('10');
  await expect(page.getByText('Návrh vyžaduje úpravu')).toBeVisible();
  await expect(page.getByRole('button', { name: /Stiahnuť STEP/ })).toBeDisabled();
  await page.getByLabel('Modul m', { exact: true }).fill('');
  await expect(page.getByRole('status')).toContainText('Vyplňte všetky parametre');
  await expect(page.getByRole('button', { name: /Výpočtová správa/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Obnoviť návrh' }).click();
  await expect(page.getByText('Geometrické kontroly vyhovujú')).toBeVisible();
  await page.getByRole('button', { name: 'Zapnúť svetlú tému' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: '../output/screenshots/workbench-light-2d.png', fullPage: true });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(errors).toEqual([]);
  expect(apiCalls).toEqual([]);
});

test('mobile layout fits and invalid inputs are rejected without a server', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkbench(page);
  await page.getByRole('button', { name: 'Návrh z parametrov', exact: true }).click();
  await expect(page.getByText('Geometrické kontroly vyhovujú')).toBeVisible();
  await page.getByRole('button', { name: '2D náčrt' }).click();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await page.screenshot({ path: '../output/screenshots/workbench-mobile.png', fullPage: true });
  await page.getByLabel('Modul m', { exact: true }).fill('-1');
  await expect(page.getByRole('status')).toContainText('module');
});

test('failed WASM download reports an error and allows a retry', async ({ page }) => {
  await openWorkbench(page);
  await page.getByRole('button', { name: 'Návrh z parametrov', exact: true }).click();
  await expect(page.getByText('Geometrické kontroly vyhovujú')).toBeVisible();
  await page.getByLabel('Povoliť návrhový STEP', { exact: false }).check();
  await page.route('**/*.wasm', (route) => route.abort());
  await page.getByRole('button', { name: /Stiahnuť STEP/ }).click();
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 30000 });
  await page.unroute('**/*.wasm');
  await expect(page.getByRole('button', { name: /Stiahnuť STEP/ })).toBeEnabled();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Stiahnuť STEP/ }).click();
  expect((await download).suggestedFilename()).toBe('gear-pair-approximate.stp');
});
