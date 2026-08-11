# Bond Coupon Amount Line Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Упростить блок ближайшего купона в модалке: показать общую выплату и выплату за одну облигацию в одной строке и убрать купонный период.

**Architecture:** Изменение остаётся внутри локального компонента `BondDetails`. API и доменные типы не меняются; обновляются только разметка, локальные стили и component/E2E-ожидания.

**Tech Stack:** React, TypeScript, SCSS Modules, Vitest, Testing Library, Playwright.

## Global Constraints

- Строка сумм имеет вид `2 655 ₽ • 35,40 ₽ шт.`.
- Общая сумма визуально главная; сумма за штуку меньше и полужирная.
- Тексты «Сумма ближайшей выплаты», «Цена одного купона» и «Купонный период» не отображаются.

---

### Task 1: Компактный блок ближайшего купона

**Files:**
- Modify: `frontend/src/pages/PortfolioPage/components/BondDetails/BondDetails.tsx`
- Modify: `frontend/src/pages/PortfolioPage/components/BondDetails/BondDetails.module.scss`
- Test: `frontend/src/pages/PortfolioPage/__tests__/PortfolioPage.spec.tsx`
- Test: `frontend/e2e/portfolio.spec.ts`

**Interfaces:**
- Consumes: `BondNextCoupon.amount`, `BondNextCoupon.amountPerBond`, `formatMoney(value)`.
- Produces: одна визуальная строка сумм без изменения публичных props или DTO.

- [ ] **Step 1: Write the failing component test**

Проверить порядок `общая сумма • сумма за штуку`, а также отсутствие трёх удаляемых подписей.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm.cmd test -- PortfolioPage.spec.tsx`

Expected: FAIL, потому что старая разметка ещё содержит подписи и купонный период.

- [ ] **Step 3: Write the minimal component and style implementation**

Объединить `amount` и `amountPerBond` в flex-строку, добавить декоративный `•`, вывести `шт.` после второй суммы и удалить строку купонного периода.

- [ ] **Step 4: Update the E2E assertion**

Проверить новую строку сумм и отсутствие «Купонный период» в открытой модалке.

- [ ] **Step 5: Run verification**

Run: `pnpm.cmd lint`, `pnpm.cmd typecheck`, `pnpm.cmd test`, `pnpm.cmd build`.

