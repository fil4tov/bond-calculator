import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';

async function expectHeaderDivider(dialog: Locator) {
  const header = dialog.locator('[data-modal-scroll-viewport] > div').first();
  await expect(header).toHaveCSS('border-bottom-style', 'solid');
  await expect(header).toHaveCSS('border-bottom-width', '1px');
}

function inputDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function displayDate(date: Date) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function sortableBond(id: string, name: string, createdAt: string) {
  return {
    id,
    created_at: createdAt,
    instrument_uid: `instrument-${id}`,
    ticker: `TEST-${id}`,
    name,
    nominal: '1000.00',
    payments_per_year: 2,
    placement_date: '2025-01-01',
    maturity_date: '2030-01-01',
    status: 'active',
    total_quantity: 10,
    total_spent: '10000.00',
    position_cost_basis: '10000.00',
    realized_result: '0.00',
    position_status: 'open',
    paid_coupon_total: '0.00',
    calendar_year_paid_coupon_income: '0.00',
    market_value_without_aci: '10000.00',
    accrued_coupon_income: '25.00',
    calendar_year_coupon_income: '0.00',
    calendar_month_coupon_income: '0.00',
    calendar_year_coupon_yield_percent: '0.0000',
    annual_coupon_yield_percent: '14.0070',
    coupon_yield_year: new Date().getUTCFullYear(),
    maturity_remaining: { years: 3, months: 4, days_until: 1200 },
    next_coupon: {
      period_start: '2026-08-01',
      period_end: '2027-02-01',
      pay_date: '2027-02-02',
      amount: '700.35',
      amount_per_bond: '70.04',
      days_until: 173,
      period_days: 184,
      elapsed_period_days: 12,
    },
    operations: [{
      id: `purchase-${id}`,
      operation_type: 'purchase',
      amount: '10000.00',
      realized_result: null,
      quantity: 10,
      operation_date: '2026-08-01',
    }],
  };
}

