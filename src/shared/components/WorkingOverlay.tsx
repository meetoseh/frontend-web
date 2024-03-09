import { ReactElement } from 'react';
import styles from './WorkingOverlay.module.css';
import { InlineOsehSpinner } from './InlineOsehSpinner';
import { FullHeightDiv } from './FullHeightDiv';
import { ValueWithCallbacks } from '../lib/Callbacks';
import { RenderGuardedComponent } from './RenderGuardedComponent';

/**
 * A basic full-width, full-height component that can be rendered without
 * a wrapper in the modals system to prevent clicking through and to
 * provide some feedback that the app is working.
 */
export const WorkingOverlay = ({
  title,
  progressBarFraction,
  variant,
}: {
  title?: string;
  progressBarFraction?: ValueWithCallbacks<number>;
  variant?: 'spinner' | 'nospinner';
}): ReactElement => {
  return (
    <FullHeightDiv className={styles.container}>
      {variant === 'spinner' && (
        <InlineOsehSpinner
          size={{
            type: 'react-rerender',
            props: {
              width: 80,
            },
          }}
        />
      )}
      {title !== undefined || progressBarFraction !== undefined ? (
        <div className={styles.progressContainer}>
          {title !== undefined && <div className={styles.title}>{title}</div>}
          {progressBarFraction !== undefined && (
            <RenderGuardedComponent
              props={progressBarFraction}
              component={(p) => <progress value={p} max={1} />}
            />
          )}
        </div>
      ) : undefined}
    </FullHeightDiv>
  );
};
