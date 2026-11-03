import { expect, test } from '@playwright/test';

test('rounded roots, dimensioned tooth/space SVG and actual rounded STEP export', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Návrh z parametrov', exact: true }).click();
  await expect(page.getByText('Geometrické kontroly vyhovujú')).toBeVisible();
  const detail = page.getByRole('region', { name: 'Kótovaný detail zuba', exact: true });
  const drawing = detail.getByRole('img', { name: /Geometricky kótovaný zub/ });
  await expect(drawing).toContainText('BEZ ZAOBLENIA');
  await page.getByLabel('S navrhovaným zaoblením', { exact: true }).check();
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
  await page.getByLabel('Bez zaoblenia', { exact: true }).check();
  await expect(drawing).toContainText('BEZ ZAOBLENIA');
  await expect(drawing).toContainText('R päty = 0');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
