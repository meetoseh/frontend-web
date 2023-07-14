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
import { JourneyStartScreen } from '../../../journey/screens/JourneyStartScreen';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { apiFetch } from '../../../../shared/ApiConstants';
import { JourneyFeedbackScreen } from '../../../journey/screens/JourneyFeedbackScreen';
import { PickEmotion } from './PickEmotion';
import { ECPPartialFeature } from './extended_classes_pack/ECPPartialFeature';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useUnwrappedValueWithCallbacks } from '../../../../shared/hooks/useUnwrappedValueWithCallbacks';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { createLoadingJourneyShared } from '../../../journey/hooks/useJourneyShared';

/**
 * The core screen where the user selects an emotion and the backend
 * uses that to select a journey
 */
export const PickEmotionJourney = ({
  state,
  resources,
}: FeatureComponentProps<PickEmotionJourneyState, PickEmotionJourneyResources>): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [step, setStep] = useState<{
    journeyUid: string | null;
    step: 'pick' | JourneyRouterScreenId;
  }>({ journeyUid: null, step: 'pick' });
  const stepRef = useRef(step);
  stepRef.current = step;

  const ecpState = ECPPartialFeature.useWorldState(
    useMappedValueWithCallbacks(resources, (r) => r.selected?.word ?? null)
  );
  const ecpIsRequiredVWC = useMappedValueWithCallbacks(
    ecpState,
    (s) => ECPPartialFeature.isRequired(s) ?? false
  );
  const ecpResources = ECPPartialFeature.useResources(ecpState, ecpIsRequiredVWC);

  useEffect(() => {
    resources.callbacks.add(handleSelectedChanged);
    handleSelectedChanged();
    return () => {
      resources.callbacks.remove(handleSelectedChanged);
    };

    function handleSelected(selected: PickEmotionJourneyResources['selected']) {
      if (selected === null && step.step !== 'pick') {
        setStep({ journeyUid: null, step: 'pick' });
        return;
      }

      if (selected !== null && step.step === 'pick' && selected.skipsStats) {
        setStep({ journeyUid: selected.journey.uid, step: 'lobby' });
        return;
      }

      if (selected !== null && step.step !== 'pick' && step.journeyUid !== selected.journey.uid) {
        setStep({ journeyUid: null, step: 'pick' });
      }
    }

    function handleSelectedChanged() {
      handleSelected(resources.get().selected);
    }
  }, [step, resources]);

  const gotoJourney = useCallback(() => {
    const selected = resources.get().selected;
    if (selected === null) {
      console.warn('gotoJourney without a journey to goto');
      return;
    }
    setStep({ journeyUid: selected.journey.uid, step: 'lobby' });
  }, [resources]);

  const onFinishJourney = useCallback(() => {
    resources.get().onFinishedJourney.call(undefined);
    state.get().onFinishedClass.call(undefined);
    setStep({ journeyUid: null, step: 'pick' });
  }, [resources, state]);

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

      const selected = resources.get().selected;
      if (selected === null) {
        console.warn('Cannot go to journey screen without a selected emotion.');
        return;
      }
      if (screen === 'journey') {
        const audio = selected.shared.audio;
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
              emotion_user_uid: selected.emotionUserUid,
            }),
          },
          loginContext
        );

        audio.play();
      }
      const newStep = { journeyUid: selected.journey.uid, step: screen };
      stepRef.current = newStep;
      setStep(newStep);
    },
    [resources, loginContext]
  );

  const forceSplash = useUnwrappedValueWithCallbacks(
    useMappedValueWithCallbacks(resources, (r) => r.forceSplash)
  );
  const selectedVWC = useMappedValueWithCallbacks(
    resources,
    (r) =>
      r.selected === null
        ? null
        : {
            word: r.selected.word,
            journey: r.selected.journey,
          },
    {
      inputEqualityFn(a, b) {
        if (a.selected === null || b.selected === null) {
          return a.selected === b.selected;
        }

        return (
          a.selected.word.word === b.selected.word.word &&
          a.selected.journey.uid === b.selected.journey.uid
        );
      },
    }
  );
  const sharedVWC = useMappedValueWithCallbacks(
    resources,
    (r) =>
      r.selected?.shared ??
      createLoadingJourneyShared({ width: 0, height: 0 }, { width: 0, height: 0 })
  );
  const ecpIsRequired = useUnwrappedValueWithCallbacks(ecpIsRequiredVWC);

  if (forceSplash) {
    return <SplashScreen type="wordmark" />;
  }

  if (step.step === 'pick') {
    return <PickEmotion state={state} resources={resources} gotoJourney={gotoJourney} />;
  }

  if (ecpIsRequired === undefined) {
    return <SplashScreen />;
  }

  if (ecpIsRequired) {
    return ECPPartialFeature.component(ecpState, ecpResources);
  }

  return (
    <RenderGuardedComponent
      props={selectedVWC}
      component={(selected) => {
        if (selected === null) {
          console.warn("Not at the pick step, but there's no selected emotion.");
          return <></>;
        }
        const sel = selected;
        const props = {
          journey: selected.journey,
          shared: sharedVWC,
          setScreen,
          onJourneyFinished: onFinishJourney,
          isOnboarding: resources.get().isOnboarding,
        };

        if (step.step === 'lobby') {
          return <JourneyLobbyScreen {...props} />;
        }

        if (step.step === 'start') {
          return <JourneyStartScreen {...props} selectedEmotionAntonym={sel.word.antonym} />;
        }

        if (step.step === 'journey') {
          return <Journey {...props} />;
        }

        if (step.step === 'feedback') {
          return <JourneyFeedbackScreen {...props} />;
        }

        if (step.step === 'post') {
          return (
            <JourneyPostScreen {...props} classesTakenToday={state.get().classesTakenThisSession} />
          );
        }

        if (step.step === 'share') {
          return <JourneyShareScreen {...props} />;
        }

        throw new Error(createUnknownStepMessage(step.step));
      }}
    />
  );
};

// This function will allow the type checker to catch any missing steps
// as they will cause step not to have the right type
const createUnknownStepMessage = (step: 'pick') => {
  return `Unknown step: ${JSON.stringify(step)}`;
};
