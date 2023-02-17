import { ReactElement, useCallback, useState } from 'react';
import { useFullHeightStyle } from '../../shared/hooks/useFullHeight';
import { LoginContextValue } from '../../shared/LoginContext';
import { MyProfilePictureState } from '../../shared/MyProfilePicture';
import { OsehImageFromState, OsehImageState } from '../../shared/OsehImage';
import { DailyEventJourney } from './DailyEvent';
import styles from './DailyEventJourneyCard.module.css';
import assistiveStyles from '../../shared/assistive.module.css';
import { describeError, ErrorBlock } from '../../shared/forms/ErrorBlock';

type DailyEventJourneyCardState = {
  /**
   * Information about the authenticated user
   */
  loginContext: LoginContextValue;

  /**
   * The journey that is being shown
   */
  journey: DailyEventJourney;

  /**
   * The size of the window we're displayed in
   */
  windowSize: { width: number; height: number };

  /**
   * The background image state
   */
  background: OsehImageState;

  /**
   * The profile picture to show
   */
  profilePicture: MyProfilePictureState;

  /**
   * How many journeys there are in total
   */
  numberOfJourneys: number;

  /**
   * The index of this journey within the journeys, in the original
   * carousel order
   */
  journeyIndex: number;

  /**
   * Called when the user wants to start this journey
   *
   * @param journey The journey that should be started. If the promise
   *   rejects, an error will be shown
   */
  onPlay: (this: void, journey: DailyEventJourney) => Promise<void>;
};

/**
 * Shows a single journey within a daily event; this has no side-effects so
 * that it can be rendered instantly without a flash of white. Hence anything
 * showing these cards is extremely coupled to this components implementation
 */
export const DailyEventJourneyCard = ({
  loginContext,
  journey,
  windowSize,
  background,
  profilePicture,
  numberOfJourneys,
  journeyIndex,
  onPlay,
}: DailyEventJourneyCardState): ReactElement => {
  const containerStyle = useFullHeightStyle({ attribute: 'height', windowSize });
  const contentStyle = useFullHeightStyle({ attribute: 'height', windowSize });
  const [error, setError] = useState<ReactElement | null>(null);
  const [loading, setLoading] = useState(false);

  const doPlay = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await onPlay(journey);
    } catch (e) {
      setError(await describeError(e));
    } finally {
      setLoading(false);
    }
  }, [onPlay, journey]);

  return (
    <div className={styles.container} style={containerStyle}>
      <div className={styles.imageContainer}>
        <OsehImageFromState {...background} />
      </div>
      <div className={styles.content} style={contentStyle}>
        <a href="/settings" className={styles.header}>
          {profilePicture.state === 'available' && profilePicture.image !== null && (
            <div className={styles.profilePictureContainer}>
              <OsehImageFromState {...profilePicture.image} />
            </div>
          )}

          <div className={styles.headerRight}>
            <div className={styles.subtitle}>Hi {loginContext.userAttributes!.givenName} 👋</div>
            <div className={styles.title}>Today&rsquo;s Journeys</div>
          </div>
        </a>

        {journey.access.start && (
          <div className={styles.playContainer}>
            <button type="button" className={styles.playButton} onClick={doPlay} disabled={loading}>
              <div className={assistiveStyles.srOnly}>Play</div>
              <div className={styles.playIcon} />
            </button>
          </div>
        )}

        <div className={styles.body}>
          {error && <ErrorBlock>{error}</ErrorBlock>}
          <div className={styles.info}>
            <div className={styles.infoTitle}>{journey.title}</div>
            <div className={styles.instructor}>{journey.instructor.name}</div>
            <div className={styles.description}>{journey.description.text}</div>
          </div>
          <div className={styles.dots}>
            {Array.from({ length: numberOfJourneys }, (_, i) => (
              <div key={i} className={i === journeyIndex ? styles.dotSelected : styles.dot} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
