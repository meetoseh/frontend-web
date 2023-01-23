/**
 * Intelligently joins an array of strings with commas and an "and" before the
 * last item. Does not modify the original array.
 *
 * @param items The array of strings to join.
 * @returns The joined string.
 */
export const joinWithCommas = (items: string[]): string => {
  if (items.length <= 1) {
    return items.join();
  }

  if (items.length === 2) {
    return items.join(' and ');
  }

  const result = items.slice(0, -1).join(', ');
  return `${result}, and ${items[items.length - 1]}`;
};
