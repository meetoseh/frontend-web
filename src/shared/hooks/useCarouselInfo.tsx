import { useCallback, useEffect, useRef } from 'react';
import { ease } from '../lib/Bezier';
import { BezierAnimation, animIsComplete, calculateAnimValue } from '../lib/BezierAnimation';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';
import {
  VariableStrategyProps,
  useVariableStrategyPropsAsValueWithCallbacks,
} from '../anim/VariableStrategyProps';
import { useMappedValueWithCallbacks } from './useMappedValueWithCallbacks';
import { useMappedValuesWithCallbacks } from './useMappedValuesWithCallbacks';

/**
 * Describes the settings that determine where things within the carousel
 * are positioned.
 */
export type CarouselSettings = {
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

export type CarouselComputedSettings = CarouselSettings & {
  /**
   * The width that the carousel would take up if it had infinite horizontal
   * space.
   */
  outerWidth: number;
};

/**
 * Describes the current state of the carousel. This is usually put inside
 * of a mutable reference to avoid it triggering state changes.
 */
export type CarouselInfo = {
  /**
   * The computed settings for the carousel, which include all the
   * settings from the props, as well as any additional relevant
   * information which can be deduced from them, irrespective of
   * panning.
   */
  computed: CarouselComputedSettings;

  /**
   * The horizontal offset in pixels that is applied to each item compared
   * to their default position.
   *
   * In the default position, the first item starts at an x-offset of 0 relative
   * to the carousel.
   *
   * This value is already animated as necessary and thus should not go through
   * an animation loop, or if it does, it should use the trivial animator to avoid
   * double animation.
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
   * false otherwise. This is forwarded from the props for convenience.
   */
  panning: boolean;

  /**
   * True if the carousel is currently animating itself such that
   * the selected item is centered, false otherwise.
   */
  gluing: boolean;

  /**
   * True if clicks within the carousel should be ignored as
   * relics of panning, false otherwise.
   */
  inClickCooldown: boolean;
};

type CarouselInfoProps = {
  settings: VariableStrategyProps<CarouselSettings>;

  /**
   * True if the carousel is currently being panned by the user,
   * false otherwise.
   */
  panning: VariableStrategyProps<boolean>;
};

/**
 * Handles the logic behind a standard horizontal carousel. Specifically,
 * if the caller can detect pans and clicks, this hook will handle gluing
 * the carousel to the nearest item when the user stops panning, or animating
 * to the selected item when the user clicks on an item.
 *
 * @param settings The settings that determine where things within the carousel
 *   are positioned.
 * @param panning True if the carousel is currently being panned by the user,
 *   false otherwise.
 * @returns
 *   1. The current carousel settings for rendering
 *   2. The function to call when the user clicks on an item. This will already
 *      incorporate ignoring clicks while panning, though sometimes performance
 *      can be improved by still taking that into account (and, e.g., clever use
 *      of the CSS property pointer-events).
 *   3. The function to call to modify the carousel offset to the given value due
 *      to panning. An error will be raised if not panning.
 */
export const useCarouselInfo = ({
  settings: settingsVariableStrategy,
  panning: panningVariableStrategy,
}: CarouselInfoProps): [
  ValueWithCallbacks<CarouselInfo>,
  (idx: number) => void,
  (pannedTo: number) => void
] => {
  const settingsVWC = useVariableStrategyPropsAsValueWithCallbacks(settingsVariableStrategy);
  const computedVWC = useMappedValueWithCallbacks(
    settingsVWC,
    ({ visibleWidth, height, numItems, itemWidth, itemGap }) => {
      return {
        outerWidth: numItems * (itemWidth + itemGap) - itemGap,
        visibleWidth,
        height,
        numItems,
        itemWidth,
        itemGap,
      };
    },
    {
      inputEqualityFn: (a, b) =>
        a.visibleWidth === b.visibleWidth &&
        a.height === b.height &&
        a.numItems === b.numItems &&
        a.itemWidth === b.itemWidth &&
        a.itemGap === b.itemGap,
    }
  );

  const panningVWC = useVariableStrategyPropsAsValueWithCallbacks(panningVariableStrategy);
  const selectedVWC = useWritableValueWithCallbacks<number>(() =>
    Math.ceil(settingsVWC.get().numItems / 2)
  );
  const selectedDesiredOffset = useMappedValuesWithCallbacks(
    [computedVWC, selectedVWC],
    (): number => {
      const idx = selectedVWC.get();
      const s = computedVWC.get();
      const defaultLoc = idx * (s.itemWidth + s.itemGap);
      const desiredLoc = s.visibleWidth / 2 - s.itemWidth / 2;
      return desiredLoc - defaultLoc;
    }
  );
  const carouselOffsetVWC = useWritableValueWithCallbacks<number>(() =>
    selectedDesiredOffset.get()
  );
  const gluingVWC = useWritableValueWithCallbacks<boolean>(() => false);
  const inClickCooldownVWC = useWritableValueWithCallbacks<boolean>(() => false);

  // in case the number of items changes, ensure selected index is still valid
  useEffect(() => {
    computedVWC.callbacks.add(onSettingsChanged);
    onSettingsChanged();
    return () => {
      computedVWC.callbacks.remove(onSettingsChanged);
    };

    function onSettingsChanged() {
      const selected = selectedVWC.get();
      if (selected >= computedVWC.get().numItems) {
        selectedVWC.set(computedVWC.get().numItems - 1);
        selectedVWC.callbacks.call(undefined);
      }
    }
  }, [computedVWC, selectedVWC]);

  // while we're panning and for 350ms after, we ignore clicks
  const clickCooldownTimeout = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    panningVWC.callbacks.add(recheckCooldown);
    recheckCooldown();
    return () => {
      panningVWC.callbacks.remove(recheckCooldown);
    };

    function recheckCooldown() {
      if (panningVWC.get()) {
        if (!inClickCooldownVWC.get()) {
          inClickCooldownVWC.set(true);
          inClickCooldownVWC.callbacks.call(undefined);
        }
        if (clickCooldownTimeout.current !== null) {
          clearTimeout(clickCooldownTimeout.current);
          clickCooldownTimeout.current = null;
        }
        return;
      }

      if (inClickCooldownVWC.get() && clickCooldownTimeout.current === null) {
        clickCooldownTimeout.current = setTimeout(() => {
          clickCooldownTimeout.current = null;
          inClickCooldownVWC.set(false);
          inClickCooldownVWC.callbacks.call(undefined);
        }, 350);
        return;
      }
    }
  }, [panningVWC, inClickCooldownVWC]);

  // when we stop panning, select the item closest to the center
  const wasPanningRef = useRef<boolean>(panningVWC.get());
  useEffect(() => {
    panningVWC.callbacks.add(onPanningChanged);
    return () => {
      panningVWC.callbacks.remove(onPanningChanged);
    };

    function onPanningChanged() {
      const wasPanning = wasPanningRef.current;
      const nowPanning = panningVWC.get();
      wasPanningRef.current = nowPanning;

      if (!wasPanning || nowPanning) {
        return;
      }

      const s = computedVWC.get();

      const centerOffset = s.visibleWidth / 2 - s.itemWidth / 2;
      const nearestIdx = Math.max(
        0,
        Math.min(
          s.numItems - 1,
          getCarouselIndexForOffset(s.itemWidth, s.itemGap, carouselOffsetVWC.get(), centerOffset)
        )
      );

      if (nearestIdx !== selectedVWC.get()) {
        selectedVWC.set(nearestIdx);
        selectedVWC.callbacks.call(undefined);
      }
    }
  }, [panningVWC, selectedVWC, computedVWC, carouselOffsetVWC]);

  // when we're not panning, glue to the desired offset
  useEffect(() => {
    let animation: BezierAnimation | null = null;
    let active = true;
    let animating = false;
    panningVWC.callbacks.add(recheckAnimation);
    selectedDesiredOffset.callbacks.add(recheckAnimation);
    return () => {
      if (active) {
        active = false;
        panningVWC.callbacks.remove(recheckAnimation);
        selectedDesiredOffset.callbacks.remove(recheckAnimation);
      }
    };

    function recheckAnimation() {
      if (panningVWC.get()) {
        animation = null;
        return;
      }

      if (selectedDesiredOffset.get() === carouselOffsetVWC.get()) {
        animation = null;
        return;
      }

      if (animation === null || animation.to !== selectedDesiredOffset.get()) {
        animation = {
          startedAt: null,
          from: carouselOffsetVWC.get(),
          to: selectedDesiredOffset.get(),
          duration: 350,
          ease,
        };
      }
      ensureAnimating();
    }

    function ensureAnimating() {
      if (animating || !active) {
        return;
      }

      animating = true;
      requestAnimationFrame(onFirstFrame.bind(undefined, performance.now()));
    }

    function onFirstFrame(oldPerfNow: number, newFrameTime: DOMHighResTimeStamp) {
      handleFrame(performance.now() - oldPerfNow, newFrameTime);
    }

    function onFrame(oldFrameTime: DOMHighResTimeStamp, newFrameTime: DOMHighResTimeStamp) {
      handleFrame(newFrameTime - oldFrameTime, newFrameTime);
    }

    function handleFrame(delta: number, newFrameTime: DOMHighResTimeStamp) {
      if (!active) {
        return;
      }

      if (animation === null) {
        animating = false;
        return;
      }

      if (animation.startedAt === null) {
        animation.startedAt = newFrameTime - delta;
      }

      if (animIsComplete(animation, newFrameTime)) {
        const target = animation.to;
        animation = null;
        animating = false;
        carouselOffsetVWC.set(target);
        carouselOffsetVWC.callbacks.call(undefined);
        return;
      }

      const newVal = calculateAnimValue(animation, newFrameTime);
      carouselOffsetVWC.set(newVal);
      carouselOffsetVWC.callbacks.call(undefined);
      requestAnimationFrame(onFrame.bind(undefined, newFrameTime));
    }
  }, [panningVWC, carouselOffsetVWC, selectedDesiredOffset]);

  return [
    useMappedValuesWithCallbacks(
      [computedVWC, carouselOffsetVWC, selectedVWC, panningVWC, gluingVWC, inClickCooldownVWC],
      () => ({
        computed: computedVWC.get(),
        carouselOffset: carouselOffsetVWC.get(),
        selectedIndex: selectedVWC.get(),
        panning: panningVWC.get(),
        gluing: gluingVWC.get(),
        inClickCooldown: inClickCooldownVWC.get(),
      })
    ),
    useCallback(
      (clickedIndex: number) => {
        if (inClickCooldownVWC.get()) {
          return;
        }
        if (clickedIndex === selectedVWC.get()) {
          return;
        }
        selectedVWC.set(clickedIndex);
        selectedVWC.callbacks.call(undefined);
      },
      [selectedVWC, inClickCooldownVWC]
    ),
    useCallback(
      (offset: number) => {
        if (!panningVWC.get()) {
          throw new Error('cannot use the panToOffset function when not panning');
        }

        if (carouselOffsetVWC.get() !== offset) {
          carouselOffsetVWC.set(offset);
          carouselOffsetVWC.callbacks.call(undefined);
        }
      },
      [panningVWC, carouselOffsetVWC]
    ),
  ];
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
