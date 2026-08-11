import { expect, test } from '@playwright/test';

function inputDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

test('creates a portfolio bond and updates its aggregate through the purchase endpoint', async ({ page }) => {
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

  await page.route('**/api/portfolio/bonds/t-invest-lookup?*', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.searchParams.get('ticker') !== 'SU26238') return route.fulfill({ json: { item: null } });
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

  await page.getByRole('combobox', { name: 'Тикер' }).fill('su26238');
  await page.getByRole('option', { name: /SU26238.*Тестовая облигация/ }).click();
  await expect(page.getByLabel('Название')).toHaveValue(bondName);
  await page.getByLabel('Сумма покупки').fill('9500,70');
  await page.getByLabel('Количество', { exact: true }).fill('10');
  await expect(page.getByLabel('Дата покупки')).toHaveValue(inputDate(today));
  await expect(page.getByText('Имя свободно')).toBeVisible();
  await page.getByRole('button', { name: 'Сохранить' }).click();

  const card = page.getByRole('article', { name: bondName });
  await expect(card).toContainText('10 шт.');
  await expect(card).toContainText('9 500,70 ₽');
  const progress = card.getByRole('progressbar', { name: `Купонный период ${bondName}` });
  await expect(progress).toHaveAttribute('aria-valuenow', /\d+/);

  const detailsTrigger = card.getByRole('button', { name: `Открыть сведения об облигации ${bondName}` });
  await detailsTrigger.click();
  const detailsDialog = page.getByRole('dialog', { name: bondName });
  await expect(detailsDialog.getByText('Вложенная сумма')).toBeVisible();
  await expect(detailsDialog.getByText('Годовая купонная доходность')).toBeVisible();
  await expect(detailsDialog.getByText('12')).toBeVisible();
  const nextCoupon = detailsDialog.getByRole('region', { name: 'Ближайший купон' });
  await expect(nextCoupon).toContainText(/•.*₽ шт\./);
  await expect(nextCoupon).not.toContainText('Сумма ближайшей выплаты');
  await expect(nextCoupon).not.toContainText('Купонный период');
  await detailsDialog.getByRole('button', { name: 'Закрыть окно' }).click();
  await expect(detailsTrigger).toBeFocused();
  await detailsTrigger.click();
  const initialHistory = page.getByRole('dialog', { name: bondName }).getByRole('region', { name: 'История покупок' });
  await expect(initialHistory).toContainText('1 покупка');
  await expect(initialHistory.getByRole('listitem')).toContainText(/9.500,70.₽.*10 шт\./);
  await page.getByRole('dialog', { name: bondName }).getByRole('button', { name: 'Закрыть окно' }).click();

  const actions = card.getByRole('button', { name: `Действия с облигацией ${bondName}` });
  await actions.click();
  await page.getByRole('button', { name: 'Зафиксировать покупку' }).click();

  const purchaseDialog = page.getByRole('dialog', { name: 'Зафиксировать покупку' });
  await purchaseDialog.getByLabel('Сумма покупки').fill('1000,05');
  await purchaseDialog.getByLabel('Количество', { exact: true }).fill('2');
  await purchaseDialog.getByRole('button', { name: 'Зафиксировать' }).click();

  await expect(purchaseDialog).toBeHidden();
  await expect(card).toContainText('12 шт.');
  await expect(card).toContainText('10 500,75 ₽');
  await expect(progress).toBeVisible();

  await detailsTrigger.click();
  const updatedDetailsDialog = page.getByRole('dialog', { name: bondName });
  const updatedHistory = updatedDetailsDialog.getByRole('region', { name: 'История покупок' });
  await expect(updatedHistory).toContainText('2 покупки');
  const purchases = updatedHistory.getByRole('listitem');
  await expect(purchases).toHaveCount(2);
  await expect(purchases.nth(0)).toContainText(/1.000,05.₽.*2 шт\./);
  await expect(purchases.nth(1)).toContainText(/9.500,70.₽.*10 шт\./);
  await updatedDetailsDialog.getByRole('button', { name: 'Закрыть окно' }).click();

  await actions.click();
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toBe(
      'Вы точно хотите удалить облигацию из портфеля? Это действие необратимо.',
    );
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Удалить из портфеля' }).click();

  await expect(card).toBeHidden();
  await expect(page.getByText('Портфель пока пуст')).toBeVisible();
});
