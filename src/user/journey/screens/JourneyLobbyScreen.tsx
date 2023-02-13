import { ReactElement, useContext, useEffect, useRef } from 'react';
import { useFullHeight } from '../../../shared/hooks/useFullHeight';
import { LoginContext } from '../../../shared/LoginContext';
import { OsehImageFromState } from '../../../shared/OsehImage';
import { useJoinLeave } from '../hooks/useJoinLeave';
import { useCoarseTime, useJourneyTime } from '../hooks/useJourneyTime';
import { useProfilePictures } from '../hooks/useProfilePictures';
import { useStats } from '../hooks/useStats';
import { JourneyScreenProps } from '../models/JourneyScreenProps';
import '../../../assets/fonts.css';
import assistiveStyles from '../../../shared/assistive.module.css';
import styles from './JourneyLobbyScreen.module.css';
import { JourneyPrompt } from '../components/JourneyPrompt';
import { JourneyProfilePictures } from '../components/JourneyProfilePictures';
import { useWindowSize } from '../../../shared/hooks/useWindowSize';

const profilePicturesRequiredHeight = 844;

/**
 * Shows the screen for the lobby prior to the actual class, where the user
 * can answer a prompt while they wait. Also useful for hiding the audio loading
 * time, which allows higher quality audio on lower-end devices.
 */
export const JourneyLobbyScreen = ({
  journey,
  shared,
  setScreen,
  onJourneyFinished,
}: JourneyScreenProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const journeyTime = useJourneyTime(0, false);
  const windowSize = useWindowSize();
  const profilePicturesEnabled = windowSize.height >= profilePicturesRequiredHeight;
  const profilePictures = useProfilePictures({
    journeyUid: journey.uid,
    journeyJwt: journey.jwt,
    journeyLobbyDurationSeconds: journey.lobbyDurationSeconds,
    journeyTime,
    enabled: profilePicturesEnabled,
  });
  const stats = useStats({
    journeyUid: journey.uid,
    journeyJwt: journey.jwt,
    journeyLobbyDurationSeconds: journey.lobbyDurationSeconds,
    journeyPrompt: journey.prompt,
    journeyTime,
  });
  useJoinLeave({
    journeyUid: journey.uid,
    journeyJwt: journey.jwt,
    sessionUid: journey.sessionUid,
    journeyLobbyDurationSeconds: journey.lobbyDurationSeconds,
    journeyTime,
    loginContext,
  });

  useEffect(() => {
    let active = true;

    const onJourneyTimeChanged = (oldTime: DOMHighResTimeStamp, newTime: DOMHighResTimeStamp) => {
      if (!active) {
        return;
      }

      if (
        oldTime < journey.lobbyDurationSeconds * 1000 &&
        newTime >= journey.lobbyDurationSeconds * 1000
      ) {
        setScreen('start');
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
  }, [journeyTime.onTimeChanged, journey.lobbyDurationSeconds, setScreen]);

  const coarsenedJourneyTime = useCoarseTime(journeyTime, 1000, 0, false);

  const containerRef = useRef<HTMLDivElement>(null);

  useFullHeight({ element: containerRef, attribute: 'minHeight', windowSize: shared.windowSize });

  return (
    <div ref={containerRef} className={styles.container}>
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
          <div className={styles.countdown}>
            <div className={styles.countdownTitle}>Class is almost ready</div>
            <div className={styles.countdownText}>
              {Math.max(Math.ceil(journey.lobbyDurationSeconds - coarsenedJourneyTime), 0)}
            </div>
          </div>
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
        {profilePicturesEnabled && (
          <div className={styles.profilePicturesContainer}>
            <JourneyProfilePictures pictures={profilePictures} users={stats.users} />
          </div>
        )}
      </div>
    </div>
  );
};
