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
import {
  useMappedDeltaValueWithCallbacks,
  useMappedValueWithCallbacks,
} from '../hooks/useMappedValueWithCallbacks';
import { RenderGuardedComponent } from './RenderGuardedComponent';

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
   * Components heights are updated one render later than they normally would be
   * by wrapping them in a position absolute container with a fixed width and
   * height and a overflow-y auto. When a scrollbar is detected on a component,
   * the height will be updated to remove the scrollbar at the same time that
   * the other components are repositioned, in such a way that causes the
   * minimum amount of visual disruption.
   *
   * If an element is off-screen, i.e., it's above or below the viewport, this
   * causes no visual shift at all.
   *
   * This value is the height we assume when a new component is added to the
   * list. Settings a value which is often correct here improves performance,
   * but does not affect correctness.
   */
  initialComponentHeight: number;

  /**
   * If specified, items are keyed by this function. This can be useful if
   * the component is doing some level of lazy loading.
   *
   * The default implementation is (_, idx) => idx.toString()
   *
   * @param item The item to get the key for
   * @param idx The index of the item in the list
   * @returns The key for the item
   */
  keyFn?: (item: T, idx: number) => string;

  /**
   * The element to show if the list is still loading
   */
  loadingElement?: ReactElement;

  /**
   * The element to show if the list is empty
   */
  emptyElement?: ReactElement;
};

type ScrollPaddingValue = {
  top: number;
  bottom: number;
};
const scrollPaddingEqualityFn = (a: ScrollPaddingValue, b: ScrollPaddingValue) =>
  a.top === b.top && a.bottom === b.bottom;

/**
 * Uses an infinite listing object to render items within a scrollable
 * container such that the user can scroll down or scroll up seamlessly
 * to load items, so long as there are items to load, without incurring
 * an increasing cost as time goes on.
 *
 * This element could be swapped with libraries like `react-window` or
 * `react-virtuoso`. In terms of implementation, this is implemented like
 * `react-virtuoso`, but rather than attaching listeners to all the children
 * to detect whenever their heights change, this assumes heights only change
 * if the listing.items are rotated. This could be extended to whenever
 * listing.items changes at all if user interaction is changing heights.
 */
