import { ReactElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { PickEmotionJourneyResources } from './PickEmotionJourneyResources';
import { PickEmotionJourneyState } from './PickEmotionJourneyState';
import { JourneyLobbyScreen } from '../../../journey/screens/JourneyLobbyScreen';
import { Journey } from '../../../journey/screens/Journey';
import { SplashScreen } from '../../../splash/SplashScreen';
import { JourneyRouterScreenId } from '../../../journey/JourneyRouter';
import { JourneyPostScreen } from '../../../journey/screens/JourneyPostScreen';
import { JourneyShareScreen } from '../../../journey/screens/JourneyShareScreen';
import { JourneyStart } from '../../../journey/screens/JourneyStart';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { apiFetch } from '../../../../shared/ApiConstants';
import { JourneyFeedbackScreen } from '../../../journey/screens/JourneyFeedbackScreen';
import { PickEmotion } from './PickEmotion';
import { ECPPartialFeature } from './extended_classes_pack/ECPPartialFeature';

/**
 * The core screen where the user selects an emotion and the backend
 * uses that to select a journey
 */
export const PickEmotionJourney = ({
  state,
  resources,
  doAnticipateState,
}: FeatureComponentProps<PickEmotionJourneyState, PickEmotionJourneyResources>): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [step, setStep] = useState<{
    journeyUid: string | null;
    step: 'pick' | JourneyRouterScreenId;
  }>({ journeyUid: null, step: 'pick' });
  const stepRef = useRef(step);
  stepRef.current = step;

  const ecpState = ECPPartialFeature.useWorldState(resources.selected?.word ?? null);
  const ecpIsRequired = ECPPartialFeature.isRequired(ecpState);
  const ecpResources = ECPPartialFeature.useResources(ecpState, ecpIsRequired ?? false);

  useEffect(() => {
    if (resources.selected === null && step.step !== 'pick') {
      setStep({ journeyUid: null, step: 'pick' });
      return;
    }

    if (resources.selected !== null && step.step === 'pick' && resources.selected.skipsStats) {
      setStep({ journeyUid: resources.selected.journey.uid, step: 'lobby' });
      return;
    }

    if (
      resources.selected !== null &&
      step.step !== 'pick' &&
      step.journeyUid !== resources.selected.journey.uid
    ) {
      console.log('returning to pick screen because its a new journey');
      setStep({ journeyUid: null, step: 'pick' });
    }
  }, [step, resources.selected]);

  const gotoJourney = useCallback(() => {
    if (resources.selected === null) {
      console.warn('gotoJourney without a journey to goto');
      return;
    }
    setStep({ journeyUid: resources.selected.journey.uid, step: 'lobby' });
  }, [resources.selected]);

  const onFinishJourney = useCallback(() => {
    resources.onFinishedJourney.call(undefined);
    state.onFinishedClass.call(undefined);
    setStep({ journeyUid: null, step: 'pick' });
  }, [resources.onFinishedJourney, state.onFinishedClass]);

  const setScreen = useCallback(
    (
      screen: JourneyRouterScreenId | ((screen: JourneyRouterScreenId) => JourneyRouterScreenId)
    ) => {
      if (stepRef.current.step === 'pick') {
        return;
      }

      if (typeof screen === 'function') {
        screen = screen(stepRef.current.step);
      }
      if (resources.selected === null) {
        console.warn('Cannot go to journey screen without a selected emotion.');
        return;
      }
      if (screen === 'journey') {
        const audio = resources.selected.shared.get().audio;
        if (!audio.loaded) {
          console.warn('Cannot go to journey screen without loaded audio.');
          return;
        }

        if (audio.play === null) {
          console.warn('Cannot go to journey screen without audio play.');
          return;
        }

        apiFetch(
          '/api/1/emotions/started_related_journey',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              emotion_user_uid: resources.selected.emotionUserUid,
            }),
          },
          loginContext
        );

        audio.play();
      }
      const newStep = { journeyUid: resources.selected.journey.uid, step: screen };
      stepRef.current = newStep;
      setStep(newStep);
    },
    [resources.selected, loginContext]
  );

  if (resources.forceSplash) {
    return <SplashScreen type="wordmark" />;
  }

  if (step.step === 'pick') {
    return (
      <PickEmotion
        state={state}
        resources={resources}
        doAnticipateState={doAnticipateState}
        gotoJourney={gotoJourney}
      />
    );
  }

  if (ecpIsRequired === undefined) {
    return <SplashScreen />;
  }

  if (ecpIsRequired) {
    return ECPPartialFeature.component(ecpState, ecpResources);
  }

  if (resources.selected === null) {
    console.warn("Not at the pick step, but there's no selected emotion.");
    return <></>;
  }
  const sel = resources.selected;
  const props = {
    journey: resources.selected.journey,
    shared: resources.selected.shared,
    setScreen,
    onJourneyFinished: onFinishJourney,
    isOnboarding: resources.isOnboarding,
  };

  if (step.step === 'lobby') {
    return <JourneyLobbyScreen {...props} />;
  }

  if (step.step === 'start') {
    return <JourneyStart {...props} selectedEmotionAntonym={sel.word.antonym} />;
  }

  if (step.step === 'journey') {
    return <Journey {...props} />;
  }

  if (step.step === 'feedback') {
    return <JourneyFeedbackScreen {...props} />;
  }

  if (step.step === 'post') {
    return <JourneyPostScreen {...props} classesTakenToday={state.classesTakenThisSession} />;
  }

  if (step.step === 'share') {
    return <JourneyShareScreen {...props} />;
  }

  throw new Error(createUnknownStepMessage(step.step));
};

// This function will allow the type checker to catch any missing steps
// as they will cause step not to have the `never` type
const createUnknownStepMessage = (step: never) => {
  return `Unknown step: ${JSON.stringify(step)}`;
};
