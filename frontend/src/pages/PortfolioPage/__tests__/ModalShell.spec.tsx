import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ModalShell } from '../components/ModalShell';

describe('ModalShell', () => {
  it('forwards an optional subtitle to the common modal header', () => {
    render(
      <ModalShell
        title="Добавить покупку"
        subtitle="Пересчитаем показатели портфеля"
        busy={false}
        onClose={vi.fn()}
      >
        <p>Форма</p>
      </ModalShell>,
    );

    expect(screen.getByRole('dialog', { name: 'Добавить покупку' })).toHaveTextContent('Пересчитаем показатели портфеля');
  });
});
