import { ReactElement } from 'react';
import { useFullHeightStyle } from '../../shared/hooks/useFullHeight';
import { LoginContextValue } from '../../shared/LoginContext';
import { MyProfilePictureState } from '../../shared/MyProfilePicture';
import { OsehImageFromState, OsehImageState } from '../../shared/OsehImage';
import { JourneyRef } from '../journey/models/JourneyRef';
import { DailyEventJourney } from './DailyEvent';
import styles from './DailyEventJourneyCard.module.css';

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
   * Called when we receive a ref to the journey that the user should be directed
   * to
   *
   * @param journey The journey that the user should be directed to
   */
  setJourney: (this: void, journey: JourneyRef) => void;
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
  setJourney,
}: DailyEventJourneyCardState): ReactElement => {
  const containerStyle = useFullHeightStyle({ attribute: 'height', windowSize });

  return (
    <div className={styles.container} style={containerStyle}>
      <div className={styles.imageContainer}>
        <OsehImageFromState {...background} />
      </div>
      <div className={styles.content}>
        <div className={styles.header}>
          {profilePicture.state === 'available' && profilePicture.image !== null && (
            <div className={styles.profilePictureContainer}>
              <OsehImageFromState {...profilePicture.image} />
            </div>
          )}

          <div className={styles.headerRight}>
            <div className={styles.subtitle}>Hi {loginContext.userAttributes!.givenName}</div>
            <div className={styles.title}>Today&rsquo;s Journeys</div>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.title}>{journey.title}</div>
          <div className={styles.instructor}>{journey.instructor.name}</div>
          <div className={styles.description}>{journey.description.text}</div>
        </div>
      </div>
    </div>
  );
};
