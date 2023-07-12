import { PropsWithChildren, ReactElement, useEffect, useRef } from 'react';
import TinyGesture from 'tinygesture';
import { CarouselInfo } from '../hooks/useCarouselInfo';
import styles from './Carousel.module.css';
import { ValueWithCallbacks, WritableValueWithCallbacks } from '../lib/Callbacks';

type CarouselProps = {
  /**
   * Information about how the carousel should be displayed.
   */
  info: ValueWithCallbacks<CarouselInfo>;

  /**
   * Where we report panning state to, which should be forwarded to the
   * carousel info.
   */
  panning: WritableValueWithCallbacks<boolean>;

  /**
   * The function to use to pan the carousel
   * @param offset The new desired offset
   */
  panCarouselTo: (offset: number) => void;
};

/**
 * Renders a carousel of items, where the children represent the items. There
 * should be just as many children as there are items in the carousel, and
 * they should have the correct size and gap. The carousel will wrap them in
 * a flex container with flex-flow row nowrap.
 */
export const Carousel = ({
  info: infoVWC,
  panning: panningVWC,
  panCarouselTo,
  children,
}: PropsWithChildren<CarouselProps>): ReactElement => {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  // location & size
  useEffect(() => {
    if (outerRef.current === null || innerRef.current === null) {
      return;
    }

    const outer = outerRef.current;
    const inner = innerRef.current;

    infoVWC.callbacks.add(handleInfoEvent);
    let renderedPos = updatePosition();
    let renderedSize = updateSize();

    return () => {
      inner.style.removeProperty('left');
      infoVWC.callbacks.remove(handleInfoEvent);
    };

    function handleInfoEvent() {
      const info = infoVWC.get();
      if (
        info.computed.visibleWidth !== renderedSize.visibleWidth ||
        info.computed.height !== renderedSize.height ||
        info.computed.outerWidth !== renderedSize.outerWidth
      ) {
        renderedSize = updateSize();
      }

      if (renderedPos !== info.carouselOffset) {
        renderedPos = updatePosition();
      }
    }

    function updatePosition(): number {
      const pos = infoVWC.get().carouselOffset;
      inner.style.left = `${pos}px`;
      return pos;
    }

    function updateSize(): { outerWidth: number; visibleWidth: number; height: number } {
      const size = {
        outerWidth: infoVWC.get().computed.outerWidth,
        visibleWidth: infoVWC.get().computed.visibleWidth,
        height: infoVWC.get().computed.height,
      };
      outer.style.width = `${size.visibleWidth}px`;
      outer.style.height = `${size.height}px`;
      inner.style.height = `${size.height}px`;
      inner.style.width = `${size.outerWidth}px`;
      return size;
    }
  }, [infoVWC]);

  // panning
  useEffect(() => {
    if (outerRef.current === null) {
      return;
    }

    const outer = outerRef.current;
    const gesture = new TinyGesture(outer);
    let carouselOffsetAtPanStart: number = infoVWC.get().carouselOffset;
    let panStartAt: number = 0;
    gesture.on('panstart', () => {
      if (infoVWC.get().panning) {
        return;
      }

      carouselOffsetAtPanStart = infoVWC.get().carouselOffset;
      panStartAt = Date.now();
    });
    gesture.on('panmove', () => {
      if (gesture.touchMoveX === null) {
        return;
      }

      const oldInfo = infoVWC.get();
      if (!oldInfo.panning && Math.abs(gesture.touchMoveX) < 5 && Date.now() - panStartAt < 250) {
        return;
      }

      if (!panningVWC.get()) {
        panningVWC.set(true);
        panningVWC.callbacks.call(undefined);
      }

      const newOffset = carouselOffsetAtPanStart + gesture.touchMoveX;
      if (newOffset !== oldInfo.carouselOffset) {
        panCarouselTo(newOffset);
      }
    });
    gesture.on('panend', () => {
      if (!infoVWC.get().panning) {
        return;
      }
      if (gesture.touchEndX === null || gesture.touchStartX === null) {
        throw new Error('Expected touchEndX/touchStartX to be set');
      }

      const finalPanLoc = carouselOffsetAtPanStart + gesture.touchEndX - gesture.touchStartX;
      if (infoVWC.get().carouselOffset !== finalPanLoc) {
        panCarouselTo(finalPanLoc);
      }
      panningVWC.set(false);
      panningVWC.callbacks.call(undefined);
    });

    return () => {
      gesture.destroy();

      if (panningVWC.get()) {
        panningVWC.set(false);
        panningVWC.callbacks.call(undefined);
      }
    };
  }, [infoVWC, panningVWC, panCarouselTo]);

  return (
    <div
      ref={outerRef}
      className={styles.outer}
      style={{
        width: `${infoVWC.get().computed.visibleWidth}px`,
        height: `${infoVWC.get().computed.height}px`,
      }}>
      <div
        ref={innerRef}
        className={styles.inner}
        style={{
          width: `${infoVWC.get().computed.outerWidth}px`,
          height: `${infoVWC.get().computed.height}px`,
        }}>
        {children}
      </div>
    </div>
  );
};
