const charToKerningLength: Record<string, number> = {
  i: 0.25,
  r: 0.5,
  f: 0.5,
  l: 0.33,
  t: 0.33,
  ' ': 0.25,
  '.': 0.25,
};

/**
 * Approximates the kerning length of the given string as the number
 * of 'w's it would take up. This is a heuristic intended for open sans
 *
 * @param s the string to calculate the kerning length of
 * @param cutoff If specified, we stop calculating the kerning length once
 *   we reach this number of ws
 * @returns the string up to the point where the kerning length is reached,
 *   and the number of ws in a string of all ws that would visually take up
 *   the same width
 */
export const calculateKerningLength = (s: string, cutoff?: number): [string, number] => {
  let kerningLength = 0;
  for (let i = 0; i < s.length; i++) {
    const characterLength = charToKerningLength[s[i]] || 1;
    if (cutoff !== undefined && kerningLength + characterLength > cutoff) {
      return [s.slice(0, i), cutoff];
    }
    kerningLength += characterLength;
  }
  return [s, kerningLength];
};

/**
 * If the given string exceeds the cutoff length, returns the string
 * truncated with ellipses, otherwise returns the string
 *
 * @param s The string to truncate
 * @param cutoff The maximum length of the string in w's
 * @returns The truncated string
 */
export const textOverflowEllipses = (s: string, cutoff: number): string => {
  const truncated = calculateKerningLength(s, cutoff - 3 * charToKerningLength['.'])[0];
  if (truncated.length === s.length) {
    return s;
  }

  return truncated + '...';
};
