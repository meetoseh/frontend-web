import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InfiniteListing } from '../lib/InfiniteListing';
import styles from './InfiniteList.module.css';

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

const scrollPaddingAbove = 500;

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
  const itemsLoaded = items !== null;
  const numItems = items?.length ?? 0;
  const scrollPaddingBelow = height;

  // The scroll on the list container. The element is marked scrollable,
  // but scrolling is blocked and instead we listen to the scroll event
  // to update this value.
  const [scrollY, setScrollY] = useState(0);
  const setItemsCounter = useState(0)[1];
  const [itemHeights, setItemHeights] = useState<number[]>([]);
  const oldItemsRef = useRef<T[]>([]);
  const fixHeights = useRef(false);
  const fixHeightsTimeout = useRef<NodeJS.Timeout | null>(null);
  const scrollPreventedUntilScrollYDiffersFrom = useRef<number | null>(null);

  const listRef = useRef<HTMLDivElement>(null);

  const updateScrollY = useCallback(
    (delta: number) => {
      setScrollY((y) => {
        y += delta;

        if (listing.definitelyNoneBelow && listRef.current !== null) {
          y = Math.min(y, listRef.current.scrollHeight);
        }

        if (listing.definitelyNoneAbove) {
          y = Math.max(y, 0);
        }
        return y;
      });
    },
    [listing]
  );

  // ensure listing or listing.items changes triggers a rerender
  useEffect(() => {
    const onItemsChanged = () => {
      setItemsCounter((c) => c + 1);
      updateScrollY(0);
    };

    listing.itemsChanged.add(onItemsChanged);
    return () => {
      listing.itemsChanged.remove(onItemsChanged);
    };
  }, [listing, updateScrollY, setItemsCounter]);

  // when rendering after listing.items changes, if listing.items is a simple
  // rotation of the list, visually maintain the scroll position. this needs to
  // happen before the element heights calculation, as element heights will need
  // to be updated in the following tick.
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
      // top of the list.

      // I'm not sure why oldItems[0] + gap is not correct, but when we're
      // actually infinite scrolling the correct adjustment here appears to
      // always be the same. i suspect it's because it works when the sizes
      // dont change, and when the sizes do change they counterbalance each
      // other
      let adjustment = initialComponentHeight + gap;
      let newHeights = [initialComponentHeight, ...itemHeights.slice(0, -1)];

      updateScrollY(adjustment);
      setItemHeights(newHeights);
    } else if (oldItems[1] === items[0]) {
      // We rotated items up one index, meaning we removed an item from the
      // top of the list.
      updateScrollY(-itemHeights[0] - gap);
      setItemHeights([...itemHeights.slice(1), initialComponentHeight]);
    }

    if (fixHeightsTimeout.current !== null) {
      clearTimeout(fixHeightsTimeout.current);
    }
    fixHeightsTimeout.current = setTimeout(() => {
      fixHeights.current = true;
      setItemsCounter((c) => c + 1);
    }, 35);

    if (listRef.current !== null) {
      listRef.current.scrollTop = scrollPaddingAbove;
    }

    oldItemsRef.current = items;
  });

  // when element heights change, give them more space and update the scroll.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!itemsLoaded) {
      return;
    }

    const list = listRef.current;
    if (list === undefined || list === null) {
      return;
    }

    if (list.children.length !== items.length + 2) {
      return;
    }

    if (items.length !== itemHeights.length) {
      // we don't want to update the scrollbar on first load, so this
      // is the trivial case
      const newHeights: number[] = [];
      for (let i = 1; i < list.children.length - 1; i++) {
        newHeights.push(list.children[i].scrollHeight);
      }
      setItemHeights(newHeights);
      return;
    }

    // whenever we're changing the height of something which is above
    // the viewport, move the scrollY down by the same amount
    // The scrollPaddingAbove is canceled out by the scrollTop, so for determining
    // where a component is within the viewport we ignore it.
    let scrollChange = 0;
    let changed = false;
    let y = -scrollY;
    const newHeights: number[] = [];
    for (let i = 1; i < list.children.length - 1; i++) {
      const newHeight = list.children[i].scrollHeight;
      if (newHeight !== itemHeights[i - 1]) {
        changed = true;
        if (y + newHeight < 0) {
          const change = newHeight - itemHeights[i - 1];
          scrollChange += change;
        }
      }
      newHeights.push(newHeight);
      y += newHeight + gap;
    }
    if (changed && fixHeights.current) {
      updateScrollY(scrollChange);
      setItemHeights(newHeights);
    }
    fixHeights.current = false;
  });

  // call onFirstVisible/onLastVisible as appropriate when the scroll changes
  // the items change
  useEffect(() => {
    if (
      items === null ||
      itemHeights.length !== items.length ||
      items.length < listing.visibleLimit
    ) {
      return;
    }

    if (scrollPreventedUntilScrollYDiffersFrom.current === scrollY) {
      return;
    }

    // The scrollPaddingAbove is canceled out by the scrollTop, so for determining
    // where a component is within the viewport we ignore it.
    let y = -scrollY;
    let triggered = false;
    for (let i = 0; i < items.length; i++) {
      const itemHeight = itemHeights[i];

      if (i === 0 && y + height > 0) {
        listing.onFirstVisible();
        triggered = true;
      }
      if (i === items.length - 1 && y < height) {
        listing.onLastVisible();
        triggered = true;
      }

      y += itemHeight + gap;
    }

    if (triggered) {
      scrollPreventedUntilScrollYDiffersFrom.current = scrollY;
    } else {
      scrollPreventedUntilScrollYDiffersFrom.current = null;
    }
  }, [scrollY, items, itemHeights, height, gap, listing]);

  // scrolling the list only changes scrollY, not the real scroll position
  useEffect(() => {
    const list = listRef.current;
    if (list === undefined || list === null || !itemsLoaded) {
      return;
    }

    let addedListener = false;

    const onScroll = (e: Event) => {
      if (e.cancelable) {
        e.preventDefault();
      }

      const currentScroll = list.scrollTop;
      const scrollChange = currentScroll - scrollPaddingAbove;
      list.scrollTop = scrollPaddingAbove;
      updateScrollY(scrollChange);
    };

    const resetScroll = () => {
      setScrollY(0);
      list.scrollTop = scrollPaddingAbove;

      if (list.scrollTop !== scrollPaddingAbove) {
        setScrollY(0);
        requestAnimationFrame(resetScroll);
      } else {
        list.addEventListener('scroll', onScroll, { passive: false });
        addedListener = true;
      }
    };
    requestAnimationFrame(resetScroll);

    return () => {
      if (addedListener) {
        list.removeEventListener('scroll', onScroll);
      }
    };
  }, [listing, itemsLoaded, scrollPaddingBelow, updateScrollY]);

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

  const [paddingAboveElementStyle, itemsStyles, paddingBelowElementStyle] = useMemo<
    [React.CSSProperties, React.CSSProperties[], React.CSSProperties]
  >(() => {
    let y = -scrollY;
    const paddingAboveElement: React.CSSProperties = {
      position: 'absolute',
      minHeight: `${scrollPaddingAbove}px`,
      width: '100%',
      top: `${y}px`,
    };
    y += scrollPaddingAbove;

    const result: React.CSSProperties[] = [];
    for (let i = 0; i < numItems; i++) {
      const height = itemHeights[i] ?? initialComponentHeight;

      if (i > 0) {
        y += gap;
      }

      result.push({
        top: `${y}px`,
      });

      y += height;
    }
    const paddingBelowElement: React.CSSProperties = {
      position: 'absolute',
      minHeight: `${scrollPaddingBelow}px`,
      width: '100%',
      top: `${y}px`,
    };
    return [paddingAboveElement, result, paddingBelowElement];
  }, [itemHeights, gap, initialComponentHeight, numItems, scrollY, scrollPaddingBelow]);

  if (loadingElement !== undefined && items === null) {
    return loadingElement;
  }

  if (emptyElement !== undefined && items?.length === 0) {
    return emptyElement;
  }

  return (
    <div style={listStyle} className={styles.container} ref={listRef}>
      <div style={paddingAboveElementStyle}></div>
      {items?.map((item, index) => {
        return (
          <div key={index} className={styles.item} style={itemsStyles[index]}>
            {component(item, replaceItemByIndex[index], items, index)}
          </div>
        );
      })}
      <div style={paddingBelowElementStyle}></div>
    </div>
  );
}
