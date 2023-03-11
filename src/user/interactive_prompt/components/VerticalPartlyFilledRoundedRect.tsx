import { ReactElement, useEffect, useRef } from 'react';
import { Callbacks } from '../../../shared/lib/Callbacks';
import { rgbaToCss } from '../../../shared/lib/rgbaToCss';
import styles from './VerticalPartlyFilledRoundedRect.module.css';

// VPFRR = VerticalPartlyFilledRoundedRect

export type VPFRRState = {
  /**
   * The opacity of the overall element, 0-1
   */
  opacity: number;

  /**
   * The filled height as a fractional value 0-1
   */
  filledHeight: number;
};

export type VPFRRStateChangedEvent = {
  /**
   * The state prior to the change
   */
  old: VPFRRState;

  /**
   * The state after the change
   */
  current: VPFRRState;
};

type VPFRRProps = {
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
   * A function to fetch the current state
   */
  state: () => VPFRRState;

  /**
   * A function to fetch the callbacks we can register in to know when
   * the state changes.
   */
  onStateChanged: () => Callbacks<VPFRRStateChangedEvent>;
};

/**
 * Renders a rectangle whose background fills vertically and which
 * has rounded corners.
 */
export const VerticalPartlyFilledRoundedRect = ({
  height,
  width,
  unfilledColor,
  borderRadius,
  filledColor,
  state,
  onStateChanged,
}: VPFRRProps): ReactElement => {
  const outerRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const callbacks = onStateChanged();
    callbacks.add(handleEvent);
    return () => {
      callbacks.remove(handleEvent);
    };

    function handleEvent(event: VPFRRStateChangedEvent) {
      const outer = outerRef.current;
      const background = backgroundRef.current;
      if (outer === null || background === null) {
        return;
      }

      if (event.current.filledHeight !== event.old.filledHeight) {
        background.style.height = (event.current.filledHeight * height).toString() + 'px';
      }
      if (event.current.opacity !== event.old.opacity) {
        outer.style.opacity = (event.current.opacity * 100).toString() + '%';
      }
    }
  }, [onStateChanged, height]);

  return (
    <div
      style={{
        backgroundColor: rgbaToCss(unfilledColor),
        width,
        height,
        borderRadius,
        opacity: (state().opacity * 100).toString() + '%',
      }}
      className={styles.outer}
      ref={outerRef}>
      <div
        ref={backgroundRef}
        className={styles.inner}
        style={{
          height: (state().filledHeight * height).toString() + 'px',
          width,
          backgroundColor: rgbaToCss(filledColor),
        }}
      />
    </div>
  );
};
