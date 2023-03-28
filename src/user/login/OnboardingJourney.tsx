import { ReactElement, useCallback, useEffect, useState } from 'react';
import { useJourneyShared } from '../journey/hooks/useJourneyShared';
import { JourneyRouterScreenId } from '../journey/JourneyRouter';
import { JourneyRef } from '../journey/models/JourneyRef';
import { Journey } from '../journey/screens/Journey';
import { JourneyStart } from '../journey/screens/JourneyStart';

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
 * followed by a special interactive prompt and informational splash screen.
 */
export const OnboardingJourney = ({
  journey,
  onLoaded,
  onFinished,
}: OnboardingJourneyProps): ReactElement => {
  const shared = useJourneyShared(journey);
  const [playing, setPlaying] = useState(false);

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
        onFinished();
      }
    },
    [onFinished, playing, shared.audio]
  );

  if (!shared.audio?.loaded || shared.imageLoading) {
    return <></>;
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