test('sorts portfolio cards and keeps responsive controls aligned', async ({ page }, testInfo) => {
  const username = `portfolio_sort_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const older = sortableBond('older', 'Облигация 10', '2026-08-01T10:00:00Z');
  const newer = sortableBond('newer', 'Облигация 2', '2026-08-02T10:00:00Z');
  older.calendar_year_coupon_income = '100.10';
  newer.calendar_year_coupon_income = '200.20';
  older.calendar_year_paid_coupon_income = '40.04';
  newer.calendar_year_paid_coupon_income = '80.08';

  await page.route('**/api/portfolio/bonds', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { items: [older, newer] } });
    return route.continue();
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Войти или зарегистрироваться' }).click();
  await page.getByRole('tab', { name: 'Регистрация' }).click();
  await page.getByLabel(/^Логин/).fill(username);
  await page.getByLabel(/^Пароль/).fill('e2e-password-123');
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();
  await page.getByRole('button', { name: `Открыть меню пользователя ${username}` }).click();
  await page.getByRole('link', { name: 'Портфель', exact: true }).click();

  const cards = page.getByRole('article');
  await expect(cards).toHaveCount(2);
  const summary = page.getByRole('region', { name: 'Сводка портфеля' });
  await expect(summary).toBeVisible();
  await expect(summary.getByText('Рыночная стоимость с НКД')).toBeVisible();
  await expect(summary.getByText(/120,12.₽ \/ 300,30.₽/)).toBeVisible();
  await expect(summary.getByRole('progressbar')).toHaveCSS('height', '34px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  await expect.poll(() => cards.evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')))).toEqual([
    'Облигация 2',
    'Облигация 10',
  ]);

  const controls = page.locator('[aria-label="Сортировка облигаций"]');
  const trigger = page.getByRole('button', { name: 'Критерий сортировки: По дате добавления' });
  const direction = page.getByRole('button', { name: 'По убыванию. Переключить по возрастанию' });
  const [controlsBox, triggerBox, directionBox, cardBox] = await Promise.all([
    controls.boundingBox(),
    trigger.boundingBox(),
    direction.boundingBox(),
    cards.first().boundingBox(),
  ]);
  if (!controlsBox || !triggerBox || !directionBox || !cardBox) throw new Error('Не удалось измерить панель сортировки');
  expect(Math.abs(controlsBox.x - cardBox.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(triggerBox.y - directionBox.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(directionBox.width - directionBox.height)).toBeLessThanOrEqual(1);
  if (testInfo.project.name === 'mobile') {
    expect(Math.abs(controlsBox.width - cardBox.width)).toBeLessThanOrEqual(2);
    expect(triggerBox.width).toBeGreaterThan(directionBox.width);
  } else {
    expect(controlsBox.width).toBeLessThan(cardBox.width);
  }

  await direction.click();
  await expect.poll(() => cards.evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')))).toEqual([
    'Облигация 10',
    'Облигация 2',
  ]);
  await trigger.click();
  const selectedOption = page.getByRole('menuitemradio', { name: 'По дате добавления' });
  const ordinaryOption = page.getByRole('menuitemradio', { name: 'По имени' });
  const [selectedTypography, ordinaryTypography] = await Promise.all([
    selectedOption.evaluate((element) => ({ color: getComputedStyle(element).color, fontWeight: getComputedStyle(element).fontWeight })),
    ordinaryOption.evaluate((element) => ({ color: getComputedStyle(element).color, fontWeight: getComputedStyle(element).fontWeight })),
  ]);
  expect(selectedTypography).toEqual(ordinaryTypography);
  await page.getByRole('menuitemradio', { name: 'По имени' }).click();
  await expect(page.getByRole('button', { name: 'Критерий сортировки: По имени' })).toBeFocused();
  await expect.poll(() => cards.evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')))).toEqual([
    'Облигация 10',
    'Облигация 2',
  ]);
  await expect.poll(() => page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith('bond-portfolio-sort:'));
    return key ? localStorage.getItem(key) : null;
  })).toContain('"field":"name"');

  const actionsTrigger = page.getByRole('article', { name: 'Облигация 10' })
    .getByRole('button', { name: 'Действия с облигацией Облигация 10' });
  const [actionsTriggerBox, actionsIconBox] = await Promise.all([
    actionsTrigger.boundingBox(),
    actionsTrigger.locator('svg').boundingBox(),
  ]);
  if (!actionsTriggerBox || !actionsIconBox) throw new Error('Не удалось измерить кнопку действий');
  expect(Math.abs((actionsIconBox.x + actionsIconBox.width / 2) - (actionsTriggerBox.x + actionsTriggerBox.width / 2))).toBeLessThanOrEqual(1);
  expect(Math.abs((actionsIconBox.y + actionsIconBox.height / 2) - (actionsTriggerBox.y + actionsTriggerBox.height / 2))).toBeLessThanOrEqual(1);

  await actionsTrigger.click();
  await page.getByRole('button', { name: 'Удалить из портфеля' }).click();
  const confirmationDialog = page.getByRole('dialog', { name: 'Удалить облигацию' });
  const closeButton = confirmationDialog.getByRole('button', { name: 'Закрыть окно' });
  const [closeButtonBox, closeIconBox] = await Promise.all([
    closeButton.boundingBox(),
    closeButton.locator('svg').boundingBox(),
  ]);
  if (!closeButtonBox || !closeIconBox) throw new Error('Не удалось измерить кнопку закрытия');
  expect(Math.abs((closeIconBox.x + closeIconBox.width / 2) - (closeButtonBox.x + closeButtonBox.width / 2))).toBeLessThanOrEqual(1);
  expect(Math.abs((closeIconBox.y + closeIconBox.height / 2) - (closeButtonBox.y + closeButtonBox.height / 2))).toBeLessThanOrEqual(1);
  await expect(confirmationDialog.getByRole('button', { name: 'Отмена' })).toHaveCSS('justify-content', 'center');
  await expect(confirmationDialog.getByRole('button', { name: 'Отмена' })).toHaveCSS('text-align', 'center');
  await expect(confirmationDialog.getByRole('button', { name: 'Удалить' })).toHaveCSS('justify-content', 'center');
  await expect(confirmationDialog.getByRole('button', { name: 'Удалить' })).toHaveCSS('text-align', 'center');
  await confirmationDialog.getByRole('button', { name: 'Отмена' }).click();

  const detailsDialog = page.getByRole('dialog', { name: 'Облигация 10' });
  await page.getByRole('article', { name: 'Облигация 10' })
    .getByRole('button', { name: 'Открыть сведения об облигации Облигация 10' })
    .click();
  const annualCouponYieldMetric = detailsDialog
    .getByText('Годовая купонная доходность', { exact: true })
    .locator('..')
    .locator('..');
  await expect(annualCouponYieldMetric).toContainText('14,01 %');
  const year = new Date().getUTCFullYear();
  await expect(detailsDialog.getByText(`Ожидаемый купонный доход за ${year} год`, { exact: true })).toBeVisible();
  await expect(detailsDialog.getByText(`Доходность отдельных купонов за ${year} год`, { exact: true })).toBeVisible();
});

test('records purchases and sales, restores operations, and removes the position', async ({ page }, testInfo) => {
  const username = `portfolio_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const today = new Date();
  const maturity = new Date(Date.UTC(
    today.getUTCFullYear() + 3,
    today.getUTCMonth(),
    today.getUTCDate(),
  ));
  const placement = new Date(Date.UTC(
    today.getUTCFullYear() - 1,
    today.getUTCMonth(),
    today.getUTCDate(),
  ));
  const bondName = `Тестовая облигация ${Date.now().toString(36)}`;
  let releaseLookup!: () => void;
  const lookupGate = new Promise<void>((resolve) => { releaseLookup = resolve; });

  await page.route('**/api/portfolio/bonds/t-invest-search?*', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.searchParams.get('query') !== 'тестовая') return route.fulfill({ json: { items: [] } });
    return route.fulfill({
      json: { items: [{ ticker: 'SU26238', instrument_uid: 'e2e-instrument-1', name: bondName }] },
    });
  });
  await page.route('**/api/portfolio/bonds/t-invest-lookup?*', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.searchParams.get('instrument_uid') !== 'e2e-instrument-1') {
      return route.fulfill({ json: { item: null } });
    }
    await lookupGate;
    return route.fulfill({
      json: {
        item: {
          ticker: 'SU26238', instrument_uid: 'e2e-instrument-1', name: bondName, nominal: '1000.00', payments_per_year: 12,
          placement_date: inputDate(placement), maturity_date: inputDate(maturity),
        },
      },
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Войти или зарегистрироваться' }).click();
  await page.getByRole('tab', { name: 'Регистрация' }).click();
  await page.getByLabel(/^Логин/).fill(username);
  await page.getByLabel(/^Пароль/).fill('e2e-password-123');
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();

  await page.getByRole('button', { name: `Открыть меню пользователя ${username}` }).click();
  await page.getByRole('link', { name: 'Портфель', exact: true }).click();
  await expect(page.getByText('Портфель пока пуст')).toBeVisible();
  await page.getByRole('button', { name: 'Добавить облигацию' }).first().click();

  await page.getByRole('combobox', { name: 'Название или тикер' }).fill('тестовая');
  const createDialog = page.getByRole('dialog', { name: 'Добавить облигацию' });
  await expectHeaderDivider(createDialog);
  const firstSearchOption = page.getByRole('option', { name: /SU26238.*Тестовая облигация/ });
  await expect(firstSearchOption).toBeVisible();
  const [dialogBox, optionBox] = await Promise.all([
    createDialog.boundingBox(),
    firstSearchOption.boundingBox(),
  ]);
  if (!dialogBox || !optionBox) throw new Error('Не удалось измерить модалку поиска облигаций');
  expect(optionBox.y + optionBox.height).toBeLessThanOrEqual(dialogBox.y + dialogBox.height);
  await firstSearchOption.click();
  await expect(createDialog.getByText('Загружаем данные облигации…')).toBeVisible();
  const pendingDialogBox = await createDialog.boundingBox();
  if (!pendingDialogBox) throw new Error('Не удалось измерить модалку во время lookup');
  expect(pendingDialogBox.height).toBeGreaterThanOrEqual(dialogBox.height);
  releaseLookup();
  const bondPreview = page.getByRole('region', { name: 'Выбранная облигация' });
  await expect(bondPreview).toContainText(bondName);
  await expect(bondPreview).toContainText('SU26238');
  await expect(bondPreview).toContainText('1 000,00 ₽');
  await expect(bondPreview).toContainText('12');
  await expect(bondPreview.getByText(/Облигация T/)).toHaveCount(0);
  await expect(bondPreview.getByText('Можно добавить в портфель')).toHaveCount(0);
  const tickerColors = await bondPreview.getByText('SU26238', { exact: true }).evaluate((element) => {
    const reference = document.createElement('span');
    reference.style.color = 'var(--green-soft)';
    reference.style.backgroundColor = 'var(--accent-text)';
    document.body.append(reference);
    const actual = getComputedStyle(element);
    const expected = getComputedStyle(reference);
    const result = {
      color: actual.color,
      backgroundColor: actual.backgroundColor,
      expectedColor: expected.color,
      expectedBackgroundColor: expected.backgroundColor,
    };
    reference.remove();
    return result;
  });
  expect(tickerColors.color).toBe(tickerColors.expectedColor);
  expect(tickerColors.backgroundColor).toBe(tickerColors.expectedBackgroundColor);
  await expect(page.getByLabel('Название', { exact: true })).toHaveCount(0);
  await page.getByLabel('Сумма сделки (с учётом НКД и комиссий)').fill('9500,70');
  await page.getByLabel('Количество', { exact: true }).fill('10');
  await expect(page.getByLabel('Дата покупки')).toHaveValue(inputDate(today));
  await expect(page.getByRole('button', { name: 'Сохранить' })).toBeEnabled();
  await page.getByRole('button', { name: 'Сохранить' }).click();

  const card = page.getByRole('article', { name: bondName });
  await expect(card).toContainText('10 шт.');
  await expect(card).toContainText(/10\s*025,00\s*₽/);
  const cardMarketHelp = card.getByRole('button', {
    name: 'Текущая рыночная стоимость + НКД',
  });
  await cardMarketHelp.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(cardMarketHelp).toBeFocused();
  const cardMarketTooltip = card.getByRole('tooltip', {
    name: 'Текущая рыночная стоимость + НКД',
  });
  await expect(cardMarketTooltip).toBeVisible();
  await cardMarketHelp.hover();
  await expect(cardMarketTooltip).toBeVisible();
  await expect(cardMarketTooltip).toHaveText('Текущая рыночная стоимость + НКД');
  const cardCouponHelp = card.getByRole('button', {
    name: `Как рассчитывается сумма купонов за ${today.getUTCFullYear()} год`,
  });
  await cardCouponHelp.hover();
  const cardCouponTooltip = card.getByRole('tooltip', { name: /Ожидаемый купонный доход за/ });
  await expect(cardCouponTooltip).toBeVisible();
  await expect(cardCouponTooltip).toContainText('без учета выплаченного НКД по операциям продажи');
  const tooltipColor = await cardCouponTooltip.evaluate((element) => getComputedStyle(element).color);
  const cardTooltipFontSize = await cardCouponTooltip.evaluate(
    (element) => getComputedStyle(element).fontSize,
  );
  expect(tooltipColor).toBe('rgb(23, 35, 30)');
  const progress = card.getByRole('progressbar', { name: `Купонный период ${bondName}` });
  await expect(progress).toHaveAttribute('aria-valuenow', /\d+/);

  const detailsTrigger = card.getByRole('button', { name: `Открыть сведения об облигации ${bondName}` });
  const originalViewport = page.viewportSize();
  if (!originalViewport) throw new Error('Viewport is unavailable');
  await page.setViewportSize({ width: originalViewport.width, height: 600 });
  await detailsTrigger.click();
  const detailsDialog = page.getByRole('dialog', { name: bondName });
  await expectHeaderDivider(detailsDialog);
  const modalScrollViewport = detailsDialog.locator('[data-modal-scroll-viewport]');
  const modalScrollMetrics = await modalScrollViewport.evaluate((element) => {
    const dialog = element.parentElement;
    if (!dialog) throw new Error('Modal shell is missing');
    return {
      dialogOverflow: getComputedStyle(dialog).overflow,
      dialogRadius: getComputedStyle(dialog).borderTopRightRadius,
      viewportOverflowY: getComputedStyle(element).overflowY,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    };
  });
  expect(modalScrollMetrics.dialogOverflow).toBe('hidden');
  expect(modalScrollMetrics.dialogRadius).not.toBe('0px');
  expect(modalScrollMetrics.viewportOverflowY).toBe('auto');
  expect(modalScrollMetrics.scrollHeight).toBeGreaterThan(modalScrollMetrics.clientHeight);
  await modalScrollViewport.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  expect(await modalScrollViewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await modalScrollViewport.evaluate((element) => { element.scrollTop = 0; });
  await page.setViewportSize(originalViewport);
  await expect(detailsDialog.getByText('Вложено в облигации')).toBeVisible();
  await expect(detailsDialog.getByText('Текущая рыночная стоимость', { exact: true })).toBeVisible();
  await expect(detailsDialog.getByText('10 025,00 ₽', { exact: true })).toBeVisible();
  await expect(detailsDialog.getByText('+ 25,00 ₽', { exact: false })).toBeVisible();
  await expect(detailsDialog.getByText(`Ожидаемый купонный доход за ${today.getUTCFullYear()} год`, { exact: true })).toBeVisible();
  await expect(detailsDialog.getByText(`Доходность отдельных купонов за ${today.getUTCFullYear()} год`, { exact: true })).toBeVisible();
  await expect(detailsDialog.getByText('Годовая купонная доходность', { exact: true })).toBeVisible();
  const couponIncomeMetric = detailsDialog.getByText(`Ожидаемый купонный доход за ${today.getUTCFullYear()} год`, { exact: true }).locator('xpath=../..');
  await expect(couponIncomeMetric).toContainText('+0,00 ₽');
  const metricsGrid = detailsDialog.getByText('Текущая рыночная стоимость', { exact: true })
    .locator('xpath=ancestor::dl');
  const metricsGridLayout = await metricsGrid.evaluate((element) => {
    const cells = Array.from(element.children).map((cell) => cell.getBoundingClientRect());
    return {
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      firstCellLeft: cells[0]?.left,
      secondCellLeft: cells[1]?.left,
      firstCellTop: cells[0]?.top,
      secondCellTop: cells[1]?.top,
    };
  });
  expect(metricsGridLayout.scrollWidth).toBeLessThanOrEqual(metricsGridLayout.clientWidth);
  if (testInfo.project.name === 'mobile') {
    expect(metricsGridLayout.secondCellLeft).toBe(metricsGridLayout.firstCellLeft);
    expect(metricsGridLayout.secondCellTop).toBeGreaterThan(metricsGridLayout.firstCellTop!);
  } else {
    expect(metricsGridLayout.secondCellTop).toBe(metricsGridLayout.firstCellTop);
    expect(metricsGridLayout.secondCellLeft).toBeGreaterThan(metricsGridLayout.firstCellLeft!);
  }
  const yieldHelp = detailsDialog.getByRole('button', {
    name: `Как рассчитывается доходность отдельных купонов за ${today.getUTCFullYear()} год`,
  });
  await expect(yieldHelp).toBeVisible();
  await yieldHelp.hover();
  const yieldTooltip = detailsDialog.getByRole('tooltip');
  await expect(yieldTooltip).toBeVisible();
  const modalTooltipFontSize = await yieldTooltip.evaluate(
    (element) => getComputedStyle(element).fontSize,
  );
  expect(modalTooltipFontSize).toBe(cardTooltipFontSize);
  const tooltipTopIsInteractive = await yieldTooltip.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const hit = document.elementFromPoint(bounds.left + 8, bounds.top + 8);
    return hit !== null && element.contains(hit);
  });
  expect(tooltipTopIsInteractive).toBe(true);
  await expect(detailsDialog.getByText('12', { exact: true })).toBeVisible();
  const realizedMetricLayout = await detailsDialog.getByText('Результат сделок', { exact: true }).evaluate((element) => {
    const cell = element.closest('div');
    if (!cell) throw new Error('Realized result metric cell is missing');
    const style = getComputedStyle(cell);
    return {
      borderTopWidth: style.borderTopWidth,
      gridColumnStart: style.gridColumnStart,
      gridColumnEnd: style.gridColumnEnd,
    };
  });
  expect(realizedMetricLayout).toEqual({ borderTopWidth: '1px', gridColumnStart: 'auto', gridColumnEnd: 'auto' });
  const nextCoupon = detailsDialog.getByRole('region', { name: 'Ближайший купон' });
  await expect(nextCoupon).toContainText(/•.*₽ шт\./);
  await expect(nextCoupon).not.toContainText('Сумма ближайшей выплаты');
  await expect(nextCoupon).not.toContainText('Купонный период');
  await detailsDialog.getByRole('button', { name: 'Закрыть окно' }).click();
  await expect(detailsTrigger).toBeFocused();
  await detailsTrigger.click();
  const initialHistory = page.getByRole('dialog', { name: bondName }).getByRole('region', { name: 'История операций' });
  await expect(initialHistory).toContainText('1 операция');
  await expect(initialHistory.getByRole('listitem')).toContainText(/9.500,70.₽.*\+10 шт\./);
  await expect(initialHistory).not.toContainText('Покупка');
  await expect(initialHistory).not.toContainText('Продажа');
  await page.getByRole('dialog', { name: bondName }).getByRole('button', { name: 'Закрыть окно' }).click();

  const actions = card.getByRole('button', { name: `Действия с облигацией ${bondName}` });
  await actions.click();
  await page.getByRole('button', { name: 'Зафиксировать покупку' }).click();

  const purchaseDialog = page.getByRole('dialog', { name: 'Зафиксировать покупку' });
  await expectHeaderDivider(purchaseDialog);
  const purchaseSubtitle = purchaseDialog.getByText(bondName, { exact: true });
  await expect(purchaseSubtitle).toBeVisible();
  expect(await purchaseSubtitle.evaluate((element) => getComputedStyle(element).fontSize)).toBe('16px');
  await purchaseDialog.getByLabel('Сумма сделки (с учётом НКД и комиссий)').fill('1000,05');
  await purchaseDialog.getByLabel('Количество', { exact: true }).fill('2');
  await purchaseDialog.getByRole('button', { name: 'Зафиксировать' }).click();

  await expect(purchaseDialog).toBeHidden();
  await expect(card).toContainText('12 шт.');
  await expect(card).toContainText('12 030,00 ₽');
  await expect(progress).toBeVisible();

  await detailsTrigger.click();
  const updatedDetailsDialog = page.getByRole('dialog', { name: bondName });
  await expect(updatedDetailsDialog.getByText('12 030,00 ₽', { exact: true })).toBeVisible();
  await expect(updatedDetailsDialog.getByText('+ 30,00 ₽', { exact: false })).toBeVisible();
  const updatedHistory = updatedDetailsDialog.getByRole('region', { name: 'История операций' });
  await expect(updatedHistory).toContainText('2 операции');
  const purchases = updatedHistory.getByRole('listitem');
  await expect(purchases).toHaveCount(2);
  await expect(purchases.nth(0)).toContainText(/1.000,05.₽.*\+2 шт\./);
  await expect(purchases.nth(1)).toContainText(/9.500,70.₽.*\+10 шт\./);
  await updatedDetailsDialog.getByRole('button', { name: 'Закрыть окно' }).click();

  await actions.click();
  await page.getByRole('button', { name: 'Зафиксировать продажу' }).click();
  const saleDialog = page.getByRole('dialog', { name: 'Зафиксировать продажу' });
  await expectHeaderDivider(saleDialog);
  const saleSubtitle = saleDialog.getByText(bondName, { exact: true });
  await expect(saleSubtitle).toBeVisible();
  expect(await saleSubtitle.evaluate((element) => getComputedStyle(element).fontSize)).toBe('16px');
  await expect(saleDialog.getByText('Доступно на выбранную дату: 12 шт.')).toBeVisible();
  await saleDialog.getByLabel('Сумма сделки (с учётом НКД и комиссий)').fill('12000');
  await saleDialog.getByLabel('Количество', { exact: true }).fill('12');
  await saleDialog.getByRole('button', { name: 'Зафиксировать' }).click();

  await expect(saleDialog).toBeHidden();
  await expect(card).toContainText('0 шт.');
  await expect(card).toContainText('0,00 ₽');

  await actions.click();
  const disabledSaleAction = page.getByRole('button', { name: 'Зафиксировать продажу' });
  await expect(disabledSaleAction).toBeDisabled();
  expect(await disabledSaleAction.evaluate((element) => getComputedStyle(element).cursor)).toBe('not-allowed');
  await page.keyboard.press('Escape');

  await detailsTrigger.click();
  const closedDetails = page.getByRole('dialog', { name: bondName });
  const closedMarketValue = closedDetails.locator('dt')
    .filter({ hasText: 'Текущая рыночная стоимость' })
    .locator('xpath=following-sibling::dd');
  await expect(closedMarketValue).not.toContainText('НКД');
  await expect(closedDetails.getByText('Вложено в оставшиеся облигации')).toBeVisible();
  const closedHistory = closedDetails.getByRole('region', { name: 'История операций' });
  await expect(closedHistory).toContainText('3 операции');
  const saleOperation = closedHistory.getByRole('listitem').first();
  await expect(saleOperation).toContainText(/12.000,00.₽.*−12 шт\..*\+1.499,25.₽/);
  const saleQuantityTone = await saleOperation.getByText('−12 шт.').evaluate((element) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--loss)';
    document.body.append(probe);
    const result = {
      color: getComputedStyle(element).color,
      expectedColor: getComputedStyle(probe).color,
    };
    probe.remove();
    return result;
  });
  expect(saleQuantityTone.color).toBe(saleQuantityTone.expectedColor);
  await expect(saleOperation).not.toContainText('Продажа');
  await expect(saleOperation).not.toContainText('Результат:');
  const saleMetaText = await saleOperation.locator('time').evaluate((element) => element.parentElement?.textContent ?? '');
  expect(saleMetaText).toContain(displayDate(today));
  expect(saleMetaText).toMatch(/\+1.499,25.₽/);
  expect(saleMetaText).not.toMatch(/12.000,00.₽/);

  const deleteSale = saleOperation.getByRole('button', { name: 'Удалить операцию продажи' });
  await deleteSale.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  const deleteSaleHitTarget = await deleteSale.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    return {
      button: { top: bounds.top, right: bounds.right, bottom: bounds.bottom, left: bounds.left },
      belongsToButton: hit !== null && element.contains(hit),
      hitTag: hit?.tagName ?? null,
      hitText: hit?.textContent ?? null,
      hitClass: hit?.getAttribute('class') ?? null,
    };
  });
  expect(deleteSaleHitTarget.belongsToButton, JSON.stringify(deleteSaleHitTarget)).toBe(true);
  await deleteSale.click({ force: true });
  const deleteOperationDialog = page.getByRole('dialog', { name: 'Удалить операцию' });
  await expect(page.getByRole('dialog', { name: bondName })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(2);
  await expect(deleteOperationDialog.getByText(bondName, { exact: true })).toBeVisible();
  await deleteOperationDialog.getByRole('button', { name: 'Отмена' }).click();
  await expect(page.getByRole('dialog', { name: bondName })).toBeVisible();
  await expect(deleteSale).toBeFocused();

  await deleteSale.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  await deleteSale.click({ force: true });
  await page.getByRole('dialog', { name: 'Удалить операцию' }).getByRole('button', { name: 'Удалить' }).click();
  const restoredDetails = page.getByRole('dialog', { name: bondName });
  await expect(restoredDetails.getByRole('region', { name: 'История операций' })).toContainText('2 операции');
  await expect(restoredDetails.getByRole('button', { name: 'Удалить операцию покупки' }).first()).toBeFocused();
  await expect(card).toContainText('12 шт.');
  await restoredDetails.getByRole('button', { name: 'Закрыть окно' }).click();

  await actions.click();
  await page.getByRole('button', { name: 'Удалить из портфеля' }).click();
  const deleteBondDialog = page.getByRole('dialog', { name: 'Удалить облигацию' });
  await expect(deleteBondDialog.getByText(bondName, { exact: true })).toBeVisible();
  await deleteBondDialog.getByRole('button', { name: 'Удалить' }).click();

  await expect(card).toBeHidden();
  await expect(page.getByText('Портфель пока пуст')).toBeVisible();
});
