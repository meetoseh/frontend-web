import { ReactElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useFullHeight } from '../../shared/hooks/useFullHeight';
import { LoginContext } from '../../shared/LoginContext';
import { OsehImageFromState } from '../../shared/OsehImage';
import { useHistoricalEvents } from './hooks/useHistoricalEvents';
import { useJoinLeave } from './hooks/useJoinLeave';
import { useJourneyTime } from './hooks/useJourneyTime';
import { useLiveEvents } from './hooks/useLiveEvents';
import { useProfilePictures } from './hooks/useProfilePictures';
import { useStats } from './hooks/useStats';
import styles from './Journey.module.css';
import { JourneyAndJourneyStartShared, JourneyRef } from './JourneyAndJourneyStartShared';
import { JourneyAudio } from './JourneyAudio';
import { JourneyChat } from './JourneyChat';
import { JourneyLikes } from './JourneyLikes';
import { JourneyProfilePictures } from './JourneyProfilePictures';
import { JourneyPrompt } from './JourneyPrompt';

type JourneyProps = {
  /**
   * The journey to show
   */
  journey: JourneyRef;

  /**
   * Shared information between us and the previous screen to reduce
   * redundant requests
   */
  shared: JourneyAndJourneyStartShared;

  /**
   * Called when the loaded state of the journey changes. The journey
   * should not be started until it's loaded.
   */
  setLoaded: (loaded: boolean) => void;

  /**
   * Called with a function that can be used to start the journey. This
   * must be called in a privileged context, i.e., immediately after
   * a user interaction. May be unavailable if already started or not
   * yet loaded.
   */
  doStart: (this: void, start: ((this: void) => void) | null) => void;

  /**
   * Called when the journey finishes
   */
  onFinished: () => void;
};

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
  setLoaded,
  doStart,
  onFinished,
}: JourneyProps): ReactElement => {
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
  const historicalEvents = useHistoricalEvents({
    journeyUid: journey.uid,
    journeyJwt: journey.jwt,
    journeyDurationSeconds: journey.durationSeconds,
    journeyTime,
  });
  const liveEvents = useLiveEvents({
    journeyUid: journey.uid,
    journeyJwt: journey.jwt,
    journeyDurationSeconds: journey.durationSeconds,
    journeyTime,
  });
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [playAudio, setPlayAudio] = useState<((this: void) => Promise<void>) | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const setPlayAudioWithFunc = useCallback((play: ((this: void) => Promise<void>) | null) => {
    setPlayAudio(() => play);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);

  useFullHeight({ element: containerRef, attribute: 'minHeight', windowSize: shared.windowSize });

  useEffect(() => {
    let active = true;

    const onJourneyTimeChanged = (oldTime: DOMHighResTimeStamp, newTime: DOMHighResTimeStamp) => {
      if (!active) {
        return;
      }

      if (oldTime < journey.durationSeconds * 1000 && newTime >= journey.durationSeconds * 1000) {
        onFinished();
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
  }, [journeyTime.onTimeChanged, journey.durationSeconds, onFinished]);

  useEffect(() => {
    if (isLoaded) {
      return;
    }

    if (!shared.imageLoading && audioLoaded && playAudio !== null) {
      doStart(() => {
        playAudio();
        journeyTime.setPaused.bind(undefined)(false);
        doStart(null);
      });
      setIsLoaded(true);
    }
  }, [isLoaded, shared.imageLoading, audioLoaded, playAudio, doStart, journeyTime.setPaused]);

  useEffect(() => {
    setLoaded(isLoaded);
  }, [isLoaded, setLoaded]);

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.backgroundImageContainer}>
        {shared.image && <OsehImageFromState {...shared.image} />}
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
            <div className={styles.chatContainer}>
              <JourneyChat
                historicalEvents={historicalEvents}
                liveEvents={liveEvents}
                prompt={journey.prompt}
              />
            </div>
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
      <JourneyAudio
        audioContent={journey.audioContent}
        setLoaded={setAudioLoaded}
        doPlay={setPlayAudioWithFunc}
      />
    </div>
  );
};
