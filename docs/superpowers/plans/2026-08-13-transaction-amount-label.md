# Transaction Amount Label Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Показать одинаковую полную подпись «Сумма сделки (с учётом НКД и комиссий)» над денежным полем в модалках добавления облигации, покупки и продажи.

**Architecture:** Изменение остаётся внутри существующих `PortfolioForms`. Три формы получают одинаковый строковый `label`, отдельные `hint` и `aria-label` удаляются, а бизнес-имена полей и правила валидации сохраняются.

**Tech Stack:** React 19, TypeScript, React Hook Form, SCSS Modules, Vitest, Testing Library, Playwright.

## Global Constraints

- Точный видимый текст во всех трёх формах: «Сумма сделки (с учётом НКД и комиссий)».
- Доступное имя поля формируется из видимого label; отдельный `aria-label` не используется.
- Поля `amountSpent` и `amountReceived`, форматирование, отправляемые данные и правила валидации не меняются.
- Контекстные тексты ошибок «Сумма покупки» и «Сумма продажи» сохраняются.
- Стили, размеры модалок, зависимости и публичные API не меняются.

---

### Task 1: Унифицировать подпись денежного поля в PortfolioForms

**Files:**
- Modify: `frontend/src/pages/PortfolioPage/__tests__/PortfolioPage.spec.tsx`
- Modify: `frontend/e2e/portfolio.spec.ts`
- Modify: `frontend/src/pages/PortfolioPage/components/PortfolioForms/CreateBondForm.tsx:271-283`
- Modify: `frontend/src/pages/PortfolioPage/components/PortfolioForms/AddPurchaseForm.tsx:75-87`
- Modify: `frontend/src/pages/PortfolioPage/components/PortfolioForms/AddSaleForm.tsx:100-112`

**Interfaces:**
- Consumes: существующий `ControlledNumberField` с prop `label: ReactNode`.
- Produces: прежние формы и прежние имена form-полей; пользовательский и accessible label каждого денежного поля — «Сумма сделки (с учётом НКД и комиссий)».

- [x] **Step 1: Обновить component-тесты на новый единый accessible label**

В `PortfolioPage.spec.tsx` заменить все обращения:

```tsx
getByLabelText('Сумма покупки (с учётом НКД и комиссий)')
getByLabelText('Сумма продажи (с учётом НКД и комиссий)')
queryByLabelText('Сумма покупки (с учётом НКД и комиссий)')
```

на соответствующие `getByLabelText`/`queryByLabelText` с единым литералом:

```tsx
'Сумма сделки (с учётом НКД и комиссий)'
```

Остальную структуру и ожидания тестов не менять.

- [x] **Step 2: Запустить component-тест и подтвердить ожидаемое падение**

Run:

```bash
pnpm.cmd --dir frontend test -- src/pages/PortfolioPage/__tests__/PortfolioPage.spec.tsx
```

Expected: FAIL при поиске «Сумма сделки (с учётом НКД и комиссий)», потому что формы пока предоставляют старые accessible names покупки и продажи.

- [x] **Step 3: Заменить label в трёх формах минимальным изменением**

В каждом `ControlledNumberField` денежной суммы в `CreateBondForm.tsx`, `AddPurchaseForm.tsx` и `AddSaleForm.tsx` использовать:

```tsx
label="Сумма сделки (с учётом НКД и комиссий)"
```

Удалить из этих трёх полей props:

```tsx
hint="(с учётом НКД и комиссий)"
aria-label="Сумма покупки (с учётом НКД и комиссий)"
aria-label="Сумма продажи (с учётом НКД и комиссий)"
```

Не менять `name`, `rules`, `unit`, `inputMode` и обработчики форм.

- [x] **Step 4: Запустить component-тест и подтвердить прохождение**

Run:

```bash
pnpm.cmd --dir frontend test -- src/pages/PortfolioPage/__tests__/PortfolioPage.spec.tsx
```

Expected: PASS для всех тестов `PortfolioPage`.

- [x] **Step 5: Обновить E2E-селекторы трёх модалок**

В `frontend/e2e/portfolio.spec.ts` заменить два селектора покупки и один селектор продажи на:

```ts
getByLabel('Сумма сделки (с учётом НКД и комиссий)')
```

Это сохраняет проверку реального accessible label в модалках добавления облигации, покупки и продажи.

- [x] **Step 6: Проверить отсутствие старых UI-подписей**

Run:

```powershell
rg -n -S 'label="Сумма покупки"|label="Сумма продажи"|aria-label="Сумма покупки \(с учётом НКД и комиссий\)"|aria-label="Сумма продажи \(с учётом НКД и комиссий\)"' frontend/src/pages/PortfolioPage/components/PortfolioForms
```

Expected: no matches, exit code 1.

- [x] **Step 7: Выполнить полный набор проверок frontend**

Run:

```powershell
pnpm.cmd --dir frontend lint
pnpm.cmd --dir frontend typecheck
pnpm.cmd --dir frontend test
pnpm.cmd --dir frontend test:e2e
pnpm.cmd --dir frontend build
```

Expected: все команды завершаются с exit code 0; 24 E2E-сценария проходят на desktop и mobile.

- [x] **Step 8: Зафиксировать реализацию**

```powershell
git add frontend/src/pages/PortfolioPage/__tests__/PortfolioPage.spec.tsx frontend/e2e/portfolio.spec.ts frontend/src/pages/PortfolioPage/components/PortfolioForms/CreateBondForm.tsx frontend/src/pages/PortfolioPage/components/PortfolioForms/AddPurchaseForm.tsx frontend/src/pages/PortfolioPage/components/PortfolioForms/AddSaleForm.tsx docs/superpowers/plans/2026-08-13-transaction-amount-label.md
git commit -m "refactor(portfolio): unify transaction amount label"
```