export function InfiniteList<T extends object>({
  listing,
  itemComparer,
  component,
  height,
  gap,
  initialComponentHeight,
  loadingElement,
  emptyElement,
  keyFn,
}: InfiniteListProps<T>): ReactElement {
  const itemsVWC = useListingItemsAsVWC(listing);
  const elementsVWC = useElements(itemsVWC, component, itemComparer, keyFn, listing);
  const heightsVWC = useElementHeights(elementsVWC);
  /*
   * Scroll padding is specifically for ios; we could not have it and it'd still work on android.
   * It's only necessary because safari doesn't support scroll anchoring
   */
  const scrollPaddingVWC = useWritableValueWithCallbacks<ScrollPaddingValue>(() => ({
    top: 0,
    bottom: 0,
  }));

  const listRef = useRef<HTMLDivElement>(null);
  const paddingTopRef = useRef<HTMLDivElement>(null);
  const paddingBottomRef = useRef<HTMLDivElement>(null);

  // when listing changes, go back to the top
  useEffect(() => {
    if (listRef.current === null) {
      return;
    }
    const list = listRef.current;

    if (!listing.definitelyNoneAbove) {
      // didn't really swap lists
      return;
    }

    setVWC(
      scrollPaddingVWC,
      { top: 0, bottom: listing.definitelyNoneBelow ? 20 : 500 },
      scrollPaddingEqualityFn
    );
    list.scrollTo({ top: 0, behavior: 'auto' });
  }, [listing, scrollPaddingVWC]);

  // After the items change, the elements will be updated and then the heights,
  // all before this callback. Thus to get this callback to be called precisely
  // once its sufficient to just use itemsVWC as the trigger.
  const itemsElementsAndHeights = useMappedValueWithCallbacks(
    itemsVWC,
    useCallback(
      () => ({
        items: itemsVWC.get(),
        elements: elementsVWC.get(),
        heights: heightsVWC.get(),
      }),
      [itemsVWC, elementsVWC, heightsVWC]
    )
  );

  // when rendering after listing.items changes, if listing.items is a simple
  // rotation of the list, visually maintain the scroll position.
  useMappedDeltaValueWithCallbacks(itemsElementsAndHeights, (old, updated) => {
    if (
      old === undefined ||
      old.items === null ||
      updated.items === null ||
      listRef.current === null
    ) {
      return;
    }

    const list = listRef.current;
    if (old.items.length !== updated.items.length) {
      return;
    }

    if (!checkDownRotation()) {
      checkUpRotation();
    }

    if (listing.definitelyNoneAbove) {
      setVWC(
        scrollPaddingVWC,
        { top: 0, bottom: scrollPaddingVWC.get().bottom },
        scrollPaddingEqualityFn
      );
    }

    if (listing.definitelyNoneBelow) {
      setVWC(
        scrollPaddingVWC,
        { top: scrollPaddingVWC.get().top, bottom: 20 },
        scrollPaddingEqualityFn
      );
    } else {
      setVWC(scrollPaddingVWC, { top: scrollPaddingVWC.get().top, bottom: 500 });
    }
    return;

    function checkDownRotation(): boolean {
      if (old === undefined || old.items === null || updated.items === null) {
        return false;
      }

      for (let i = 1; i <= listing.rotationLength; i++) {
        if (old.items[0] === updated.items[i]) {
          handleDownRotation(i);
          return true;
        }
      }
      return false;
    }

    function handleDownRotation(amt: number) {
      // We rotated items down amt index. This means we added an item to the
      // top of the list that takes up space, meaning we need less space in our
      // padding above.

      // We will take the space created by the new item and reduce the padding
      // above by that amount

      let adjustment: number;
      if (
        old === undefined ||
        old.heights.some((h) => h === null) ||
        updated.heights.some((h) => h === null)
      ) {
        const topOfFirstAddedItem = list.children[1].getBoundingClientRect().top;
        const bottomOfLastAddedItem = list.children[amt].getBoundingClientRect().bottom + gap;
        adjustment = topOfFirstAddedItem - bottomOfLastAddedItem;
      } else {
        const idxOfTopInOld = 5;
        const idxOfTopInNew = idxOfTopInOld + amt;

        const yBefore = computeTopUsingHeights(0, old.heights as number[], idxOfTopInOld);
        const yAfter = computeTopUsingHeights(0, updated.heights as number[], idxOfTopInNew);

        adjustment = yBefore - yAfter;
      }

      setVWC(
        scrollPaddingVWC,
        {
          top: Math.max(scrollPaddingVWC.get().top + adjustment, 0),
          bottom: scrollPaddingVWC.get().bottom,
        },
        scrollPaddingEqualityFn
      );
    }

    function checkUpRotation(): boolean {
      if (old === undefined || old.items === null || updated.items === null) {
        return false;
      }

      for (let i = 1; i <= listing.rotationLength; i++) {
        if (old.items[i] === updated.items[0]) {
          handleUpRotation(i);
          return true;
        }
      }
      return false;
    }

    function handleUpRotation(amt: number) {
      // We rotated items up amt index, meaning we removed an item from the
      // top of the list, so theres less real space there, so we need more
      // padding above.
      let heightRemoved = 0;
      if (
        old === undefined ||
        old.items === null ||
        old.heights.some((h) => h === null) ||
        updated.heights.some((h) => h === null)
      ) {
        heightRemoved = (initialComponentHeight + gap) * amt;
      } else {
        const idxOfBottomInOld = old.items.length - 1;
        const idxOfBottomInNew = old.items.length - 1 - amt;

        const yBefore = computeTopUsingHeights(0, old.heights as number[], idxOfBottomInOld);
        const yAfter = computeTopUsingHeights(0, updated.heights as number[], idxOfBottomInNew);

        heightRemoved = yBefore - yAfter;
      }
      const adjustment = heightRemoved;
      setVWC(
        scrollPaddingVWC,
        {
          top: scrollPaddingVWC.get().top + adjustment,
          bottom: scrollPaddingVWC.get().bottom,
        },
        scrollPaddingEqualityFn
      );
    }

    function computeTopUsingHeights(padding: number, heights: number[], idx: number) {
      let y = padding;
      for (let i = 0; i < idx; i++) {
        y += heights[i] + gap;
      }
      return y;
    }
  });

  // call onFirstVisible/onLastVisible as appropriate when the scroll changes
  // the items change
  useEffect(() => {
    if (listRef.current === undefined || listRef.current === null) {
      return;
    }
    if (listing === null) {
      return;
    }

    const list = listRef.current;
    let waitingForItemsChanged = false;
    let waitingForFrame = false;
    let waitingForItemsChangedTimeout: NodeJS.Timeout | null = null;
    let scrollWaitingForFrame = false;
    let locked = false;

    let active = true;
    itemsVWC.callbacks.add(onItemsChanged);
    list.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (active) {
        active = false;
        itemsVWC.callbacks.remove(onItemsChanged);
        list.removeEventListener('scroll', onScroll, { capture: false });
        if (waitingForItemsChangedTimeout !== null) {
          clearTimeout(waitingForItemsChangedTimeout);
          waitingForItemsChangedTimeout = null;
        }
      }
    };

    function checkVisible() {
      if (!active) {
        return;
      }

      if (list.children.length < 6) {
        return;
      }

      const items = listing.items;
      if (items === null) {
        return;
      }

      if (waitingForItemsChanged || waitingForFrame || scrollWaitingForFrame || locked) {
        return;
      }

      locked = true;
      try {
        const listRect = list.getBoundingClientRect();
        const fifthItem = list.children[5].getBoundingClientRect();
        const lastItem = list.children[list.children.length - 2].getBoundingClientRect();

        let triggerTop = fifthItem.bottom > listRect.top && !listing.definitelyNoneAbove;
        let triggerBottom = lastItem.top < listRect.bottom && !listing.definitelyNoneBelow;

        if (triggerTop || triggerBottom) {
          waitingForItemsChanged = true;
          waitingForItemsChangedTimeout = setTimeout(() => {
            waitingForItemsChangedTimeout = null;
            waitingForItemsChanged = false;
            checkVisible();
          }, 1000);
        }

        if (triggerTop) {
          listing.onFirstVisible();
        }
        if (triggerBottom) {
          listing.onLastVisible();
        }
      } finally {
        locked = false;
      }
    }

    function onScroll() {
      checkVisible();
    }

    function onItemsChanged() {
      if (waitingForItemsChanged) {
        if (waitingForItemsChangedTimeout !== null) {
          clearTimeout(waitingForItemsChangedTimeout);
          waitingForItemsChangedTimeout = null;
        }
        waitingForItemsChanged = false;
        waitingForFrame = true;
        requestAnimationFrame(() => {
          // This is the first frame we've likely rendered the items
          requestAnimationFrame(() => {
            waitingForFrame = false;
            checkVisible();
          });
        });
      }

      checkVisible();
    }
  }, [height, gap, listing, itemsVWC]);

  // Changing scrollPadding immediately effects the corresponding elements
  useEffect(() => {
    if (
      paddingBottomRef.current === null ||
      paddingTopRef.current === null ||
      listRef.current === null
    ) {
      return;
    }
    const paddingBottom = paddingBottomRef.current;
    const paddingTop = paddingTopRef.current;

    paddingBottom.style.width = '100%';
    paddingTop.style.width = '100%';

    let active = true;
    updateStyles();
    scrollPaddingVWC.callbacks.add(updateStyles);
    return () => {
      if (active) {
        active = false;
        scrollPaddingVWC.callbacks.remove(updateStyles);
      }
    };

    function updateStyles() {
      if (!active) {
        return;
      }

      const top = scrollPaddingVWC.get().top;
      const bottom = scrollPaddingVWC.get().bottom;
      const expectedTop = `${top}px`;
      const expectedBottom = `${bottom}px`;

      if (
        paddingBottom.style.minHeight === expectedBottom &&
        paddingTop.style.minHeight === expectedTop
      ) {
        return;
      }

      paddingBottom.style.minHeight = expectedBottom;
      paddingTop.style.minHeight = expectedTop;
    }
  }, [scrollPaddingVWC]);

  const listStyle = useMemo<React.CSSProperties>(() => {
    return {
      height: `${height}px`,
    };
  }, [height]);

  const stateVWC = useMappedValueWithCallbacks(
    itemsVWC,
    (items): 'loading' | 'empty' | 'elements' => {
      if (items === null) {
        return 'loading';
      }

      if (items.length === 0) {
        return 'empty';
      }

      return 'elements';
    }
  );

  return (
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
            props={elementsVWC}
            component={(elements) => (
              <div style={listStyle} className={styles.container} ref={listRef}>
                <div ref={paddingTopRef}></div>
                {elements.map((el) => el.react)}
                <div ref={paddingBottomRef}></div>
              </div>
            )}
          />
        );
      }}
    />
  );
}

