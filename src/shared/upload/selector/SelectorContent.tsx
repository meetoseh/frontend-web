import { ReactElement, useContext, useEffect, useRef } from 'react';
import {
  CrudFetcher,
  CrudFetcherFilter,
  CrudFetcherKeyMap,
  CrudFetcherSort,
} from '../../../admin/crud/CrudFetcher';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../../lib/Callbacks';
import styles from './SelectorContent.module.css';
import { adaptValueWithCallbacksAsSetState } from '../../lib/adaptValueWithCallbacksAsSetState';
import { setVWC } from '../../lib/setVWC';
import { useValueWithCallbacksEffect } from '../../hooks/useValueWithCallbacksEffect';
import { LoginContext } from '../../contexts/LoginContext';
import { ErrorBlock, describeError } from '../../forms/ErrorBlock';
import { RenderGuardedComponent } from '../../components/RenderGuardedComponent';
import { combineClasses } from '../../lib/combineClasses';
import { InlineOsehSpinner } from '../../components/InlineOsehSpinner';
import { useMappedValuesWithCallbacks } from '../../hooks/useMappedValuesWithCallbacks';
import { Button } from '../../forms/Button';

export type SelectorContentProps<T extends object> = {
  /**
   * Explains what can be uploaded and how it will be used. For images,
   * for example, this should describe the minimum resolution required.
   *
   * This can also include controls for the filter and sort, if desired.
   */
  description: ReactElement;

  /**
   * The path to where the items can be found. Should go to a listing
   * endpoint, e.g., `/api/1/journeys/background_images/search`
   */
  path: string;

  /**
   * The function or key map capable of parsing the items in the listing
   * response
   */
  keyMap: CrudFetcherKeyMap<T> | ((v: any) => T);

  /**
   * The component for rendering items in the listing. This is provided
   * rather than an `itemComponent` for each item to allow control over
   * spacing/flow.
   */
  itemsComponent: (props: { items: T[]; onClick: (item: T) => void }) => ReactElement;

  /**
   * Called when the user selects an item from the listing.
   */
  onClick: (item: T) => void;

  /**
   * If specified, the filters to apply to the listing endpoint. Otherwise,
   * no filters are applied. Changing this filter will cause the listing
   * to reset.
   */
  filters?: ValueWithCallbacks<CrudFetcherFilter> | undefined;

  /**
   * If specified, the initial sort to apply to the listing endpoint.
   * Changing this sort will cause the listing to reset. None for the
   * default sort.
   */
  sort?: ValueWithCallbacks<CrudFetcherSort> | undefined;

  /**
   * If true, instead of appending more items with a load more button,
   * the load more button is replaced with a next page button and a
   * reset button.
   */
  loadMoreReplaces?: boolean;

  /**
   * The number of items to fetch at a time
   */
  fetchLimit: number;
};

/**
 * Provides standard content for a modal which is used to select an
 * existing file from a list of files that have been uploaded.
 *
 * Requires a login context.
 */
