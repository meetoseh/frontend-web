/**
 * Formats large numbers into a human readable format, e.g., 1200 to 1.2k,
 * 1,000,000 to 1M, etc.
 */
export const kFormatter = (num: number) => {
  if (num <= 999) {
    return num;
  }

  if (num <= 999_999) {
    return `${(num / 1_000).toFixed(1)}k`;
  }

  if (num <= 999_999_999) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }

  return `${(num / 1_000_000_000).toFixed(1)}B`;
};
