import { Fragment, ReactElement } from 'react';
import { ValueWithCallbacks } from '../../lib/Callbacks';
import styles from './RecordingBars.module.css';
import { RenderGuardedComponent } from '../RenderGuardedComponent';
import { HorizontalSpacer } from '../HorizontalSpacer';

export type RecordingBarSettings = {
  /** The available width in logical pixels */
  width: number;

  /** The height in logical pixels of the tallest possible bar */
  height: number;

  /** The color of the bars */
  color: string;

  /**
   * The width in pixels of an individual bar; if fewer bars can be rendered in the available
   * space then are specified, the oldest bars are dropped. If more bars can be
   * rendered, we fill to the right (leaving empty space on the left)
   */
  barWidth: number;

  /** The spacing between bars in logical pixels */
  barSpacing: number;

  /** how to align the bars when theres too much space */
  align: 'left' | 'right';
};

export type RecordingBarProps = {
  /**
   * Samples of the intensity of the audio, where the oldest sample is at the
   * beginning of the array and the newest sample is at the end
   */
  intensity: ValueWithCallbacks<Float32Array>;
  /**
   * A value that typically ranges from 0-1, where 0 means we just got the most
   * recent sample and 1 means we are just now due for the next sample
   */
  offset: ValueWithCallbacks<number>;

  /**
   * Configures how to render the bars representing time vs intensity
   */
  settings: RecordingBarSettings;
};

/**
 * Renders the stream of audio that is being recorded as a time vs intensity
 * graph
 */
export const RecordingBars = (props: RecordingBarProps): ReactElement => {
  const numberOfBars =
    Math.floor(
      (props.settings.width + props.settings.barSpacing) /
        (props.settings.barWidth + props.settings.barSpacing)
    ) + 1;
  const maxInnerWidth =
    (numberOfBars - 1) * (props.settings.barWidth + props.settings.barSpacing) -
    props.settings.barSpacing;
  return (
    <div
      className={styles.outerContainer}
      style={{
        width: `${props.settings.width}px`,
        height: `${props.settings.height}px`,
      }}>
      <div
        className={styles.innerContainer}
        style={{
          height: `${props.settings.height}px`,
          maxWidth: `${maxInnerWidth}px`,

          ...(props.settings.align === 'right'
            ? { right: `-${props.settings.barSpacing + props.settings.barWidth}px` }
            : {
                left: '0px',
              }),
        }}>
        <RenderGuardedComponent
          props={props.offset}
          component={(offset) => (
            <HorizontalSpacer
              width={(1 - offset) * (props.settings.barSpacing + props.settings.barWidth)}
            />
          )}
        />
        <RenderGuardedComponent
          props={props.intensity}
          component={(intensity) => {
            const bars: ReactElement[] = [];
            const realNumBars = Math.min(numberOfBars, intensity.length);
            const skippedBars = intensity.length - realNumBars;
            for (let i = skippedBars; i < intensity.length; i++) {
              const barHeight = intensity[i] * props.settings.height;
              bars.push(
                <Fragment key={i}>
                  <HorizontalSpacer width={props.settings.barSpacing} />
                  <div
                    style={{
                      height: `${barHeight}px`,
                      width: `${props.settings.barWidth}px`,
                      paddingLeft: `${props.settings.barWidth}px`,
                      backgroundColor: props.settings.color,
                      borderRadius: 2,
                    }}
                  />
                </Fragment>
              );
            }
            return <>{bars}</>;
          }}
        />
      </div>
    </div>
  );
};
