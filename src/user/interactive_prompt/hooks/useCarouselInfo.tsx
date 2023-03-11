import { MutableRefObject, useEffect, useMemo, useRef } from 'react';
import { ease } from '../../../shared/lib/Bezier';
import { BezierAnimation, calculateAnimValue } from '../../../shared/lib/BezierAnimation';
import { Callbacks } from '../../../shared/lib/Callbacks';

/**
 * Describes the current state of the carousel. This is usually put inside
 * of a mutable reference to avoid it triggering state changes.
 */
export type CarouselInfo = {
  /**
   * The width that the carousel would take up if it had infinite horizontal
   * space.
   */
  outerWidth: number;

  /**
   * The height of the carousel, as well as each item in the carousel.
   */
  height: number;

  /**
   * The width that the carousel actually has.
   */
  visibleWidth: number;

  /**
   * The width of each item in the carousel.
   */
  itemWidth: number;

  /**
   * The horizontal gap between each item in the carousel.
   */
  itemGap: number;

  /**
   * The number of items in the carousel
   */
  numItems: number;

  /**
   * The horizontal offset in pixels that is applied to each item compared
   * to their default position.
   *
   * In the default position, the first item starts at an x-offset of 0 relative
   * to the carousel.
   */
  carouselOffset: number;

  /**
   * The index of thet option in the carousel that we currently
   * consider selected. When panning stops, if this item is not
   * centered, the carousel will animate itself such that it is.
   *
   * While panning the carousel will update the selected index
   * to whatever is closest to the center of the carousel.
   */
  selectedIndex: number;

  /**
   * True if the carousel is currently being panned by the user,
   * false otherwise. This must be handled by whatever component
   * is rendering the carousel.
   */
  panning: boolean;

  /**
   * True if the carousel is currently animating itself such that
   * the selected item is centered, false otherwise. This will
   * be handled by useCarouselInfo automatically.
   */
  gluing: boolean;

  /**
   * True if clicks within the carousel should be ignored as
   * relics of panning, false otherwise. This will be handled
   * by useCarouselInfo automatically.
   */
  inClickCooldown: boolean;
};

export type CarouselInfoChangedEvent = {
  /**
   * The carousel info prior to the change
   */
  old: CarouselInfo;

  /**
   * The carousel info after the change
   */
  current: CarouselInfo;
};

export type CarouselInfoRef = {
  /**
   * The current carousel info.
   */
  info: MutableRefObject<CarouselInfo>;

  /**
   * Called when the carousel info changes.
   */
  onInfoChanged: MutableRefObject<Callbacks<CarouselInfoChangedEvent>>;
};

type CarouselInfoProps = {
  /**
   * The width that the carousel actually has.
   */
  visibleWidth: number;

  /**
   * The height of the carousel, as well as each item in the carousel,
   * in pixels.
   */
  height: number;

  /**
   * The number of items in the carousel
   */
  numItems: number;

  /**
   * The width of each item in the carousel.
   */
  itemWidth: number;

  /**
   * The horizontal gap between each item in the carousel.
   */
  itemGap: number;
};

