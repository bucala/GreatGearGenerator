import { expect, test } from '@playwright/test';

test('design, 3D, 2D, validation, themes and exports work against the real API', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByText('Geometrické kontroly vyhovujú')).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Spustiť animáciu' }).click();
  await expect(page.getByRole('button', { name: 'Zastaviť animáciu' })).toBeVisible();
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
});

test('mobile layout fits and reports API errors', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByText('Geometrické kontroly vyhovujú')).toBeVisible();
  await page.getByRole('button', { name: '2D náčrt' }).click();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await page.screenshot({ path: '../output/screenshots/workbench-mobile.png', fullPage: true });
  await page.route('**/api/generate-report', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Testovacia chyba exportu.' }),
    }),
  );
  await page.getByRole('button', { name: /Výpočtová správa/ }).click();
  await expect(page.getByRole('alert')).toHaveText('Testovacia chyba exportu.');
  await page.getByLabel('Modul m', { exact: true }).fill('-1');
  await expect(page.getByRole('status')).toContainText('module');
});
