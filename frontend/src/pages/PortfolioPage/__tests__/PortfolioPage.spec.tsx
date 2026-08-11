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

const activeBond = {
  id: 'bond-1', name: 'ОФЗ 26238', nominal: '1000.00', payments_per_year: 2,
  placement_date: '2025-05-15', maturity_date: '2041-05-15', status: 'active',
  total_quantity: 75, total_spent: '75000.70',
  paid_coupon_total: '1770.00', annual_coupon_yield_percent: '7.0800',
  maturity_remaining: { years: 14, months: 9, days_until: 5392 },
  next_coupon: {
    period_start: '2026-05-15', period_end: '2026-11-15', pay_date: '2026-11-16',
    amount: '2655.00', amount_per_bond: '35.40', days_until: 99, period_days: 184, elapsed_period_days: 86,
  },
  purchases: [
    { id: 'purchase-2', amount_spent: '25000.35', quantity: 25, purchase_date: '2026-08-09' },
    { id: 'purchase-1', amount_spent: '50000.35', quantity: 50, purchase_date: '2026-08-08' },
  ],
};

const maturedBond = {
  ...activeBond, id: 'bond-2', name: 'ОФЗ 25000', status: 'matured', maturity_date: '2025-05-15',
  maturity_remaining: { years: 0, months: 0, days_until: 0 }, next_coupon: null,
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
  annual_coupon_yield_percent: '0.0000',
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

async function fillCreateForm(user: ReturnType<typeof userEvent.setup>, name = 'ОФЗ 26238') {
  await user.type(screen.getByRole('combobox', { name: 'Тикер' }), 'su26238');
  await user.click(await screen.findByRole('option', { name: /SU26238.*ОФЗ 26238/ }));
  if (name !== lookupItem.name) {
    await user.clear(screen.getByLabelText('Название'));
    await user.type(screen.getByLabelText('Название'), name);
  }
  await user.type(screen.getByLabelText('Сумма покупки'), '75000,70');
  await user.type(screen.getByLabelText('Количество'), '75');
  expect(screen.getByLabelText('Дата покупки')).toHaveValue(todayInput());
  await screen.findByText('Имя свободно');
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

describe('PortfolioPage', () => {
  beforeEach(() => {
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

  it('renders compact active and matured rows with real coupon progress', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [activeBond, maturedBond] })));

    renderPortfolio();

    const activeCard = await screen.findByRole('article', { name: 'ОФЗ 26238' });
    const maturedCard = screen.getByRole('article', { name: 'ОФЗ 25000' });
    expect(activeCard).toHaveTextContent(/75.000,70.₽/);
    expect(within(activeCard).getByText('75 шт.')).toBeInTheDocument();
    expect(within(activeCard).getByText('7,08 % годовых')).toBeInTheDocument();
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
        .map((label) => label.textContent),
    ).toEqual(['Номинал', 'Выплат в год', 'Дата размещения', 'Дата погашения']);
    expect(within(dialog).queryByText('Купон')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Купонный период')).not.toBeInTheDocument();
    expect(
      Array.from(within(dialog).getByText('Вложенная сумма').closest('dl')!.querySelectorAll('dt'))
        .map((label) => label.textContent),
    ).toEqual([
      'Вложенная сумма',
      'Количество',
      'Годовая купонная доходность',
      'Выплачено купонов',
      'Срок до погашения',
    ]);
    const nextCoupon = within(dialog).getByRole('region', { name: 'Ближайший купон' });
    expect(nextCoupon).not.toHaveTextContent('Сумма ближайшей выплаты');
    expect(nextCoupon).not.toHaveTextContent('Цена одного купона');
    expect(nextCoupon).not.toHaveTextContent('Купонный период');
    expect(nextCoupon).toHaveTextContent(/2.655,00.₽.*•.*35,40.₽ шт\./);
    expect(nextCoupon).toHaveTextContent('16 ноября 2026 г.');
    const purchaseHistory = within(dialog).getByRole('region', { name: 'История покупок' });
    expect(purchaseHistory).toHaveTextContent('2 покупки');
    const purchases = within(purchaseHistory).getAllByRole('listitem');
    expect(purchases).toHaveLength(2);
    expect(purchases[0]).toHaveTextContent(/25.000,35.₽.*25 шт\..*9 августа 2026 г\./);
    expect(purchases[1]).toHaveTextContent(/50.000,35.₽.*50 шт\..*8 августа 2026 г\./);
    expect(within(dialog).getByText('Выплачено купонов').parentElement).toHaveTextContent(/1.770,00.₽/);
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
      Array.from(within(dialog).getByText('Вложенная сумма').closest('dl')!.querySelectorAll('dt'))
        .map((label) => label.textContent),
    ).toEqual([
      'Вложенная сумма',
      'Количество',
      'Годовая купонная доходность',
      'Выплачено купонов',
      'Срок до погашения',
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
    expect(within(dialog).getByText('После добавления покупки произойдет перерасчет процента годовых')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(dialog).not.toBeInTheDocument();
    expect(actions).toHaveFocus();
  });

  it('cancels bond deletion after the exact native confirmation', async () => {
    const user = userEvent.setup();
    const confirm = vi.fn().mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [activeBond] }));
    vi.stubGlobal('confirm', confirm);
    vi.stubGlobal('fetch', fetchMock);
    renderPortfolio();
    const card = await screen.findByRole('article', { name: 'ОФЗ 26238' });

    await user.click(within(card).getByRole('button', { name: 'Действия с облигацией ОФЗ 26238' }));
    expect(screen.getByRole('button', { name: 'Зафиксировать покупку' })).toBeInTheDocument();
    const deleteAction = screen.getByRole('button', { name: 'Удалить из портфеля' });
    await user.click(deleteAction);

    expect(confirm).toHaveBeenCalledWith(
      'Вы точно хотите удалить облигацию из портфеля? Это действие необратимо.',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(card).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('deletes a confirmed bond from the cache and shows the empty portfolio state', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    const requests: Array<{ url: string; method: string }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const details = requestDetails(input, init);
      requests.push(details);
      return details.method === 'DELETE'
        ? new Response(null, { status: 204 })
        : jsonResponse({ items: [activeBond] });
    }));
    renderPortfolio();
    const card = await screen.findByRole('article', { name: 'ОФЗ 26238' });

    await user.click(within(card).getByRole('button', { name: 'Действия с облигацией ОФЗ 26238' }));
    await user.click(screen.getByRole('button', { name: 'Удалить из портфеля' }));

    expect(await screen.findByText('Портфель пока пуст')).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'ОФЗ 26238' })).not.toBeInTheDocument();
    expect(requests).toContainEqual({
      url: expect.stringContaining('/api/portfolio/bonds/bond-1'),
      method: 'DELETE',
    });
  });

  it('keeps the bond and shows a native alert when deletion fails', async () => {
    const user = userEvent.setup();
    const alert = vi.fn();
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    vi.stubGlobal('alert', alert);
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

    await waitFor(() => expect(alert).toHaveBeenCalledWith(
      'Не удалось удалить облигацию из портфеля. Попробуйте ещё раз.',
    ));
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
    expect(screen.getByLabelText('Дата покупки')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(trigger).toHaveFocus();
  });

  it('does not validate an empty numeric field when the create form only focuses it', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [] })));
    renderPortfolio();
    const dialog = await openCreateForm(user);
    const amount = within(dialog).getByLabelText('Сумма покупки');

    await user.click(amount);

    expect(amount).toHaveFocus();
    expect(amount).not.toHaveAttribute('aria-invalid');
    expect(within(dialog).queryByText('Введите сумму покупки')).not.toBeInTheDocument();
  });

  it('does not validate an empty numeric field when the purchase form only focuses it', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [activeBond] })));
    renderPortfolio();
    const card = await screen.findByRole('article', { name: activeBond.name });
    const { dialog } = await openPurchaseForm(user, card);
    const amount = within(dialog).getByLabelText('Сумма покупки');

    await user.click(amount);

    expect(amount).toHaveFocus();
    expect(amount).not.toHaveAttribute('aria-invalid');
    expect(within(dialog).queryByText('Введите сумму покупки')).not.toBeInTheDocument();
  });

  it('validates backend money and date rules live before submission', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [] })));
    renderPortfolio();
    await openCreateForm(user);

    await user.type(screen.getByLabelText('Название'), '   ');
    await user.type(screen.getByLabelText('Количество выплат в год'), '1,5');
    expect(await screen.findByText('Введите целое неотрицательное число')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Номинал облигации'), '0');
    await user.type(screen.getByLabelText('Количество'), '1.5');

    expect(await screen.findByText('Введите название')).toBeInTheDocument();
    expect(screen.getByText('Номинал облигации должен быть больше нуля')).toBeInTheDocument();
    expect(screen.getByText('Введите целое количество больше нуля')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  });

  it('accepts zero as a whole-number payment frequency', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [] })));
    renderPortfolio();
    await openCreateForm(user);

    const payments = screen.getByLabelText('Количество выплат в год');
    await user.type(payments, '0');
    expect(payments).not.toHaveAttribute('aria-invalid');
  });

  it.each([
    ['1.5', 'дробное значение'],
  ])('blocks submit for %s (%s) payment frequency', async (value) => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [] })));
    renderPortfolio();
    await openCreateForm(user);
    const payments = screen.getByLabelText('Количество выплат в год');
    await user.type(payments, value);
    expect(payments).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  });

  it('keeps a fractional payment frequency invalid after the field loses focus', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [] })));
    renderPortfolio();
    await openCreateForm(user);
    const payments = screen.getByLabelText('Количество выплат в год');
    fireEvent.change(payments, { target: { value: '30.5' } });
    await user.tab();
    expect(payments).toHaveValue('30.5');
    expect(payments).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  });

  it('shows create fields in the requested order without the footer hint', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [] })));
    renderPortfolio();
    const dialog = await openCreateForm(user);
    const controls = [
      within(dialog).getByLabelText('Тикер'),
      within(dialog).getByLabelText('Название'),
      within(dialog).getByLabelText('Номинал облигации'),
      within(dialog).getByLabelText('Количество выплат в год'),
      within(dialog).getByLabelText('Дата размещения'),
      within(dialog).getByLabelText('Дата погашения'),
      within(dialog).getByLabelText('Сумма покупки'),
      within(dialog).getByLabelText('Количество'),
      within(dialog).getByLabelText('Дата покупки'),
    ];

    controls.slice(1).forEach((control, index) => {
      const previousControl = controls[index];
      if (!previousControl) throw new Error('Previous create-form control is missing');
      expect(previousControl.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    expect(within(dialog).queryByText('ПОРТФЕЛЬ')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Деньги и купоны хранятся с точностью до копейки.')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Сохранить' })).toBeInTheDocument();
  });

  it('validates purchase dates against the placement date in both forms', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [activeBond] })));
    renderPortfolio();

    await user.click(screen.getByRole('button', { name: 'Добавить облигацию' }));
    const createDialog = screen.getByRole('dialog', { name: 'Добавить облигацию' });
    fireEvent.change(within(createDialog).getByLabelText('Дата размещения'), {
      target: { value: '2025-05-15' },
    });
    fireEvent.change(within(createDialog).getByLabelText('Дата покупки'), {
      target: { value: '2025-05-14' },
    });
    expect(await within(createDialog).findByText(
      'Дата покупки должна быть не раньше размещения',
    )).toBeInTheDocument();

    await user.click(within(createDialog).getByRole('button', { name: 'Закрыть окно' }));
    const card = await screen.findByRole('article', { name: 'ОФЗ 26238' });
    const { dialog: purchaseDialog } = await openPurchaseForm(user, card);
    const purchaseDate = within(purchaseDialog).getByLabelText('Дата покупки');
    expect(purchaseDate).toHaveAttribute('min', activeBond.placement_date);
    fireEvent.change(purchaseDate, { target: { value: '2025-05-14' } });
    expect(await within(purchaseDialog).findByText(
      'Дата покупки должна быть не раньше размещения',
    )).toBeInTheDocument();
  });

  it('uses calculator-style numeric editing in create and purchase forms', async () => {
    const user = userEvent.setup();
    let purchaseBody: unknown;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const { url, method } = requestDetails(input, init);
      if (url.includes('t-invest-lookup')) return jsonResponse({ item: lookupItem });
      if (url.includes('name-availability')) return jsonResponse({ available: true });
      if (method === 'POST') {
        purchaseBody = await requestJson(input, init);
        return jsonResponse(activeBond, 201);
      }
      return jsonResponse({ items: [activeBond] });
    }));
    renderPortfolio();
    const card = await screen.findByRole('article', { name: 'ОФЗ 26238' });

    await user.click(screen.getByRole('button', { name: 'Добавить облигацию' }));
    const createDialog = screen.getByRole('dialog', { name: 'Добавить облигацию' });
    const nominal = within(createDialog).getByLabelText('Номинал облигации');
    const quantity = within(createDialog).getByLabelText('Количество');

    await user.type(nominal, '9500,45');
    await user.tab();
    expect(nominal).toHaveValue(new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(9500.45));
    await user.click(nominal);
    expect(nominal).toHaveValue('9500.45');

    await user.type(quantity, '2000');
    await user.tab();
    expect(quantity).toHaveValue(new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(2000));

    await user.click(within(createDialog).getByRole('button', { name: 'Закрыть окно' }));
    const { dialog: purchaseDialog } = await openPurchaseForm(user, card);
    const amountSpent = within(purchaseDialog).getByLabelText('Сумма покупки');

    await user.type(amountSpent, '12500,75');
    await user.tab();
    expect(amountSpent).toHaveValue(new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(12500.75));
    await user.click(amountSpent);
    expect(amountSpent).toHaveValue('12500.75');
    const purchaseQuantity = within(purchaseDialog).getByLabelText(/Количество/);
    await user.type(purchaseQuantity, '2000');
    await user.tab();
    expect(purchaseQuantity).toHaveValue(new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(2000));
    await user.click(within(purchaseDialog).getByRole('button', { name: 'Зафиксировать' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(purchaseBody).toMatchObject({ amount_spent: '12500.75', quantity: 2000 });
  });

  it('enforces the backend money boundary and blocks calculator-invalid characters in both forms', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [activeBond] })));
    renderPortfolio();
    const card = await screen.findByRole('article', { name: 'ОФЗ 26238' });

    const createTrigger = screen.getByRole('button', { name: 'Добавить облигацию' });
    await user.click(createTrigger);
    const createDialog = screen.getByRole('dialog', { name: 'Добавить облигацию' });
    const nominalInput = within(createDialog).getByLabelText('Номинал облигации');
    await user.type(nominalInput, '9999999999999999.99');
    expect(nominalInput).not.toHaveAttribute('aria-invalid');
    await user.clear(nominalInput);
    await user.type(nominalInput, '10000000000000000.00');
    expect(nominalInput).toHaveAccessibleDescription('Не более 16 цифр до запятой');

    await user.click(within(createDialog).getByRole('button', { name: 'Закрыть окно' }));
    const { dialog: purchaseDialog } = await openPurchaseForm(user, card);
    const amountInput = within(purchaseDialog).getByLabelText('Сумма покупки');

    await user.type(amountInput, '9999999999999999,99');
    expect(amountInput).not.toHaveAttribute('aria-invalid');
    await user.clear(amountInput);
    await user.type(amountInput, '10000000000000000,00');
    expect(amountInput).toHaveAccessibleDescription('Не более 16 цифр до запятой');
    await user.clear(amountInput);
    await user.type(amountInput, '+1.00');
    expect(amountInput).toHaveValue('1.00');
    expect(amountInput).not.toHaveAttribute('aria-invalid');
  });

  it('associates the payment-frequency error with its numeric input', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [] })));
    renderPortfolio();
    const dialog = await openCreateForm(user);
    const payments = within(dialog).getByLabelText('Количество выплат в год');
    await user.type(payments, '1.5');

    const error = await within(dialog).findByRole('alert', { name: '' });
    expect(error).toHaveTextContent('Введите целое неотрицательное число');
    expect(payments).toHaveAttribute('aria-describedby', error.id);
    expect(error.id).not.toBe('');
  });

  it('opens the ticker lookup during debounce and hides an obsolete lookup response', async () => {
    let resolveFirst!: (response: Response) => void;
    let resolveSecond!: (response: Response) => void;
    const first = new Promise<Response>((resolve) => { resolveFirst = resolve; });
    const second = new Promise<Response>((resolve) => { resolveSecond = resolve; });
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const { url } = requestDetails(input, init);
      if (url.includes('t-invest-lookup?ticker=SU2')) return second;
      if (url.includes('t-invest-lookup?ticker=SU')) return first;
      return Promise.resolve(jsonResponse({ items: [] }));
    }));
    renderPortfolio();
    const user = userEvent.setup();
    await openCreateForm(user);
    const ticker = screen.getByRole('combobox', { name: 'Тикер' });

    fireEvent.change(ticker, { target: { value: 'su' } });
    expect(screen.getByRole('listbox', { name: 'Результаты поиска тикера' })).toBeInTheDocument();
    expect(screen.getByText('Ищем облигацию…')).toBeInTheDocument();
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 370)); });

    fireEvent.change(ticker, { target: { value: 'su2' } });
    expect(screen.getByText('Ищем облигацию…')).toBeInTheDocument();
    await act(async () => { resolveFirst(jsonResponse({ item: lookupItem })); });
    expect(screen.queryByRole('option', { name: /SU26238.*ОФЗ 26238/ })).not.toBeInTheDocument();
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 370)); });
    await act(async () => { resolveSecond(jsonResponse({ item: null })); });
    expect(await screen.findByText('Облигация не найдена')).toBeInTheDocument();
  });

  it('selects the active ticker option from the combobox keyboard', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const { url } = requestDetails(input, init);
      if (url.includes('t-invest-lookup')) return Promise.resolve(jsonResponse({ item: lookupItem }));
      if (url.includes('name-availability')) return Promise.resolve(jsonResponse({ available: true }));
      return Promise.resolve(jsonResponse({ items: [] }));
    }));
    renderPortfolio();
    const user = userEvent.setup();
    await openCreateForm(user);
    const ticker = screen.getByRole('combobox', { name: 'Тикер' });

    await user.type(ticker, 'su26238');
    const option = await screen.findByRole('option', { name: /SU26238.*ОФЗ 26238/ });
    await user.keyboard('{ArrowDown}');
    expect(option).toHaveAttribute('tabindex', '-1');
    expect(ticker).toHaveAttribute('aria-activedescendant', option.id);
    await user.keyboard('{Enter}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByText('Выбрана:', { exact: false })).toHaveTextContent('SU26238 — ОФЗ 26238');
    expect(screen.getByLabelText('Название')).toHaveValue('ОФЗ 26238');
  });

  it('invalidates the selected instrument when the ticker changes', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const { url } = requestDetails(input, init);
      if (url.includes('t-invest-lookup')) return Promise.resolve(jsonResponse({ item: lookupItem }));
      if (url.includes('name-availability')) return Promise.resolve(jsonResponse({ available: true }));
      return Promise.resolve(jsonResponse({ items: [] }));
    }));
    renderPortfolio();
    const user = userEvent.setup();
    await openCreateForm(user);
    const ticker = screen.getByRole('combobox', { name: 'Тикер' });

    await user.type(ticker, 'su26238');
    await user.click(await screen.findByRole('option', { name: /SU26238.*ОФЗ 26238/ }));
    await user.clear(ticker);
    await user.type(ticker, 'su26239');

    expect(screen.queryByText(/Выбрана:.*SU26238/)).not.toBeInTheDocument();
    expect(screen.getByText('Ищем облигацию…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  });

  it('debounces name checks and ignores a stale duplicate response', async () => {
    let resolveFirst!: (response: Response) => void;
    let resolveSecond!: (response: Response) => void;
    const first = new Promise<Response>((resolve) => { resolveFirst = resolve; });
    const second = new Promise<Response>((resolve) => { resolveSecond = resolve; });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);
    vi.stubGlobal('fetch', fetchMock);
    renderPortfolio();
    await act(async () => { await Promise.resolve(); });
    const trigger = screen.getAllByRole('button', { name: 'Добавить облигацию' })[0];
    if (!trigger) throw new Error('Create trigger is missing');
    fireEvent.click(trigger);
    const input = screen.getByLabelText('Название');

    fireEvent.change(input, { target: { value: 'ОФЗ старая' } });
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 300)); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 70)); });
    expect(screen.getByText('Проверяем…')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'ОФЗ новая' } });
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 370)); });
    await act(async () => { resolveSecond(jsonResponse({ available: true })); });
    expect(await screen.findByText('Имя свободно')).toBeInTheDocument();
    await act(async () => { resolveFirst(jsonResponse({ available: false })); });
    expect(screen.getByText('Имя свободно')).toBeInTheDocument();
    expect(screen.queryByText('Облигация с таким названием уже есть')).not.toBeInTheDocument();
  });

  it('suppresses a stale availability error while the next name is checking', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(jsonResponse({ code: 'request_failed', message: 'Сервер недоступен' }, 500))
      .mockResolvedValueOnce(jsonResponse({ available: true }));
    vi.stubGlobal('fetch', fetchMock);
    renderPortfolio();
    await screen.findByText('Портфель пока пуст');
    fireEvent.click(screen.getAllByRole('button', { name: 'Добавить облигацию' })[0]!);
    const input = screen.getByLabelText('Название');

    fireEvent.change(input, { target: { value: 'ОФЗ первая' } });
    expect(await screen.findByText('Не удалось проверить имя.', {}, { timeout: 1_000 })).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'ОФЗ вторая' } });

    expect(screen.getByText('Проверяем…')).toBeInTheDocument();
    expect(screen.queryByText('Не удалось проверить имя.')).not.toBeInTheDocument();
  });

  it('renders cached availability and its refetch states mutually exclusively', async () => {
    let rejectAvailableRefetch!: (response: Response) => void;
    let resolveDuplicateRefetch!: (response: Response) => void;
    const availableRefetch = new Promise<Response>((resolve) => { rejectAvailableRefetch = resolve; });
    const duplicateRefetch = new Promise<Response>((resolve) => { resolveDuplicateRefetch = resolve; });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(jsonResponse({ available: true }))
      .mockResolvedValueOnce(jsonResponse({ available: false }))
      .mockReturnValueOnce(availableRefetch)
      .mockReturnValueOnce(duplicateRefetch);
    vi.stubGlobal('fetch', fetchMock);
    renderPortfolio();
    await screen.findByText('Портфель пока пуст');
    fireEvent.click(screen.getAllByRole('button', { name: 'Добавить облигацию' })[0]!);
    const input = screen.getByLabelText('Название');

    fireEvent.change(input, { target: { value: 'ОФЗ свободная' } });
    expect(await screen.findByText('Имя свободно', {}, { timeout: 1_000 })).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'ОФЗ занятая' } });
    expect(await screen.findByText('Облигация с таким названием уже есть', {}, { timeout: 1_000 })).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'ОФЗ свободная' } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4), { timeout: 1_000 });
    expect(screen.getByText('Проверяем…')).toBeInTheDocument();
    expect(screen.queryByText('Имя свободно')).not.toBeInTheDocument();
    await act(async () => {
      rejectAvailableRefetch(jsonResponse({ code: 'request_failed', message: 'Сервер недоступен' }, 500));
    });
    expect(await screen.findByText('Не удалось проверить имя.')).toBeInTheDocument();
    expect(screen.queryByText('Имя свободно')).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'ОФЗ занятая' } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5), { timeout: 1_000 });
    expect(screen.getByText('Проверяем…')).toBeInTheDocument();
    expect(screen.queryByText('Облигация с таким названием уже есть')).not.toBeInTheDocument();
    await act(async () => { resolveDuplicateRefetch(jsonResponse({ available: false })); });
    expect(await screen.findByText('Облигация с таким названием уже есть')).toBeInTheDocument();
    expect(screen.queryByText('Проверяем…')).not.toBeInTheDocument();
  });

  it('maps a bond_name_taken response to the name field', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const { url, method } = requestDetails(input, init);
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

    expect(await screen.findByText('Облигация с таким названием уже существует')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('maps a purchase date backend error to its field', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const { url, method } = requestDetails(input, init);
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

  it('closes after create and inserts the mutation response into the visible list cache', async () => {
    const user = userEvent.setup();
    let createBody: unknown;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const { url, method } = requestDetails(input, init);
      if (url.includes('t-invest-lookup')) return jsonResponse({ item: lookupItem });
      if (url.includes('name-availability')) return jsonResponse({ available: true });
      if (method === 'POST') {
        createBody = await requestJson(input, init);
        return jsonResponse(activeBond, 201);
      }
      return jsonResponse({ items: [] });
    }));
    renderPortfolio();
    await openCreateForm(user);
    await fillCreateForm(user);

    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByRole('article', { name: 'ОФЗ 26238' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(createBody).toMatchObject({ instrument_uid: 'instrument-1', ticker: 'SU26238', nominal: '1000.00', amount_spent: '75000.70', quantity: 75 });
  });

  it('updates the matching card from an add-purchase response without reloading the page', async () => {
    const user = userEvent.setup();
    const updatedBond = { ...activeBond, total_quantity: 77, total_spent: '76000.75' };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const { method } = requestDetails(input, init);
      return method === 'POST' ? jsonResponse(updatedBond, 201) : jsonResponse({ items: [activeBond] });
    }));
    renderPortfolio();
    const card = await screen.findByRole('article', { name: 'ОФЗ 26238' });
    const { dialog } = await openPurchaseForm(user, card);
    await user.type(within(dialog).getByLabelText('Сумма покупки'), '1000,05');
    await user.type(within(dialog).getByLabelText('Количество'), '2');
    expect(within(dialog).getByLabelText('Дата покупки')).toHaveValue(todayInput());
    await user.click(within(dialog).getByRole('button', { name: 'Зафиксировать' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(screen.getByRole('article', { name: 'ОФЗ 26238' })).getByText('77 шт.')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'ОФЗ 26238' })).toHaveTextContent(/76.000,75.₽/);
  });
});
