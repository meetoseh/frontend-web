import { MutableRefObject, ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { InfiniteListing } from '../lib/InfiniteListing';
import styles from './InfiniteList.module.css';
import { Callbacks } from '../lib/Callbacks';

type InfiniteListProps<T> = {
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
   * within a wrapping coponent. Most common implementations only need the
   * first two arguments, but the full list and index are provided for when
   * complicated joining is required.
   */
  component: (item: T, setItem: (newItem: T) => void, items: T[], index: number) => ReactElement;

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

type ScrollPadding = {
  value: ScrollPaddingValue;
  changed: Callbacks<ScrollPaddingValue>;
  set: (value: ScrollPaddingValue) => void;
};

/**
 * Uses an infinite listing object to render items within a scrollable
 * container such that the user can scroll down or scroll up seamlessly
 * to load items, so long as there are items to load, without incurring
 * an increasing cost as time goes on.
 *
 */
export function InfiniteList<T>({
  listing,
  itemComparer,
  component,
  height,
  gap,
  initialComponentHeight,
  loadingElement,
  emptyElement,
}: InfiniteListProps<T>): ReactElement {
  const items = listing.items;

  const setItemsCounter = useState(0)[1];
  const oldItemsRef = useRef<T[]>([]);

  const scrollPadding = useRef<ScrollPadding>() as MutableRefObject<ScrollPadding>;
  if (scrollPadding.current === undefined) {
    scrollPadding.current = {
      value: { top: 0, bottom: 0 },
      changed: new Callbacks(),
      set: (value) => {
        scrollPadding.current.value = value;
        scrollPadding.current.changed.call(value);
      },
    };
  }

  const listRef = useRef<HTMLDivElement>(null);
  const paddingTopRef = useRef<HTMLDivElement>(null);
  const paddingBottomRef = useRef<HTMLDivElement>(null);

  // ensure listing or listing.items changes triggers a rerender
  useEffect(() => {
    const onItemsChanged = () => {
      setItemsCounter((c) => c + 1);
    };

    listing.itemsChanged.add(onItemsChanged);
    return () => {
      listing.itemsChanged.remove(onItemsChanged);
    };
  }, [listing, setItemsCounter]);

  // when rendering after listing.items changes, if listing.items is a simple
  // rotation of the list, visually maintain the scroll position.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (items === null) {
      oldItemsRef.current = [];
      return;
    }

    const oldItems = oldItemsRef.current;
    if (items.length !== oldItems.length) {
      oldItemsRef.current = items;
      return;
    }

    if (oldItems[0] === items[1]) {
      // We rotated items down one index. This means we added an item to the
      // top of the list that takes up space, meaning we need less space in our
      // padding above.

      // We will take the space created by the new item and reduce the padding
      // above by that amount
      const adjustment = -initialComponentHeight - gap;
      scrollPadding.current.set({
        top: Math.max(scrollPadding.current.value.top + adjustment, 0),
        bottom: scrollPadding.current.value.bottom,
      });
    } else if (oldItems[1] === items[0]) {
      // We rotated items up one index, meaning we removed an item from the
      // top of the list, so theres less real space there, so we need more
      // padding above.
      const adjustment = initialComponentHeight + gap;
      scrollPadding.current.set({
        top: scrollPadding.current.value.top + adjustment,
        bottom: scrollPadding.current.value.bottom,
      });
    }

    if (listing.definitelyNoneAbove) {
      if (scrollPadding.current.value.top !== 0) {
        scrollPadding.current.set({ top: 0, bottom: scrollPadding.current.value.bottom });
      }
    }

    if (listing.definitelyNoneBelow) {
      if (scrollPadding.current.value.bottom !== 20) {
        scrollPadding.current.set({ top: scrollPadding.current.value.top, bottom: 20 });
      }
    } else {
      if (scrollPadding.current.value.bottom !== 500) {
        scrollPadding.current.set({ top: scrollPadding.current.value.top, bottom: 500 });
      }
    }

    oldItemsRef.current = items;
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
    listing.itemsChanged.add(onItemsChanged);
    list.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (active) {
        active = false;
        listing.itemsChanged.remove(onItemsChanged);
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

      if (list.children.length < 4) {
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
        const firstItem = list.children[1].getBoundingClientRect();
        const lastItem = list.children[list.children.length - 2].getBoundingClientRect();

        let triggerTop = firstItem.bottom > listRect.top && !listing.definitelyNoneAbove;
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
  }, [height, gap, listing]);

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
    const list = listRef.current;

    let active = true;
    updateStyles();
    scrollPadding.current.changed.add(updateStyles);
    return () => {
      if (active) {
        active = false;
        scrollPadding.current.changed.remove(updateStyles);
      }
    };

    function updateStyles() {
      if (!active) {
        return;
      }

      const top = scrollPadding.current.value.top;
      const bottom = scrollPadding.current.value.bottom;
      const expectedTop = `${top}px`;
      const expectedBottom = `${bottom}px`;

      if (
        paddingBottom.style.minHeight === expectedBottom &&
        paddingTop.style.minHeight === expectedTop
      ) {
        return;
      }

      const rerender = () =>
        list.offsetHeight +
        list.scrollHeight +
        paddingBottom.offsetHeight +
        paddingBottom.scrollHeight;

      rerender();
      list.style.overflowAnchor = 'none';
      rerender();
      paddingBottom.style.minHeight = expectedBottom;
      paddingTop.style.minHeight = expectedTop;
      rerender();
      list.style.removeProperty('overflow-anchor');
      rerender();
    }
  }, []);

  const listStyle = useMemo<React.CSSProperties>(() => {
    return {
      height: `${height}px`,
    };
  }, [height]);

  const replaceItemByIndex = useMemo<((newItem: T) => void)[]>(() => {
    if (items === null) {
      return [];
    }

    return items.map((item) => {
      return (newItem: T) => {
        listing.replaceItem((oldItem) => itemComparer(oldItem, item), newItem);
      };
    });
  }, [listing, items, itemComparer]);

  const firstItemStyle = useMemo<React.CSSProperties>(() => {
    if (items === null || listing.definitelyNoneAbove) {
      return {};
    }
    return {
      minHeight: `${initialComponentHeight}px`,
      maxHeight: `${initialComponentHeight}px`,
      overflowY: 'hidden',
    };
  }, [items, listing, initialComponentHeight]);

  if (loadingElement !== undefined && items === null) {
    return loadingElement;
  }

  if (emptyElement !== undefined && items?.length === 0) {
    return emptyElement;
  }

  return (
    <div style={listStyle} className={styles.container} ref={listRef}>
      <div
        style={{ width: '100%', minHeight: scrollPadding.current.value.top }}
        ref={paddingTopRef}></div>
      {items?.map((item, index) => {
        return (
          <div key={index} className={styles.item} style={index === 0 ? firstItemStyle : undefined}>
            {component(item, replaceItemByIndex[index], items, index)}
          </div>
        );
      })}
      <div
        style={{ width: '100%', minHeight: scrollPadding.current.value.bottom }}
        ref={paddingBottomRef}></div>
    </div>
  );
}
