import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUserStore } from '#entities/user';

import { PortfolioPage } from '../PortfolioPage';
import { todayInputValue } from '../utils';

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const lookupItem = {
  ticker: 'SU26238', instrument_uid: 'instrument-1', name: 'ОФЗ 26238', nominal: '1000.00', payments_per_year: 2,
  placement_date: '2025-05-15', maturity_date: '2041-05-15',
};

const searchResponse = (item = lookupItem) => ({
  items: [{ ticker: item.ticker, instrument_uid: item.instrument_uid, name: item.name }],
});

const activeBond = {
  created_at: '2026-08-08T10:00:00Z',
  id: 'bond-1', name: 'ОФЗ 26238', nominal: '1000.00', payments_per_year: 2,
  placement_date: '2025-05-15', maturity_date: '2041-05-15', status: 'active',
  total_quantity: 75, total_spent: '75000.70',
  position_cost_basis: '75000.70', market_value_without_aci: '74250.00', realized_result: '0.00', position_status: 'open',
  paid_coupon_total: '1770.00', calendar_year_coupon_yield_percent: '7.0800', calendar_year_coupon_income: '4248.00', coupon_yield_year: 2026,
  maturity_remaining: { years: 14, months: 9, days_until: 5392 },
  next_coupon: {
    period_start: '2026-05-15', period_end: '2026-11-15', pay_date: '2026-11-16',
    amount: '2655.00', amount_per_bond: '35.40', days_until: 99, period_days: 184, elapsed_period_days: 86,
  },
  purchases: [
    { id: 'purchase-2', amount_spent: '25000.35', quantity: 25, purchase_date: '2026-08-09' },
    { id: 'purchase-1', amount_spent: '50000.35', quantity: 50, purchase_date: '2026-08-08' },
  ],
  operations: [
    { id: 'purchase-2', operation_type: 'purchase', amount: '25000.35', quantity: 25, operation_date: '2026-08-09', realized_result: null },
    { id: 'purchase-1', operation_type: 'purchase', amount: '50000.35', quantity: 50, operation_date: '2026-08-08', realized_result: null },
  ],
};

const maturedBond = {
  ...activeBond, id: 'bond-2', name: 'ОФЗ 25000', status: 'matured', maturity_date: '2025-05-15',
  market_value_without_aci: null, maturity_remaining: { years: 0, months: 0, days_until: 0 }, next_coupon: null,
};

const pendingBond = {
  ...activeBond,
  id: 'bond-3',
  name: 'ОФЗ ожидает выплату',
  status: 'payment_pending',
  maturity_date: '2026-08-02',
  maturity_remaining: { years: 0, months: 0, days_until: 0 },
  next_coupon: {
    period_start: '2026-07-02', period_end: '2026-08-02', pay_date: '2026-08-03',
    amount: '2655.00', amount_per_bond: '35.40', days_until: 1, period_days: 31, elapsed_period_days: 31,
  },
};

const zeroCouponBond = {
  ...activeBond,
  id: 'bond-4',
  name: 'Бескупонная облигация',
  calendar_year_coupon_yield_percent: '0.0000',
  next_coupon: null,
};

