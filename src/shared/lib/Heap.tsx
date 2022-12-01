/**
 * Implements the min-heap heappush algorithm, assuming that
 * the array is already a min-heap on the given key. This requires
 * amortized log(n) time.
 *
 * @param key the key to use for sorting. This is the first argument
 *   to make binding easier.
 * @param arr The array to push to, where each item has `key` as
 *   a property.
 * @param item the item to insert, which has `key` as a property
 */
export const heappush = (key: string, arr: any[], item: any) => {
  arr.push(item);
  let i = arr.length - 1;
  while (i > 0) {
    const parent = Math.floor((i - 1) / 2);
    if (arr[parent][key] <= arr[i][key]) {
      break;
    }
    const temp = arr[parent];
    arr[parent] = arr[i];
    arr[i] = temp;
    i = parent;
  }
};

/**
 * Removes the top item from the min-heap, assuming that the array
 * is already a min-heap on the given key, and then leaves the
 * array as a min-heap. This requires amortized log(n) time.
 *
 * @param key the key to use for sorting. This is the first argument
 *   to make binding easier.
 * @param arr The array to pop from, where each item has `key` as
 *   a property.
 * @returns the top item from the array
 */
export const heappop = (key: string, arr: any[]): any => {
  const top = arr[0];
  const last = arr.pop();
  if (arr.length === 0) {
    return top;
  }
  arr[0] = last;
  let i = 0;
  while (i < arr.length) {
    const left = 2 * i + 1;
    const right = 2 * i + 2;
    if (left >= arr.length) {
      break;
    }
    let min = left;
    if (right < arr.length && arr[right][key] < arr[left][key]) {
      min = right;
    }
    if (arr[i][key] <= arr[min][key]) {
      break;
    }
    const temp = arr[min];
    arr[min] = arr[i];
    arr[i] = temp;
    i = min;
  }
  return top;
};
