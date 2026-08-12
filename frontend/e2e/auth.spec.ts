import { expect, test } from '@playwright/test';

test('registers, opens the portfolio and revokes access on logout', async ({ page }) => {
  const username = `e2e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  await page.goto('/');
  await page.getByRole('button', { name: 'Войти или зарегистрироваться' }).click();
  const authDialog = page.getByRole('dialog', { name: 'Вход и регистрация' });
  const authDialogHeader = authDialog.locator('[data-modal-scroll-viewport] > div').first();
  await expect(authDialogHeader).toHaveCSS('border-bottom-style', 'solid');
  await expect(authDialogHeader).toHaveCSS('border-bottom-width', '1px');
  await page.getByRole('tab', { name: 'Регистрация' }).click();
  await page.getByLabel(/^Логин/).fill(username);
  await page.getByLabel(/^Пароль/).fill('e2e-password-123');
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();

  const avatar = page.getByRole('button', { name: `Открыть меню пользователя ${username}` });
  await expect(avatar).toHaveText('E');
  await avatar.click();
  await page.getByRole('link', { name: 'Портфель', exact: true }).click();
  await expect(page).toHaveURL(/\/portfolio$/);
  await expect(page.getByRole('heading', { name: 'Портфель облигаций' })).toBeVisible();

  await page.getByRole('button', { name: `Открыть меню пользователя ${username}` }).click();
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto('/portfolio');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: /Рассчитайте реальную/ })).toBeVisible();
});
