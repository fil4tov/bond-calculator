# Auth Modal Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Упростить модалку авторизации, оставив единый заголовок, только необходимые подписи полей и визуально отделённую кнопку действия.

**Architecture:** Все изменения локализуются в существующем `AuthModal` внутри `widgets/SiteHeader`. Разметка получает локальный блок действий, а стили и тесты обновляются рядом с владельцем; общие `Modal`, `TextField` и `Button` не меняются.

**Tech Stack:** React 19, TypeScript, React Hook Form, SCSS Modules, Vitest, Testing Library, Playwright.

## Global Constraints

- Единый заголовок модалки: «Авторизация».
- Надпись «Личный кабинет» и поясняющий текст под вкладками удаляются.
- Placeholder логина: «Логин»; placeholder пароля остаётся «Не менее 8 символов».
- Разделитель применяется к действиям входа и регистрации и работает в обеих темах через `var(--divider)`.
- Клавиатурное переключение вкладок, валидация, адаптивность и состояние отправки не меняются.
- Новые зависимости и публичные API не добавляются.

---

### Task 1: Упростить содержимое и композицию AuthModal

**Files:**
- Modify: `frontend/src/widgets/SiteHeader/__tests__/SiteHeader.spec.tsx:23-51`
- Modify: `frontend/src/widgets/SiteHeader/components/AuthModal/AuthModal.tsx:111-168`
- Modify: `frontend/src/widgets/SiteHeader/components/AuthModal/AuthModal.module.scss:1-23`
- Modify: `frontend/e2e/auth.spec.ts:3-19`

**Interfaces:**
- Consumes: существующие props `Modal`, `TextField`, `Button` и состояние `AuthMode`.
- Produces: прежний `AuthModal({ onClose }: AuthModalProps)` без изменения публичной сигнатуры; локальный CSS-класс `actions` для блока основной кнопки.

- [x] **Step 1: Написать падающие component-утверждения для нового текста и структуры**

В первом тесте `SiteHeader` заменить ожидание диалога и добавить проверки:

```tsx
const authDialog = screen.getByRole('dialog', { name: 'Авторизация' });
expect(authDialog).not.toHaveTextContent('ЛИЧНЫЙ КАБИНЕТ');
expect(authDialog).not.toHaveTextContent('Продолжите работу со своим портфелем облигаций.');
expect(screen.getByPlaceholderText('Логин')).toBeInTheDocument();
expect(screen.getByPlaceholderText('Не менее 8 символов')).toBeInTheDocument();

const loginButton = screen.getByRole('button', { name: 'Войти' });
expect(loginButton.parentElement?.className).toMatch(/actions/);
```

- [x] **Step 2: Запустить component-тест и подтвердить ожидаемое падение**

Run:

```bash
pnpm --dir frontend test -- src/widgets/SiteHeader/__tests__/SiteHeader.spec.tsx
```

Expected: FAIL, потому что диалог ещё называется «Вход и регистрация», placeholder логина прежний, а блок `actions` отсутствует.

- [x] **Step 3: Реализовать минимальное изменение разметки**

В `AuthModal.tsx`:

```tsx
<Modal title="Авторизация" busy={isSubmitting} onClose={close} width="narrow">
```

Удалить весь `styles.intro`. Заменить placeholder логина:

```tsx
placeholder="Логин"
```

Обернуть кнопку отправки:

```tsx
<div className={styles.actions}>
  <Button type="submit" trailingIcon={<FiArrowRight />} disabled={isSubmitting}>
    {isSubmitting ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
  </Button>
</div>
```

- [x] **Step 4: Добавить локальный разделитель и скорректировать вертикальные отступы**

В `AuthModal.module.scss` удалить `.intro`, сохранить grid формы и добавить:

```scss
.form { display: grid; gap: 18px; margin-top: 22px; }
.actions {
  margin-top: 2px;
  padding-top: 20px;
  border-top: 1px solid var(--divider);
}
```

Так граница остаётся между полями/ошибкой и кнопкой, а цвет наследует обе темы.

- [x] **Step 5: Запустить component-тест и подтвердить прохождение**

Run:

```bash
pnpm --dir frontend test -- src/widgets/SiteHeader/__tests__/SiteHeader.spec.tsx
```

Expected: PASS для всех тестов `SiteHeader`.

- [x] **Step 6: Обновить E2E-селектор заголовка и проверить реальный CSS-разделитель**

В `frontend/e2e/auth.spec.ts` использовать новый accessible name и добавить проверку блока кнопки:

```ts
const authDialog = page.getByRole('dialog', { name: 'Авторизация' });
const authActions = authDialog.getByRole('button', { name: 'Войти' }).locator('..');
await expect(authActions).toHaveCSS('border-top-style', 'solid');
await expect(authActions).toHaveCSS('border-top-width', '1px');
```

Существующую проверку границы заголовка сохранить.

- [x] **Step 7: Выполнить полную соразмерную проверку frontend**

Run:

```bash
pnpm --dir frontend lint
pnpm --dir frontend typecheck
pnpm --dir frontend test
pnpm --dir frontend test:e2e
pnpm --dir frontend build
```

Expected: все команды завершаются с exit code 0.

- [x] **Step 8: Зафиксировать реализацию**

```bash
git add frontend/src/widgets/SiteHeader/__tests__/SiteHeader.spec.tsx frontend/src/widgets/SiteHeader/components/AuthModal/AuthModal.tsx frontend/src/widgets/SiteHeader/components/AuthModal/AuthModal.module.scss frontend/e2e/auth.spec.ts docs/superpowers/plans/2026-08-13-auth-modal-simplification.md
git commit -m "refactor(auth): simplify authentication modal"
```
