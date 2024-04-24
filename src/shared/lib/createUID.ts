/**
 * Equivalent to python `secrets.token_urlsafe(16)`.
 *
 * Generates 16 random bytes, then encodes it with the URL-safe base64 alphabet
 */
export const createUID = () => {
  const random = window.crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...Array.from(random)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};
