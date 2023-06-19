import { ReactElement, useCallback, useRef } from 'react';
import { Button } from '../../../shared/forms/Button';
import { useFullHeight } from '../../../shared/hooks/useFullHeight';
import { JourneyScreenProps } from '../models/JourneyScreenProps';
import styles from './JourneyStart.module.css';
import { Journey } from './Journey';
import { combineClasses } from '../../../shared/lib/combineClasses';
import { OsehImageFromState } from '../../../shared/images/OsehImageFromState';

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
  onJourneyFinished,
  selectedEmotionAntonym,
}: JourneyScreenProps & {
  selectedEmotionAntonym?: string;
}): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);

  useFullHeight({ element: containerRef, attribute: 'minHeight', windowSize: shared.windowSize });

  const onSkipClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      shared.audio!.play!();
      setScreen('journey', true);
    },
    [setScreen, shared.audio]
  );

  if (selectedEmotionAntonym === undefined) {
    return (
      <div className={styles.container} ref={containerRef}>
        <div className={styles.backgroundImageContainer}>
          <OsehImageFromState {...shared.darkenedImage} />
        </div>

        <div className={styles.innerContainer}>
          <div className={styles.content}>
            <div className={styles.title}>Your Class is Ready</div>
            <div className={styles.description}>
              Put on your headset, get comfortable, and prepare for a short audio experience.
            </div>
            <div className={styles.journeyTitle}>{journey.title}</div>
            <div className={styles.journeyDescription}>{journey.description.text}</div>
            <div className={styles.skipForNowContainer}>
              <Button type="button" fullWidth={true} onClick={onSkipClick}>
                Let&rsquo;s Go
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.backgroundContainer}>
        <Journey
          journey={journey}
          shared={shared}
          setScreen={setScreen}
          isOnboarding={isOnboarding}
          onJourneyFinished={onJourneyFinished}
        />
      </div>
      <div className={combineClasses(styles.innerContainer, styles.foreground)}>
        <div className={styles.content}>
          <div className={styles.title}>
            Here&rsquo;s a 1-minute {journey.category.externalName.toLocaleLowerCase()} class to
            help you {selectedEmotionAntonym.toLocaleLowerCase()} with {journey.instructor.name}.
          </div>
          <div className={styles.skipForNowContainer}>
            <Button type="button" variant="filled-white" fullWidth={true} onClick={onSkipClick}>
              Let&rsquo;s Go
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
