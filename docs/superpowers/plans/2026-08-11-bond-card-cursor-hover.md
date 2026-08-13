# Bond Card Cursor Hover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a theme-aware radial cursor hover to the main bond-card surface while keeping the actions button completely unaffected.

**Architecture:** Track pointer coordinates imperatively on the existing `.main` element and expose them as CSS custom properties. Render the effect with a pointer-transparent pseudo-element restricted to `.main`, with theme-specific tint variables and media-query guards.

**Tech Stack:** React, TypeScript, SCSS Modules, Vitest, Testing Library.

## Global Constraints

- Do not use React state or trigger renders on pointer movement.
- Do not apply the effect to the actions column or `•••` button.
- Disable the effect for non-hover pointers and `prefers-reduced-motion: reduce`.
- Preserve current click, focus, dropdown and mobile behavior.

---

### Task 1: Track pointer position on the main card surface

**Files:**
- Modify: `frontend/src/pages/PortfolioPage/components/BondPortfolioCard/BondPortfolioCard.tsx`
- Test: `frontend/src/pages/PortfolioPage/__tests__/PortfolioPage.spec.tsx`

**Interfaces:**
- Produces: inline `--hover-x` and `--hover-y` pixel values on `.main` only.

- [ ] Add a failing component test that mocks `.main.getBoundingClientRect()`, fires `pointerMove`, and expects relative CSS coordinates while the actions button has no hover variables.
- [ ] Run the focused PortfolioPage test and confirm the custom properties are absent.
- [ ] Add an `onPointerMove` handler that writes the two custom properties directly to `event.currentTarget.style`.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Render and verify the theme-aware radial mask

**Files:**
- Modify: `frontend/src/pages/PortfolioPage/components/BondPortfolioCard/BondPortfolioCard.module.scss`

- [ ] Make `.main` isolate its overlay, add the radial pseudo-element, and remove the old flat `.detailsTrigger:hover` fill.
- [ ] Set a subtle dark tint in light mode and a subtle light tint under `:root[data-theme='dark']`.
- [ ] Use a `360px` gradient radius with a `3%` light-theme tint and `4%` dark-theme tint at the cursor, fading continuously to transparent so the default background stays unchanged outside the spot.
- [ ] Restrict hover opacity to `(hover: hover) and (pointer: fine)` and disable it under reduced motion.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`; inspect `git diff --check` for the touched files.
