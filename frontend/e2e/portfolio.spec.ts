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

  await page.goto('/');
  await page.getByRole('button', { name: 'Войти или зарегистрироваться' }).click();
  await page.getByRole('tab', { name: 'Регистрация' }).click();
  await page.getByLabel(/^Логин/).fill(username);
  await page.getByLabel(/^Пароль/).fill('e2e-password-123');
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();

  await page.getByRole('button', { name: `Открыть меню пользователя ${username}` }).click();
  await page.getByRole('link', { name: 'Портфель облигаций' }).click();
  await expect(page.getByText('Портфель пока пуст')).toBeVisible();
  await page.getByRole('button', { name: 'Добавить облигацию' }).first().click();

  await page.getByLabel('Название').fill(bondName);
  await page.getByLabel('Величина купона').fill('35,40');
  await page.getByLabel('Номинал облигации').fill('1000');
  await page.getByLabel('Количество выплат в год').selectOption('12');
  await expect(page.getByLabel('Купонный период, дней')).toHaveValue('30');
  await page.getByLabel('Дата размещения').fill(inputDate(placement));
  await page.getByLabel('Дата погашения').fill(inputDate(maturity));
  await page.getByLabel('Сумма покупки').fill('9500,70');
  await page.getByLabel('Количество').fill('10');
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
  await expect(detailsDialog.getByText('30 дней')).toBeVisible();
  await expect(detailsDialog.getByText(/Купонный период: .+ — .+/)).toBeVisible();
  await detailsDialog.getByRole('button', { name: 'Закрыть окно' }).click();
  await expect(detailsTrigger).toBeFocused();

  const actions = card.getByRole('button', { name: `Действия с облигацией ${bondName}` });
  await actions.click();
  await page.getByRole('button', { name: 'Добавить покупку' }).click();

  const purchaseDialog = page.getByRole('dialog', { name: 'Добавить покупку' });
  await purchaseDialog.getByLabel('Сумма покупки').fill('1000,05');
  await purchaseDialog.getByLabel('Количество').fill('2');
  await purchaseDialog.getByRole('button', { name: 'Добавить покупку' }).click();

  await expect(purchaseDialog).toBeHidden();
  await expect(card).toContainText('12 шт.');
  await expect(card).toContainText('10 500,75 ₽');
  await expect(progress).toBeVisible();

  await actions.click();
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toBe(
      'Вы точно хотите удалить облигацию из портфеля? Это действие необратимо.',
    );
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Удалить облигацию из портфеля' }).click();

  await expect(card).toBeHidden();
  await expect(page.getByText('Портфель пока пуст')).toBeVisible();
});
