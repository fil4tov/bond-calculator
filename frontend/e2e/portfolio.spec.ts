import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';

async function expectHeaderDivider(dialog: Locator) {
  const header = dialog.locator(':scope > div').first();
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

test('records purchases and sales, restores operations, and removes the position', async ({ page }) => {
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
  await page.getByLabel('Сумма покупки (с учётом НКД и комиссий)').fill('9500,70');
  await page.getByLabel('Количество', { exact: true }).fill('10');
  await expect(page.getByLabel('Дата покупки')).toHaveValue(inputDate(today));
  await expect(page.getByRole('button', { name: 'Сохранить' })).toBeEnabled();
  await page.getByRole('button', { name: 'Сохранить' }).click();

  const card = page.getByRole('article', { name: bondName });
  await expect(card).toContainText('10 шт.');
  const cardMarketHelp = card.getByRole('button', {
    name: 'Как рассчитывается рыночная оценка без НКД',
  });
  await cardMarketHelp.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(cardMarketHelp).toBeFocused();
  const cardMarketTooltip = card.getByRole('tooltip', {
    name: 'Текущая рыночная стоимость без учета НКД.',
  });
  await expect(cardMarketTooltip).toBeVisible();
  await cardMarketHelp.hover();
  await expect(cardMarketTooltip).toBeVisible();
  await expect(cardMarketTooltip).toHaveText('Текущая рыночная стоимость без учета НКД.');
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
  await detailsTrigger.click();
  const detailsDialog = page.getByRole('dialog', { name: bondName });
  await expectHeaderDivider(detailsDialog);
  await expect(detailsDialog.getByText('Вложено в облигации')).toBeVisible();
  await expect(detailsDialog.getByText(`Купонная доходность за ${today.getUTCFullYear()} год`)).toBeVisible();
  const yieldHelp = detailsDialog.getByRole('button', {
    name: `Как рассчитывается купонная доходность за ${today.getUTCFullYear()} год`,
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
  expect(realizedMetricLayout).toEqual({ borderTopWidth: '1px', gridColumnStart: '1', gridColumnEnd: '-1' });
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
  await purchaseDialog.getByLabel('Сумма покупки (с учётом НКД и комиссий)').fill('1000,05');
  await purchaseDialog.getByLabel('Количество', { exact: true }).fill('2');
  await purchaseDialog.getByRole('button', { name: 'Зафиксировать' }).click();

  await expect(purchaseDialog).toBeHidden();
  await expect(card).toContainText('12 шт.');
  await expect(progress).toBeVisible();

  await detailsTrigger.click();
  const updatedDetailsDialog = page.getByRole('dialog', { name: bondName });
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
  await saleDialog.getByLabel('Сумма продажи (с учётом НКД и комиссий)').fill('12000');
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
  await deleteSale.click();
  const deleteOperationDialog = page.getByRole('dialog', { name: 'Удалить операцию' });
  await expect(page.getByRole('dialog', { name: bondName })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(2);
  await expect(deleteOperationDialog.getByText(bondName, { exact: true })).toBeVisible();
  await deleteOperationDialog.getByRole('button', { name: 'Отмена' }).click();
  await expect(page.getByRole('dialog', { name: bondName })).toBeVisible();
  await expect(deleteSale).toBeFocused();

  await deleteSale.click();
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
