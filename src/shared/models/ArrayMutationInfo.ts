/**
 * Usually used with typed callbacks, describes the mutation to go from the old
 * value to the current value via an arr.splice equivalent call.
 */
export type ArraySpliceInfo<T> = {
  /** Indicates that the array was mutated as if by arr.splice */
  type: 'splice';
  /** zero-based index at which the change began */
  start: number;
  /** an integer indicating the number of elements in the array to remove from start */
  deleteCount: number;
  /** the elements to add to the array, beginning at start */
  items: T[];
  /** what was (or would have been) returned from arr.splice on the orignal list */
  removed: T[];
};

export type ArrayMoveSwapInfo<T> = {
  /**
   * Indicates that the array was mutated as if by
   * ```
   * arr.splice(oldIndex, 1);
   * arr.splice(newIndex, 0, added);
   * ```
   * with the assumption that generally, the removed element is similar in some
   * meaningful way to the element being added.
   */
  type: 'moveSwap';
  /** The index of the element in the old array */
  oldIndex: number;
  /** The index of the element in the new array */
  newIndex: number;
  /** The element that was removed, i.e., the unwrapped result of the first splice on the original list */
  removed: T;
  /** The element being added */
  added: T;
};

export type ArrayMutationInfo<T> = ArraySpliceInfo<T> | ArrayMoveSwapInfo<T>;
