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
   * within a wrapping component. We will not attempt to render the first
   * or last item that is loaded, meaning that the next and previous item
   * is always available unless the item is the first or last in the list.
   */
  component: (
    item: ValueWithCallbacks<T>,
    replaceItem: (item: T) => void,
    previous: ValueWithCallbacks<T | null>,
    next: ValueWithCallbacks<T | null>
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
  loadingElement,
  emptyElement,
}: InfiniteListProps<T>): ReactElement {
  const listingVWC = useListingItemsAsVWC(listingUntrackable);
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
    [listingVWC, itemsUnloadedAboveVWC],
    () =>
      listingVWC.get().definitelyNoneBelow
        ? (listingVWC.get().items?.length ?? 0) + itemsUnloadedAboveVWC.get()
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
    ({ startIndex, endIndex }: { startIndex: number; endIndex: number }) => {
      if (
        listingUntrackable.items === null ||
        listingUntrackable.items.length < listingUntrackable.visibleLimit
      ) {
        return;
      }

      const nearness = Math.max(endIndex - startIndex, 1) * 10;

      let loadedStartIndex = itemsUnloadedAboveVWC.get();
      if (loadedStartIndex > 0) {
        // we don't want to render the first item as it wouldn't have
        // the correct neighbor
        loadedStartIndex += 1;
      }

      let loadedEndIndex = itemsUnloadedAboveVWC.get() + listingUntrackable.items.length;
      if (!listingUntrackable.definitelyNoneBelow) {
        // we don't want to render the last item as it wouldn't have
        // the correct neighbor
        loadedEndIndex -= 1;
      }

      if (startIndex <= loadedStartIndex + nearness) {
        handleStartReached(true);
      } else {
        if (endIndex >= loadedEndIndex - nearness) {
          handleEndReached(true);
        }
      }
    },
    [handleStartReached, handleEndReached, itemsUnloadedAboveVWC, listingUntrackable]
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
                      return (
                        <div style={{ paddingTop: `${gap}px` }}>
                          <ElementFromListing
                            listingVWC={listingVWC}
                            unloadedAboveVWC={itemsUnloadedAboveVWC}
                            height={initialComponentHeight}
                            index={index}
                            component={component}
                            itemComparer={itemComparer}
                          />
                        </div>
                      );
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

const ElementFromListing = <T extends object>({
  listingVWC,
  unloadedAboveVWC,
  height,
  index,
  component,
  itemComparer,
}: {
  listingVWC: ValueWithCallbacks<InfiniteListing<T>>;
  unloadedAboveVWC: ValueWithCallbacks<number>;
  height: number;
  index: number;
  component: InfiniteListProps<T>['component'];
  itemComparer: InfiniteListProps<T>['itemComparer'];
}) => {
  const itemAndNeighbors = useMappedValuesWithCallbacks(
    [listingVWC, unloadedAboveVWC],
    (): {
      item: T;
      previous: T | null;
      next: T | null;
    } | null => {
      const listing = listingVWC.get();
      const unloadedAbove = unloadedAboveVWC.get();
      if (listing.items === null) {
        return null;
      }

      const realIndex = index - unloadedAbove;
      if (realIndex < 0 || realIndex >= listing.items.length) {
        return null;
      }

      if (!listing.definitelyNoneAbove && realIndex === 0) {
        return null;
      }

      if (!listing.definitelyNoneBelow && realIndex === listing.items.length - 1) {
        return null;
      }

      return {
        item: listing.items[realIndex],
        previous: realIndex === 0 ? null : listing.items[realIndex - 1],
        next: realIndex === listing.items.length - 1 ? null : listing.items[realIndex + 1],
      };
    }
  );

  const haveData = useMappedValueWithCallbacks(itemAndNeighbors, (v) => v !== null);

  return (
    <RenderGuardedComponent
      props={haveData}
      component={(haveData) => (
        <ElementFromListingHaveData
          haveData={haveData}
          itemAndNeighbors={itemAndNeighbors}
          height={height}
          component={component}
          itemComparer={itemComparer}
          listingVWC={listingVWC}
        />
      )}
    />
  );
};

const ElementFromListingHaveData = <T extends object>({
  haveData,
  itemAndNeighbors,
  height,
  component,
  itemComparer,
  listingVWC,
}: {
  haveData: boolean;
  itemAndNeighbors: ValueWithCallbacks<{
    item: T;
    previous: T | null;
    next: T | null;
  } | null>;
  height: number;
  component: InfiniteListProps<T>['component'];
  itemComparer: InfiniteListProps<T>['itemComparer'];
  listingVWC: ValueWithCallbacks<InfiniteListing<T>>;
}) => {
  const initialItemAndNeighbors = itemAndNeighbors.get();
  const item = useWritableValueWithCallbacks<T | undefined>(() => initialItemAndNeighbors?.item);
  const previous = useWritableValueWithCallbacks<T | undefined | null>(
    () => initialItemAndNeighbors?.previous
  );
  const next = useWritableValueWithCallbacks<T | undefined | null>(
    () => initialItemAndNeighbors?.next
  );

  useValueWithCallbacksEffect(itemAndNeighbors, (v) => {
    if (v !== null) {
      setVWC(item, v.item, Object.is);
      setVWC(previous, v.previous, Object.is);
      setVWC(next, v.next, Object.is);
    }
    return undefined;
  });

  if (!haveData || initialItemAndNeighbors === null) {
    return <LoadingElement height={height} />;
  }

  return component(
    item as WritableValueWithCallbacks<T>,
    (newItem) => {
      listingVWC.get().replaceItem(itemComparer.bind(undefined, item.get() as T), newItem);
    },
    previous as WritableValueWithCallbacks<T | null>,
    next as WritableValueWithCallbacks<T | null>
  );
};

const LoadingElement = ({ height }: { height: number }) => {
  return (
    <div
      style={{
        height: `${height}px`,
      }}
      className={styles.loading}>
      Loading...
    </div>
  );
};
