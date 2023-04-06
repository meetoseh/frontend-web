import { MutableRefObject, useEffect, useMemo, useRef, useState } from 'react';
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

/**
 * A react hook that returns a standard react state object to determine
 * if the selection is not null.
 *
 * @param selection The selection ref object
 * @returns Whether the selection is not null
 */
export function useSimpleSelectionHasSelection<T>(selection: SimpleSelectionRef<T>): boolean {
  const [hasSelection, setHasSelection] = useState<boolean>(selection.selection.current !== null);

  useEffect(() => {
    let curValue = selection.selection.current !== null;
    setHasSelection(curValue);
    selection.onSelectionChanged.current.add(handleSelectionChanged);
    return () => {
      selection.onSelectionChanged.current.remove(handleSelectionChanged);
    };

    function handleSelectionChanged(e: SimpleSelectionChangedEvent<T>) {
      const newVal = e.current !== null;
      if (newVal !== curValue) {
        setHasSelection(newVal);
        curValue = newVal;
      }
    }
  }, [selection]);

  return hasSelection;
}
