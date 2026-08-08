import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BondCalculatorPage } from '../BondCalculatorPage';

describe('BondCalculatorPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('calculates and then updates the result live', async () => {
    const user = userEvent.setup();
    render(<BondCalculatorPage theme="light" toggleTheme={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Рассчитать доходность' }));
    expect(await screen.findByText('9,47%')).toBeInTheDocument();
    expect(screen.getByText('С учётом суммы погашения')).toBeInTheDocument();
    const coupon = screen.getByRole('textbox', { name: 'Величина купона' });
    await user.clear(coupon);
    await user.type(coupon, '50');
    await waitFor(() => expect(screen.getByText('11,58%')).toBeInTheDocument());
  });

  it('switches purchase and holding modes', async () => {
    const user = userEvent.setup();
    render(<BondCalculatorPage theme="light" toggleTheme={vi.fn()} />);
    await user.click(screen.getByText('Сумме вложения'));
    expect(screen.getByRole('textbox', { name: 'Количество облигаций' })).toBeDisabled();
    expect(screen.getByText('Остаток после покупки')).toBeInTheDocument();
    await user.click(screen.getByText('Нет'));
    expect(screen.getByRole('textbox', { name: /Ожидаемая цена продажи/ })).toBeInTheDocument();
    expect(screen.getByText('Продажа')).toBeInTheDocument();
  });

  it('shows an accessible validation error and moves focus', async () => {
    const user = userEvent.setup();
    render(<BondCalculatorPage theme="light" toggleTheme={vi.fn()} />);
    const nominal = screen.getByLabelText(/Номинал облигации/);
    await user.clear(nominal);
    await user.click(screen.getByRole('button', { name: 'Рассчитать доходность' }));
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('Введите номинал больше нуля');
    expect(nominal).toHaveFocus();
  });

  it('shows and clears validation errors while the user edits a field', async () => {
    const user = userEvent.setup();
    render(<BondCalculatorPage theme="light" toggleTheme={vi.fn()} />);
    const nominal = screen.getByLabelText(/Номинал облигации/);

    await user.clear(nominal);
    expect(await screen.findByText('Введите номинал больше нуля')).toBeInTheDocument();

    await user.type(nominal, '1000');
    await waitFor(() => expect(screen.queryByText('Введите номинал больше нуля')).not.toBeInTheDocument());
  });

  it('rejects non-numeric typing but accepts a formatted pasted value', async () => {
    const user = userEvent.setup();
    render(<BondCalculatorPage theme="light" toggleTheme={vi.fn()} />);
    const nominal = screen.getByLabelText(/Номинал облигации/);

    await user.clear(nominal);
    await user.type(nominal, 'abc$%1405,33');
    expect(nominal).toHaveValue('1405,33');

    await user.clear(nominal);
    await user.paste('1\u00a0405,33');
    expect(nominal).toHaveValue('1\u00a0405,33');
  });

  it('saves, restores and deletes a preset through the dropdown', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<BondCalculatorPage theme="light" toggleTheme={vi.fn()} />);
    await user.type(screen.getByRole('textbox', { name: /Название облигации/ }), 'ОФЗ 26238');
    await user.click(screen.getByRole('button', { name: 'Рассчитать доходность' }));
    await user.click(screen.getByRole('button', { name: 'Сохранить расчёт' }));
    await user.click(screen.getByRole('button', { name: 'Открыть сохранённые расчёты' }));
    const loadButton = screen.getByRole('button', { name: 'Загрузить расчёт «ОФЗ 26238»' });
    expect(within(loadButton).getByText('ОФЗ 26238')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Удалить расчёт «ОФЗ 26238»' }));
    expect(screen.getByText('Здесь пока пусто')).toBeInTheDocument();
  });

  it('closes the dropdown with Escape and returns focus', async () => {
    const user = userEvent.setup();
    render(<BondCalculatorPage theme="light" toggleTheme={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Открыть сохранённые расчёты' });
    await user.click(trigger);
    expect(screen.getByText('Сохранённые расчёты')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByText('Сохранённые расчёты')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
