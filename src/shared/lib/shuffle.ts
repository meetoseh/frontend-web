/**
 * Performs an in-place Fisher-Yates shuffle on the given array. At the
 * end, every element has an equal probability of being at any index.
 */
export const shuffle = (arr: any[]): void => {
  for (let i = arr.length - 1; i >= 1; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    if (j < i) {
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
  }
};
