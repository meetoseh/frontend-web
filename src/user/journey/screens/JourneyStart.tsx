import { ReactElement, useCallback, useRef } from 'react';
import { Button } from '../../../shared/forms/Button';
import { useFullHeight } from '../../../shared/hooks/useFullHeight';
import { OsehImageFromState } from '../../../shared/OsehImage';
import { JourneyScreenProps } from '../models/JourneyScreenProps';
import styles from './JourneyStart.module.css';

/**
 * Shows a screen allowing the user to perform an interaction to start the
 * journey, as well as potentially other social actions.
 *
 * This is useful for elevating to a privileged context, which is required
 * for starting the journey audio.
 */
export const JourneyStart = ({
  journey,
  shared,
  setScreen,
  isOnboarding,
}: JourneyScreenProps): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);

  useFullHeight({ element: containerRef, attribute: 'minHeight', windowSize: shared.windowSize });

  const onSkipClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      shared.audio!.play!();
      setScreen('journey');
    },
    [setScreen, shared.audio]
  );

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.backgroundImageContainer}>
        {shared.image && <OsehImageFromState {...shared.image} />}
      </div>

      <div className={styles.innerContainer}>
        <div className={styles.content}>
          <div className={styles.title}>Your Class is Ready</div>
          {isOnboarding && (
            <>
              <div className={styles.description}>
                Put on your headset, get comfortable, and prepare for a 1 minute audio experience.
              </div>
              <div className={styles.journeyTitle}>{journey.title}</div>
              <div className={styles.journeyDescription}>{journey.description.text}</div>
            </>
          )}
          <div className={styles.skipForNowContainer}>
            <Button type="button" fullWidth={true} onClick={onSkipClick}>
              Let&rsquo;s Go
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
