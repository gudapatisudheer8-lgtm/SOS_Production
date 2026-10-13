import { Platform } from 'react-native';
import { mobileApiBase } from './api-base';
import { currentToken, reportError } from './session';

/** Same authenticated backend as the generated client, for endpoints not yet in codegen. */
export async function nativeApi<T>(path: string, input?: { method?: string; body?: unknown }): Promise<T> {
  if (!path.startsWith('/api/')) throw new Error('Expected an API path.');
  const token = currentToken();
  const response = await fetch(`${mobileApiBase(Platform.OS, process.env.EXPO_PUBLIC_DOMAIN)}${path}`, {
    method: input?.method ?? (input?.body === undefined ? 'GET' : 'POST'),
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(input?.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(input?.body === undefined ? {} : { body: JSON.stringify(input.body) }),
  });
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) {
    throw new Error('The API returned an access page instead of data. Reload and sign in again.');
  }
  const data = await response.json();
  if (!response.ok) {
    const error = Object.assign(new Error(data.message || `Request failed (${response.status}).`), {
      status: response.status, code: data.error,
    });
    reportError(error);
    throw error;
  }
  return data as T;
}
