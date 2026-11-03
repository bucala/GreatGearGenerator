import { expect, test } from '@playwright/test';

test('measured single gear: identification, uncertainty, transfer and stale results', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByText('Reverzný návrh zo skenu', { exact: false }).click();
  await page.getByRole('button', { name: 'Vyplniť príklad merania' }).click();
  await page.getByRole('button', { name: 'Nájsť kandidátov' }).click();
  const results = page.getByRole('region', { name: 'Výsledok identifikácie' });
  await expect(results).toContainText('Počet rozmerovo prípustných kandidátov: 1');
  await expect(results).toContainText('hypotetické druhé koleso');
  await page.getByLabel('Povoliť návrhový STEP', { exact: false }).check();
  await page.getByRole('button', { name: 'Preniesť kandidáta do návrhu' }).click();
  await expect(page.getByLabel('Modul m', { exact: true })).toHaveValue('2');
  await expect(page.getByLabel('Počet zubov z₁', { exact: true })).toHaveValue('24');
  await expect(page.getByText('Geometrické kontroly vyhovujú')).toBeVisible();
  await expect(page.getByLabel('Povoliť návrhový STEP', { exact: false })).not.toBeChecked();
  await expect(page.getByRole('button', { name: /Stiahnuť STEP/ })).toBeDisabled();
  await page.locator('#reverse-pressureAngle').fill('');
  await expect(results).not.toBeVisible();
  await page.getByRole('button', { name: 'Nájsť kandidátov' }).click();
  await expect(results).toContainText('Počet rozmerovo prípustných kandidátov: 4');
  await expect(results).toContainText('Merania neurčujú jediný návrh');
  await page.locator('#reverse-root1').fill('40');
  await page.getByRole('button', { name: 'Nájsť kandidátov' }).click();
  await expect(results).toContainText('Žiadny kandidát');
  await expect(
    page.getByRole('button', { name: 'Preniesť kandidáta do návrhu' }),
  ).not.toBeVisible();
  expect(errors).toEqual([]);
});

test('corrected pair and mobile reverse form', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByText('Reverzný návrh zo skenu', { exact: false }).click();
  await page.getByRole('button', { name: 'Súkolesie so známou vzdialenosťou' }).click();
  for (const [key, value] of Object.entries({
    teeth1: '24',
    teeth2: '48',
    center: '72',
    tip1: '52',
    root1: '43',
    pressureAngle: '20',
  }))
    await page.locator(`#reverse-${key}`).fill(value);
  await page.getByRole('button', { name: 'Nájsť kandidátov' }).click();
  await expect(page.getByRole('region', { name: 'Výsledok identifikácie' })).toContainText(
    'Počet rozmerovo prípustných kandidátov: 1',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '../output/screenshots/reverse-mobile.png', fullPage: true });
  await page.locator('#reverse-center').fill('1');
  await page.getByRole('button', { name: 'Nájsť kandidátov' }).click();
  await expect(page.getByRole('region', { name: 'Výsledok identifikácie' })).toContainText(
    'Žiadny kandidát',
  );
});
