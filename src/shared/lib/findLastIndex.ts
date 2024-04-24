/**
 * arr.findLastIndex ponyfill
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/findLastIndex
 */
export function findLastIndex<T>(arr: T[], predicate: (value: T) => boolean): number {
  if ('findLastIndex' in (arr as any)) {
    return (arr as any).findLastIndex(predicate);
  }

  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) {
      return i;
    }
  }
  return -1;
}
