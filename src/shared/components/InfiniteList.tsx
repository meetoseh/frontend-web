import { ReactElement, useEffect, useMemo, useRef, useState } from 'react';
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
   * within a wrapping coponent.
   */
  component: (item: T, setItem: (newItem: T) => void) => ReactElement;

  /**
   * The width of the listing; may be unset for 100%. Due to how listings are
   * implemented they can have either a fixed pixel width or 100%.
   */
  width?: number;

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
};

const scrollPaddingAbove = 500;

export function InfiniteList<T>({
  listing,
  itemComparer,
  component,
  width,
  height,
  gap,
}: InfiniteListProps<T>): ReactElement {
  // The scroll on the list container. The element is marked scrollable,
  // but scrolling is blocked and instead we listen to the scroll event
  // to update this value.
  const [scrollY, setScrollY] = useState(0);
  const [itemsCounter, setItemsCounter] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const oldItemsRef = useRef<T[] | null>(null);
  const oldItemsHeights = useRef<number[] | null>(null);
  const scrollPaddingBelow = height;

  const items = listing.items;
  const itemsLoaded = items !== null;

  // ensure listing or listing.items changes triggers a rerender
  useEffect(() => {
    const onItemsChanged = () => {
      setItemsCounter((c) => c + 1);

      if (listing.definitelyNoneAbove || listing.definitelyNoneBelow) {
        requestAnimationFrame(() => {
          setScrollY((y) => {
            if (listing.definitelyNoneAbove) {
              y = Math.max(0, y);
            }

            if (listing.definitelyNoneBelow) {
              const list = listRef.current;
              if (list !== null) {
                y = Math.min(y, list.scrollHeight - list.clientHeight - scrollPaddingBelow);
              }
            }

            return y;
          });
        });
      }
    };

    listing.itemsChanged.add(onItemsChanged);
    return () => {
      listing.itemsChanged.remove(onItemsChanged);
    };
  }, [listing, scrollPaddingBelow]);

  // scrolling the list only changes scrollY, not the real scroll position
  useEffect(() => {
    const list = listRef.current;
    if (list === undefined || list === null || !itemsLoaded) {
      return;
    }

    let addedListener = false;

    const onScroll = () => {
      const currentScroll = list.scrollTop;
      const scrollChange = currentScroll - scrollPaddingAbove;
      list.scrollTop = scrollPaddingAbove;
      setScrollY((y) => {
        y += scrollChange;

        if (listing.definitelyNoneBelow) {
          y = Math.min(
            y,
            list.scrollHeight - list.clientHeight - scrollPaddingBelow - scrollPaddingAbove + 20
          );
        }

        if (listing.definitelyNoneAbove) {
          y = Math.max(0, y);
        } else {
          y = Math.max(-(scrollPaddingAbove / 2), y);
        }
        return y;
      });
    };

    const resetScroll = () => {
      setScrollY(0);
      list.scrollTop = scrollPaddingAbove;

      if (list.scrollTop !== scrollPaddingAbove) {
        setScrollY(0);
        requestAnimationFrame(resetScroll);
      } else {
        list.addEventListener('scroll', onScroll);
        addedListener = true;
      }
    };
    requestAnimationFrame(resetScroll);

    return () => {
      if (addedListener) {
        list.removeEventListener('scroll', onScroll);
      }
    };
  }, [listing, itemsLoaded]);

  // when the items change, update the scroll position to compensate
  useEffect(() => {
    if (itemsCounter < 0) {
      return;
    }

    const list = listRef.current;
    const oldItems = oldItemsRef.current;
    const oldHeights = oldItemsHeights.current;
    if (oldItems === listing.items) {
      return;
    }

    if (
      list === null ||
      list === undefined ||
      oldItems === null ||
      oldHeights === null ||
      listing.items === null
    ) {
      updateRefs();
      return;
    }

    if (oldItems[0] === listing.items[1]) {
      // inserted an item above. This visually shifted us down, so we need
      // to scroll up to compensate
      const insertedHeight = list.children[1].clientHeight;
      setScrollY((y) => y + insertedHeight + gap);
    } else if (oldItems[1] === listing.items[0]) {
      // removed an item above. This visually shifted us up, so we need to
      // scroll down to compensate
      const removedHeight = oldHeights[0];
      setScrollY((y) => y - removedHeight - gap);
    }

    updateRefs();

    function updateRefs() {
      if (list === null || list === undefined || listing.items === null) {
        oldItemsRef.current = null;
        oldItemsHeights.current = null;
        return;
      }

      const newHeights = [];
      for (let i = 1; i < list.children.length - 1; i++) {
        newHeights.push(list.children[i].clientHeight);
      }
      if (newHeights.length === listing.items.length) {
        oldItemsHeights.current = newHeights;
        oldItemsRef.current = listing.items;
      } else {
        oldItemsHeights.current = null;
        oldItemsRef.current = null;
      }
    }
  }, [listing, itemsCounter, gap]);

  // when scrolling, if the first item or last item is visible, swap an
  // item in the appropriate direction
  useEffect(() => {
    const list = listRef.current;
    if (list === null || list === undefined || list.children.length < listing.visibleLimit + 2) {
      return;
    }

    const listBoundingRect = list.getBoundingClientRect();
    const firstChildBoundingRect = list.children[1].getBoundingClientRect();

    if (firstChildBoundingRect.bottom > listBoundingRect.top) {
      listing.onFirstVisible();
      return;
    }

    const lastChildBoundingRect = list.children[list.children.length - 2].getBoundingClientRect();
    if (lastChildBoundingRect.top < listBoundingRect.bottom) {
      listing.onLastVisible();
    }
  }, [listing, scrollY]);

  const listStyle = useMemo<React.CSSProperties>(() => {
    return {
      display: 'flex',
      flexDirection: 'column',
      width: width === undefined ? '100%' : `${width}px`,
      height: `${height}px`,
      overflowY: 'scroll',
    };
  }, [width, height]);

  const itemsStyle = useMemo<React.CSSProperties>(() => {
    return {
      position: 'relative',
      marginTop: `${gap}px`,
      top: `${-scrollY}px`,
    };
  }, [gap, scrollY]);

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

  return (
    <div style={listStyle} className={styles.container} ref={listRef}>
      <div style={{ paddingTop: `${scrollPaddingAbove}px` }}></div>
      {listing.items?.map((item, index) => {
        return (
          <div key={index} style={itemsStyle}>
            {component(item, replaceItemByIndex[index])}
          </div>
        );
      })}
      <div style={{ paddingTop: `${scrollPaddingBelow}px` }}></div>
    </div>
  );
}
