/**
 * Returns a new map with only the keys that are in the keys array or
 * has-testable object. The original map is not modified. If a keys
 * array is provided, it is converted to a Set for faster lookups.
 *
 * Requires O(n), where n is the number of keys in the object.
 *
 * @param obj The map to remove unmatched keys from.
 * @param keys The keys to keep.
 * @returns A new map with only the keys that are in the keys array or
 *       has-testable object.
 */
export const removeUnmatchedKeysFromMap = <K, V>(
  obj: Map<K, V>,
  keys: { has: (k: K) => boolean } | K[]
): Map<K, V> => {
  const keysLookup = Array.isArray(keys) ? new Set(keys) : keys;

  const newMap = new Map<K, V>();
  obj.forEach((value, key) => {
    if (keysLookup.has(key)) {
      newMap.set(key, value);
    }
  });
  return newMap;
};
