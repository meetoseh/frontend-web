import { ReactElement, useContext, useEffect, useState } from 'react';
import { LoginContext } from '../../shared/LoginContext';
import { OsehContentRef } from '../../shared/OsehContent';
import { OsehImage, OsehImageRef } from '../../shared/OsehImage';
import { useJoinLeave } from './hooks/useJoinLeave';
import { useJourneyTime } from './hooks/useJourneyTime';
import { useProfilePictures } from './hooks/useProfilePictures';
import { useStats } from './hooks/useStats';
import styles from './Journey.module.css';
import { JourneyProfilePictures } from './JourneyProfilePictures';

/**
 * A prompt where we show a number spinner and the user selects
 * a number from that.
 */
type NumericPrompt = {
  /**
   * The style of the prompt. This is always 'numeric' for this type.
   */
  style: 'numeric';

  /**
   * The text to show to the user which they use to select a number.
   */
  text: string;

  /**
   * The minimum number that the user can select. Integer value, inclusive.
   */
  min: number;

  /**
   * The maximum number that the user can select. Integer value, inclusive.
   */
  max: number;

  /**
   * The step size between numbers. Integer value, results in about 10 or
   * fewer numbers being shown.
   */
  step: number;
};

/**
 * A prompt where we show the user a button and they can press (and hold)
 * whenever they want.
 */
type PressPrompt = {
  /**
   * The style of the prompt. This is always 'press' for this type.
   */
  style: 'press';

  /**
   * The text to show to the user which they use to decide when to press
   */
  text: string;
};

/**
 * A prompt where we show the user multiple colors and they select one.
 */
type ColorPrompt = {
  /**
   * The style of the prompt. This is always 'color' for this type.
   */
  style: 'color';

  /**
   * The text to show to the user which they use to decide which color to select.
   */
  text: string;

  /**
   * The colors the user can choose from; 2-8 colors as rgb strings, e.g., #ff0000
   */
  colors: string[];
};

/**
 * A prompt where we show the user multiple words and they select one.
 */
type WordPrompt = {
  /**
   * The style of the prompt. This is always 'word' for this type.
   */
  style: 'word';

  /**
   * The text to show to the user which they use to decide which word to select.
   */
  text: string;

  /**
   * The words the user can choose from; 2-8 words as strings
   */
  options: string[];
};

/**
 * A prompt that a journey can have
 */
export type Prompt = NumericPrompt | PressPrompt | ColorPrompt | WordPrompt;

export type JourneyRef = {
  /**
   * The UID of the journey to show. When the journey is initialized, this
   * already has a session active, but that session doesn't yet have any events
   * (including the join event)
   */
  uid: string;

  /**
   * The UID of the session within the journey that we will add events to when
   * the user interacts with the journey.
   */
  sessionUid: string;

  /**
   * The JWT which allows us access to the journey and session
   */
  jwt: string;

  /**
   * The duration of the journey in seconds, which should match the audio content
   */
  durationSeconds: number;

  /**
   * The image to show as the background of the journey
   */
  backgroundImage: OsehImageRef;

  /**
   * The audio file to play during the journey
   */
  audioContent: OsehContentRef;

  /**
   * The category of the journey
   */
  category: {
    /**
     * The name of the category, as we show users
     */
    externalName: string;
  };

  /**
   * The very short title for the journey
   */
  title: string;

  /**
   * Who made the journey
   */
  instructor: {
    /**
     * Their display name
     */
    name: string;
  };

  /**
   * A brief description of what to expect in the journey
   */
  description: {
    /**
     * As raw text
     */
    text: string;
  };

  /**
   * The prompt to show to the user during the journey
   */
  prompt: Prompt;
};

type JourneyProps = {
  /**
   * The journey to show
   */
  journey: JourneyRef;

  /**
   * Called when the loaded state of the journey changes
   */
  setLoaded: (loaded: boolean) => void;

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
export const Journey = ({ journey, setLoaded, onFinished }: JourneyProps): ReactElement => {
  const [windowSize, setWindowSize] = useState<{ width: number; height: number }>({
    width: document.body.clientWidth,
    height: window.innerHeight,
  });
  const loginContext = useContext(LoginContext);
  const [imageLoading, setImageLoading] = useState(true);
  const [journeyStarted, setJourneyStarted] = useState(false);
  const journeyTime = useJourneyTime(-2500);
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

  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;
    const postDebounce = () => {
      timeout = null;
      setWindowSize({ width: document.body.clientWidth, height: window.innerHeight });
    };

    const onWindowResize = () => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(postDebounce, 250);
    };

    window.addEventListener('resize', onWindowResize);

    return () => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }

      window.removeEventListener('resize', onWindowResize);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const onJourneyTimeChanged = (oldTime: DOMHighResTimeStamp, newTime: DOMHighResTimeStamp) => {
      if (!active) {
        return;
      }

      if (oldTime < 0 && newTime >= 0) {
        setJourneyStarted(true);
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
  }, [journeyTime.onTimeChanged]);

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
    setLoaded(!imageLoading && journeyStarted);
  }, [imageLoading, journeyStarted, setLoaded]);

  return (
    <div className={styles.container}>
      <div className={styles.backgroundImageContainer}>
        <OsehImage
          uid={journey.backgroundImage.uid}
          jwt={journey.backgroundImage.jwt}
          displayWidth={windowSize.width}
          displayHeight={windowSize.height}
          alt=""
          setLoading={setImageLoading}
        />
      </div>
      <div className={styles.innerContainer}>
        <div className={styles.content}>
          <div className={styles.profilePicturesContainer}>
            <JourneyProfilePictures pictures={profilePictures} users={stats.users} />
          </div>
        </div>
      </div>
    </div>
  );
};
