# App, Pages, and Component Utilities Refactor Design

## Goal

Привести композицию фронтенд-приложения к подходу из `bdo-core-members-panel`, перенести конфигурацию маршрутов непосредственно в `src/pages/index.tsx` и вынести верхнеуровневые утилитарные функции из файлов React-компонентов в локальные utility-модули без изменения поведения.

## Scope

Изменения ограничены каталогом `frontend`, связанными unit/component-тестами и этой документацией. Новые runtime-зависимости, новые архитектурные слои и изменения пользовательского интерфейса не требуются. Коммит после выполнения не создаётся.

## App composition

`src/app` становится минимальной точкой композиции приложения по образцу референсного репозитория:

- `src/app/index.ts` импортирует `Pages` через публичный API `#pages` и экспортирует `App`, полученный вызовом `withProviders(Pages)`;
- `src/app/providers/withRouter.tsx` подключает `BrowserRouter`;
- `src/app/providers/withQueryProvider.tsx` подключает существующий `QueryClientProvider` с неизменными настройками retry и stale time;
- `src/app/providers/withTheme.tsx` использует существующий `useTheme` и передаёт `theme` и `toggleTheme` корневому компоненту страниц;
- `src/app/providers/index.ts` собирает HOC в одном месте и сохраняет направление зависимостей `app → pages`.

`main.tsx` продолжает импортировать только `App` из `#app` и глобальные стили из `#app/styles/global.scss`.

## Pages and routing

`src/pages/index.tsx` содержит корневой компонент `Pages` и саму конфигурацию, передаваемую в `useRoutes`. Отдельный `config.tsx` не создаётся.

`Pages`:

- запускает существующую инициализацию `useUserStore`;
- строит маршруты `/`, `/portfolio` и `*`;
- передаёт тему обеим страницам;
- сохраняет текущую проверку статуса пользователя для `/portfolio`, включая состояние проверки, защищённый рендер и redirect на `/`;
- экспортируется через публичный API `#pages`.

Отдельные слайсы `BondCalculatorPage` и `PortfolioPage` сохраняют свои публичные `index.ts` и не импортируют `app` или друг друга.

## Component utility extraction rule

Из `.tsx` выносятся только верхнеуровневые утилитарные функции, объявленные над основным компонентом. Верхнеуровневые React-компоненты, интерфейсы, типы и константы не считаются утилитами и остаются у текущего владельца, если их перенос не требуется для разрыва циклической зависимости.

Правило размещения:

- одна утилитарная функция у владельца — соседний файл `utils.ts`;
- две и более функции — каталог `utils`, одна функция на файл с одноимённым именем и `utils/index.ts`, экспортирующий публичные утилиты этого локального модуля;
- внутри одного владельца компонент импортирует утилиты относительным путём;
- утилиты не добавляются в межслойные публичные API без внешнего потребителя.

Рефакторинг охватывает найденные utility-владельцы:

- `BondCalculatorPage`: `collectPreset`;
- `TextField/NumberField`: `getValueAfterInsertion`;
- `Modal`: `topmostModal`, `handleDocumentKeyDown`, `focusableElements`, `mountModal`, `unmountModal`;
- `PortfolioSummary`: `signedMoney`, `resultClassName`;
- `BondDetails`: `maturityValue`, `formatOperationCount`, `resultSign`, `formatOperationResult`;
- `PortfolioForms/AddSaleForm`: `previousDate`, `localizedFieldError`, `localizedSubmitError`;
- `BondCalculatorForm`: `toLocalDateInputValue`, `getDefaultMaturityDate`, `getTomorrow`, `formatted`, `getDefaultValues`, `validateCalculation`;
- `BondPortfolioCard`: `maturityLabel`, `couponProgress`.

`LoadingState` и `SignedValue` остаются в своих `.tsx`, потому что это React-компоненты. Formatter-объекты, validation maps и другие константы также не переносятся только ради формального дробления.

## Utility test placement

Тесты повторяют структуру utility-модуля:

- для одиночного `utils.ts` каталог `__tests__` находится на том же уровне, что `utils.ts` и файл компонента;
- для каталога `utils` каталог `__tests__` находится внутри `utils`;
- файлы используют суффикс `.spec.ts` или `.spec.tsx` согласно `AGENTS.md`;
- существующие component-тесты остаются рядом с компонентами; они не переносятся в `utils/__tests__`, если проверяют компонент, а не utility API.

Чистые вынесенные функции получают прямые unit-тесты с акцентом на граничные случаи. Состояние модального стека дополнительно продолжает проверяться существующими component-тестами `Modal` для focus trap, Escape, scroll lock и вложенных модалок.

## Compatibility and behavior

Рефакторинг не меняет URL, доступность маршрутов, поведение авторизации, настройки React Query, выбор и сохранение темы, DOM-разметку компонентов или тексты интерфейса. Экспортируемые props существующих страниц и shared UI сохраняются.

Для состояния стека модалок допускается отдельный локальный state/type module внутри `Modal/utils`, чтобы несколько utility-файлов использовали один singleton без импорта из `Modal.tsx` и без циклической зависимости.

## Verification

Работа выполняется через структурные и поведенческие тесты: сначала тесты фиксируют ожидаемые utility API и маршрутизацию, затем переносится реализация. После локальных red/green циклов запускаются обязательные проверки из `AGENTS.md`:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Итоговый diff проверяется на отсутствие утилитарных функций над основными компонентами и на отсутствие нежелательных изменений пользовательского поведения.
