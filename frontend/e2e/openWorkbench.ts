import { expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { createHash } from 'node:crypto';

/** Include public delivery diagnostics when the app cannot boot, instead of a
 * two-minute click timeout with no indication of a missing asset or HTTP error.
 */
export async function openWorkbench(page: Page) {
  const issues: string[] = [];
  const assets: import('@playwright/test').Response[] = [];
  const failed = (request: import('@playwright/test').Request) =>
    issues.push(`request ${new URL(request.url()).pathname}: ${request.failure()?.errorText}`);
  const responseError = (response: import('@playwright/test').Response) => {
    if (new URL(response.url()).pathname.endsWith('.js')) assets.push(response);
    if (response.status() >= 400)
      issues.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);
  };
  const exception = (error: Error) => issues.push(error.stack || error.message);
  page.on('requestfailed', failed);
  page.on('response', responseError);
  page.on('pageerror', exception);
  let status: number | undefined;
  try {
    const response = await page.goto('/');
    status = response?.status();
    expect(status, 'Initial document HTTP status').toBe(200);
    await expect(page.getByRole('button', { name: 'Návrh z parametrov', exact: true })).toBeVisible(
      { timeout: 15000 },
    );
  } catch (error) {
    for (const asset of assets) {
      try {
        const actual = await asset.body(),
          path = new URL(asset.url()).pathname;
        const expected = await readFile(resolve('dist/assets', basename(path)));
        if (!actual.equals(expected)) {
          let diff = 0;
          while (diff < Math.min(actual.length, expected.length) && actual[diff] === expected[diff])
            diff++;
          issues.push(
            `Asset mismatch ${path}: expected ${expected.length}/${createHash('sha256').update(expected).digest('hex')}, received ${actual.length}/${createHash('sha256').update(actual).digest('hex')}; diff=${diff}; actual=${JSON.stringify(actual.toString('utf8', Math.max(0, diff - 50), diff + 100))}`,
          );
        } else issues.push(`Asset matches tested build: ${path}`);
      } catch (e) {
        issues.push(`Asset verification: ${String(e)}`);
      }
    }
    const body = await page
      .locator('body')
      .innerText({ timeout: 2000 })
      .catch(() => '(body unavailable)');
    throw new Error(
      `Workbench did not load. HTTP=${status}; title=${await page.title()}; delivery=${JSON.stringify(issues)}; body=${body.slice(0, 2500)}; original=${String(error)}`,
    );
  } finally {
    page.off('requestfailed', failed);
    page.off('response', responseError);
    page.off('pageerror', exception);
  }
}
