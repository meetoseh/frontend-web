/**
 * Returns the resulting color when a solid background color
 * is blended on top of a transparent foreground color.
 *
 * Both numbers should be specified as 0-1 rgb[a] values.
 *
 * @param background The background color to blend on top of.
 * @param foreground The foreground color to blend, with alpha
 */
export const alphaBlend = (
  background: [number, number, number],
  foreground: [number, number, number, number]
): [number, number, number] => [
  (1 - foreground[3]) * background[0] + foreground[3] * foreground[0],
  (1 - foreground[3]) * background[1] + foreground[3] * foreground[1],
  (1 - foreground[3]) * background[2] + foreground[3] * foreground[2],
];

/**
 * Converts a base64url encoded string to the corresponding bytes.
 * This is useful when working with thumbhashes. This usually uses
 * a fast implementation, but if the necessary APIs are not available
 * a slow javascript implementation is used.
 */
export const base64URLToByteArray = (base64Url: string): Uint8Array | number[] => {
  const binString = atob(base64Url.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binString, (c) => c.charCodeAt(0));
};

/**
 * For convenience, the reverse operation of base64URLToByteArray.
 */
export const byteArrayToBase64URL = (bytes: Uint8Array | number[]): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let base64 = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = bytes[i + 1];
    const b3 = bytes[i + 2];

    base64 += chars[b1 >> 2];
    base64 += chars[((b1 & 3) << 4) | (b2 >> 4)];
    base64 += chars[((b2 & 15) << 2) | (b3 >> 6)];
    base64 += chars[b3 & 63];
  }

  const remainder = bytes.length % 3;
  if (remainder === 2) {
    base64 = base64.substring(0, base64.length - 1);
  } else if (remainder === 1) {
    base64 = base64.substring(0, base64.length - 2);
  }

  return base64;
};

/**
 * Computes an images average color using the base64url encoded thumbhash,
 * which includes the average color.
 *
 * @param thumbhash The thumbhash bytes
 * @returns The average color of the image as a 0-1 rgba value.
 */
export const computeAverageRGBAUsingThumbhash = (
  thumbhash: Uint8Array | number[]
): [number, number, number, number] => {
  // just using the provided python implementation for reference
  // https://github.com/justinforlenza/thumbhash-py/blob/main/thumbhash/__init__.py#L141

  const header = thumbhash[0] | (thumbhash[1] << 8) | (thumbhash[2] << 16);
  const l = (header & 63) / 63.0;
  const p = ((header >> 6) & 63) / 31.5 - 1.0;
  const q = ((header >> 12) & 63) / 31.5 - 1.0;
  const hasAlpha = header >> 23 !== 0;
  const a = hasAlpha ? (thumbhash[5] & 15) / 15.0 : 1.0;
  const b = l - (2.0 / 3.0) * p;
  const r = (3.0 * l - b + q) / 2.0;
  const g = r - q;

  return [
    Math.max(Math.min(1.0, r), 0.0),
    Math.max(Math.min(1.0, g), 0.0),
    Math.max(Math.min(1.0, b), 0.0),
    a,
  ];
};
