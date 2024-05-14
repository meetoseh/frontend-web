import { ReactElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  CrudFetcher,
  CrudFetcherFilter,
  CrudFetcherKeyMap,
  CrudFetcherMapper,
  CrudFetcherSort,
} from './CrudFetcher';
import styles from './CrudPicker.module.css';
import assistiveStyles from '../../shared/assistive.module.css';
import { describeErrorFromResponse, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';

type CrudPickerProps<T> = {
  /**
   * The path to the search api endpoint
   */
  path: string;

  /**
   * How to map from items in the api response to the items
   */
  keyMap: CrudFetcherMapper<T>;

  /**
   * The sort to apply to the matched items
   */
  sort: CrudFetcherSort;

  /**
   * The function to convert a query string into a filter.
   */
  filterMaker: (this: void, query: string) => CrudFetcherFilter;

  /**
   * The component to render the items that match the query. This
   * can just be a fragment containing text, or any other element
   * which acts similarly to an inline block
   */
  component: (this: void, item: T, query: string) => ReactElement;

  /**
   * The current query string. This can be used to prefill the search
   * box, or to update the search box when the user changes their selection.
   */
  query: string;

  /**
   * Used to update the query string when the user changes their selection.
   */
  setQuery: (this: void, query: string) => void;

  /**
   * Used to set the selected value when the user clicks on an item
   */
  setSelected: (this: void, item: T) => void;

  /**
   * Whether the picker is disabled or not
   * @default false
   */
  disabled?: boolean;

  /**
   * If specified, called with the focus function for the picker's input.
   * @default null
   */
  doFocus?: ((this: void, focus: (this: void) => void) => void) | null;

  /**
   * Variant of the picker. Currently this just controls the direction
   * that suggestions are shown relative to the input.
   * @default 'down'
   */
  variant?: 'down' | 'up';
};

/**
 * Converts a standard search endpoint into a search box which pops up
 * suggestions
 */
export function CrudPicker<T extends { uid: string }>({
  path,
  keyMap,
  sort,
  filterMaker,
  component,
  query,
  setQuery,
  setSelected,
  disabled = false,
  doFocus = null,
  variant = 'down',
}: CrudPickerProps<T>): ReactElement {
  const loginContextRaw = useContext(LoginContext);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState<ReactElement | null>(null);

  const fetcher = useMemo(() => {
    return new CrudFetcher(
      path,
      keyMap,
      setItems,
      () => {},
      () => {}
    );
  }, [path, keyMap]);

  useEffect(() => {
    if (doFocus === null || inputRef.current === null) {
      return;
    }

    const input = inputRef.current;
    doFocus(() => {
      input.focus();
      setFocused(true);
    });
  }, [doFocus]);

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        if (loginContextUnch.state !== 'logged-in') {
          return;
        }
        const loginContext = loginContextUnch;
        if (query === '' || disabled) {
          setError(null);
          setItems([]);
          return;
        }

        let active = true;
        let bonusCancellers: ((this: void) => void)[] = [];
        fetchItems();
        return () => {
          active = false;
          bonusCancellers.forEach((canceller) => {
            canceller();
          });
        };

        async function fetchItems() {
          setError(null);

          const fetchCanceller = fetcher.resetAndLoadWithCancelCallback(
            filterMaker(query),
            sort,
            10,
            loginContext,
            async (e) => {
              if (!active) {
                return;
              }
              console.error('error fetching items', e);

              if (e instanceof Response) {
                const described = await describeErrorFromResponse(e);
                if (!active) {
                  return;
                }

                setError(described);
              } else {
                setError(<>Could not connect to server. Check your internet connection.</>);
              }
            }
          );
          bonusCancellers.push(fetchCanceller);
        }
      },
      [query, disabled, fetcher, filterMaker, sort]
    )
  );

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

  const onInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
    },
    [setQuery]
  );

  return (
    <div ref={containerRef} className={`${styles.container} ${styles[`variant-${variant}`]}`}>
      <div className={styles.iconAndInput}>
        <div className={styles.searchIconContainer}>
          <div className={styles.searchIcon}></div>
          <div className={assistiveStyles.srOnly}>Search</div>
        </div>
        <input
          type="text"
          className={styles.input}
          value={query}
          onChange={onInputChanged}
          placeholder="Enter a query..."
          disabled={disabled}
          ref={inputRef}
        />
      </div>

      {focused && query.length > 0 && error !== null && !disabled && (
        <div className={styles.errorContainer}>
          <ErrorBlock>{error}</ErrorBlock>
        </div>
      )}

      {focused && query.length > 0 && items.length > 0 && !disabled && error === null && (
        <div className={styles.suggestions}>
          {items.map((item) => (
            <div key={item.uid} className={styles.suggestionContainer}>
              <button
                className={styles.suggestion}
                type="button"
                onClick={() => {
                  setSelected(item);
                }}>
                {component(item, query)}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
