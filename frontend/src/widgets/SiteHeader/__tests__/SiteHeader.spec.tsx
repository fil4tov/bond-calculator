import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUserStore } from '#entities/user';

import { SiteHeader } from '../SiteHeader';

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

describe('SiteHeader', () => {
  beforeEach(() => {
    useUserStore.setState({ status: 'anonymous', user: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens registration, validates fields and turns a successful registration into an avatar', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ id: 'user-1', username: 'moxxie' }, 201)));
    render(
      <MemoryRouter>
        <SiteHeader theme="light" toggleTheme={vi.fn()} additionalAction={<button type="button">Расчёты</button>} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Расчёты' })).toBeInTheDocument();
    const authTrigger = screen.getByRole('button', { name: 'Войти или зарегистрироваться' });
    await user.click(authTrigger);
    const authDialog = screen.getByRole('dialog', { name: 'Авторизация' });
    expect(authDialog).not.toHaveTextContent('ЛИЧНЫЙ КАБИНЕТ');
    expect(authDialog).not.toHaveTextContent('Продолжите работу со своим портфелем облигаций.');
    expect(screen.getByPlaceholderText('Логин')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Не менее 8 символов')).toBeInTheDocument();

    const loginButton = screen.getByRole('button', { name: 'Войти' });
    expect(loginButton.parentElement?.className).toMatch(/actions/);

    await user.click(screen.getByRole('tab', { name: 'Регистрация' }));
    await user.click(screen.getByRole('button', { name: 'Создать аккаунт' }));
    expect(await screen.findByText('Введите логин')).toBeInTheDocument();
    expect(screen.getByText('Пароль должен содержать от 8 до 128 символов')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Логин/), 'moxxie');
    await user.type(screen.getByLabelText(/^Пароль/), 'password123');
    await user.click(screen.getByRole('button', { name: 'Создать аккаунт' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const avatar = screen.getByRole('button', { name: 'Открыть меню пользователя moxxie' });
    expect(avatar).toHaveTextContent('M');
    expect(avatar).toHaveFocus();
  });

  it('shows a localized duplicate-login error next to the username field', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      code: 'username_taken',
      message: 'Username is already taken',
      field_errors: { username: 'Username is already taken' },
    }, 409)));
    render(<MemoryRouter><SiteHeader theme="light" toggleTheme={vi.fn()} /></MemoryRouter>);

    await user.click(screen.getByRole('button', { name: 'Войти или зарегистрироваться' }));
    await user.click(screen.getByRole('tab', { name: 'Регистрация' }));
    await user.type(screen.getByLabelText(/^Логин/), 'moxxie');
    await user.type(screen.getByLabelText(/^Пароль/), 'password123');
    await user.click(screen.getByRole('button', { name: 'Создать аккаунт' }));

    expect(await screen.findByText('Этот логин уже занят')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('supports the keyboard tab pattern in the auth dialog', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><SiteHeader theme="light" toggleTheme={vi.fn()} /></MemoryRouter>);

    await user.click(screen.getByRole('button', { name: 'Войти или зарегистрироваться' }));
    const loginTab = screen.getByRole('tab', { name: 'Вход' });
    const registerTab = screen.getByRole('tab', { name: 'Регистрация' });
    expect(loginTab).toHaveAttribute('aria-controls', 'auth-login-panel');
    expect(loginTab).toHaveAttribute('tabindex', '0');
    expect(registerTab).toHaveAttribute('tabindex', '-1');

    loginTab.focus();
    await user.keyboard('{ArrowRight}');

    expect(registerTab).toHaveFocus();
    expect(registerTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'auth-register-panel');
  });

  it('shows the profile menu and logs out only after a successful request', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    useUserStore.setState({ status: 'authenticated', user: { id: 'user-1', username: 'moxxie' } });
    render(<MemoryRouter><SiteHeader theme="dark" toggleTheme={vi.fn()} /></MemoryRouter>);

    await user.click(screen.getByRole('button', { name: 'Открыть меню пользователя moxxie' }));
    expect(screen.getByText('moxxie')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Меню пользователя' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Калькулятор' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Портфель' })).toHaveAttribute('href', '/portfolio');

    await user.click(screen.getByRole('button', { name: 'Выйти' }));
    expect(await screen.findByRole('button', { name: 'Войти или зарегистрироваться' })).toBeInTheDocument();
  });

  it('closes the auth dialog with Escape and restores trigger focus', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><SiteHeader theme="light" toggleTheme={vi.fn()} /></MemoryRouter>);
    const trigger = screen.getByRole('button', { name: 'Войти или зарегистрироваться' });

    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
