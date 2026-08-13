import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { PortfolioSortControls } from '..';
import type { PortfolioSortPreference } from '..';

function SortControlsHarness({ initial }: { initial: PortfolioSortPreference }) {
  const [preference, setPreference] = useState(initial);
  return (
    <PortfolioSortControls
      preference={preference}
      onFieldChange={(field) => setPreference((current) => ({ ...current, field }))}
      onDirectionToggle={() => setPreference((current) => ({
        ...current,
        direction: current.direction === 'asc' ? 'desc' : 'asc',
      }))}
    />
  );
}

describe('PortfolioSortControls', () => {
  it('marks the selected option, preserves direction and returns focus after selection', async () => {
    const user = userEvent.setup();
    render(<SortControlsHarness initial={{ field: 'createdAt', direction: 'desc' }} />);

    const trigger = screen.getByRole('button', { name: 'Критерий сортировки: По дате добавления' });
    const direction = screen.getByRole('button', { name: 'По убыванию. Переключить по возрастанию' });
    expect(direction).toHaveAttribute('aria-pressed', 'true');
    expect(direction).toHaveAttribute('title', 'По убыванию');

    await user.click(trigger);
    expect(screen.getByRole('menuitemradio', { name: 'По дате добавления' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('menuitemradio', { name: 'По имени' }));

    expect(screen.getByRole('button', { name: 'Критерий сортировки: По имени' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'По убыванию. Переключить по возрастанию' })).toBeInTheDocument();
  });

  it('exposes the current direction through the toggle label and pressed state', async () => {
    const user = userEvent.setup();
    render(<SortControlsHarness initial={{ field: 'name', direction: 'asc' }} />);

    const direction = screen.getByRole('button', { name: 'По возрастанию. Переключить по убыванию' });
    expect(direction).toHaveAttribute('aria-pressed', 'false');
    await user.click(direction);
    expect(screen.getByRole('button', { name: 'По убыванию. Переключить по возрастанию' })).toHaveAttribute('aria-pressed', 'true');
  });
});
