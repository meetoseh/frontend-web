import React, {
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { apiFetch } from '../../shared/ApiConstants';
import { describeError, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { LoginContext } from '../../shared/LoginContext';
import { CrudFetcherKeyMap, CrudFetcherSort, convertUsingKeymap } from './CrudFetcher';
import styles from './CrudDropdown.module.css';
import assistiveStyles from '../../shared/assistive.module.css';

type CrudDropdownProps<T extends { uid: string }> = {
  /**
   * The path to the search api endpoint
   */
  path: string;

  /**
   * How to map from items in the api response to the items
   */
  keyMap: CrudFetcherKeyMap<T>;

  /**
   * The sort to apply to the matched items
   */
  sort: CrudFetcherSort;

  /**
   * The component to render the items. Note that most components will
   * not render properly as these are placed inside an <option> element
   */
  component: (this: void, item: T) => ReactElement;

  /**
   * Used to set the selected value when the user clicks on an item
   */
  setSelected: (this: void, item: T) => void;

  /**
   * Whether the dropdown is disabled or not
   * @default false
   */
  disabled?: boolean;

  /**
   * If specified, called with the focus function for the picker's input.
   * @default null
   */
  doFocus?: ((this: void, focus: (this: void) => void) => void) | null;

  /**
   * Variant of the dropdown.
   * @default 'down'
   */
  variant?: 'down';

  /**
   * When fetching the list, how many items to fetch at a time
   * @default 100
   */
  limit?: number;

  /**
   * Describes when the content should be loaded.
   * @default 'hover'
   */
  loadOn?: 'eager' | 'hover' | 'focus';
};

/**
 * Fetches the entire list of items from the api, and then presents them
 * using a native dropdown. This allows the user to see all the options
 * and scroll through them, which is appropriate if the list is relatively
 * short and discovery via search is difficult.
 *
 * This is intended to be relatively easy to swap with a CrudPicker, which
 * performs essentially the same role except without downloading the entire
 * list (but instead doing a search as the user types)
 */
export function CrudDropdown<T extends { uid: string }>({
  path,
  keyMap,
  sort,
  component,
  setSelected,
  disabled = false,
  doFocus = null,
  variant = 'down',
  limit = 100,
  loadOn = 'hover',
}: CrudDropdownProps<T>): ReactElement {
  const loginContext = useContext(LoginContext);
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [items, setItems] = useState<T[]>([]);
  const [fetchedItems, setFetchedItems] = useState(false);
  const [wantLoad, setWantLoad] = useState(loadOn === 'eager');
  const [error, setError] = useState<ReactElement | null>(null);
  const [choice, setChoice] = useState<T | null>(null);

  useEffect(() => {
    if (wantLoad) {
      return;
    }

    if (loadOn === 'eager') {
      setWantLoad(true);
    } else if (loadOn === 'hover') {
      if (hovered) {
        setWantLoad(true);
      }
    } else if (loadOn === 'focus') {
      if (focused) {
        setWantLoad(true);
      }
    } else {
      throw new Error('Invalid loadOn value');
    }
  }, [focused, hovered, wantLoad, loadOn]);

  useEffect(() => {
    if (wantLoad || loadOn !== 'hover' || containerRef.current === null) {
      return;
    }

    const container = containerRef.current;
    container.addEventListener('mouseenter', onMouseEnter);
    container.addEventListener('mouseleave', onMouseLeave);
    return () => {
      container.removeEventListener('mouseenter', onMouseEnter);
      container.removeEventListener('mouseleave', onMouseLeave);
    };

    function onMouseEnter() {
      setHovered(true);
    }
    function onMouseLeave() {
      setHovered(false);
    }
  }, [loadOn, wantLoad]);

  useEffect(() => {
    if (fetchedItems || !wantLoad || loginContext.state !== 'logged-in') {
      return;
    }
    let active = true;
    fetchItems();
    return () => {
      active = false;
    };

    async function fetchItems() {
      setError(null);
      try {
        let nextSort = sort;
        const newItems = [];
        while (true) {
          const response = await apiFetch(
            path,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
              },
              body: JSON.stringify({
                filters: {},
                sort: nextSort,
                limit,
              }),
            },
            loginContext
          );
          if (!active) {
            return;
          }

          if (!response.ok) {
            throw response;
          }

          const data: { items: any[]; next_page_sort: CrudFetcherSort | null } =
            await response.json();
          if (!active) {
            return;
          }

          for (const item of data.items) {
            newItems.push(convertUsingKeymap(item, keyMap));
          }

          if (
            data.next_page_sort === null ||
            data.next_page_sort === undefined ||
            data.next_page_sort.length === 0 ||
            data.next_page_sort.every((s) => s.after === null || s.after === undefined)
          ) {
            break;
          }
          nextSort = data.next_page_sort;
        }
        if (!active) {
          return;
        }
        setItems(newItems);
        setChoice(newItems.length > 0 ? newItems[0] : null);
        setFetchedItems(true);
      } catch (e) {
        if (!active) {
          return;
        }
        const err = await describeError(e);
        if (!active) {
          return;
        }
        setError(err);
      }
    }
  }, [focused, fetchedItems, wantLoad, path, sort, limit, loginContext, keyMap]);

  useEffect(() => {
    if (doFocus === null || selectRef.current === null) {
      return;
    }

    const select = selectRef.current;
    doFocus(() => {
      select.focus();
      setFocused(true);
    });
  }, [doFocus]);

  useEffect(() => {
    if (containerRef.current === null) {
      return;
    }

    const container = containerRef.current;
    const onFocusIn = (e: FocusEvent) => {
      setFocused(true);
    };
    const onFocusOut = (e: FocusEvent) => {
      if (container.contains(e.relatedTarget as Node)) {
        return;
      }
      setFocused(false);
    };

    container.addEventListener('focusin', onFocusIn);
    container.addEventListener('focusout', onFocusOut);
    return () => {
      container.removeEventListener('focusin', onFocusIn);
      container.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  const onSelectChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      setChoice(items.find((i) => i.uid === e.target.value) ?? null),
    [items]
  );

  const options = useMemo(() => {
    return items.map((item) => (
      <option key={item.uid} value={item.uid}>
        {component(item)}
      </option>
    ));
  }, [items, component]);

  return (
    <div ref={containerRef} className={`${styles.container} ${styles[`variant-${variant}`]}`}>
      <div className={styles.iconAndInput}>
        <div className={styles.searchIconContainer}>
          <div className={styles.searchIcon}></div>
          <div className={assistiveStyles.srOnly}>Choose</div>
        </div>
        <select
          className={styles.input}
          value={choice?.uid}
          onChange={onSelectChange}
          placeholder="Select one..."
          disabled={disabled}
          ref={selectRef}>
          {options}
        </select>
      </div>

      {focused && error !== null && !disabled && (
        <div className={styles.errorContainer}>
          <ErrorBlock>{error}</ErrorBlock>
        </div>
      )}
    </div>
  );
}