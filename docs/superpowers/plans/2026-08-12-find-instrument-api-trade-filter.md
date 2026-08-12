# FindInstrument API Trade Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Передавать `api_trade_available_flag=True` в поиск облигаций T‑Invest, чтобы `FindInstrument` возвращал только доступные для API-торговли инструменты.

**Architecture:** Изменение остаётся внутри `TInvestGateway.search_bonds`: gateway передаёт дополнительный поддерживаемый SDK-параметр, а существующая обработка ответа не меняется. Контракт фиксируется существующим fake-клиентом gateway-теста.

**Tech Stack:** Python 3.13, `t-tech-investments` 1.49.3, pytest, pytest-asyncio.

## Global Constraints

- Меняется только вызов `FindInstrument` внутри `TInvestGateway.search_bonds`.
- Значение `api_trade_available_flag` всегда равно `True`.
- Не добавлять локальную фильтрацию ответа и не менять `BondBy` или получение последних цен.
- Сохранить существующие незакоммиченные изменения в целевых файлах.

---

### Task 1: Передать фильтр доступности API-торговли

**Files:**
- Modify: `backend/tests/test_t_invest_gateway.py:43-48`
- Modify: `backend/app/portfolio/t_invest_gateway.py:95-101`

**Interfaces:**
- Consumes: `AsyncInstrumentsService.find_instrument(*, query: str, instrument_kind: InstrumentType, api_trade_available_flag: bool | None = None)` из `t-tech-investments` 1.49.3.
- Produces: `TInvestGateway.search_bonds(query: str) -> tuple[TInvestBondSearchItem, ...]`, передающий `api_trade_available_flag=True` без изменения результата метода.

- [ ] **Step 1: Усилить контракт fake-клиента**

Изменить сигнатуру `FakeInstruments.find_instrument` и существующую проверку аргументов:

```python
async def find_instrument(
    self,
    *,
    query: str,
    instrument_kind: object,
    api_trade_available_flag: bool,
) -> SimpleNamespace:
    if (
        query != "ofz"
        or instrument_kind != InstrumentType.INSTRUMENT_TYPE_BOND
        or api_trade_available_flag is not True
    ):
        raise AssertionError(
            "gateway must search API-tradable bonds by the original query"
        )
```

Остальную часть fake-ответа не менять.

- [ ] **Step 2: Запустить целевой тест и подтвердить RED**

Run from `backend`:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_t_invest_gateway.py::test_gateway_searches_bonds_deduplicates_modes_prioritizes_exact_ticker_and_limits
```

Expected: FAIL; вызов `find_instrument` завершается `TypeError` из-за отсутствующего обязательного аргумента `api_trade_available_flag`, который gateway преобразует в `ApiError`.

- [ ] **Step 3: Добавить минимальную production-правку**

В существующий вызов добавить один именованный аргумент:

```python
response = await client.instruments.find_instrument(
    query=query,
    instrument_kind=InstrumentType.INSTRUMENT_TYPE_BOND,
    api_trade_available_flag=True,
)
```

- [ ] **Step 4: Запустить целевой тест и подтвердить GREEN**

Run from `backend`:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_t_invest_gateway.py::test_gateway_searches_bonds_deduplicates_modes_prioritizes_exact_ticker_and_limits
```

Expected: PASS.

- [ ] **Step 5: Запустить проверки backend**

Run from `backend`:

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Expected: все backend-тесты проходят без ошибок.

- [ ] **Step 6: Проверить итоговый diff**

Run from repository root:

```powershell
git -c safe.directory=C:/Users/moxxie/Desktop/bonds diff --check
git -c safe.directory=C:/Users/moxxie/Desktop/bonds diff -- backend/app/portfolio/t_invest_gateway.py backend/tests/test_t_invest_gateway.py
```

Expected: новые изменения ограничены одним аргументом production-вызова и контрактом fake-клиента. Автоматический implementation commit не создавать, потому что оба файла уже содержат незакоммиченные пользовательские изменения, не относящиеся к этой задаче.