/**
 * Gets the items within an infinite listing as a value with callbacks.
 */
function useListingItemsAsVWC<T extends object>(
  listing: InfiniteListing<T>
): ValueWithCallbacks<T[] | null> {
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
    (): ValueWithCallbacks<T[] | null> => ({
      get: () => listing.items,
      callbacks: itemsChangedAsStdCallbacksRef.current,
    }),
    [listing]
  );
}

/**
 * Converts the given items to react elements, with refs to the underlying dom
 * elements (when the react elements are mounted).
 */
function useElements<T extends object>(
  items: ValueWithCallbacks<T[] | null>,
  component: InfiniteListProps<T>['component'],
  itemComparer: InfiniteListProps<T>['itemComparer'],
  keyFn: InfiniteListProps<T>['keyFn'],
  listing: InfiniteListing<T>
): ValueWithCallbacks<{ react: ReactElement; dom: HTMLDivElement | null }[]> {
  const resultPackedVWC = useWritableValueWithCallbacks<
    {
      react: ReactElement;
      dom: WritableValueWithCallbacks<HTMLDivElement | null>;
      item: WritableValueWithCallbacks<T>;
      items: WritableValueWithCallbacks<{ items: T[]; index: number }>;
    }[]
  >(() => []);

  useValueWithCallbacksEffect(
    items,
    useCallback(
      (items) => {
        items = items ?? [];
        const old = resultPackedVWC.get();

        const result = [];
        for (let i = 0; i < items.length && i < old.length; i++) {
          setVWC(old[i].item, items[i]);
          setVWC(old[i].items, { items, index: i });
        }
        for (let i = result.length; i < items.length; i++) {
          const newItem = createWritableValueWithCallbacks(items[i]);
          const newItems = createWritableValueWithCallbacks({ items, index: i });
          const newDOM = createWritableValueWithCallbacks<HTMLDivElement | null>(null);
          const newReact = (
            <div
              className={styles.item}
              ref={(r) => setVWC(newDOM, r)}
              key={keyFn === undefined ? i.toString() : keyFn(items[i], i)}>
              {component(
                newItem,
                (newValue) => {
                  listing.replaceItem(itemComparer.bind(undefined, newItem.get()), newValue);
                },
                newItems
              )}
            </div>
          );
          result.push({ react: newReact, dom: newDOM, item: newItem, items: newItems });
        }

        setVWC(resultPackedVWC, result);
        return undefined;
      },
      [resultPackedVWC, component, itemComparer, keyFn, listing]
    )
  );

  const resultVWC = useWritableValueWithCallbacks<
    {
      react: ReactElement;
      dom: HTMLDivElement | null;
    }[]
  >(() => []);

  useValueWithCallbacksEffect(resultPackedVWC, (packed) => {
    const cancelers = new Callbacks<undefined>();
    registerInnerListeners();
    updateResult();
    return () => cancelers.call(undefined);

    function registerInnerListeners() {
      packed.forEach((p) => {
        p.dom.callbacks.add(updateResult);
        cancelers.add(() => p.dom.callbacks.remove(updateResult));
      });
    }

    function updateResult() {
      setVWC(
        resultVWC,
        packed.map((p) => ({ react: p.react, dom: p.dom.get() }))
      );
    }
  });

  return resultVWC;
}

function arrEqualityFn<T>(a: T[], b: T[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function useElementHeights(
  elements: ValueWithCallbacks<{ react: ReactElement; dom: HTMLDivElement | null }[]>
): ValueWithCallbacks<(number | null)[]> {
  const resultVWC = useWritableValueWithCallbacks<(number | null)[]>(() => []);

  useValueWithCallbacksEffect(elements, (elements) => {
    const cancelers = new Callbacks<undefined>();
    registerInnerListeners();
    updateResult();
    return () => cancelers.call(undefined);

    function registerInnerListeners() {
      if (!window.ResizeObserver) {
        return;
      }

      elements.forEach((element) => {
        if (element === null || element.dom === null) {
          return;
        }

        const observer = new ResizeObserver(() => {
          updateResult();
        });
        observer.observe(element.dom);
        cancelers.add(() => observer.disconnect());
      });
    }

    function updateResult() {
      setVWC(
        resultVWC,
        elements.map((e) => {
          if (e.dom === null) {
            return null;
          }
          const bounds = e.dom.getBoundingClientRect();
          return bounds.height;
        }),
        arrEqualityFn
      );
    }
  });

  return resultVWC;
}
