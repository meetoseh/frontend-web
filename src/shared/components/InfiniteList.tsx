import { MutableRefObject, ReactElement, useCallback, useEffect, useMemo, useRef } from 'react';
import { InfiniteListing } from '../lib/InfiniteListing';
import styles from './InfiniteList.module.css';
import {
  Callbacks,
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../lib/Callbacks';
import { useValueWithCallbacksEffect } from '../hooks/useValueWithCallbacksEffect';
import { setVWC } from '../lib/setVWC';
import { useMappedValueWithCallbacks } from '../hooks/useMappedValueWithCallbacks';
import { RenderGuardedComponent } from './RenderGuardedComponent';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { useMappedValuesWithCallbacks } from '../hooks/useMappedValuesWithCallbacks';

type InfiniteListProps<T extends object> = {
  /**
   * The listing to use for fetching items. This component will not
   * reset the list, so the reset call should be made before creating
   * this component.
   */
  listing: InfiniteListing<T>;

  /**
   * Determines if two items are logically equal, based on identifiers.
   * This is used to replace an item when it is updated.
   *
   * @param a The first item
   * @param b The second item
   * @returns If the two identify the same server-side item.
   */
  itemComparer: (a: T, b: T) => boolean;

  /**
   * The component which converts from an item to a react element to render
   * within a wrapping component. Most common implementations only need the
   * first two arguments, but the full list and index are provided for when
   * complicated joining is required.
   */
  component: (
    item: ValueWithCallbacks<T>,
    replaceItem: (item: T) => void,
    visible: ValueWithCallbacks<{ items: T[]; index: number }>
  ) => ReactElement;

  /**
   * The height of the listing; listings are always fixed width and height
   * with overflow-y scroll and their scrollbar is jacked
   */
  height: number;

  /**
   * The gap in pixels between items. Items are always full width, but their
   * height is determined by the component.
   */
  gap: number;

  /**
   * The height to use for components whose data is still being loaded but we
   * are pretty confident are there. Reduces jank when scrolling when this value
   * is more accurate.
   */
  initialComponentHeight: number;

  /**
   * Except when `listing.definitelyNoneAbove`, we have this many items which
   * are in the visible list but not actually rendered. This can be used for
   * items which render based on the previous item (i.e., smooth transitions)
   * in order to ensure they have enough context to get a fixed size.
   */
  preloadedAbove?: number;

  /**
   * The element to show if the list is still loading
   */
  loadingElement?: ReactElement;

  /**
   * The element to show if the list is empty
   */
  emptyElement?: ReactElement;
};

/**
 * Uses an infinite listing object to render items within a scrollable
 * container such that the user can scroll down or scroll up seamlessly
 * to load items, so long as there are items to load, without incurring
 * an increasing cost as time goes on.
 */
export function InfiniteList<T extends object>({
  listing: listingUntrackable,
  itemComparer,
  component,
  height,
  gap,
  initialComponentHeight,
  preloadedAbove = 1,
  loadingElement,
  emptyElement,
}: InfiniteListProps<T>): ReactElement {
  const listingVWC = useListingItemsAsVWC(listingUntrackable);
  const elementsVWC = useElementsNoDOM(listingVWC, component, itemComparer);
  const itemsUnloadedAboveVWC = useWritableValueWithCallbacks<number>(() => 0);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  // if the listing changes scroll to the top
  useEffect(() => {
    if (virtuosoRef.current === null || !listingUntrackable.definitelyNoneAbove) {
      return;
    }
    virtuosoRef.current.scrollToIndex({ index: 0, align: 'start' });
  }, [listingUntrackable]);

  const stateVWC = useMappedValueWithCallbacks(
    listingVWC,
    (listing): 'loading' | 'empty' | 'elements' => {
      if (listing.items === null) {
        return 'loading';
      }

      if (listing.items.length === 0) {
        return 'empty';
      }

      return 'elements';
    }
  );

  const numAvailableElementsVWC = useMappedValuesWithCallbacks(
    [listingVWC, elementsVWC, itemsUnloadedAboveVWC],
    () =>
      listingVWC.get().definitelyNoneBelow
        ? elementsVWC.get().length + itemsUnloadedAboveVWC.get()
        : 100_000
  );

  const virtuosoStateVWC = useMappedValuesWithCallbacks(
    [numAvailableElementsVWC],
    () => [numAvailableElementsVWC.get()] as const,
    {
      outputEqualityFn: (a, b) => a[0] === b[0],
    }
  );

  const handleStartReached = useCallback(
    (atStart: boolean) => {
      if (!atStart) {
        return;
      }
      if (!listingUntrackable.definitelyNoneAbove) {
        listingUntrackable.onFirstVisible();
      }
    },
    [listingUntrackable]
  );

  const handleEndReached = useCallback(
    (atEnd: boolean) => {
      if (!atEnd) {
        return;
      }
      if (!listingUntrackable.definitelyNoneBelow) {
        listingUntrackable.onLastVisible();
      }
    },
    [listingUntrackable]
  );

  const handleRangeChanged = useCallback(
    (range: { startIndex: number; endIndex: number }) => {
      if (range.startIndex - preloadedAbove <= itemsUnloadedAboveVWC.get()) {
        handleStartReached(true);
      } else {
        if (range.endIndex >= itemsUnloadedAboveVWC.get() + elementsVWC.get().length - 1) {
          handleEndReached(true);
        }
      }
    },
    [handleStartReached, handleEndReached, elementsVWC, itemsUnloadedAboveVWC, preloadedAbove]
  );

  useEffect(() => {
    listingUntrackable.onShiftedEarlier.add(handleShiftedEarlier);
    listingUntrackable.onShiftedLater.add(handleShiftedLater);
    return () => {
      listingUntrackable.onShiftedEarlier.remove(handleShiftedEarlier);
      listingUntrackable.onShiftedLater.remove(handleShiftedLater);
    };

    function handleShiftedEarlier(items: T[]) {
      setVWC(itemsUnloadedAboveVWC, itemsUnloadedAboveVWC.get() - items.length);
    }

    function handleShiftedLater(items: T[]) {
      setVWC(itemsUnloadedAboveVWC, itemsUnloadedAboveVWC.get() + items.length);
    }
  }, [listingUntrackable, itemsUnloadedAboveVWC]);

  return (
    <div style={{ marginTop: `-${gap}px` }}>
      <RenderGuardedComponent
        props={stateVWC}
        component={(s) => {
          if (loadingElement !== undefined && s === 'loading') {
            return loadingElement;
          }

          if (emptyElement !== undefined && s === 'empty') {
            return emptyElement;
          }

          return (
            <RenderGuardedComponent
              props={virtuosoStateVWC}
              component={([numAvailable]) => {
                return (
                  <Virtuoso
                    ref={virtuosoRef}
                    style={{ height: `${height}px` }}
                    overscan={{ main: 0, reverse: 0 }}
                    itemContent={(index: number) => {
                      const unloadedAbove = itemsUnloadedAboveVWC.get();
                      const indexInElements = index - unloadedAbove;
                      const elems = elementsVWC.get();
                      const inner = (() => {
                        if (
                          indexInElements < 0 ||
                          (unloadedAbove > 0 && indexInElements < preloadedAbove) ||
                          indexInElements >= elems.length
                        ) {
                          return (
                            <div
                              style={{
                                height: `${initialComponentHeight}px`,
                              }}
                              className={styles.loading}>
                              Loading...
                            </div>
                          );
                        }
                        return elems[indexInElements].react;
                      })();
                      return <div style={{ paddingTop: `${gap}px` }}>{inner}</div>;
                    }}
                    totalCount={numAvailable}
                    rangeChanged={handleRangeChanged}
                  />
                );
              }}
            />
          );
        }}
      />
    </div>
  );
}

/**
 * Gets the items within an infinite listing as a value with callbacks.
 */
function useListingItemsAsVWC<T extends object>(
  listing: InfiniteListing<T>
): ValueWithCallbacks<InfiniteListing<T>> {
  const itemsChangedAsStdCallbacksRef = useRef<Callbacks<undefined>>() as MutableRefObject<
    Callbacks<undefined>
  >;
  if (itemsChangedAsStdCallbacksRef.current === undefined) {
    itemsChangedAsStdCallbacksRef.current = new Callbacks();
  }
  useEffect(() => {
    listing.itemsChanged.add(doCall);
    return () => {
      listing.itemsChanged.remove(doCall);
    };

    function doCall() {
      itemsChangedAsStdCallbacksRef.current.call(undefined);
    }
  }, [listing.itemsChanged]);

  return useMemo(
    (): ValueWithCallbacks<InfiniteListing<T>> => ({
      get: () => listing,
      callbacks: itemsChangedAsStdCallbacksRef.current,
    }),
    [listing]
  );
}

type ItemElement<T> = {
  react: ReactElement;
  item: WritableValueWithCallbacks<T>;
  items: WritableValueWithCallbacks<{ items: T[]; index: number }>;
};

function useElementsNoDOM<T extends object>(
  listingVWC: ValueWithCallbacks<InfiniteListing<T>>,
  component: InfiniteListProps<T>['component'],
  itemComparer: InfiniteListProps<T>['itemComparer']
): ValueWithCallbacks<ItemElement<T>[]> {
  const resultPackedVWC = useWritableValueWithCallbacks<ItemElement<T>[]>(() => []);

  useValueWithCallbacksEffect(
    listingVWC,
    useCallback(
      (listing) => {
        const items = listing.items ?? [];
        const old = resultPackedVWC.get();

        const result: ItemElement<T>[] = [];
        for (let i = 0; i < items.length && i < old.length; i++) {
          setVWC(old[i].item, items[i]);
          setVWC(old[i].items, { items, index: i });
          result.push(old[i]);
        }
        for (let i = result.length; i < items.length; i++) {
          const newItem = createWritableValueWithCallbacks(items[i]);
          const newItems = createWritableValueWithCallbacks({ items, index: i });
          const newReact = (
            <div className={styles.item}>
              {component(
                newItem,
                (newValue) => {
                  listing.replaceItem(itemComparer.bind(undefined, newItem.get()), newValue);
                },
                newItems
              )}
            </div>
          );
          result.push({ react: newReact, item: newItem, items: newItems });
        }

        setVWC(resultPackedVWC, result);
        return undefined;
      },
      [resultPackedVWC, component, itemComparer]
    )
  );

  return resultPackedVWC;
}