function renderPortfolio() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PortfolioPage theme="light" toggleTheme={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

function todayInput(today = new Date()) {
  const year = today.getUTCFullYear();
  const month = String(today.getUTCMonth() + 1).padStart(2, '0');
  const day = String(today.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function requestDetails(input: RequestInfo | URL, init?: RequestInit) {
  if (input instanceof Request) return { url: input.url, method: input.method };
  return { url: String(input), method: init?.method?.toUpperCase() ?? 'GET' };
}

async function requestJson(input: RequestInfo | URL, init?: RequestInit) {
  if (input instanceof Request) return input.clone().json() as Promise<unknown>;
  return JSON.parse(String(init?.body)) as unknown;
}

async function openCreateForm(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText('Портфель пока пуст');
  const trigger = screen.getAllByRole('button', { name: 'Добавить облигацию' })[0];
  if (!trigger) throw new Error('Create trigger is missing');
  await user.click(trigger);
  return screen.getByRole('dialog', { name: 'Добавить облигацию' });
}

async function selectLookupBond(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('combobox', { name: 'Название или тикер' }), 'su26238');
  await user.click(await screen.findByRole('option', { name: /SU26238.*ОФЗ 26238/ }));
}

async function fillCreateForm(user: ReturnType<typeof userEvent.setup>) {
  await selectLookupBond(user);
  await user.type(screen.getByLabelText('Сумма покупки (с учётом НКД и комиссий)'), '75000,70');
  await user.type(screen.getByLabelText('Количество'), '75');
  expect(screen.getByLabelText('Дата покупки')).toHaveValue(todayInput());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить' })).toBeEnabled());
}

async function openPurchaseForm(
  user: ReturnType<typeof userEvent.setup>,
  card: HTMLElement,
) {
  const actions = within(card).getByRole('button', { name: 'Действия с облигацией ОФЗ 26238' });
  await user.click(actions);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Зафиксировать покупку' }));
  return {
    actions,
    dialog: screen.getByRole('dialog', { name: 'Зафиксировать покупку' }),
  };
}

async function openSaleForm(user: ReturnType<typeof userEvent.setup>, card: HTMLElement) {
  await user.click(within(card).getByRole('button', { name: 'Действия с облигацией ОФЗ 26238' }));
  await user.click(screen.getByRole('button', { name: 'Зафиксировать продажу' }));
  return screen.getByRole('dialog', { name: 'Зафиксировать продажу' });
}

describe('PortfolioPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useUserStore.setState({ status: 'authenticated', user: { id: 'user-1', username: 'moxxie' } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps calculator navigation out of the portfolio toolbar', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [] })));

    renderPortfolio();

    expect(screen.queryByRole('link', { name: 'Перейти к калькулятору' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Включить тёмную тему' })).toBeInTheDocument();
  });

  it('uses the portfolio heading without the former assets kicker', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [] })));

    renderPortfolio();

    expect(screen.getByRole('heading', { name: 'Портфель облигаций' })).toBeInTheDocument();
    expect(screen.queryByText('ВАШИ АКТИВЫ')).not.toBeInTheDocument();
  });

  it('keeps the production date on UTC when local and UTC calendar getters disagree', () => {
    const boundary = new Date('2026-08-09T21:30:00Z');
    Object.defineProperties(boundary, {
      getFullYear: { value: () => 2026 },
      getMonth: { value: () => 7 },
      getDate: { value: () => 10 },
    });

    expect(todayInputValue(boundary)).toBe('2026-08-09');
  });

  it('shows an initial skeleton while the portfolio request is pending', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise<Response>(() => undefined)));

    renderPortfolio();

    expect(screen.getByLabelText('Загрузка портфеля')).toBeInTheDocument();
  });

  it('offers an actionable retry and then renders the compact empty state', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({ code: 'request_failed', message: 'Сервер недоступен' }, 500))
      .mockResolvedValueOnce(jsonResponse({ items: [] })));

    renderPortfolio();

    expect(await screen.findByRole('alert')).toHaveTextContent('Сервер недоступен');
    await user.click(screen.getByRole('button', { name: 'Повторить запрос' }));
    expect(await screen.findByText('Портфель пока пуст')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Добавить облигацию' })).toHaveLength(1);
    expect(screen.queryByText(
      'Добавьте первую бумагу и начальную покупку — купоны и сроки рассчитаются автоматически.',
    )).not.toBeInTheDocument();
  });

  it('sorts newest bonds first by default and persists field and direction changes', async () => {
    const user = userEvent.setup();
    const older = { ...activeBond, id: 'older', name: 'Облигация 2', created_at: '2026-08-01T10:00:00Z' };
    const newer = { ...activeBond, id: 'newer', name: 'Облигация 10', created_at: '2026-08-02T10:00:00Z' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [older, newer] })));

    renderPortfolio();

    await screen.findByRole('article', { name: 'Облигация 10' });
    expect(screen.getAllByRole('article').map((card) => card.getAttribute('aria-label'))).toEqual([
      'Облигация 10',
      'Облигация 2',
    ]);

    await user.click(screen.getByRole('button', { name: 'По убыванию. Переключить по возрастанию' }));
    expect(screen.getAllByRole('article').map((card) => card.getAttribute('aria-label'))).toEqual([
      'Облигация 2',
      'Облигация 10',
    ]);

    await user.click(screen.getByRole('button', { name: 'Критерий сортировки: По дате добавления' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'По имени' }));
    expect(screen.getByRole('button', { name: 'По возрастанию. Переключить по убыванию' })).toBeInTheDocument();
    expect(localStorage.getItem('bond-portfolio-sort:user-1')).toBe('{"version":1,"field":"name","direction":"asc"}');
  });

  it('restores a saved preference for the authenticated user', async () => {
    localStorage.setItem('bond-portfolio-sort:user-1', '{"version":1,"field":"name","direction":"desc"}');
    const second = { ...activeBond, id: 'second', name: 'Облигация 2', created_at: '2026-08-02T10:00:00Z' };
    const tenth = { ...activeBond, id: 'tenth', name: 'Облигация 10', created_at: '2026-08-01T10:00:00Z' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [second, tenth] })));

    renderPortfolio();

    await screen.findByRole('article', { name: 'Облигация 10' });
    expect(screen.getByRole('button', { name: 'Критерий сортировки: По имени' })).toBeInTheDocument();
    expect(screen.getAllByRole('article').map((card) => card.getAttribute('aria-label'))).toEqual([
      'Облигация 10',
      'Облигация 2',
    ]);
  });

  it('re-sorts automatically when refreshed query data changes', async () => {
    const older = { ...activeBond, id: 'older', name: 'Старая', created_at: '2026-08-01T10:00:00Z' };
    const newer = { ...activeBond, id: 'newer', name: 'Новая', created_at: '2026-08-02T10:00:00Z' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ items: [older, newer] }))
      .mockResolvedValueOnce(jsonResponse({ items: [
        { ...older, created_at: '2026-08-03T10:00:00Z' },
        newer,
      ] }));
    vi.stubGlobal('fetch', fetchMock);
    const { queryClient } = renderPortfolio();

    await screen.findByRole('article', { name: 'Новая' });
    expect(screen.getAllByRole('article')[0]).toHaveAccessibleName('Новая');

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['bondPortfolio', 'user-1', 'bonds'] });
    });

    await waitFor(() => expect(screen.getAllByRole('article')[0]).toHaveAccessibleName('Старая'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('renders compact active and matured rows with real coupon progress', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [activeBond, maturedBond] })));

    renderPortfolio();

    const activeCard = await screen.findByRole('article', { name: 'ОФЗ 26238' });
    const maturedCard = screen.getByRole('article', { name: 'ОФЗ 25000' });
    expect(screen.getByText(/\+8.496,00.₽/)).toBeInTheDocument();
    expect(screen.getByText('за год.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Что означает ожидаемый купонный доход за 2026 год' })).toBeInTheDocument();
    expect(activeCard).toHaveTextContent(/74.250,00.₽/);
    expect(within(activeCard).getByText('75 шт.')).toBeInTheDocument();
    expect(activeCard).toHaveTextContent(/\+4.248,00.₽/);
    expect(within(activeCard).getByRole('button', {
      name: 'Как рассчитывается рыночная оценка без НКД',
    })).toBeInTheDocument();
    expect(within(activeCard).getByText(
      'Текущая рыночная стоимость без учета НКД.',
    )).toBeInTheDocument();
    expect(within(activeCard).getByRole('button', {
      name: 'Как рассчитывается сумма купонов за 2026 год',
    })).toBeInTheDocument();
    expect(within(activeCard).getByText(
      'Ожидаемый купонный доход за 2026 год без учета выплаченного НКД по операциям продажи.',
    )).toBeInTheDocument();
    expect(within(activeCard).getByText('Ближайший купон через 99 дней')).toBeInTheDocument();
    expect(within(activeCard).queryByText('Всего вложено')).not.toBeInTheDocument();
    expect(within(activeCard).queryByText('Номинал')).not.toBeInTheDocument();

    const progress = within(activeCard).getByRole('progressbar', { name: 'Купонный период ОФЗ 26238' });
    const detailsTrigger = within(activeCard).getByRole('button', { name: 'Открыть сведения об облигации ОФЗ 26238' });
    expect(progress).toHaveAttribute('aria-valuenow', '46.74');
    expect(progress.getAttribute('aria-valuetext') ?? '').toMatch(
      /Пройдено 46,74 %. Ближайший купон через 99 дней, сумма 2.655,00.₽/,
    );
    expect(progress.querySelector('[data-progress-fill]')).toHaveStyle({ width: '46.74%' });
    expect(detailsTrigger).not.toContainElement(progress);
    expect(detailsTrigger).toHaveAttribute('aria-describedby');
    expect(within(maturedCard).getByText('Облигация погашена')).toBeInTheDocument();
    expect(within(maturedCard).getByText('—')).toBeInTheDocument();
    expect(within(maturedCard).queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('does not describe an active zero-coupon bond as matured', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [zeroCouponBond] })));

    renderPortfolio();

    const card = await screen.findByRole('article', { name: 'Бескупонная облигация' });
    expect(within(card).getByText('Купонные выплаты не предусмотрены')).toBeInTheDocument();
    expect(within(card).queryByText('Облигация погашена')).not.toBeInTheDocument();
  });

  it('keeps the final coupon visible while its shifted payment is pending', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [pendingBond] })));

    renderPortfolio();

    const card = await screen.findByRole('article', { name: pendingBond.name });
    expect(within(card).getByText('Ожидается выплата')).toBeInTheDocument();
    expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    await user.click(within(card).getByRole('button', { name: `Открыть сведения об облигации ${pendingBond.name}` }));
    expect(within(screen.getByRole('dialog', { name: pendingBond.name })).getAllByText('Ожидается выплата'))
      .toHaveLength(2);
  });

  it.each([
    { years: 1, expected: 'До погашения 1 г. 9 мес.' },
    { years: 2, expected: 'До погашения 2 г. 9 мес.' },
    { years: 6, expected: 'До погашения 6 л. 9 мес.' },
    { years: 11, expected: 'До погашения 11 л. 9 мес.' },
    { years: 21, expected: 'До погашения 21 г. 9 мес.' },
  ])('uses the correct Russian year form for $years years', async ({ years, expected }) => {
    const bond = {
      ...activeBond,
      name: `ОФЗ ${years}`,
      maturity_remaining: { ...activeBond.maturity_remaining, years },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [bond] })));

    renderPortfolio();

    const card = await screen.findByRole('article', { name: bond.name });
    expect(within(card).getByText(expected)).toBeInTheDocument();
  });

  it.each([
    { days: 1, expected: '1 день' },
    { days: 2, expected: '2 дня' },
    { days: 4, expected: '4 дня' },
    { days: 5, expected: '5 дней' },
    { days: 11, expected: '11 дней' },
    { days: 21, expected: '21 день' },
    { days: 64, expected: '64 дня' },
  ])('declines $expected in the coupon bar and details', async ({ days, expected }) => {
    const user = userEvent.setup();
    const bond = {
      ...activeBond,
      name: `ОФЗ через ${days}`,
      next_coupon: { ...activeBond.next_coupon, days_until: days },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [bond] })));

    renderPortfolio();

    const card = await screen.findByRole('article', { name: bond.name });
    expect(within(card).getByText(`Ближайший купон через ${expected}`)).toBeInTheDocument();
    expect(within(card).getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      expect.stringContaining(`Ближайший купон через ${expected}`),
    );

    await user.click(within(card).getByRole('button', { name: `Открыть сведения об облигации ${bond.name}` }));
    expect(within(screen.getByRole('dialog', { name: bond.name })).getByRole('region', { name: 'Ближайший купон' }))
      .toHaveTextContent(`через ${expected}`);
  });

  it('tracks the cursor only inside the main card surface', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [activeBond] })));
    renderPortfolio();

    const card = await screen.findByRole('article', { name: 'ОФЗ 26238' });
    const detailsTrigger = within(card).getByRole('button', { name: 'Открыть сведения об облигации ОФЗ 26238' });
    const actionsTrigger = within(card).getByRole('button', { name: 'Действия с облигацией ОФЗ 26238' });
    const main = detailsTrigger.parentElement as HTMLElement;
    vi.spyOn(main, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 50 } as DOMRect);

    fireEvent.pointerMove(main, { clientX: 164, clientY: 92 });

    expect(main.style.getPropertyValue('--hover-x')).toBe('64px');
    expect(main.style.getPropertyValue('--hover-y')).toBe('42px');
    expect(actionsTrigger.style.getPropertyValue('--hover-x')).toBe('');
    expect(actionsTrigger.style.getPropertyValue('--hover-y')).toBe('');

    fireEvent.pointerMove(actionsTrigger, { clientX: 210, clientY: 92 });
    expect(main.style.getPropertyValue('--hover-x')).toBe('64px');
  });

  it('opens complete bond details by click and keyboard and restores focus', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [activeBond] })));
    renderPortfolio();
    const card = await screen.findByRole('article', { name: 'ОФЗ 26238' });
    const detailsTrigger = within(card).getByRole('button', { name: 'Открыть сведения об облигации ОФЗ 26238' });

    await user.click(detailsTrigger);
    const dialog = screen.getByRole('dialog', { name: 'ОФЗ 26238' });
    expect(within(dialog).queryByText('ПОРТФЕЛЬ')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Активна')).toBeInTheDocument();
    expect(within(dialog).getByText('Номинал').parentElement).toHaveTextContent(/1.000,00.₽/);
    expect(
      Array.from(within(dialog).getByText('Номинал').closest('dl')!.querySelectorAll('dt'))
        .map((label) => label.firstElementChild?.textContent ?? label.textContent),
    ).toEqual(['Номинал', 'Выплат в год', 'Дата размещения', 'Дата погашения', 'Срок до погашения']);
    expect(within(dialog).queryByText('Купон')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Купонный период')).not.toBeInTheDocument();
    expect(
      Array.from(within(dialog).getByText('Вложено в облигации').closest('dl')!.querySelectorAll('dt'))
        .map((label) => label.firstElementChild?.textContent ?? label.textContent),
    ).toEqual([
      'Текущая рыночная стоимость',
      'Вложено в облигации',
      'Количество',
      'Купонная доходность за 2026 год',
      'Выплачено купонов',
      'Результат сделок',
    ]);
    const nextCoupon = within(dialog).getByRole('region', { name: 'Ближайший купон' });
    expect(nextCoupon).not.toHaveTextContent('Сумма ближайшей выплаты');
    expect(nextCoupon).not.toHaveTextContent('Цена одного купона');
    expect(nextCoupon).not.toHaveTextContent('Купонный период');
    expect(nextCoupon).toHaveTextContent(/2.655,00.₽.*•.*35,40.₽ шт\./);
    expect(nextCoupon).toHaveTextContent('16 ноября 2026 г.');
    const operationHistory = within(dialog).getByRole('region', { name: 'История операций' });
    expect(operationHistory).toHaveTextContent('2 операции');
    const operations = within(operationHistory).getAllByRole('listitem');
    expect(operations).toHaveLength(2);
    expect(operations[0]).toHaveTextContent(/25.000,35.₽.*\+25 шт\..*9 августа 2026 г\./);
    expect(operations[1]).toHaveTextContent(/50.000,35.₽.*\+50 шт\..*8 августа 2026 г\./);
    expect(operationHistory).not.toHaveTextContent('Покупка');
    expect(operationHistory).not.toHaveTextContent('Продажа');
    expect(within(dialog).getByText('Выплачено купонов').parentElement).toHaveTextContent(/1.770,00.₽/);
    expect(within(dialog).getByRole('button', {
      name: 'Как рассчитывается купонная доходность за 2026 год',
    })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', {
      name: 'Как рассчитывается сумма, вложенная в оставшиеся облигации',
    })).toBeInTheDocument();
    expect(within(dialog).getByText(
      'Для каждого купона за 2026 год сумма выплаты по бумагам в позиции на дату отсечения делится на историческую себестоимость этой позиции на ту же дату и умножается на 100%. Полученные доходности купонов складываются. Дата отсечения — дата фиксации права, а если её нет — конец купонного периода, без учёта операций в этот день. Учитываются уже выплаченные и будущие купоны; возврат номинала не входит.',
    )).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(dialog).not.toBeInTheDocument();
    expect(detailsTrigger).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: 'ОФЗ 26238' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.keyboard(' ');
    expect(screen.getByRole('dialog', { name: 'ОФЗ 26238' })).toBeInTheDocument();
  });

  it('orders portfolio metrics by investment, quantity, yield, coupons and maturity', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [activeBond] })));
    renderPortfolio();
    const card = await screen.findByRole('article', { name: 'ОФЗ 26238' });

    await user.click(within(card).getByRole('button', { name: 'Открыть сведения об облигации ОФЗ 26238' }));
    const dialog = screen.getByRole('dialog', { name: 'ОФЗ 26238' });

    expect(
      Array.from(within(dialog).getByText('Вложено в облигации').closest('dl')!.querySelectorAll('dt'))
        .map((label) => label.firstElementChild?.textContent ?? label.textContent),
    ).toEqual([
      'Текущая рыночная стоимость',
      'Вложено в облигации',
      'Количество',
      'Купонная доходность за 2026 год',
      'Выплачено купонов',
      'Результат сделок',
    ]);
  });

  it('uses disclosure keyboard behavior and restores purchase focus to ellipsis', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [activeBond] })));
    renderPortfolio();
    const card = await screen.findByRole('article', { name: 'ОФЗ 26238' });
    const actions = within(card).getByRole('button', { name: 'Действия с облигацией ОФЗ 26238' });

    actions.focus();
    await user.keyboard('{Enter}');
    const purchaseAction = screen.getByRole('button', { name: 'Зафиксировать покупку' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.tab();
    expect(purchaseAction).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(purchaseAction).not.toBeInTheDocument();
    expect(actions).toHaveFocus();

    const { dialog } = await openPurchaseForm(user, card);
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).queryByText('ПОРТФЕЛЬ')).not.toBeInTheDocument();
    expect(within(dialog).getByText(
      'После добавления покупки пересчитается купонная доходность за 2026 год',
    )).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(dialog).not.toBeInTheDocument();
    expect(actions).toHaveFocus();
  });

  it('cancels bond deletion in the local confirmation dialog', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [activeBond] }));
    vi.stubGlobal('fetch', fetchMock);
    renderPortfolio();
    const card = await screen.findByRole('article', { name: 'ОФЗ 26238' });

    await user.click(within(card).getByRole('button', { name: 'Действия с облигацией ОФЗ 26238' }));
    expect(screen.getByRole('button', { name: 'Зафиксировать покупку' })).toBeInTheDocument();
    const deleteAction = screen.getByRole('button', { name: 'Удалить из портфеля' });
    await user.click(deleteAction);
    const confirmation = screen.getByRole('dialog', { name: 'Удалить облигацию' });
    expect(within(confirmation).getByText('ОФЗ 26238')).toBeInTheDocument();
    await user.click(within(confirmation).getByRole('button', { name: 'Отмена' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(card).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('deletes a confirmed bond from the cache and shows the empty portfolio state', async () => {
    const user = userEvent.setup();
    const requests: Array<{ url: string; method: string }> = [];
    let deleted = false;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const details = requestDetails(input, init);
      requests.push(details);
      if (details.method === 'DELETE') {
        deleted = true;
        return new Response(null, { status: 204 });
      }
      return jsonResponse({ items: deleted ? [] : [activeBond] });
    }));
    renderPortfolio();
    const card = await screen.findByRole('article', { name: 'ОФЗ 26238' });

    await user.click(within(card).getByRole('button', { name: 'Действия с облигацией ОФЗ 26238' }));
    await user.click(screen.getByRole('button', { name: 'Удалить из портфеля' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Удалить облигацию' })).getByRole('button', { name: 'Удалить' }));

    expect(await screen.findByText('Портфель пока пуст')).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'ОФЗ 26238' })).not.toBeInTheDocument();
    expect(requests).toContainEqual({
      url: expect.stringContaining('/api/portfolio/bonds/bond-1'),
      method: 'DELETE',
    });
  });

  it('keeps the bond and shows an inline error when deletion fails', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const { method } = requestDetails(input, init);
      return method === 'DELETE'
        ? jsonResponse({ code: 'internal_error', message: 'Internal server error' }, 500)
        : jsonResponse({ items: [activeBond] });
    }));
    renderPortfolio();
    const card = await screen.findByRole('article', { name: 'ОФЗ 26238' });

    await user.click(within(card).getByRole('button', { name: 'Действия с облигацией ОФЗ 26238' }));
    await user.click(screen.getByRole('button', { name: 'Удалить из портфеля' }));
    const confirmation = screen.getByRole('dialog', { name: 'Удалить облигацию' });
    await user.click(within(confirmation).getByRole('button', { name: 'Удалить' }));

    expect(await within(confirmation).findByRole('alert')).toHaveTextContent('Не удалось удалить облигацию из портфеля. Попробуйте ещё раз.');
    expect(card).toBeInTheDocument();
  });

  it('labels and traps focus in the modal, locks scroll, closes on Escape and restores focus', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [] })));
    renderPortfolio();
    await screen.findByText('Портфель пока пуст');
    const trigger = screen.getAllByRole('button', { name: 'Добавить облигацию' })[0];
    if (!trigger) throw new Error('Create trigger is missing');

    await user.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Добавить облигацию' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(document.body.style.overflow).toBe('hidden');
    expect(screen.getByRole('button', { name: 'Закрыть окно' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('combobox', { name: 'Название или тикер' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(trigger).toHaveFocus();
  });

  it('shows only ticker search before a bond is selected', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [] })));
    renderPortfolio();
    const dialog = await openCreateForm(user);

    expect(within(dialog).getByRole('combobox', { name: 'Название или тикер' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('region', { name: 'Выбранная облигация' })).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Первая покупка')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Сумма покупки (с учётом НКД и комиссий)')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Сохранить' })).not.toBeInTheDocument();
  });

  it('does not validate an empty numeric field when the purchase form only focuses it', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [activeBond] })));
    renderPortfolio();
    const card = await screen.findByRole('article', { name: activeBond.name });
    const { dialog } = await openPurchaseForm(user, card);
    const amount = within(dialog).getByLabelText('Сумма покупки (с учётом НКД и комиссий)');

    await user.click(amount);

    expect(amount).toHaveFocus();
    expect(amount).not.toHaveAttribute('aria-invalid');
    expect(within(dialog).queryByText('Введите сумму покупки')).not.toBeInTheDocument();
  });

  it('uses the earliest purchase rather than a sale as the additional-purchase date boundary', async () => {
    const user = userEvent.setup();
    const bondWithEarlierSale = {
      ...activeBond,
      operations: [
        ...activeBond.operations,
        { id: 'sale-earlier', operation_type: 'sale', amount: '1000.00', quantity: 1, operation_date: '2026-08-07', realized_result: '0.00' },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [bondWithEarlierSale] })));
    renderPortfolio();
    const card = await screen.findByRole('article', { name: activeBond.name });
    const { dialog } = await openPurchaseForm(user, card);
    const purchaseDate = within(dialog).getByLabelText('Дата покупки');

    expect(purchaseDate).toHaveAttribute('min', '2026-08-08');
    fireEvent.change(purchaseDate, { target: { value: '2026-08-07' } });
    expect(await within(dialog).findByText('Дата покупки должна быть не раньше первой покупки')).toBeInTheDocument();
  });

  it('falls back to placement for the additional-purchase date boundary without purchases', async () => {
    const user = userEvent.setup();
    const bondWithoutPurchases = {
      ...activeBond,
      operations: [
        { id: 'sale-only', operation_type: 'sale', amount: '1000.00', quantity: 1, operation_date: '2026-08-07', realized_result: '0.00' },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [bondWithoutPurchases] })));
    renderPortfolio();
    const card = await screen.findByRole('article', { name: activeBond.name });
    const { dialog } = await openPurchaseForm(user, card);

    expect(within(dialog).getByLabelText('Дата покупки')).toHaveAttribute('min', activeBond.placement_date);
  });

  it('renders API bond data as a formatted read-only preview before purchase fields', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const { url } = requestDetails(input, init);
      if (url.includes('t-invest-search')) return Promise.resolve(jsonResponse(searchResponse()));
      if (url.includes('t-invest-lookup')) return Promise.resolve(jsonResponse({ item: lookupItem }));
      if (url.includes('name-availability')) return Promise.resolve(jsonResponse({ available: true }));
      return Promise.resolve(jsonResponse({ items: [] }));
    }));
    renderPortfolio();
    const dialog = await openCreateForm(user);
    await selectLookupBond(user);

    const preview = within(dialog).getByRole('region', { name: 'Выбранная облигация' });
    expect(preview).toHaveTextContent('ОФЗ 26238');
    expect(preview).toHaveTextContent('SU26238');
    expect(preview).toHaveTextContent('1 000,00 ₽');
    expect(preview).toHaveTextContent(/Выплат в год.*2/);
    expect(preview).toHaveTextContent(/Дата размещения.*15 мая 2025 г\./);
    expect(preview).toHaveTextContent(/Дата погашения.*15 мая 2041 г\./);
    expect(within(dialog).queryByLabelText('Название')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Номинал облигации')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Количество выплат в год')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Дата размещения')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Дата погашения')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Первая покупка')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Сумма покупки (с учётом НКД и комиссий)')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  });

  it('shows no provider or non-error availability status in the selected-bond preview', async () => {
    let resolveAvailability!: (response: Response) => void;
    const availability = new Promise<Response>((resolve) => { resolveAvailability = resolve; });
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const { url } = requestDetails(input, init);
      if (url.includes('t-invest-search')) return Promise.resolve(jsonResponse(searchResponse()));
      if (url.includes('t-invest-lookup')) return Promise.resolve(jsonResponse({ item: lookupItem }));
      if (url.includes('name-availability')) return availability;
      return Promise.resolve(jsonResponse({ items: [] }));
    }));
    renderPortfolio();
    const user = userEvent.setup();
    await openCreateForm(user);
    await selectLookupBond(user);

    const preview = await screen.findByRole('region', { name: 'Выбранная облигация' });
    expect(within(preview).queryByText(/Облигация T/)).not.toBeInTheDocument();
    expect(within(preview).queryByText('Проверяем наличие в портфеле…')).not.toBeInTheDocument();

    await act(async () => { resolveAvailability(jsonResponse({ available: true })); });
    await waitFor(() => expect(within(preview).queryByText('Можно добавить в портфель')).not.toBeInTheDocument());
  });

  it('does not validate an empty numeric field when the selected-bond purchase only focuses it', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const { url } = requestDetails(input, init);
      if (url.includes('t-invest-search')) return Promise.resolve(jsonResponse(searchResponse()));
      if (url.includes('t-invest-lookup')) return Promise.resolve(jsonResponse({ item: lookupItem }));
      if (url.includes('name-availability')) return Promise.resolve(jsonResponse({ available: true }));
      return Promise.resolve(jsonResponse({ items: [] }));
    }));
    renderPortfolio();
    const dialog = await openCreateForm(user);
    await selectLookupBond(user);
    const amount = within(dialog).getByLabelText('Сумма покупки (с учётом НКД и комиссий)');

    await user.click(amount);

    expect(amount).toHaveFocus();
    expect(amount).not.toHaveAttribute('aria-invalid');
    expect(within(dialog).queryByText('Введите сумму покупки')).not.toBeInTheDocument();
  });

  it('validates first-purchase dates against the selected API bond dates', async () => {
    const user = userEvent.setup();
    const maturityBoundaryLookup = { ...lookupItem, maturity_date: todayInput() };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const { url } = requestDetails(input, init);
      if (url.includes('t-invest-search')) return jsonResponse(searchResponse(maturityBoundaryLookup));
      if (url.includes('t-invest-lookup')) return jsonResponse({ item: maturityBoundaryLookup });
      if (url.includes('name-availability')) return jsonResponse({ available: true });
      return jsonResponse({ items: [] });
    }));
    renderPortfolio();
    const dialog = await openCreateForm(user);
    await selectLookupBond(user);
    const purchaseDate = within(dialog).getByLabelText('Дата покупки');

    expect(purchaseDate).toHaveAttribute('min', lookupItem.placement_date);
    expect(purchaseDate).toHaveAttribute('max', todayInput());
    fireEvent.change(purchaseDate, { target: { value: '2025-05-14' } });
    expect(await within(dialog).findByText('Дата покупки должна быть не раньше размещения')).toBeInTheDocument();
    fireEvent.change(purchaseDate, { target: { value: maturityBoundaryLookup.maturity_date } });
    expect(await within(dialog).findByText('Дата покупки должна быть раньше погашения')).toBeInTheDocument();
  });

  it('uses calculator-style numeric editing and money limits for the first purchase', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const { url } = requestDetails(input, init);
      if (url.includes('t-invest-search')) return jsonResponse(searchResponse());
      if (url.includes('t-invest-lookup')) return jsonResponse({ item: lookupItem });
      if (url.includes('name-availability')) return jsonResponse({ available: true });
      return jsonResponse({ items: [] });
    }));
    renderPortfolio();
    const dialog = await openCreateForm(user);
    await selectLookupBond(user);
    const amountInput = within(dialog).getByLabelText('Сумма покупки (с учётом НКД и комиссий)');
    const quantityInput = within(dialog).getByLabelText('Количество');

    await user.type(amountInput, '9999999999999999,99');
    expect(amountInput).not.toHaveAttribute('aria-invalid');
    await user.clear(amountInput);
    await user.type(amountInput, '10000000000000000,00');
    expect(amountInput).toHaveAccessibleDescription('Не более 16 цифр до запятой');
    await user.clear(amountInput);
    await user.type(amountInput, '+1.00');
    expect(amountInput).toHaveValue('1.00');
    expect(amountInput).not.toHaveAttribute('aria-invalid');
    await user.type(quantityInput, '2000');
    await user.tab();
    expect(quantityInput).toHaveValue(new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(2000));
  });

  it('opens the ticker lookup during debounce and hides an obsolete lookup response', async () => {
    let resolveFirst!: (response: Response) => void;
    let resolveSecond!: (response: Response) => void;
    const first = new Promise<Response>((resolve) => { resolveFirst = resolve; });
    const second = new Promise<Response>((resolve) => { resolveSecond = resolve; });
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const { url } = requestDetails(input, init);
      if (url.includes('t-invest-search?query=su2')) return second;
      if (url.includes('t-invest-search?query=su')) return first;
      return Promise.resolve(jsonResponse({ items: [] }));
    }));
    renderPortfolio();
    const user = userEvent.setup();
    await openCreateForm(user);
    const ticker = screen.getByRole('combobox', { name: 'Название или тикер' });

    fireEvent.change(ticker, { target: { value: 'su' } });
    expect(screen.getByRole('listbox', { name: 'Результаты поиска облигаций' })).toBeInTheDocument();
    expect(screen.getByText('Ищем облигации…')).toBeInTheDocument();
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 370)); });

    fireEvent.change(ticker, { target: { value: 'su2' } });
    expect(screen.getByText('Ищем облигации…')).toBeInTheDocument();
    await act(async () => { resolveFirst(jsonResponse(searchResponse())); });
    expect(screen.queryByRole('option', { name: /SU26238.*ОФЗ 26238/ })).not.toBeInTheDocument();
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 370)); });
    await act(async () => { resolveSecond(jsonResponse({ items: [] })); });
    expect(await screen.findByText('Облигации не найдены')).toBeInTheDocument();
  });

  it('searches multiple bonds by name and loads the selected bond details by UID', async () => {
    let resolveLookup!: (response: Response) => void;
    const lookup = new Promise<Response>((resolve) => { resolveLookup = resolve; });
    const secondLookupItem = {
      ...lookupItem,
      ticker: 'SU26240',
      instrument_uid: 'instrument-2',
      name: 'ОФЗ 26240',
    };
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const { url } = requestDetails(input, init);
      if (url.includes('t-invest-search')) return Promise.resolve(jsonResponse({ items: [
        { ticker: 'SU26238', instrument_uid: 'instrument-1', name: 'ОФЗ 26238' },
        { ticker: 'SU26240', instrument_uid: 'instrument-2', name: 'ОФЗ 26240' },
      ] }));
      if (url.includes('t-invest-lookup?instrument_uid=instrument-2')) return lookup;
      if (url.includes('name-availability')) return Promise.resolve(jsonResponse({ available: true }));
      return Promise.resolve(jsonResponse({ items: [] }));
    }));
    renderPortfolio();
    const user = userEvent.setup();
    await openCreateForm(user);
    const search = screen.getByRole('combobox', { name: 'Название или тикер' });

    await user.type(search, 'офз');
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(2);
    await user.click(screen.getByRole('option', { name: /SU26240.*ОФЗ 26240/ }));
    expect(screen.getByText('Загружаем данные облигации…')).toBeInTheDocument();
    await act(async () => { resolveLookup(jsonResponse({ item: secondLookupItem })); });

    expect(await screen.findByRole('region', { name: 'Выбранная облигация' })).toHaveTextContent('ОФЗ 26240');
    expect(search).toHaveValue('SU26240');
  });

  it('shows at most five results and selects the last visible option with ArrowUp', async () => {
    const items = Array.from({ length: 12 }, (_, index) => ({
      ticker: `SU${index}`,
      instrument_uid: `instrument-${index}`,
      name: `ОФЗ ${index}`,
    }));
    const selected = { ...lookupItem, ticker: 'SU4', instrument_uid: 'instrument-4', name: 'ОФЗ 4' };
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const { url } = requestDetails(input, init);
      if (url.includes('t-invest-search')) return Promise.resolve(jsonResponse({ items }));
      if (url.includes('t-invest-lookup?instrument_uid=instrument-4')) {
        return Promise.resolve(jsonResponse({ item: selected }));
      }
      if (url.includes('name-availability')) return Promise.resolve(jsonResponse({ available: true }));
      return Promise.resolve(jsonResponse({ items: [] }));
    }));
    renderPortfolio();
    const user = userEvent.setup();
    await openCreateForm(user);
    const search = screen.getByRole('combobox', { name: 'Название или тикер' });

    await user.type(search, 'офз');
    expect(await screen.findAllByRole('option')).toHaveLength(5);
    await user.keyboard('{ArrowUp}{Enter}');

    expect(await screen.findByRole('region', { name: 'Выбранная облигация' })).toHaveTextContent('ОФЗ 4');
  });

  it.each([
    ['t_invest_bond_matured', 'Облигация уже погашена и не может быть добавлена.'],
    ['t_invest_bond_not_placed', 'Облигация ещё не размещена и не может быть добавлена.'],
  ])('shows a localized non-retryable lookup error for %s', async (code, message) => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const { url } = requestDetails(input, init);
      if (url.includes('t-invest-search')) return Promise.resolve(jsonResponse(searchResponse()));
      if (url.includes('t-invest-lookup')) {
        return Promise.resolve(jsonResponse({ code, message: 'SDK domain error' }, 422));
      }
      return Promise.resolve(jsonResponse({ items: [] }));
    }));
    renderPortfolio();
    const user = userEvent.setup();
    await openCreateForm(user);
    await selectLookupBond(user);

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Повторить загрузку' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Выбранная облигация' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Сумма покупки (с учётом НКД и комиссий)')).not.toBeInTheDocument();
  });

  it('retries a temporary selected-bond lookup failure', async () => {
    let lookupAttempts = 0;
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const { url } = requestDetails(input, init);
      if (url.includes('t-invest-search')) return Promise.resolve(jsonResponse(searchResponse()));
      if (url.includes('t-invest-lookup')) {
        lookupAttempts += 1;
        return Promise.resolve(lookupAttempts === 1
          ? jsonResponse({ code: 't_invest_unavailable', message: 'offline' }, 503)
          : jsonResponse({ item: lookupItem }));
      }
      if (url.includes('name-availability')) return Promise.resolve(jsonResponse({ available: true }));
      return Promise.resolve(jsonResponse({ items: [] }));
    }));
    renderPortfolio();
    const user = userEvent.setup();
    await openCreateForm(user);
    await selectLookupBond(user);

    expect(await screen.findByText('Не удалось загрузить данные облигации.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Повторить загрузку' }));

    expect(await screen.findByRole('region', { name: 'Выбранная облигация' })).toHaveTextContent('ОФЗ 26238');
    expect(lookupAttempts).toBe(2);
  });

  it('selects the active ticker option from the combobox keyboard', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const { url } = requestDetails(input, init);
      if (url.includes('t-invest-search')) return Promise.resolve(jsonResponse(searchResponse()));
      if (url.includes('t-invest-lookup')) return Promise.resolve(jsonResponse({ item: lookupItem }));
      if (url.includes('name-availability')) return Promise.resolve(jsonResponse({ available: true }));
      return Promise.resolve(jsonResponse({ items: [] }));
    }));
    renderPortfolio();
    const user = userEvent.setup();
    await openCreateForm(user);
    const ticker = screen.getByRole('combobox', { name: 'Название или тикер' });

    await user.type(ticker, 'su26238');
    const option = await screen.findByRole('option', { name: /SU26238.*ОФЗ 26238/ });
    await user.keyboard('{ArrowDown}');
    expect(option).toHaveAttribute('tabindex', '-1');
    expect(ticker).toHaveAttribute('aria-activedescendant', option.id);
    await user.keyboard('{Enter}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Выбранная облигация' })).toHaveTextContent('SU26238');
    expect(screen.getByRole('region', { name: 'Выбранная облигация' })).toHaveTextContent('ОФЗ 26238');
    expect(screen.getByLabelText('Сумма покупки (с учётом НКД и комиссий)')).toBeInTheDocument();
  });

  it('invalidates the selected instrument and resets purchase fields when the ticker changes', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const { url } = requestDetails(input, init);
      if (url.includes('t-invest-search')) return Promise.resolve(jsonResponse(searchResponse()));
      if (url.includes('t-invest-lookup')) return Promise.resolve(jsonResponse({ item: lookupItem }));
      if (url.includes('name-availability')) return Promise.resolve(jsonResponse({ available: true }));
      return Promise.resolve(jsonResponse({ items: [] }));
    }));
    renderPortfolio();
    const user = userEvent.setup();
    await openCreateForm(user);
    const ticker = screen.getByRole('combobox', { name: 'Название или тикер' });

    await user.type(ticker, 'su26238');
    await user.click(await screen.findByRole('option', { name: /SU26238.*ОФЗ 26238/ }));
    await user.type(screen.getByLabelText('Сумма покупки (с учётом НКД и комиссий)'), '9500,70');
    await user.type(screen.getByLabelText('Количество'), '10');
    fireEvent.change(ticker, { target: { value: 'su26238' } });

    expect(screen.queryByRole('region', { name: 'Выбранная облигация' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Сумма покупки (с учётом НКД и комиссий)')).not.toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: 'Результаты поиска облигаций' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Сохранить' })).not.toBeInTheDocument();

    await user.click(await screen.findByRole('option', { name: /SU26238.*ОФЗ 26238/ }));
    expect(screen.getByLabelText('Сумма покупки (с учётом НКД и комиссий)')).toHaveValue('');
    expect(screen.getByLabelText('Количество')).toHaveValue('');
    expect(screen.getByLabelText('Дата покупки')).toHaveValue(todayInput());
  });

  it('keeps a duplicate selected bond visible and blocks saving', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const { url } = requestDetails(input, init);
      if (url.includes('t-invest-search')) return Promise.resolve(jsonResponse(searchResponse()));
      if (url.includes('t-invest-lookup')) return Promise.resolve(jsonResponse({ item: lookupItem }));
      if (url.includes('name-availability')) return Promise.resolve(jsonResponse({ available: false }));
      return Promise.resolve(jsonResponse({ items: [] }));
    }));
    renderPortfolio();
    const user = userEvent.setup();
    await openCreateForm(user);
    await selectLookupBond(user);

    const preview = screen.getByRole('region', { name: 'Выбранная облигация' });
    expect(await within(preview).findByText('Облигация с таким названием уже есть')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  });

  it('shows an availability error in the preview and retries it', async () => {
    let availabilityAttempts = 0;
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const { url } = requestDetails(input, init);
      if (url.includes('t-invest-search')) return Promise.resolve(jsonResponse(searchResponse()));
      if (url.includes('t-invest-lookup')) return Promise.resolve(jsonResponse({ item: lookupItem }));
      if (url.includes('name-availability')) {
        availabilityAttempts += 1;
        return Promise.resolve(availabilityAttempts === 1
          ? jsonResponse({ code: 'request_failed', message: 'Сервер недоступен' }, 500)
          : jsonResponse({ available: true }));
      }
      return Promise.resolve(jsonResponse({ items: [] }));
    }));
    renderPortfolio();
    const user = userEvent.setup();
    await openCreateForm(user);
    await selectLookupBond(user);

    const preview = screen.getByRole('region', { name: 'Выбранная облигация' });
    expect(await within(preview).findByText('Не удалось проверить облигацию.')).toBeInTheDocument();
    await user.click(within(preview).getByRole('button', { name: 'Повторить проверку' }));
    await waitFor(() => expect(within(preview).queryByText('Не удалось проверить облигацию.')).not.toBeInTheDocument());
    expect(within(preview).queryByText('Можно добавить в портфель')).not.toBeInTheDocument();
  });

  it('maps a bond_name_taken response to the selected-bond preview', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const { url, method } = requestDetails(input, init);
      if (url.includes('t-invest-search')) return jsonResponse(searchResponse());
      if (url.includes('t-invest-lookup')) return jsonResponse({ item: lookupItem });
      if (url.includes('name-availability')) return jsonResponse({ available: true });
      if (method === 'POST') return jsonResponse({
        code: 'bond_name_taken', message: 'Название уже занято',
        field_errors: { name: 'Облигация с таким названием уже существует' },
      }, 409);
      return jsonResponse({ items: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderPortfolio();
    await openCreateForm(user);
    await fillCreateForm(user);

    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    const preview = screen.getByRole('region', { name: 'Выбранная облигация' });
    expect(await within(preview).findByText('Облигация с таким названием уже существует')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('maps a purchase date backend error to its field', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const { url, method } = requestDetails(input, init);
      if (url.includes('t-invest-search')) return jsonResponse(searchResponse());
      if (url.includes('t-invest-lookup')) return jsonResponse({ item: lookupItem });
      if (url.includes('name-availability')) return jsonResponse({ available: true });
      if (method === 'POST') return jsonResponse({
        code: 'validation_error', message: 'Некорректные данные',
        field_errors: { purchase_date: 'Дата покупки раньше первой' },
      }, 422);
      return jsonResponse({ items: [] });
    }));
    renderPortfolio();
    await openCreateForm(user);
    await fillCreateForm(user);

    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByText('Дата покупки раньше первой')).toBeInTheDocument();
    expect(document.querySelector<HTMLInputElement>('input[name="purchaseDate"]')).toHaveAttribute('aria-invalid', 'true');
  });

  it('preserves the selected bond and purchase after a coupon-schedule failure', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const { url, method } = requestDetails(input, init);
      if (url.includes('t-invest-search')) return jsonResponse(searchResponse());
      if (url.includes('t-invest-lookup')) return jsonResponse({ item: lookupItem });
      if (url.includes('name-availability')) return jsonResponse({ available: true });
      if (method === 'POST') return jsonResponse({
        code: 't_invest_unavailable', message: 'Не удалось получить расписание выплат',
      }, 503);
      return jsonResponse({ items: [] });
    }));
    renderPortfolio();
    await openCreateForm(user);
    await fillCreateForm(user);

    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByText('Не удалось получить расписание выплат')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Выбранная облигация' })).toHaveTextContent('ОФЗ 26238');
    expect(screen.getByLabelText('Сумма покупки (с учётом НКД и комиссий)')).toHaveValue(
      new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(75000.7),
    );
    expect(screen.getByLabelText('Количество')).toHaveValue('75');
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeEnabled();
  });

  it('keeps the created card visible while refetching the portfolio market values', async () => {
    const user = userEvent.setup();
    const exactLookupItem = { ...lookupItem, name: 'ОФЗ 26238 ' };
    let createBody: unknown;
    let portfolioListRequests = 0;
    let created = false;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const { url, method } = requestDetails(input, init);
      if (url.includes('t-invest-search')) return jsonResponse(searchResponse(exactLookupItem));
      if (url.includes('t-invest-lookup')) return jsonResponse({ item: exactLookupItem });
      if (url.includes('name-availability')) return jsonResponse({ available: true });
      if (method === 'POST') {
        createBody = await requestJson(input, init);
        created = true;
        return jsonResponse({ ...activeBond, market_value_without_aci: '1.00' }, 201);
      }
      if (url.includes('portfolio/bonds')) portfolioListRequests += 1;
      return jsonResponse({ items: created ? [activeBond] : [] });
    }));
    renderPortfolio();
    await openCreateForm(user);
    await fillCreateForm(user);

    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByRole('article', { name: 'ОФЗ 26238' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(portfolioListRequests).toBe(2));
    expect(screen.getByRole('article', { name: 'ОФЗ 26238' })).toHaveTextContent(/74.250,00.₽/);
    expect(createBody).toEqual({
      instrument_uid: 'instrument-1',
      ticker: 'SU26238',
      name: 'ОФЗ 26238 ',
      nominal: '1000.00',
      payments_per_year: 2,
      placement_date: '2025-05-15',
      maturity_date: '2041-05-15',
      amount_spent: '75000.70',
      quantity: 75,
      purchase_date: todayInput(),
    });
  });

  it('keeps the successful mutation card visible when its market-data refetch fails', async () => {
    const user = userEvent.setup();
    let portfolioListRequests = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const { url, method } = requestDetails(input, init);
      if (url.includes('t-invest-search')) return jsonResponse(searchResponse());
      if (url.includes('t-invest-lookup')) return jsonResponse({ item: lookupItem });
      if (url.includes('name-availability')) return jsonResponse({ available: true });
      if (method === 'POST') return jsonResponse(activeBond, 201);
      if (url.includes('portfolio/bonds')) {
        portfolioListRequests += 1;
        return portfolioListRequests === 1
          ? jsonResponse({ items: [] })
          : jsonResponse({ code: 'request_failed', message: 'Рыночные данные временно недоступны' }, 503);
      }
      return jsonResponse({ items: [] });
    }));
    renderPortfolio();
    await openCreateForm(user);
    await fillCreateForm(user);

    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(portfolioListRequests).toBe(2));
    expect(screen.getByRole('article', { name: 'ОФЗ 26238' })).toBeInTheDocument();
    expect(screen.queryByText('Не удалось загрузить портфель')).not.toBeInTheDocument();
  });

  it('updates the matching card from the refetched add-purchase portfolio', async () => {
    const user = userEvent.setup();
    const updatedBond = {
      ...activeBond,
      total_quantity: 77,
      total_spent: '76000.75',
      position_cost_basis: '76000.75',
    };
    let purchased = false;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const { method } = requestDetails(input, init);
      if (method === 'POST') {
        purchased = true;
        return jsonResponse(updatedBond, 201);
      }
      return jsonResponse({ items: [purchased ? updatedBond : activeBond] });
    }));
    renderPortfolio();
    const card = await screen.findByRole('article', { name: 'ОФЗ 26238' });
    const { dialog } = await openPurchaseForm(user, card);
    await user.type(within(dialog).getByLabelText('Сумма покупки (с учётом НКД и комиссий)'), '1000,05');
    await user.type(within(dialog).getByLabelText('Количество'), '2');
    expect(within(dialog).getByLabelText('Дата покупки')).toHaveValue(todayInput());
    await user.click(within(dialog).getByRole('button', { name: 'Зафиксировать' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(screen.getByRole('article', { name: 'ОФЗ 26238' })).getByText('77 шт.')).toBeInTheDocument();
  });

  it('limits a sale to the quantity available on its date and updates the card from the sale response', async () => {
    const user = userEvent.setup();
    const soldBond = {
      ...activeBond,
      total_quantity: 50,
      position_cost_basis: '50000.47',
      realized_result: '999.65',
      operations: [
        { id: 'sale-1', operation_type: 'sale', amount: '26000.00', quantity: 25, operation_date: todayInput(), realized_result: '999.65' },
        ...activeBond.operations,
      ],
    };
    let requestBody: unknown;
    let sold = false;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const { method } = requestDetails(input, init);
      if (method === 'POST') {
        requestBody = await requestJson(input, init);
        sold = true;
        return jsonResponse(soldBond, 201);
      }
      return jsonResponse({ items: [sold ? soldBond : activeBond] });
    }));
    renderPortfolio();
    const card = await screen.findByRole('article', { name: 'ОФЗ 26238' });
    const dialog = await openSaleForm(user, card);
    const quantity = within(dialog).getByLabelText('Количество');

    expect(within(dialog).getByText('Доступно на выбранную дату: 75 шт.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Сумма продажи (с учётом НКД и комиссий)'), '26000');
    await user.type(quantity, '76');
    expect(within(dialog).getByText('Доступно не более 75 шт.')).toBeInTheDocument();
    await user.clear(quantity);
    await user.type(quantity, '25');
    await user.click(within(dialog).getByRole('button', { name: 'Зафиксировать' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(requestBody).toEqual({ amount_received: '26000.00', quantity: 25, sale_date: todayInput() });
    expect(screen.getByRole('article', { name: 'ОФЗ 26238' })).toHaveTextContent('50 шт.');
  });

  it('revalidates quantity when the selected sale date reduces the available position', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [activeBond] })));
    renderPortfolio();
    const card = await screen.findByRole('article', { name: 'ОФЗ 26238' });
    const dialog = await openSaleForm(user, card);

    await user.type(within(dialog).getByLabelText('Сумма продажи (с учётом НКД и комиссий)'), '60000');
    await user.type(within(dialog).getByLabelText('Количество'), '60');
    expect(within(dialog).getByRole('button', { name: 'Зафиксировать' })).toBeEnabled();

    fireEvent.change(within(dialog).getByLabelText('Дата продажи'), { target: { value: '2026-08-08' } });

    expect(await within(dialog).findByText('Доступно не более 50 шт.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Зафиксировать' })).toBeDisabled();
  });

  it('uses the day before maturity as the default and maximum sale date for a matured bond', async () => {
    const user = userEvent.setup();
    const historicalMaturedBond = {
      ...maturedBond,
      total_quantity: 10,
      position_cost_basis: '9500.00',
      position_status: 'open',
      placement_date: '2024-05-15',
      maturity_date: '2025-05-15',
      operations: [{
        id: 'purchase-historical', operation_type: 'purchase', amount: '9500.00', quantity: 10, operation_date: '2025-05-01', realized_result: null,
      }],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [historicalMaturedBond] })));
    renderPortfolio();
    const card = await screen.findByRole('article', { name: 'ОФЗ 25000' });
    await user.click(within(card).getByRole('button', { name: 'Действия с облигацией ОФЗ 25000' }));
    await user.click(screen.getByRole('button', { name: 'Зафиксировать продажу' }));

    const saleDate = within(screen.getByRole('dialog', { name: 'Зафиксировать продажу' })).getByLabelText('Дата продажи');
    expect(saleDate).toHaveValue('2025-05-14');
    expect(saleDate).toHaveAttribute('max', '2025-05-14');
  });

  it('shows the bond name only in purchase and sale modal subtitles', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [activeBond] })));
    renderPortfolio();
    const card = await screen.findByRole('article', { name: 'ОФЗ 26238' });

    const { dialog: purchaseDialog } = await openPurchaseForm(user, card);
    expect(within(purchaseDialog).getByText('ОФЗ 26238')).toBeInTheDocument();
    expect(within(purchaseDialog).queryByText(/Покупка для/)).not.toBeInTheDocument();
    await user.click(within(purchaseDialog).getByRole('button', { name: 'Закрыть окно' }));

    const saleDialog = await openSaleForm(user, card);
    expect(within(saleDialog).getByText('ОФЗ 26238')).toBeInTheDocument();
    expect(within(saleDialog).queryByText(/^Продажа /)).not.toBeInTheDocument();
  });

  it('localizes known sale field errors returned in English', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const { method } = requestDetails(input, init);
      return method === 'POST'
        ? jsonResponse({
          code: 'validation_error', message: 'Request validation failed',
          field_errors: { quantity: 'Sale quantity must not exceed the open position at the sale date' },
        }, 422)
        : jsonResponse({ items: [activeBond] });
    }));
    renderPortfolio();
    const dialog = await openSaleForm(user, await screen.findByRole('article', { name: 'ОФЗ 26238' }));
    await user.type(within(dialog).getByLabelText('Сумма продажи (с учётом НКД и комиссий)'), '1000');
    await user.type(within(dialog).getByLabelText('Количество'), '1');
    await user.click(within(dialog).getByRole('button', { name: 'Зафиксировать' }));

    expect(await within(dialog).findByText('Количество превышает доступный остаток на выбранную дату')).toBeInTheDocument();
    expect(within(dialog).queryByText(/Sale quantity/)).not.toBeInTheDocument();
  });

  it('shows a localized fallback when sale field errors contain only unknown fields', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const { method } = requestDetails(input, init);
      return method === 'POST'
        ? jsonResponse({
          code: 'validation_error', message: 'Request validation failed', field_errors: { ledger: 'Unknown ledger error' },
        }, 422)
        : jsonResponse({ items: [activeBond] });
    }));
    renderPortfolio();
    const dialog = await openSaleForm(user, await screen.findByRole('article', { name: 'ОФЗ 26238' }));
    await user.type(within(dialog).getByLabelText('Сумма продажи (с учётом НКД и комиссий)'), '1000');
    await user.type(within(dialog).getByLabelText('Количество'), '1');
    await user.click(within(dialog).getByRole('button', { name: 'Зафиксировать' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Не удалось проверить данные продажи. Проверьте поля и попробуйте снова.');
    expect(within(dialog).queryByText(/Unknown ledger error/)).not.toBeInTheDocument();
  });

  it('renders signed quantities, exact cost-basis help, and result tones without signing operation amounts', async () => {
    const user = userEvent.setup();
    const signedBond = {
      ...activeBond,
      realized_result: '-100.00',
      operations: [
        { id: 'sale-loss', operation_type: 'sale', amount: '900.00', quantity: 1, operation_date: '2026-08-10', realized_result: '-100.00' },
        { id: 'sale-zero', operation_type: 'sale', amount: '1000.00', quantity: 1, operation_date: '2026-08-09', realized_result: '0.00' },
        { id: 'sale-profit', operation_type: 'sale', amount: '1100.00', quantity: 1, operation_date: '2026-08-08', realized_result: '100.00' },
        { id: 'purchase-sign', operation_type: 'purchase', amount: '2000.00', quantity: 2, operation_date: '2026-08-07', realized_result: null },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [signedBond] })));
    renderPortfolio();
    const card = await screen.findByRole('article', { name: 'ОФЗ 26238' });
    await user.click(within(card).getByRole('button', { name: 'Открыть сведения об облигации ОФЗ 26238' }));
    const details = screen.getByRole('dialog', { name: 'ОФЗ 26238' });

    expect(within(details).getByText('Результат сделок').closest('div')).toHaveTextContent(/−100,00.₽/);
    expect(within(details).getByText('Вложено в оставшиеся облигации')).toBeInTheDocument();
    expect(within(details).getByText('Сколько из потраченных на покупки денег приходится на облигации, которые ещё остаются в портфеле. После продажи сумма уменьшается на среднюю стоимость проданных облигаций. Это не текущая рыночная цена.')).toBeInTheDocument();
    expect(within(details).getAllByText('−1 шт.')).toHaveLength(3);
    expect(within(details).getByText('+2 шт.')).toBeInTheDocument();
    expect(within(details).queryByText('Покупка')).not.toBeInTheDocument();
    expect(within(details).queryByText('Продажа')).not.toBeInTheDocument();
    expect(within(details).getByText(/900,00.₽/)).toBeInTheDocument();
    expect(within(details).queryByText(/\+900,00.₽/)).not.toBeInTheDocument();
    const operationRows = within(within(details).getByRole('region', { name: 'История операций' })).getAllByRole('listitem');
    const lossResult = within(operationRows[0]!).getByText(/−100,00.₽/);
    expect(lossResult).toHaveAttribute('data-result-sign', 'negative');
    expect(lossResult.parentElement).toHaveTextContent(/10 августа 2026 г\..*−100,00.₽/);
    expect(lossResult.parentElement).not.toHaveTextContent(/900,00.₽/);
    expect(operationRows[1]!.querySelector('[data-result-sign="zero"]')).toHaveTextContent(/0,00.₽/);
    expect(operationRows[2]!.querySelector('[data-result-sign="positive"]')).toHaveTextContent(/\+100,00.₽/);
    expect(within(details).queryByText(/Результат:/)).not.toBeInTheDocument();
  });

  it('shows the unified operations ledger with position metrics and removes the last operation after local confirmation', async () => {
    const user = userEvent.setup();
    const closedBond = {
      ...activeBond,
      total_quantity: 0,
      position_cost_basis: '0.00',
      realized_result: '999.65',
      position_status: 'closed',
      operations: [{
        id: 'sale-1', operation_type: 'sale', amount: '76000.35', quantity: 75, operation_date: '2026-08-10', realized_result: '999.65',
      }],
    };
    let operationDeleted = false;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const { method } = requestDetails(input, init);
      if (method === 'DELETE') {
        operationDeleted = true;
        return jsonResponse({ item: null });
      }
      return jsonResponse({ items: operationDeleted ? [] : [closedBond] });
    }));
    renderPortfolio();
    const card = await screen.findByRole('article', { name: 'ОФЗ 26238' });
    const addBond = screen.getByRole('button', { name: 'Добавить облигацию' });
    expect(within(card).queryByText('Позиция закрыта')).not.toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Открыть сведения об облигации ОФЗ 26238' }));
    const details = screen.getByRole('dialog', { name: 'ОФЗ 26238' });

    expect(within(details).getByText('История операций')).toBeInTheDocument();
    expect(within(details).getByText('−75 шт.')).toBeInTheDocument();
    expect(within(details).getByText('Результат сделок')).toBeInTheDocument();
    expect(within(details).getByText('Результат сделок').closest('div')).toHaveTextContent(/\+999,65.₽/);
    expect(within(details).getByRole('button', { name: 'Как рассчитывается результат сделок' })).toBeInTheDocument();
    await user.click(within(details).getByRole('button', { name: 'Удалить операцию продажи' }));

    const confirmation = screen.getByRole('dialog', { name: 'Удалить операцию' });
    expect(screen.getByRole('dialog', { name: 'ОФЗ 26238' })).toBe(details);
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    expect(within(confirmation).getByText('ОФЗ 26238')).toBeInTheDocument();
    await user.click(within(confirmation).getByRole('button', { name: 'Удалить' }));
    await waitFor(() => expect(screen.queryByRole('article', { name: 'ОФЗ 26238' })).not.toBeInTheDocument());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(addBond).toHaveFocus());
  });

  it('returns to operation details and restores the same delete control after cancel', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [activeBond] })));
    renderPortfolio();
    const card = await screen.findByRole('article', { name: 'ОФЗ 26238' });
    await user.click(within(card).getByRole('button', { name: 'Открыть сведения об облигации ОФЗ 26238' }));
    const details = screen.getByRole('dialog', { name: 'ОФЗ 26238' });
    const deleteSale = within(details).getAllByRole('button', { name: 'Удалить операцию покупки' })[0];
    if (!deleteSale) throw new Error('Delete operation button is missing');
    await user.click(deleteSale);
    expect(screen.getByRole('dialog', { name: 'ОФЗ 26238' })).toBe(details);
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    await user.click(within(screen.getByRole('dialog', { name: 'Удалить операцию' })).getByRole('button', { name: 'Отмена' }));

    const restoredDetails = screen.getByRole('dialog', { name: 'ОФЗ 26238' });
    const restoredDelete = within(restoredDetails).getAllByRole('button', { name: 'Удалить операцию покупки' })[0];
    await waitFor(() => expect(restoredDelete).toHaveFocus());
  });

  it('returns updated details and focuses a neighboring operation after a non-last deletion', async () => {
    const user = userEvent.setup();
    const updatedBond = {
      ...activeBond,
      total_quantity: 50,
      position_cost_basis: '50000.35',
      operations: [activeBond.operations[1]],
    };
    let operationDeleted = false;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const { method } = requestDetails(input, init);
      if (method === 'DELETE') {
        operationDeleted = true;
        return jsonResponse({ item: updatedBond });
      }
      return jsonResponse({ items: [operationDeleted ? updatedBond : activeBond] });
    }));
    renderPortfolio();
    const card = await screen.findByRole('article', { name: 'ОФЗ 26238' });
    await user.click(within(card).getByRole('button', { name: 'Открыть сведения об облигации ОФЗ 26238' }));
    const details = screen.getByRole('dialog', { name: 'ОФЗ 26238' });
    const deleteButtons = within(details).getAllByRole('button', { name: 'Удалить операцию покупки' });
    const firstDelete = deleteButtons[0];
    if (!firstDelete) throw new Error('Delete operation button is missing');
    await user.click(firstDelete);
    await user.click(within(screen.getByRole('dialog', { name: 'Удалить операцию' })).getByRole('button', { name: 'Удалить' }));

    const updatedDetails = await screen.findByRole('dialog', { name: 'ОФЗ 26238' });
    expect(within(updatedDetails).getByRole('region', { name: 'История операций' })).toHaveTextContent('1 операция');
    const neighboringDelete = within(updatedDetails).getByRole('button', { name: 'Удалить операцию покупки' });
    await waitFor(() => expect(neighboringDelete).toHaveFocus());
    expect(screen.getByRole('article', { name: 'ОФЗ 26238' })).toHaveTextContent('50 шт.');
  });
});
