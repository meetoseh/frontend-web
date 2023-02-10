import { ReactElement, useContext, useEffect, useRef } from 'react';
import { useFullHeight } from '../../../shared/hooks/useFullHeight';
import { LoginContext } from '../../../shared/LoginContext';
import { OsehImageFromState } from '../../../shared/OsehImage';
import { useJoinLeave } from '../hooks/useJoinLeave';
import { useJourneyTime } from '../hooks/useJourneyTime';
import { useProfilePictures } from '../hooks/useProfilePictures';
import { useStats } from '../hooks/useStats';
import styles from './Journey.module.css';
import assistiveStyles from '../../../shared/assistive.module.css';
import { JourneyLikes } from '../components/JourneyLikes';
import { JourneyProfilePictures } from '../components/JourneyProfilePictures';
import { JourneyPrompt } from '../components/JourneyPrompt';
import { JourneyScreenProps } from '../models/JourneyScreenProps';

/**
 * Takes the meta information about a journey returned from any of the endpoints
 * which start a session in the journey (e.g., start_random), then uses that to
 * connect to the "live" information (the true live events, the historical
 * events, profile pictures, and the stats endpoints) and playback the journey
 * to the user, while they are allowed to engage via the prompt and a "like"
 * button.
 */
export const Journey = ({
  journey,
  shared,
  setScreen,
  onJourneyFinished,
}: JourneyScreenProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const journeyTime = useJourneyTime(0, true);
  const profilePictures = useProfilePictures({
    journeyUid: journey.uid,
    journeyJwt: journey.jwt,
    journeyDurationSeconds: journey.durationSeconds,
    journeyTime,
  });
  const stats = useStats({
    journeyUid: journey.uid,
    journeyJwt: journey.jwt,
    journeyDurationSeconds: journey.durationSeconds,
    journeyPrompt: journey.prompt,
    journeyTime,
  });
  useJoinLeave({
    journeyUid: journey.uid,
    journeyJwt: journey.jwt,
    sessionUid: journey.sessionUid,
    journeyDurationSeconds: journey.durationSeconds,
    journeyTime,
    loginContext,
  });

  const containerRef = useRef<HTMLDivElement>(null);

  useFullHeight({ element: containerRef, attribute: 'minHeight', windowSize: shared.windowSize });

  useEffect(() => {
    let active = true;

    const onJourneyTimeChanged = (oldTime: DOMHighResTimeStamp, newTime: DOMHighResTimeStamp) => {
      if (!active) {
        return;
      }

      if (oldTime < journey.durationSeconds * 1000 && newTime >= journey.durationSeconds * 1000) {
        onJourneyFinished();
        unmount();
      }
    };

    const predictedIndex = journeyTime.onTimeChanged.current.length;
    journeyTime.onTimeChanged.current.push(onJourneyTimeChanged);

    const unmount = () => {
      if (!active) {
        return;
      }

      active = false;
      for (let i = predictedIndex; i >= 0; i--) {
        if (journeyTime.onTimeChanged.current[i] === onJourneyTimeChanged) {
          journeyTime.onTimeChanged.current.splice(i, 1);
          break;
        }
      }
    };
    return unmount;
  }, [journeyTime.onTimeChanged, journey.durationSeconds, onJourneyFinished]);

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.backgroundImageContainer}>
        {shared.image && <OsehImageFromState {...shared.image} />}
      </div>
      <div className={styles.closeButtonContainer}>
        <div className={styles.closeButtonInnerContainer}>
          <button type="button" className={styles.close} onClick={onJourneyFinished}>
            <div className={styles.closeIcon} />
            <div className={assistiveStyles.srOnly}>Close</div>
          </button>
        </div>
      </div>
      <div className={styles.innerContainer}>
        <div className={styles.content}>
          <div className={styles.profilePicturesContainer}>
            <JourneyProfilePictures pictures={profilePictures} users={stats.users} />
          </div>
          <div className={styles.promptContainer}>
            <JourneyPrompt
              journeyUid={journey.uid}
              journeyJwt={journey.jwt}
              journeyDurationSeconds={journey.durationSeconds}
              journeyTime={journeyTime}
              sessionUid={journey.sessionUid}
              prompt={journey.prompt}
              stats={stats}
              loginContext={loginContext}
            />
          </div>
          <div className={styles.chatAndLikesContainer}>
            <div className={styles.likesContainer}>
              <JourneyLikes
                journeyUid={journey.uid}
                journeyJwt={journey.jwt}
                sessionUid={journey.sessionUid}
                journeyTime={journeyTime}
                likes={stats.likes}
                loginContext={loginContext}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