export const useCarouselInfo = ({
  visibleWidth,
  numItems,
  itemWidth,
  itemGap,
  height,
}: CarouselInfoProps): CarouselInfoRef => {
  const info = useRef<CarouselInfo>() as MutableRefObject<CarouselInfo>;
  const onInfoChanged = useRef<Callbacks<CarouselInfoChangedEvent>>() as MutableRefObject<
    Callbacks<CarouselInfoChangedEvent>
  >;

  if (info.current === undefined) {
    const initialIdx = Math.ceil(numItems / 2);
    const initialIdxDefaultLoc = (initialIdx - 1) * (itemWidth + itemGap);
    const desiredLoc = visibleWidth / 2 - itemWidth / 2;

    info.current = {
      outerWidth: numItems * (itemWidth + itemGap) - itemGap,
      height,
      visibleWidth,
      itemWidth,
      itemGap,
      numItems,
      carouselOffset: desiredLoc - initialIdxDefaultLoc,
      selectedIndex: initialIdx,
      panning: false,
      gluing: false,
      inClickCooldown: false,
    };
  }

  if (onInfoChanged.current === undefined) {
    onInfoChanged.current = new Callbacks();
  }

  useEffect(() => {
    if (
      info.current.visibleWidth === visibleWidth &&
      info.current.numItems === numItems &&
      info.current.itemWidth === itemWidth &&
      info.current.itemGap === itemGap &&
      info.current.height === height
    ) {
      return;
    }

    const oldInfo = info.current;
    const newInfo = Object.assign({}, oldInfo, {
      outerWidth: numItems * (itemWidth + itemGap) - itemGap,
      visibleWidth,
      numItems,
      itemWidth,
      itemGap,
      height,
    });
    if (newInfo.selectedIndex >= newInfo.numItems) {
      newInfo.selectedIndex = newInfo.numItems - 1;
    }

    info.current = newInfo;
    onInfoChanged.current.call({ old: oldInfo, current: newInfo });
  }, [visibleWidth, numItems, itemWidth, itemGap, height]);

  useEffect(() => {
    let active = true;
    let glueAnimation: BezierAnimation | null = null;
    let handlerCounter = 0;
    onInfoChanged.current.add(handleInfoEvent);
    handleInitialInfo(info.current);
    return () => {
      active = false;
      glueAnimation = null;
      onInfoChanged.current.remove(handleInfoEvent);
    };

    function handleInitialInfo(current: CarouselInfo) {
      if (current.panning) {
        if (!current.gluing) {
          return;
        }

        const newInfo = Object.assign({}, current, { gluing: false });
        info.current = newInfo;
        onInfoChanged.current.call({ old: current, current: newInfo });
        return;
      }

      const centerOffset = current.visibleWidth / 2 - current.itemWidth / 2;
      const selectedDefaultOffset = current.selectedIndex * (current.itemWidth + current.itemGap);
      const desiredCarouselOffset = centerOffset - selectedDefaultOffset;
      if (current.carouselOffset === desiredCarouselOffset) {
        if (current.gluing) {
          const newInfo = Object.assign({}, current, { gluing: false });
          info.current = newInfo;
          onInfoChanged.current.call({ old: current, current: newInfo });
        }
        return;
      }

      glueAnimation = {
        from: current.carouselOffset,
        to: desiredCarouselOffset,
        startedAt: null,
        duration: 350,
        ease: ease,
      };
      const handlerId = ++handlerCounter;

      if (!current.gluing) {
        const newInfo = Object.assign({}, current, { gluing: true });
        info.current = newInfo;
        onInfoChanged.current.call({ old: current, current: newInfo });
      }

      requestAnimationFrame((now) => handleFrame(handlerId, now));
    }

    function handleInfoEvent(event: CarouselInfoChangedEvent) {
      if (!active) {
        return;
      }

      if (event.current.gluing && event.current.panning) {
        glueAnimation = null;
        handlerCounter++;
        const newInfo = Object.assign({}, event.current, {
          gluing: false,
        });
        info.current = newInfo;
        onInfoChanged.current.replaceCall(
          { old: event.current, current: newInfo },
          { old: event.old, current: newInfo }
        );
        return;
      }

      if (event.old.panning && !event.current.panning) {
        const centerOffset = event.current.visibleWidth / 2 - event.current.itemWidth / 2;
        const nearestIdx = Math.max(
          0,
          Math.min(
            event.current.numItems - 1,
            getCarouselIndexForOffset(
              event.current.itemWidth,
              event.current.itemGap,
              event.current.carouselOffset,
              centerOffset
            )
          )
        );

        const nearestDefaultOffset = nearestIdx * (event.current.itemWidth + event.current.itemGap);
        const desiredCarouselOffset = centerOffset - nearestDefaultOffset;
        if (
          event.current.carouselOffset === desiredCarouselOffset &&
          event.current.selectedIndex === nearestIdx
        ) {
          return;
        }

        if (
          event.current.gluing &&
          event.current.selectedIndex === nearestIdx &&
          glueAnimation !== null &&
          glueAnimation.to === desiredCarouselOffset
        ) {
          return;
        }

        if (glueAnimation === null || glueAnimation.to !== desiredCarouselOffset) {
          glueAnimation = {
            from: event.current.carouselOffset,
            to: desiredCarouselOffset,
            startedAt: null,
            duration: 350,
            ease: ease,
          };
        }

        const newInfo = Object.assign({}, event.current, {
          gluing: true,
          selectedIndex: nearestIdx,
        });
        info.current = newInfo;
        onInfoChanged.current.replaceCall(
          { old: event.current, current: newInfo },
          { old: event.old, current: newInfo }
        );
        const handlerId = ++handlerCounter;
        requestAnimationFrame((now) => handleFrame(handlerId, now));
        return;
      }

      if (event.old.selectedIndex !== event.current.selectedIndex && !event.current.panning) {
        const centerOffset = event.current.visibleWidth / 2 - event.current.itemWidth / 2;
        const selectedDefaultOffset =
          event.current.selectedIndex * (event.current.itemWidth + event.current.itemGap);
        const desiredCarouselOffset = centerOffset - selectedDefaultOffset;

        if (event.current.carouselOffset === desiredCarouselOffset) {
          if (event.current.gluing) {
            glueAnimation = null;
            handlerCounter++;
            const newInfo = Object.assign({}, event.current, { gluing: false });
            info.current = newInfo;
            onInfoChanged.current.replaceCall(
              { old: event.current, current: newInfo },
              { old: event.old, current: newInfo }
            );
          }
          return;
        }

        if (
          event.current.gluing &&
          glueAnimation !== null &&
          glueAnimation.to === desiredCarouselOffset
        ) {
          return;
        }

        let handlerId: number | null = null;
        if (glueAnimation === null || glueAnimation.to !== desiredCarouselOffset) {
          glueAnimation = {
            from: event.current.carouselOffset,
            to: desiredCarouselOffset,
            startedAt: null,
            duration: 350,
            ease: ease,
          };
          handlerId = ++handlerCounter;
        }

        if (!event.current.gluing) {
          const newInfo = Object.assign({}, event.current, { gluing: true });
          info.current = newInfo;
          onInfoChanged.current.replaceCall(
            { old: event.current, current: newInfo },
            { old: event.old, current: newInfo }
          );
        }

        if (handlerId !== null && handlerId === handlerCounter) {
          const myHandlerId = handlerId;
          requestAnimationFrame((now) => handleFrame(myHandlerId, now));
        }
      }
    }

    function handleFrame(handlerId: number, now: DOMHighResTimeStamp) {
      if (!active || glueAnimation === null || handlerCounter !== handlerId) {
        return;
      }

      const newOffset = calculateAnimValue(glueAnimation, now);
      const oldInfo = info.current;
      const newInfo = Object.assign({}, oldInfo, {
        carouselOffset: newOffset,
      });

      if (
        glueAnimation.startedAt !== null &&
        now >= glueAnimation.startedAt + glueAnimation.duration
      ) {
        glueAnimation = null;
        newInfo.gluing = false;
      }

      info.current = newInfo;
      onInfoChanged.current.call({ old: oldInfo, current: newInfo });

      if (newInfo.gluing && handlerCounter === handlerId) {
        requestAnimationFrame((now) => handleFrame(handlerId, now));
      }
    }
  }, []);

  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;
    onInfoChanged.current.add(handleEvent);
    return () => {
      onInfoChanged.current.remove(handleEvent);
      if (timeout !== null) {
        clearTimeout(timeout);
      }
    };

    function handleEvent(event: CarouselInfoChangedEvent) {
      if (event.current.panning) {
        if (timeout !== null) {
          clearTimeout(timeout);
          timeout = null;
        }

        if (!event.current.inClickCooldown) {
          const newInfo = Object.assign({}, event.current, {
            inClickCooldown: true,
          });
          info.current = newInfo;
          onInfoChanged.current.replaceCall(
            { old: event.current, current: newInfo },
            { old: event.old, current: newInfo }
          );
        }
        return;
      }

      if (event.old.panning && !event.current.panning) {
        if (timeout !== null) {
          clearTimeout(timeout);
          timeout = null;
        }

        if (!event.current.inClickCooldown) {
          const newInfo = Object.assign({}, event.current, {
            inClickCooldown: true,
          });
          info.current = newInfo;
          onInfoChanged.current.replaceCall(
            { old: event.current, current: newInfo },
            { old: event.old, current: newInfo }
          );
        }

        timeout = setTimeout(() => {
          timeout = null;
          const newInfo = Object.assign({}, event.current, {
            inClickCooldown: false,
          });
          info.current = newInfo;
          onInfoChanged.current.call({ old: event.current, current: newInfo });
        }, 350);
        return;
      }
    }
  }, []);

  return useMemo(
    () => ({
      info,
      onInfoChanged,
    }),
    []
  );
};

