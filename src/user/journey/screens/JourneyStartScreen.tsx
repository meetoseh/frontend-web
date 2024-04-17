import { ReactElement, useCallback, useRef } from 'react';
import { Button } from '../../../shared/forms/Button';
import { useFullHeight } from '../../../shared/hooks/useFullHeight';
import { JourneyScreenProps } from '../models/JourneyScreenProps';
import styles from './JourneyStartScreen.module.css';
import { Journey } from './Journey';
import { combineClasses } from '../../../shared/lib/combineClasses';
import { OsehImageFromStateValueWithCallbacks } from '../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { useUnwrappedValueWithCallbacks } from '../../../shared/hooks/useUnwrappedValueWithCallbacks';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { useWindowSizeValueWithCallbacks } from '../../../shared/hooks/useWindowSize';

/**
 * Shows a screen allowing the user to perform an interaction to start the
 * journey, as well as potentially other social actions.
 *
 * This is useful for elevating to a privileged context, which is required
 * for starting the journey audio.
 */
export const JourneyStartScreen = ({
  journey,
  shared,
  setScreen,
  isOnboarding,
  onJourneyFinished,
  selectedEmotionAntonym,
  takeAnother,
  duration = '1-minute',
}: JourneyScreenProps & {
  selectedEmotionAntonym?: string;
  duration?: string;
}): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioReady = useUnwrappedValueWithCallbacks(
    useMappedValueWithCallbacks(shared, (s) => s.audio.element !== null)
  );

  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  useFullHeight({ element: containerRef, attribute: 'minHeight', windowSizeVWC });

  const onSkipClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setScreen('journey', true);
    },
    [setScreen]
  );

  const darkenedImage = useMappedValueWithCallbacks(shared, (s) => s.darkenedImage);

  if (selectedEmotionAntonym === undefined) {
    return (
      <div className={styles.container} ref={containerRef}>
        <div className={styles.backgroundImageContainer}>
          <OsehImageFromStateValueWithCallbacks state={darkenedImage} />
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
              <Button
                type="button"
                fullWidth={true}
                onClick={onSkipClick}
                disabled={!audioReady}
                spinner={!audioReady}>
                {audioReady ? <>Let&rsquo;s Go</> : <>Loading...</>}
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
          takeAnother={takeAnother}
        />
      </div>
      <div className={combineClasses(styles.innerContainer, styles.foreground)}>
        <div className={styles.content}>
          <div className={styles.title}>
            Here&rsquo;s a {duration} {journey.category.externalName.toLocaleLowerCase()} class to
            help you {selectedEmotionAntonym.toLocaleLowerCase()} with {journey.instructor.name}.
          </div>
          <div className={styles.skipForNowContainer}>
            <Button
              type="button"
              variant="filled-white"
              fullWidth={true}
              onClick={onSkipClick}
              disabled={!audioReady}
              spinner={!audioReady}>
              {audioReady ? <>Let&rsquo;s Go</> : <>Loading...</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
