import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUserStore } from '../userStore';

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

describe('useUserStore', () => {
  beforeEach(() => {
    useUserStore.setState({ status: 'checking', user: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('deduplicates concurrent session initialization and authenticates the user', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'user-1', username: 'moxxie' }));
    vi.stubGlobal('fetch', fetchMock);

    await Promise.all([
      useUserStore.getState().initialize(),
      useUserStore.getState().initialize(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useUserStore.getState()).toMatchObject({
      status: 'authenticated',
      user: { id: 'user-1', username: 'moxxie' },
    });
  });

  it('treats an unauthenticated /me response as an anonymous session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      code: 'unauthenticated',
      message: 'Authentication required',
    }, 401)));

    await useUserStore.getState().initialize();

    expect(useUserStore.getState()).toMatchObject({ status: 'anonymous', user: null });
  });

  it('registers, logs in and logs out without persisting credentials', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'user-2', username: 'bond_owner' }, 201))
      .mockResolvedValueOnce(jsonResponse({ id: 'user-2', username: 'bond_owner' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    useUserStore.setState({ status: 'anonymous', user: null });

    await useUserStore.getState().register({ username: 'bond_owner', password: 'password123' });
    expect(useUserStore.getState().status).toBe('authenticated');

    await useUserStore.getState().login({ username: 'bond_owner', password: 'password123' });
    expect(useUserStore.getState().user?.username).toBe('bond_owner');

    await useUserStore.getState().logout();
    expect(useUserStore.getState()).toMatchObject({ status: 'anonymous', user: null });
    expect(localStorage.length).toBe(0);
  });

  it('exposes backend field errors to forms', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      code: 'username_taken',
      message: 'Username is already taken',
      field_errors: { username: 'Этот логин уже занят' },
    }, 409)));
    useUserStore.setState({ status: 'anonymous', user: null });

    await expect(useUserStore.getState().register({
      username: 'moxxie',
      password: 'password123',
    })).rejects.toMatchObject({
      code: 'username_taken',
      fieldErrors: { username: 'Этот логин уже занят' },
    });
  });
});
