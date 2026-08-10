import ky from 'ky';
import type { Options } from 'ky';

interface ApiErrorPayload {
  code?: string;
  message?: string;
  field_errors?: Record<string, string | string[]>;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;

  constructor({ code, message, status, fieldErrors }: {
    code: string;
    message: string;
    status: number;
    fieldErrors?: Record<string, string>;
  }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

const client = ky.create({
  baseUrl: new URL('/api/', window.location.origin).toString(),
  credentials: 'include',
  throwHttpErrors: false,
  retry: 0,
  fetch: (input, init) => globalThis.fetch(input, init),
});

const normalizeFieldErrors = (fieldErrors?: ApiErrorPayload['field_errors']) => {
  if (!fieldErrors) return undefined;
  return Object.fromEntries(Object.entries(fieldErrors).map(([field, error]) => [
    field,
    Array.isArray(error) ? error[0] ?? 'Некорректное значение' : error,
  ]));
};

export async function apiRequest<T>(path: string, options?: Options): Promise<T> {
  let response: Response;
  try {
    response = await client(path, options);
  } catch {
    throw new ApiError({
      code: 'network_error',
      message: 'Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.',
      status: 0,
    });
  }

  if (!response.ok) {
    let payload: ApiErrorPayload = {};
    try {
      payload = await response.json() as ApiErrorPayload;
    } catch {
      // A stable client-side error is preferable to exposing an invalid server body.
    }
    throw new ApiError({
      code: payload.code ?? 'request_failed',
      message: payload.message ?? 'Не удалось выполнить запрос.',
      status: response.status,
      fieldErrors: normalizeFieldErrors(payload.field_errors),
    });
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
