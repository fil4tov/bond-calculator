import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('renders the calculator without an outer border', async ({ page }) => {
  const calculator = page.locator('section[aria-label="Калькулятор доходности облигации"]');

  await expect(calculator).toHaveCSS('border-style', 'none');
});

test('keeps the same label-to-input gap in both form rows', async ({ page }) => {
  const gaps = await page.evaluate(() => {
    const getGap = (inputId: string) => {
      const input = document.getElementById(inputId);
      const label = input?.closest('label')?.querySelector(':scope > span:first-child');

      if (!input || !label) throw new Error(`Field ${inputId} is not rendered`);
      const labelContent = document.createRange();
      labelContent.selectNodeContents(label);
      return input.getBoundingClientRect().top - labelContent.getBoundingClientRect().bottom;
    };

    return {
      nominal: getGap('nominal'),
      purchasePrice: getGap('purchasePrice'),
      coupon: getGap('coupon'),
    };
  });

  expect(Math.abs(gaps.nominal - gaps.coupon)).toBeLessThanOrEqual(1);
  expect(Math.abs(gaps.purchasePrice - gaps.coupon)).toBeLessThanOrEqual(1);
});

test('aligns the first-row inputs when the price hint wraps', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 900 });

  const layout = await page.evaluate(() => {
    const nominal = document.getElementById('nominal');
    const purchasePrice = document.getElementById('purchasePrice');
    const nominalLabel = nominal?.closest('label')?.querySelector(':scope > span:first-child');
    const priceLabel = purchasePrice?.closest('label')?.querySelector(':scope > span:first-child');

    if (!nominal || !purchasePrice || !nominalLabel || !priceLabel) {
      throw new Error('The first form row is not rendered');
    }

    const nominalContent = document.createRange();
    const priceContent = document.createRange();
    nominalContent.selectNodeContents(nominalLabel);
    priceContent.selectNodeContents(priceLabel);

    return {
      inputOffset: Math.abs(
        nominal.getBoundingClientRect().top - purchasePrice.getBoundingClientRect().top,
      ),
      nominalLabelHeight: nominalContent.getBoundingClientRect().height,
      priceLabelHeight: priceContent.getBoundingClientRect().height,
    };
  });

  expect(layout.priceLabelHeight).toBeGreaterThan(layout.nominalLabelHeight);
  expect(layout.inputOffset).toBeLessThanOrEqual(1);
});

test('aligns the first-row inputs at 630px', async ({ page }) => {
  await page.setViewportSize({ width: 630, height: 823 });

  const nominal = await page.locator('#nominal').boundingBox();
  const purchasePrice = await page.locator('#purchasePrice').boundingBox();

  expect(nominal).not.toBeNull();
  expect(purchasePrice).not.toBeNull();
  expect(Math.abs(nominal!.y - purchasePrice!.y)).toBeLessThanOrEqual(1);
});

test('keeps the standard label gap in the single-column mobile form', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });

  const gaps = await page.evaluate(() => {
    const getGap = (inputId: string) => {
      const input = document.getElementById(inputId);
      const label = input?.closest('label')?.querySelector(':scope > span:first-child');

      if (!input || !label) throw new Error(`Field ${inputId} is not rendered`);
      const labelContent = document.createRange();
      labelContent.selectNodeContents(label);
      return input.getBoundingClientRect().top - labelContent.getBoundingClientRect().bottom;
    };

    return { nominal: getGap('nominal'), coupon: getGap('coupon') };
  });

  expect(Math.abs(gaps.nominal - gaps.coupon)).toBeLessThanOrEqual(1);
});

test('animates results once when the first calculation replaces the empty state', async ({ page }) => {
  await page.evaluate(() => {
    document.body.dataset.resultAnimationStarts = '0';
    document.addEventListener('animationstart', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.textContent?.includes('Годовая доходность')) return;
      document.body.dataset.resultAnimationStarts = String(
        Number(document.body.dataset.resultAnimationStarts) + 1,
      );
    });
  });

  await page.getByRole('button', { name: 'Рассчитать доходность' }).click();
  const calculatedResults = page.getByText('Годовая доходность', { exact: true }).locator('..');

  await expect(calculatedResults).toBeVisible();
  await expect(calculatedResults).toHaveCSS('animation-duration', '0.32s');
  await expect.poll(() => page.locator('body').getAttribute('data-result-animation-starts')).toBe('1');

  await page.locator('#coupon').fill('50');
  await page.waitForTimeout(350);
  await expect(page.locator('body')).toHaveAttribute('data-result-animation-starts', '1');
});

test('reduces the results entrance animation when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Рассчитать доходность' }).click();

  const calculatedResults = page.getByText('Годовая доходность', { exact: true }).locator('..');
  const animation = await calculatedResults.evaluate((element) => {
    const style = getComputedStyle(element);
    const duration = Number.parseFloat(style.animationDuration);
    return {
      name: style.animationName,
      durationMs: style.animationDuration.endsWith('ms') ? duration : duration * 1000,
    };
  });

  expect(animation.name).not.toBe('none');
  expect(animation.durationMs).toBeLessThanOrEqual(0.01);
});

test('calculates, switches scenarios and saves a preset', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Рассчитать доходность' }).click();
  await expect(page.getByText('9,47%')).toBeVisible();
  await page.locator('label[for="holdToMaturity-no"]').click();
  await expect(page.getByText('Продажа')).toBeVisible();
  await page.getByRole('textbox', { name: /Название облигации/ }).fill('ОФЗ 26238');
  await page.getByRole('button', { name: 'Сохранить расчёт' }).click();
  await page.getByRole('button', { name: 'Открыть сохранённые расчёты' }).click();
  await expect(page.getByRole('button', { name: 'Загрузить расчёт «ОФЗ 26238»' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('calculator.png'), fullPage: true, animations: 'disabled' });
});

test('supports theme and keyboard dropdown controls', async ({ page }) => {
  await page.getByRole('button', { name: 'Включить тёмную тему' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const trigger = page.getByRole('button', { name: 'Открыть сохранённые расчёты' });
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});
