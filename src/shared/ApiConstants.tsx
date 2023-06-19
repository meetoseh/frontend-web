import type { LoginContextValue } from './contexts/LoginContext';

/**
 * The base url for simple http requests to the backend
 */
export const HTTP_API_URL = process.env.REACT_APP_ROOT_BACKEND_URL;

/**
 * The base url for websocket requests to the backend
 */
export const HTTP_WEBSOCKET_URL = process.env.REACT_APP_ROOT_WEBSOCKET_URL;

/**
 * Wraps a fetch call by injecting the appropriate authorization header,
 * if the user is logged in.
 *
 * @param path The path to append to the base url
 * @param init The init object to pass to fetch
 * @param user The user to use for authentication
 * @returns The response from the backend
 */
export const apiFetch = async (
  path: string,
  init: RequestInit | null,
  user: LoginContextValue | null
): Promise<Response> => {
  const url = HTTP_API_URL + path;
  const headers = new Headers(init ? init.headers : undefined);
  if (user?.authTokens?.idToken) {
    headers.set('authorization', 'bearer ' + user.authTokens.idToken);
  }

  return await fetch(url, {
    ...init,
    headers,
  });
};
