import { ReactElement, useCallback, useState } from 'react';
import { OnboardingStepComponentProps } from '../../models/OnboardingStep';
import { OnboardingClassState } from './OnboardingClassState';
import { OnboardingClassResources } from './OnboardingClassResources';
import { JourneyStart } from '../../../journey/screens/JourneyStart';
import { Journey } from '../../../journey/screens/Journey';

export const OnboardingClass = ({
  state,
  resources,
}: OnboardingStepComponentProps<OnboardingClassState, OnboardingClassResources>): ReactElement => {
  // we started playing is just to ensure we rerender if journey start is used
  const [weStartedPlaying, setWeStartedPlaying] = useState(false);

  const playAudio = useCallback(() => {
    if (resources.shared?.audio?.play) {
      resources.shared.audio.play.call(undefined);
      resources.playing.current = true;
      setWeStartedPlaying(true);
    }
  }, [resources.shared?.audio?.play, resources.playing]);

  const onFinished = useCallback(() => {
    state.onContinue.call(undefined);
  }, [state.onContinue]);

  if (
    resources.journey === null ||
    resources.shared === null ||
    resources.shared.audio === null ||
    !resources.shared.audio.loaded ||
    resources.shared.image === null ||
    resources.shared.image.loading ||
    resources.shared.audio.audioRef.current === null
  ) {
    return <></>;
  }

  if (!resources.playing.current && !weStartedPlaying) {
    return (
      <JourneyStart
        journey={resources.journey}
        shared={resources.shared}
        setScreen={playAudio}
        isOnboarding
        onJourneyFinished={onFinished}
      />
    );
  }

  return (
    <Journey
      journey={resources.journey}
      shared={resources.shared}
      setScreen={onFinished}
      isOnboarding
      onJourneyFinished={onFinished}
    />
  );
};
