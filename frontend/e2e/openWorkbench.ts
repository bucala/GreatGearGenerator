import { expect, type Page } from '@playwright/test';

/** Include public delivery diagnostics when the app cannot boot, instead of a
 * two-minute click timeout with no indication of a missing asset or HTTP error.
 */
export async function openWorkbench(page: Page) {
  const issues: string[] = [];
  const failed = (request: import('@playwright/test').Request) =>
    issues.push(`request ${new URL(request.url()).pathname}: ${request.failure()?.errorText}`);
  const responseError = (response: import('@playwright/test').Response) => {
    if (response.status() >= 400)
      issues.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);
  };
  const exception = (error: Error) => issues.push(error.message);
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
