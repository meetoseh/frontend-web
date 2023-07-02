import { ReactElement, useCallback, useContext, useState } from 'react';
import { ECPResources } from './ECPResources';
import { ECPState } from './ECPState';
import { useWindowSize } from '../../../../../shared/hooks/useWindowSize';
import { JourneyStart } from '../../../../journey/screens/JourneyStart';
import { SplashScreen } from '../../../../splash/SplashScreen';
import { Journey } from '../../../../journey/screens/Journey';
import { ExtendedClassesPackOfferSample } from './ExtendedClassesPackOfferSample';
import { ExtendedClassesPackPurchaseOffer } from './ExtendedClassesPackPurchaseOffer';
import { useStartSession } from '../../../../../shared/hooks/useInappNotificationSession';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { LoginContext } from '../../../../../shared/contexts/LoginContext';
import { ValueWithCallbacks } from '../../../../../shared/lib/Callbacks';
import { useUnwrappedValueWithCallbacks } from '../../../../../shared/hooks/useUnwrappedValueWithCallbacks';
import { useMappedValueWithCallbacks } from '../../../../../shared/hooks/useMappedValueWithCallbacks';

export const ExtendedClassesPack = ({
  state,
  resources,
}: {
  state: ValueWithCallbacks<ECPState>;
  resources: ValueWithCallbacks<ECPResources>;
}): ReactElement => {
  const loginContext = useContext(LoginContext);
  const windowSize = useWindowSize();
  const [step, setStep] = useState<
    'offerSample' | 'start' | 'journey' | 'offerPack' | 'redirecting'
  >('offerSample');
  useStartSession({
    type: 'callbacks',
    props: () => resources.get().session,
    callbacks: resources.callbacks,
  });

  const onNext = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const journey = state.get().journey;
      resources.get().session?.storeAction('try_class', {
        emotion: state.get().emotion?.word ?? null,
        journey_uid: journey?.uid ?? null,
      });
      if (journey !== null && journey !== undefined) {
        apiFetch(
          '/api/1/campaigns/extended_classes_pack/started',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              journey_uid: journey.uid,
              journey_jwt: journey.jwt,
            }),
          },
          loginContext
        );
      }
      const play = resources.get().journeyShared.audio.play;
      if (play !== null) {
        resources.get().session?.storeAction('start_audio', null);
        play();
        setStep('journey');
      } else {
        setStep('start');
      }
    },
    [resources, state, loginContext]
  );

  const onNoThanks = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      resources
        .get()
        .session?.storeAction('no_thanks', { emotion: state.get().emotion?.word ?? null });
      resources.get().session?.reset();
      state.get().ian?.onShown();
    },
    [resources, state]
  );

  const handleStartSetScreen = useCallback(() => {
    const audio = resources.get().journeyShared.audio;
    if (!audio.loaded || audio.play === null) {
      return;
    }
    audio.play();
    resources.get().session?.storeAction('start_audio', null);
    setStep('journey');
  }, [resources]);

  const handleStartJourneyFinished = handleStartSetScreen;

  const handleJourneySetScreen = useCallback(() => {
    resources.get().session?.storeAction('stop_audio_normally', null);
    setStep('offerPack');
  }, [resources]);

  const handleJourneyJourneyFinished = handleJourneySetScreen;

  const handleJourneyCloseEarly = useCallback(
    (currentTime: number, totalTime: number) => {
      resources.get().session?.storeAction('stop_audio_early', { current_time: currentTime });
      setStep('offerPack');
    },
    [resources]
  );

  const handleRedirectingToPaymentProvider = useCallback(async () => {
    setStep('redirecting');
    await resources.get().session?.storeAction('buy_now', null);
    resources.get().session?.reset();
    // we don't want to dismiss the ian as we want to go to the splash
    // screen until the redirect goes through
  }, [resources]);

  const handleRejectPaymentOffer = useCallback(() => {
    setStep('redirecting');
    resources.get().session?.reset();
    state.get().ian?.onShown();
  }, [resources, state]);

  const stdJourney = useUnwrappedValueWithCallbacks(
    useMappedValueWithCallbacks(state, (s) => s.journey)
  );
  const emotion = useUnwrappedValueWithCallbacks(
    useMappedValueWithCallbacks(state, (s) => s.emotion)
  );
  const journeySharedVWC = useMappedValueWithCallbacks(resources, (r) => r.journeyShared);

  if (stdJourney === null || stdJourney === undefined || emotion === null) {
    return <SplashScreen />;
  }

  if (step === 'offerSample') {
    return (
      <ExtendedClassesPackOfferSample
        windowSize={windowSize}
        resources={resources}
        onNext={onNext}
        onNoThanks={onNoThanks}
      />
    );
  }

  if (step === 'start') {
    return (
      <JourneyStart
        journey={stdJourney}
        shared={journeySharedVWC}
        setScreen={handleStartSetScreen}
        isOnboarding={false}
        onJourneyFinished={handleStartJourneyFinished}
        selectedEmotionAntonym={emotion.antonym}
        duration="3-minute"
      />
    );
  }

  if (step === 'journey') {
    return (
      <Journey
        journey={stdJourney}
        shared={journeySharedVWC}
        setScreen={handleJourneySetScreen}
        onCloseEarly={handleJourneyCloseEarly}
        onJourneyFinished={handleJourneyJourneyFinished}
        isOnboarding={false}
      />
    );
  }

  if (step === 'offerPack') {
    return (
      <ExtendedClassesPackPurchaseOffer
        resources={resources}
        onRedirecting={handleRedirectingToPaymentProvider}
        onSkip={handleRejectPaymentOffer}
      />
    );
  }

  if (step === 'redirecting') {
    return <SplashScreen />;
  }

  throw new Error(createUnknownStepMessage(step));
};

function createUnknownStepMessage(step: never) {
  return `unknown step ${step}`;
}
