# Portfolio Add Button Color Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать фон кнопки «Добавить облигацию» одинаковым в светлой и тёмной темах.

**Architecture:** Изменение остаётся внутри локального SCSS-модуля страницы портфеля. `Button` и глобальные theme-токены не меняются, поэтому остальные primary-кнопки продолжают использовать тему приложения.

**Tech Stack:** React, TypeScript, SCSS Modules, Vite, Vitest.

## Global Constraints

- Основной фон кнопки в обеих темах: `#2f805f`.
- Hover-фон кнопки в обеих темах: `#236649`.
- Меняется только `addButton` страницы портфеля.
- Цвет текста, иконка, фокус, размеры и поведение кнопки остаются без изменений.

---

### Task 1: Локальный фон кнопки добавления облигации

**Files:**
- Modify: `frontend/src/pages/PortfolioPage/PortfolioPage.module.scss:5`
- Verify: `frontend/src/pages/PortfolioPage/__tests__/PortfolioPage.spec.tsx`

**Interfaces:**
- Consumes: CSS-класс `addButton`, переданный общему `Button` в `PortfolioPage.tsx`.
- Produces: тема-независимые normal и hover цвета только для кнопки «Добавить облигацию».

- [ ] **Step 1: Зафиксировать текущее состояние проверок страницы**

Run:

```powershell
pnpm.cmd test -- PortfolioPage.spec.tsx
```

Expected: все текущие component-тесты проходят до CSS-изменения.

- [ ] **Step 2: Добавить минимальный локальный стиль**

В `PortfolioPage.module.scss` заменить однострочное правило на:

```scss
.addButton {
  width: auto;
  min-width: 260px;
  align-self: center;
  background: #2f805f;

  &:hover { background: #236649; }
}
```

Не изменять `frontend/src/app/styles/global.scss` и `frontend/src/shared/ui/Button/Button.module.scss`.

- [ ] **Step 3: Проверить отсутствие регрессий страницы**

Run:

```powershell
pnpm.cmd test -- PortfolioPage.spec.tsx
```

Expected: все component-тесты проходят.

- [ ] **Step 4: Выполнить финальную проверку frontend**

Run:

```powershell
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
```

Expected: каждая команда завершается с exit code `0`.
