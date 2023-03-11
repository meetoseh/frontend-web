import { ReactElement, useEffect, useRef } from 'react';
import { Callbacks } from '../../../shared/lib/Callbacks';
import { rgbaToCss } from '../../../shared/lib/rgbaToCss';
import styles from './HorizontalPartlyFilledRoundedRect.module.css';

export type FilledWidthChangedEvent = {
  /**
   * The filled width as a fractional value 0-1 before the change
   */
  old: number;

  /**
   * The filled width as a fractional value 0-1 after the change
   */
  current: number;
};

type HorizontalPartlyFilledRoundedRectProps = {
  /**
   * The height of the element to draw, in logical pixels
   */
  height: number;

  /**
   * The width of the element to draw, in logical pixels
   */
  width: number;

  /**
   * The border radius in logical pixels
   */
  borderRadius: number;

  /**
   * The color to use for the unfilled portion, as a series of numbers 0-1
   * representing the red, green, blue, and alpha components.
   */
  unfilledColor: [number, number, number, number];

  /**
   * The color to use for the filled portion, as a series of numbers 0-1
   * representing the red, green, blue, and alpha components. This is
   * rendered on top of the unfilled color.
   */
  filledColor: [number, number, number, number];

  /**
   * A function to fetch the current filled width as a fractional value, 0-1
   */
  filledWidth: () => number;

  /**
   * A function to fetch the callbacks we can register in to know when
   * the filled width changes.
   */
  onFilledWidthChanged: () => Callbacks<FilledWidthChangedEvent>;
};

/**
 * Renders a rectangle whose background fills horizontally and which
 * has rounded corners.
 */
export const HorizontalPartlyFilledRoundedRect = ({
  height,
  width,
  unfilledColor,
  borderRadius,
  filledColor,
  filledWidth,
  onFilledWidthChanged,
}: HorizontalPartlyFilledRoundedRectProps): ReactElement => {
  const backgroundRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const callbacks = onFilledWidthChanged();
    callbacks.add(handleEvent);
    return () => {
      callbacks.remove(handleEvent);
    };

    function handleEvent(event: FilledWidthChangedEvent) {
      const background = backgroundRef.current;
      if (!background) {
        return;
      }

      background.style.width = (event.current * 100).toString() + '%';
    }
  }, [onFilledWidthChanged]);

  return (
    <div
      style={{ backgroundColor: rgbaToCss(unfilledColor), width, height, borderRadius }}
      className={styles.outer}>
      <div
        ref={backgroundRef}
        className={styles.inner}
        style={{
          width: (filledWidth() * 100).toString() + '%',
          height,
          backgroundColor: rgbaToCss(filledColor),
        }}
      />
    </div>
  );
};
