import { expect, test } from '@playwright/test';
import { openWorkbench } from './openWorkbench';

test.use({ hasTouch: true });

test('2D gears rotate in ratio, pause, zoom and pan on desktop and mobile', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openWorkbench(page);
  await page.getByRole('button', { name: 'Návrh z parametrov', exact: true }).click();
  await page.getByRole('button', { name: '2D náčrt', exact: true }).click();
  const sketch = page.getByRole('img', { name: /^2D náčrt/ });
  const zoom = page.getByLabel('Priblíženie', { exact: true });
  const closer = page.getByRole('button', { name: 'Priblížiť 2D náčrt', exact: true });
  const farther = page.getByRole('button', { name: 'Oddialiť 2D náčrt', exact: true });
  const reset = page.getByRole('button', { name: 'Obnoviť 2D pohľad', exact: true });
  const controlsBox = (await page
    .getByRole('group', { name: 'Priblíženie 2D náčrtu', exact: true })
    .boundingBox())!;
  const drawingBox = (await sketch.boundingBox())!;
  expect(drawingBox.y).toBeGreaterThanOrEqual(controlsBox.y + controlsBox.height);
  const originalView = await sketch.getAttribute('viewBox');
  const dimensions = await sketch.locator('text').allTextContents();
  const angles = () =>
    sketch.evaluate((svg) =>
      ['Pastorok', 'Koleso'].map((name) => {
        const transform = svg.querySelector(`g[aria-label="${name}"]`)!.getAttribute('transform')!;
        return Number(/rotate\(([^)]+)\)/.exec(transform)![1]);
      }),
    );
  const initial = await angles();
  const play = page.getByRole('button', { name: 'Spustiť otáčanie', exact: true });
  const pause = page.getByRole('button', { name: 'Pozastaviť otáčanie', exact: true });
  await play.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await angles())[0]).toBeGreaterThan(initial[0]);
  await pause.click();
  const stopped = await angles();
  expect(stopped[1]).toBeLessThan(initial[1]);
  // Default gears have 24 and 48 teeth: opposite rotation at a 2:1 ratio.
  expect((stopped[0] - initial[0]) / (initial[1] - stopped[1])).toBeCloseTo(2, 6);
  await page.evaluate(async () => {
    for (let i = 0; i < 12; i++) await new Promise(requestAnimationFrame);
  });
  expect(await angles()).toEqual(stopped);
  expect(await sketch.locator('text').allTextContents()).toEqual(dimensions);
  await play.click();
  await expect.poll(async () => (await angles())[0]).toBeGreaterThan(stopped[0]);
  await pause.click();

  await closer.click();
  await expect(zoom).toHaveText('125 %');
  const zoomedView = await sketch.getAttribute('viewBox');
  expect(Number(zoomedView!.split(' ')[2])).toBeLessThan(Number(originalView!.split(' ')[2]));
  const box = (await sketch.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 30, { steps: 5 });
  await page.mouse.up();
  expect(await sketch.getAttribute('viewBox')).not.toEqual(zoomedView);
  await page.mouse.wheel(0, -200);
  await expect
    .poll(async () => Number((await zoom.textContent())?.replace(/\D/g, '')))
    .toBeGreaterThan(125);
  await reset.click();
  await expect(zoom).toHaveText('100 %');
  await expect(sketch).toHaveAttribute('viewBox', originalView!);
  await farther.click();
  await expect(zoom).toHaveText('80 %');
  await page
    .locator('.viewer-panel')
    .screenshot({ path: '../output/screenshots/sketch-controls-desktop.png' });

  await page.setViewportSize({ width: 390, height: 844 });
  await reset.click();
  await closer.click();
  await expect(zoom).toHaveText('125 %');
  await sketch.scrollIntoViewIfNeeded();
  const mobile = (await sketch.boundingBox())!;
  const cx = mobile.x + mobile.width / 2,
    cy = mobile.y + mobile.height / 2;
  const touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: cx - 35, y: cy, id: 0 },
      { x: cx + 35, y: cy, id: 1 },
    ],
  });
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: cx - 60, y: cy, id: 0 },
      { x: cx + 60, y: cy, id: 1 },
    ],
  });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await touch.detach();
  await expect
    .poll(async () => Number((await zoom.textContent())?.replace(/\D/g, '')))
    .toBeGreaterThan(125);
  await reset.click();
  await expect(zoom).toHaveText('100 %');
  await expect(sketch).toHaveAttribute('viewBox', originalView!);
  await closer.click();
  await play.click();
  await expect(pause).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page
    .locator('.viewer-panel')
    .screenshot({ path: '../output/screenshots/sketch-controls-mobile.png' });
  await pause.click();
  await page.getByRole('button', { name: '3D model', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Priblížiť 3D model', exact: true })).toBeVisible();
  await expect(closer).not.toBeVisible();
  expect(errors).toEqual([]);
});
