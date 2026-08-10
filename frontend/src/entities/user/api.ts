import { apiRequest } from '#shared/api';

import type { Credentials, User } from './types';

export const getCurrentUser = () => apiRequest<User>('auth/me');

export const loginUser = (credentials: Credentials) => apiRequest<User>('auth/login', {
  method: 'post',
  json: credentials,
});

export const registerUser = (credentials: Credentials) => apiRequest<User>('auth/register', {
  method: 'post',
  json: credentials,
});

export const logoutUser = () => apiRequest<void>('auth/logout', { method: 'post' });
