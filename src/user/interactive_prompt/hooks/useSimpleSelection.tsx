import { MutableRefObject, useMemo, useRef } from 'react';
import { Callbacks } from '../../../shared/lib/Callbacks';

/**
 * The event that we use for callbacks when the user changes their selection
 */
export type SimpleSelectionChangedEvent<T> = {
  /**
   * The old selection, or null if there was no old selection
   */
  old: T | null;

  /**
   * The new selection
   */
  current: T;
};

export type SimpleSelectionRef<T> = {
  /**
   * The current selection, or null if no option is selected
   */
  selection: MutableRefObject<T | null>;

  /**
   * The callbacks for when the selection changed
   */
  onSelectionChanged: MutableRefObject<Callbacks<SimpleSelectionChangedEvent<T>>>;
};

/**
 * Used for prompts that have a simple selection which can be described in
 * an object T (e.g., a number representing the index of the currently
 * selected option).
 */
export function useSimpleSelection<T>(): SimpleSelectionRef<T> {
  const selection = useRef<T | null>(null);
  const onSelectionChanged = useRef<
    Callbacks<SimpleSelectionChangedEvent<T>>
  >() as MutableRefObject<Callbacks<SimpleSelectionChangedEvent<T>>>;

  if (onSelectionChanged.current === undefined) {
    onSelectionChanged.current = new Callbacks<SimpleSelectionChangedEvent<T>>();
  }

  return useMemo(
    () => ({
      selection,
      onSelectionChanged,
    }),
    []
  );
}
