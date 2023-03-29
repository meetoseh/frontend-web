import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../shared/forms/Button';
import { usePublicInteractivePrompt } from '../../shared/hooks/usePublicInteractivePrompt';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { OsehImageFromState } from '../../shared/OsehImage';
import { InteractivePromptRouter } from '../interactive_prompt/components/InteractivePromptRouter';
import { useJourneyShared } from '../journey/hooks/useJourneyShared';
import { JourneyRouterScreenId } from '../journey/JourneyRouter';
import { JourneyRef } from '../journey/models/JourneyRef';
import { Journey } from '../journey/screens/Journey';
import { JourneyStart } from '../journey/screens/JourneyStart';
import { SplashScreen } from '../splash/SplashScreen';
import styles from './OnboardingJourney.module.css';

type OnboardingJourneyProps = {
  /**
   * The introductory journey to take the user through
   */
  journey: JourneyRef;

  /**
   * The function to call when the required assets are ready. Passed
   * a function to call to start the audio, which must be done in
   * response to a user interaction.
   */
  onLoaded: (play: () => Promise<void>) => void;

  /**
   * The function to call when the user completed the onboarding journey
   * and should continue with onboarding.
   */
  onFinished: () => void;
};

/**
 * Plays the onboarding journey, which is an abbreviated, reversed experience
 * intended to introduce the user to the app. This starts with the audio clip,
 * followed by a special interactive prompt
 */
export const OnboardingJourney = ({
  journey,
  onLoaded,
  onFinished: innerOnFinished,
}: OnboardingJourneyProps): ReactElement => {
  const shared = useJourneyShared(journey);
  const [playing, setPlaying] = useState(false);
  const [finishedAudio, setFinishedAudio] = useState(false);
  const followupPrompt = usePublicInteractivePrompt({
    identifier: 'onboarding-prompt-feeling-result',
  });
  const windowSize = useWindowSize();
  const containerStyle = useMemo(() => {
    return {
      width: windowSize.width,
      height: windowSize.height,
    };
  }, [windowSize.width, windowSize.height]);
  const leavingCallback = useRef<(() => void) | null>(null);
  const [followupPromptResponse, setFollowupPromptResponse] = useState<string | null>(null);

  const onFinished = useCallback(() => {
    leavingCallback.current?.();
    innerOnFinished();
  }, [innerOnFinished]);

  useEffect(() => {
    const play = shared.audio?.play;
    if (shared.audio?.loaded && !shared.imageLoading && play !== undefined && play !== null) {
      onLoaded(() => {
        const res = play();
        setPlaying(true);
        return res;
      });
    }
  }, [shared.audio?.loaded, shared.imageLoading, shared.audio?.play, onLoaded]);

  useEffect(() => {
    if (followupPrompt.error !== null && finishedAudio) {
      onFinished();
    }
  }, [followupPrompt.error, finishedAudio, onFinished]);

  const handleSetScreen = useCallback(
    (
      screen: JourneyRouterScreenId | ((oldScreen: JourneyRouterScreenId) => JourneyRouterScreenId)
    ) => {
      if (typeof screen === 'function') {
        screen = screen(playing ? 'journey' : 'start');
      }

      if (screen === 'journey') {
        if (!playing && shared.audio?.play) {
          shared.audio.play();
          setPlaying(true);
        }
      } else {
        setFinishedAudio(true);
      }
    },
    [playing, shared.audio]
  );

  if (!shared.audio?.loaded || shared.imageLoading) {
    return <></>;
  }

  if (finishedAudio) {
    if (followupPrompt.prompt === null) {
      return <SplashScreen />;
    }

    return (
      <div className={styles.container} style={containerStyle}>
        <div className={styles.backgroundContainer}>
          <OsehImageFromState {...shared.image!} />
        </div>
        <div className={styles.contentContainer}>
          <InteractivePromptRouter
            prompt={followupPrompt.prompt}
            onFinished={onFinished}
            onWordPromptResponse={setFollowupPromptResponse}
            paused={!finishedAudio}
            leavingCallback={leavingCallback}
            finishEarly
          />
        </div>
      </div>
    );
  }

  if (!playing) {
    return (
      <JourneyStart
        journey={journey}
        shared={shared}
        setScreen={handleSetScreen}
        isOnboarding
        onJourneyFinished={onFinished}
      />
    );
  }

  return (
    <Journey
      journey={journey}
      shared={shared}
      setScreen={handleSetScreen}
      onJourneyFinished={onFinished}
      isOnboarding
    />
  );
};
