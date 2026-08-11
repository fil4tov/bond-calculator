import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRef, useState } from 'react';
import userEvent from '@testing-library/user-event';

import { Modal } from '#shared/ui';

describe('Modal', () => {
  it('renders an accessible header with optional context', () => {
    render(
      <Modal
        title="Подтвердите операцию"
        eyebrow="ПОРТФЕЛЬ"
        subtitle="Это действие нельзя отменить"
        busy={false}
        onClose={vi.fn()}
      >
        <p>Содержимое</p>
      </Modal>,
    );

    expect(screen.getByRole('dialog', { name: 'Подтвердите операцию' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('ПОРТФЕЛЬ')).toBeInTheDocument();
    expect(screen.getByText('Это действие нельзя отменить')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Закрыть окно' })).toBeInTheDocument();
  });

  it('traps focus, locks scrolling, and restores the invoking element after Escape', async () => {
    function Example() {
      const [open, setOpen] = useState(false);
      const triggerRef = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>Открыть</button>
          {open ? (
            <Modal title="Подтвердите операцию" busy={false} onClose={() => setOpen(false)} returnFocusTarget={triggerRef.current}>
              <button type="button">Продолжить</button>
            </Modal>
          ) : null}
        </>
      );
    }

    const user = userEvent.setup();
    render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Открыть' });
    await user.click(trigger);

    expect(document.body.style.overflow).toBe('hidden');
    expect(screen.getByRole('button', { name: 'Закрыть окно' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Продолжить' })).toHaveFocus();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(trigger).toHaveFocus();
  });

  it('does not dismiss a busy modal', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <Modal title="Подтвердите операцию" busy onClose={onClose}>
        <button type="button">Продолжить</button>
      </Modal>,
    );

    await user.click(screen.getByRole('button', { name: 'Закрыть окно' }));
    await user.keyboard('{Escape}');
    await user.click(container.firstElementChild!);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('dismisses an ordinary modal from its backdrop', () => {
    const onClose = vi.fn();
    render(
      <Modal title="Обычное окно" onClose={onClose}>
        <button type="button">Продолжить</button>
      </Modal>,
    );

    const backdrop = screen.getByRole('dialog', { name: 'Обычное окно' }).parentElement;
    if (!backdrop) throw new Error('Modal backdrop is missing');
    fireEvent.mouseDown(backdrop);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('lets only the topmost modal handle Escape', async () => {
    const closeLower = vi.fn();
    const closeUpper = vi.fn();
    const user = userEvent.setup();
    render(
      <>
        <Modal title="Нижнее окно" onClose={closeLower}>
          <button type="button">Нижнее действие</button>
        </Modal>
        <Modal title="Верхнее окно" onClose={closeUpper}>
          <button type="button">Верхнее действие</button>
        </Modal>
      </>,
    );

    await user.keyboard('{Escape}');

    expect(closeUpper).toHaveBeenCalledOnce();
    expect(closeLower).not.toHaveBeenCalled();
  });

  it('keeps the upper modal locked and focused when the lower modal unmounts', async () => {
    function Example() {
      const [open, setOpen] = useState(false);
      const [lowerOpen, setLowerOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Открыть стек</button>
          {open && lowerOpen ? (
            <Modal title="Нижнее окно" onClose={() => undefined}>
              <button type="button">Нижнее действие</button>
            </Modal>
          ) : null}
          {open ? (
            <Modal title="Верхнее окно" onClose={() => setOpen(false)}>
              <button type="button" onClick={() => setLowerOpen(false)}>Удалить нижнее</button>
            </Modal>
          ) : null}
        </>
      );
    }

    const user = userEvent.setup();
    render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Открыть стек' });
    await user.click(trigger);
    const upperDialog = screen.getByRole('dialog', { name: 'Верхнее окно' });
    const removeLower = within(upperDialog).getByRole('button', { name: 'Удалить нижнее' });

    await user.click(removeLower);

    expect(screen.queryByRole('dialog', { name: 'Нижнее окно' })).not.toBeInTheDocument();
    expect(upperDialog).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    expect(removeLower).toHaveFocus();
    expect(trigger).not.toHaveFocus();
  });

  it('skips hidden and negative-tabindex elements when wrapping focus', async () => {
    const user = userEvent.setup();
    render(
      <Modal title="Проверка фокуса" onClose={() => undefined}>
        <button type="button">Видимое действие</button>
        <input type="hidden" />
        <a href="/hidden-action" tabIndex={-1}>Скрытое действие</a>
      </Modal>,
    );

    expect(screen.getByRole('button', { name: 'Закрыть окно' })).toHaveFocus();
    await user.tab({ shift: true });

    expect(screen.getByRole('button', { name: 'Видимое действие' })).toHaveFocus();
  });
});
