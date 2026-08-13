import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUserStore } from '#entities/user';

import { App } from '..';

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

describe('App routes', () => {
  beforeEach(() => {
    useUserStore.setState({ status: 'checking', user: null });
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the protected portfolio for an authenticated session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ id: 'user-1', username: 'moxxie' })));
    window.history.replaceState({}, '', '/portfolio');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Портфель облигаций' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/portfolio');
  });

  it('replaces a protected URL with the calculator route for an anonymous session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      code: 'unauthenticated',
      message: 'Authentication required',
    }, 401)));
    window.history.replaceState({}, '', '/portfolio');

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/'));
    expect(await screen.findByRole('heading', { name: /Рассчитайте реальную/ })).toBeInTheDocument();
  });
});
