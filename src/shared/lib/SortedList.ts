/**
 * A simple wrapper around a list that maintains the list in sorted order
 * according to some key function. For items with the same key, the order
 * they were inserted is maintained.
 */
export class SortedList<ItemT, SortT> {
  public readonly list: ItemT[];
  public readonly key: (item: ItemT) => SortT;

  /** creates an empty list sorted with the given mapped value */
  constructor(key: (item: ItemT) => SortT) {
    this.list = [];
    this.key = key;
  }

  /** finds the index that an item with the given key should be inserted at in O(log n) time */
  getSortedInsertionIndex(key: SortT): number {
    if (this.list.length < 5) {
      let i = 0;
      while (i < this.list.length && this.key(this.list[i]) < key) {
        i++;
      }
      return i;
    }

    let low = 0;
    let high = this.list.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.key(this.list[mid]) < key) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return low;
  }

  /** inserts an item into the list in O(log n) time */
  sortedInsert(item: ItemT) {
    const idx = this.getSortedInsertionIndex(this.key(item));
    this.list.splice(idx, 0, item);
  }
}