/**
 * Finds the index of the item whose center is closest to the given offset.
 *
 * @param itemWidth The width of each item in the carousel.
 * @param itemGap The gap between each item in the carousel.
 * @param carouselOffset The offset of the carousel from the left edge of the viewport.
 * @param offset The offset from the left edge of the viewport to find the closest item to.
 */
function getCarouselIndexForOffset(
  itemWidth: number,
  itemGap: number,
  carouselOffset: number,
  offset: number
): number {
  // The location of any item is calculated as:
  //   itemLeftX = carouselOffset + (itemWidth + itemGap) * itemIndex
  //   itemCenterX = itemLeftX + itemWidth / 2

  // We are looking for the item whose center is closest to the given offset. In other
  // words, for
  //   itemDistance = carouselOffset - offset + itemWidth / 2 + (itemWidth + itemGap) * itemIndex
  // we want to find the itemIndex that minimizes itemDistance.

  // Going even further, let
  //   b = carouselOffset - offset + itemWidth / 2
  //   m = itemWidth + itemGap
  //   x = itemIndex

  // Then we want to solve for x in
  //   0 = m * x + b
  // which is equivalent to
  //   x = -b / m

  // When would b be negative? When offset > (carouselOffset + itemWidth / 2). In this
  // case, we are looking for an item at or right of the first item, so it makes sense
  // that would result in a positive index.

  if (itemWidth + itemGap === 0) {
    throw new Error('itemWidth + itemGap must be greater than 0');
  }

  const b = carouselOffset - offset + itemWidth / 2;
  const m = itemWidth + itemGap;
  const x = -b / m;

  return Math.round(x);
}
