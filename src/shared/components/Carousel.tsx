import { PropsWithChildren, ReactElement, useEffect, useRef } from 'react';
import TinyGesture from 'tinygesture';
import { CarouselInfoChangedEvent, CarouselInfoRef } from '../hooks/useCarouselInfo';
import styles from './Carousel.module.css';

type CarouselProps = {
  /**
   * Information about how the carousel should be displayed. The carousel
   * component will inject handling for panning.
   */
  info: CarouselInfoRef;
};

/**
 * Renders a carousel of items, where the children represent the items. There
 * should be just as many children as there are items in the carousel, and
 * they should have the correct size and gap. The carousel will wrap them in
 * a flex container with flex-flow row nowrap.
 */
export const Carousel = ({ info, children }: PropsWithChildren<CarouselProps>): ReactElement => {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  // location & size
  useEffect(() => {
    if (outerRef.current === null || innerRef.current === null) {
      return;
    }

    const outer = outerRef.current;
    const inner = innerRef.current;

    info.onInfoChanged.current.add(handleInfoEvent);
    updateLeft();
    updateSize();

    return () => {
      inner.style.removeProperty('left');
      info.onInfoChanged.current.remove(handleInfoEvent);
    };

    function handleInfoEvent(event: CarouselInfoChangedEvent) {
      if (
        event.current.visibleWidth !== event.old.visibleWidth ||
        event.current.height !== event.old.height ||
        event.current.outerWidth !== event.old.outerWidth
      ) {
        updateSize();
      }

      if (event.current.carouselOffset !== event.old.carouselOffset) {
        updateLeft();
      }
    }

    function updateLeft() {
      inner.style.left = `${info.info.current.carouselOffset}px`;
    }

    function updateSize() {
      outer.style.width = `${info.info.current.visibleWidth}px`;
      outer.style.height = `${info.info.current.height}px`;
      inner.style.height = `${info.info.current.height}px`;
      inner.style.width = `${info.info.current.outerWidth}px`;
    }
  }, [info]);

  // panning
  useEffect(() => {
    if (outerRef.current === null) {
      return;
    }

    const outer = outerRef.current;
    const gesture = new TinyGesture(outer);
    let carouselOffsetAtPanStart: number = info.info.current.carouselOffset;
    let panStartAt: number = 0;
    gesture.on('panstart', () => {
      if (info.info.current.panning) {
        return;
      }

      carouselOffsetAtPanStart = info.info.current.carouselOffset;
      panStartAt = Date.now();
    });
    gesture.on('panmove', () => {
      if (gesture.touchMoveX === null) {
        return;
      }

      const oldInfo = info.info.current;
      if (!oldInfo.panning && Math.abs(gesture.touchMoveX) < 5 && Date.now() - panStartAt < 250) {
        return;
      }

      const newInfo = Object.assign({}, info.info.current, {
        carouselOffset: carouselOffsetAtPanStart + gesture.touchMoveX,
        panning: true,
      });
      info.info.current = newInfo;
      info.onInfoChanged.current.call({ old: oldInfo, current: newInfo });
    });
    gesture.on('panend', () => {
      if (!info.info.current.panning) {
        return;
      }
      if (gesture.touchEndX === null || gesture.touchStartX === null) {
        throw new Error('Expected touchEndX/touchStartX to be set');
      }

      const oldInfo = info.info.current;
      const newInfo = Object.assign({}, info.info.current, {
        panning: false,
        carouselOffset: carouselOffsetAtPanStart + gesture.touchEndX - gesture.touchStartX,
      });
      info.info.current = newInfo;
      info.onInfoChanged.current.call({ old: oldInfo, current: newInfo });
    });

    return () => {
      gesture.destroy();
    };
  }, [info]);

  return (
    <div
      ref={outerRef}
      className={styles.outer}
      style={{
        width: `${info.info.current.visibleWidth}px`,
        height: `${info.info.current.height}px`,
      }}>
      <div
        ref={innerRef}
        className={styles.inner}
        style={{
          width: `${info.info.current.outerWidth}px`,
          height: `${info.info.current.height}px`,
        }}>
        {children}
      </div>
    </div>
  );
};
