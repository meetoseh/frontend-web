import { useMappedValueWithCallbacks } from '../hooks/useMappedValueWithCallbacks';
import { StandardScreenTransitionState } from '../hooks/useStandardTransitions';
import { CSSProperties, ReactElement } from 'react';
import { RenderGuardedComponent } from './RenderGuardedComponent';
import { useWindowSizeValueWithCallbacks } from '../hooks/useWindowSize';
import { useMappedValuesWithCallbacks } from '../hooks/useMappedValuesWithCallbacks';
import { useWritableValueWithCallbacks } from '../lib/Callbacks';
import styles from './WipeTransitionOverlay.module.css';
import { setVWC } from '../lib/setVWC';
import { useStyleVWC } from '../hooks/useStyleVWC';
import { interpolateColor } from '../lib/BezierAnimation';
import { colorToCSS } from '../anim/svgUtils';

export type WipeTransitionOverlayProps = Pick<StandardScreenTransitionState, 'wipe'>;

/**
 * Places itself at the appropriate size and location using the window
 * size and position: 'absolute' to cover the nearest relative parent,
 * whose size must exactly match the window size.
 */
export const WipeTransitionOverlay = ({ wipe }: WipeTransitionOverlayProps): ReactElement => {
  const neededVWC = useMappedValueWithCallbacks(wipe, (w) => w !== null);

  return (
    <RenderGuardedComponent
      props={neededVWC}
      component={(needed) => (!needed ? <></> : <WipeTransitionOverlayNeeded wipe={wipe} />)}
    />
  );
};

const WipeTransitionOverlayNeeded = ({ wipe }: WipeTransitionOverlayProps): ReactElement => {
  const windowSizeVWC = useWindowSizeValueWithCallbacks();

  const directionVWC = useMappedValueWithCallbacks(wipe, (w) => w?.direction ?? 'up');

  // we reparameterize the wipe to account for a faded edge
  // instead of height from 0 to 1, its height from -0.25 to 1
  const hardHeightTopVWC = useMappedValueWithCallbacks(wipe, (w) => {
    const time = w?.heightPercentage ?? 0;
    return time * 1.25 - 0.25;
  });

  const hardHeightTopClippedVWC = useMappedValueWithCallbacks(hardHeightTopVWC, (h) =>
    Math.max(0, h)
  );

  const hardHeightContainerRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const hardHeightContainerStyleVWC = useMappedValuesWithCallbacks(
    [windowSizeVWC, directionVWC, hardHeightTopClippedVWC],
    (): CSSProperties => {
      const size = windowSizeVWC.get();
      const hardHeight = hardHeightTopClippedVWC.get();
      const direction = directionVWC.get();

      return {
        top: direction === 'up' ? '0' : undefined,
        bottom: direction === 'down' ? '0' : undefined,
        left: '0',
        right: '0',
        height: `${size.height * hardHeight}px`,
      };
    }
  );
  useStyleVWC(hardHeightContainerRef, hardHeightContainerStyleVWC);

  const gradientContainerRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const gradientStyleVWC = useMappedValueWithCallbacks(
    windowSizeVWC,
    (size): CSSProperties => ({
      width: `${size.width}px`,
      height: `${size.height}px`,
    })
  );
  useStyleVWC(gradientContainerRef, gradientStyleVWC);

  const bottomGradientContainerRef = useWritableValueWithCallbacks<HTMLDivElement | null>(
    () => null
  );

  const bottomGradientStateVWC = useMappedValuesWithCallbacks(
    [hardHeightTopVWC, directionVWC],
    (): string => {
      const hardHeight = hardHeightTopVWC.get();
      const direction = directionVWC.get();

      const startColor = (() => {
        const stop1 = [20 / 255, 25 / 255, 28 / 255]; // at the top
        const stop2 = [1 / 255, 1 / 255, 1 / 255]; // at the bottom

        const fromTop = direction === 'up' ? hardHeight : 1 - hardHeight;
        if (fromTop <= 0) {
          return stop1;
        }
        if (fromTop >= 1) {
          return stop2;
        }
        return interpolateColor(stop1, stop2, fromTop);
      })();

      return `linear-gradient(180deg, ${colorToCSS([
        startColor[0],
        startColor[1],
        startColor[2],
        1,
      ])}, #00000000)`;
    }
  );
  const bottomGradientStyleVWC = useMappedValuesWithCallbacks(
    [windowSizeVWC, hardHeightTopVWC, directionVWC, bottomGradientStateVWC],
    (): CSSProperties => {
      const size = windowSizeVWC.get();
      const hardHeight = hardHeightTopVWC.get();
      const direction = directionVWC.get();

      return {
        position: 'absolute',
        width: `${size.width}px`,
        height: `${size.height * 0.2}px`,
        left: '0',
        top: direction === 'up' ? `${hardHeight * size.height}px` : undefined,
        bottom: direction === 'down' ? `${hardHeight * size.height}px` : undefined,
        display: 'flex',
        background: bottomGradientStateVWC.get(),
      };
    }
  );
  useStyleVWC(bottomGradientContainerRef, bottomGradientStyleVWC);

  return (
    <div className={styles.outerContainer}>
      <div
        className={styles.container}
        style={hardHeightContainerStyleVWC.get()}
        ref={(r) => setVWC(hardHeightContainerRef, r)}>
        <div
          className={styles.background}
          style={gradientStyleVWC.get()}
          ref={(r) => setVWC(gradientContainerRef, r)}
        />
      </div>
      <div
        style={bottomGradientStyleVWC.get()}
        ref={(r) => setVWC(bottomGradientContainerRef, r)}
      />
    </div>
  );
};