export const SelectorContent = <T extends object>({
  description,
  path,
  keyMap,
  itemsComponent,
  onClick,
  filters: filtersArg,
  sort: sortArg,
  fetchLimit,
  loadMoreReplaces,
}: SelectorContentProps<T>): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const items = useWritableValueWithCallbacks<T[]>(() => []);
  const loading = useWritableValueWithCallbacks<boolean>(() => true);
  const haveMore = useWritableValueWithCallbacks<boolean>(() => false);
  const nextSort = useWritableValueWithCallbacks<CrudFetcherSort>(() => sortArg?.get() ?? []);
  const filters = useWritableValueWithCallbacks<CrudFetcherFilter>(() => filtersArg?.get() ?? {});
  const refreshDesired = useWritableValueWithCallbacks<boolean>(() => true);
  const error = useWritableValueWithCallbacks<ReactElement | null>(() => null);

  const haveMoreAndLoading = useMappedValuesWithCallbacks(
    [haveMore, loading],
    (): [boolean, boolean] => [haveMore.get(), loading.get()]
  );

  const fetcherRef = useRef<CrudFetcher<T> | undefined>();

  useEffect(() => {
    setVWC(items, [], (a, b) => a.length === b.length);
    setVWC(loading, true);
    setVWC(haveMore, false);

    fetcherRef.current = new CrudFetcher<T>(
      path,
      keyMap,
      adaptValueWithCallbacksAsSetState(items),
      adaptValueWithCallbacksAsSetState(loading),
      adaptValueWithCallbacksAsSetState(haveMore)
    );
  }, [path, keyMap, haveMore, items, loading]);

  useValueWithCallbacksEffect(filters, () => {
    setVWC(refreshDesired, true, () => false);
    return undefined;
  });

  useEffect(() => {
    if (sortArg === undefined) {
      setVWC(nextSort, []);
      setVWC(refreshDesired, true, () => false);
      return undefined;
    }

    const requestedSort = sortArg;
    let running = true;
    requestedSort.callbacks.add(onRequestedSortChanged);
    onRequestedSortChanged();
    return () => {
      running = false;
      requestedSort.callbacks.remove(onRequestedSortChanged);
    };

    function onRequestedSortChanged() {
      if (!running) {
        return;
      }

      setVWC(nextSort, requestedSort.get());
      setVWC(refreshDesired, true, () => false);
    }
  }, [sortArg, nextSort, refreshDesired]);

  useEffect(() => {
    let refreshCounter = 0;
    let lastSub: string | null = null;
    let running = true;
    let cancelLastFetch: (() => void) | undefined;
    loginContextRaw.value.callbacks.add(considerRefresh);
    refreshDesired.callbacks.add(refresh);
    refresh();
    return () => {
      running = false;
      cancelLastFetch?.();
      cancelLastFetch = undefined;
      loginContextRaw.value.callbacks.remove(considerRefresh);
      refreshDesired.callbacks.remove(refresh);
    };

    function refresh() {
      cancelLastFetch?.();
      cancelLastFetch = undefined;

      const loginContext = loginContextRaw.value.get();
      if (loginContext.state !== 'logged-in') {
        return;
      }

      if (fetcherRef.current === undefined) {
        return;
      }

      if (!running) {
        return;
      }

      lastSub = loginContext.userAttributes.sub;
      const id = ++refreshCounter;
      setVWC(error, null);
      cancelLastFetch = fetcherRef.current.resetAndLoadWithCancelCallback(
        filters.get(),
        sortArg?.get() ?? [],
        fetchLimit,
        loginContext,
        async (e) => {
          if (!running) {
            return;
          }

          const fmted = await describeError(e);
          if (refreshCounter === id && running) {
            setVWC(error, fmted);
          }
        }
      );
    }

    function considerRefresh() {
      const loginContext = loginContextRaw.value.get();
      if (loginContext.state !== 'logged-in') {
        return;
      }

      if (loginContext.userAttributes.sub === lastSub) {
        return;
      }

      refresh();
    }
  }, [refreshDesired, loginContextRaw.value, error, fetchLimit, filters, sortArg]);

  return (
    <div className={styles.container}>
      <div className={styles.description}>{description}</div>
      <RenderGuardedComponent
        props={items}
        component={(items) =>
          items.length === 0 ? (
            <RenderGuardedComponent
              props={loading}
              component={(loading) =>
                loading ? (
                  <div className={styles.loading}>
                    <InlineOsehSpinner size={{ type: 'react-rerender', props: { height: 64 } }} />
                  </div>
                ) : (
                  <div className={combineClasses(styles.items, styles.noItems)}>No results</div>
                )
              }
            />
          ) : (
            <>
              <div className={styles.items}>{itemsComponent({ items, onClick })}</div>
              <RenderGuardedComponent
                props={haveMoreAndLoading}
                component={([haveMore, loading]) =>
                  haveMore ? (
                    <div className={styles.loadMoreContainer}>
                      <Button
                        type="button"
                        variant="outlined-white"
                        fullWidth
                        disabled={loading}
                        onClick={(e) => {
                          e.preventDefault();
                          const loginContext = loginContextRaw.value.get();
                          if (loginContext.state !== 'logged-in') {
                            setVWC(error, <>Not logged in</>);
                            return;
                          }

                          fetcherRef.current?.loadMore(filters.get(), fetchLimit, loginContext, {
                            replace: loadMoreReplaces,
                          });
                        }}>
                        {loadMoreReplaces ? <>Next Page</> : <>Load More</>}
                      </Button>
                    </div>
                  ) : (
                    <></>
                  )
                }
              />
            </>
          )
        }
      />
      <RenderGuardedComponent
        props={error}
        component={(error) =>
          loadMoreReplaces || error ? (
            <div className={styles.resetContainer}>
              <Button
                type="button"
                variant="outlined-white"
                fullWidth
                onClick={(e) => {
                  e.preventDefault();
                  setVWC(refreshDesired, true, () => false);
                }}>
                Reset
              </Button>
            </div>
          ) : (
            <></>
          )
        }
      />
      <RenderGuardedComponent
        props={error}
        component={(error) => (error === null ? <></> : <ErrorBlock>{error}</ErrorBlock>)}
      />
    </div>
  );
};
