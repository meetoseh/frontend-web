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

export const ExtendedClassesPack = ({
  state,
  resources,
}: {
  state: ECPState;
  resources: ECPResources;
}): ReactElement => {
  const loginContext = useContext(LoginContext);
  const windowSize = useWindowSize();
  const [step, setStep] = useState<
    'offerSample' | 'start' | 'journey' | 'offerPack' | 'redirecting'
  >('offerSample');
  useStartSession(resources.session);

  const onNext = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      resources.session?.storeAction('try_class', {
        emotion: state.emotion?.word ?? null,
        journey_uid: state.journey?.uid ?? null,
      });
      if (state.journey !== null && state.journey !== undefined) {
        apiFetch(
          '/api/1/campaigns/extended_classes_pack/started',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              journey_uid: state.journey.uid,
              journey_jwt: state.journey.jwt,
            }),
          },
          loginContext
        );
      }
      if (resources.journeyShared.audio?.play) {
        resources.session?.storeAction('start_audio', null);
        resources.journeyShared.audio.play();
        setStep('journey');
      } else {
        setStep('start');
      }
    },
    [resources.journeyShared.audio, resources.session, state.emotion, state.journey, loginContext]
  );

  const onNoThanks = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      resources.session?.storeAction('no_thanks', { emotion: state.emotion?.word ?? null });
      resources.session?.reset();
      state.ian?.onShown();
    },
    [resources.session, state.ian, state.emotion?.word]
  );

  const handleStartSetScreen = useCallback(() => {
    if (resources.journeyShared.audio?.play) {
      resources.session?.storeAction('start_audio', null);
      resources.journeyShared.audio.play();
      setStep('journey');
    }
  }, [resources.journeyShared.audio, resources.session]);

  const handleStartJourneyFinished = handleStartSetScreen;

  const handleJourneySetScreen = useCallback(() => {
    resources.session?.storeAction('stop_audio_normally', null);
    setStep('offerPack');
  }, [resources.session]);

  const handleJourneyJourneyFinished = handleJourneySetScreen;

  const handleJourneyCloseEarly = useCallback(
    (currentTime: number, totalTime: number) => {
      resources.session?.storeAction('stop_audio_early', { current_time: currentTime });
      setStep('offerPack');
    },
    [resources.session]
  );

  const handleRedirectingToPaymentProvider = useCallback(async () => {
    setStep('redirecting');
    await resources.session?.storeAction('buy_now', null);
    resources.session?.reset();
    // we don't want to dismiss the ian as we want to go to the splash
    // screen until the redirect goes through
  }, [resources.session]);

  const handleRejectPaymentOffer = useCallback(() => {
    setStep('redirecting');
    resources.session?.reset();
    state.ian?.onShown();
  }, [resources.session, state.ian]);

  if (state.journey === null || state.journey === undefined || state.emotion === null) {
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
    if (resources.journeyShared.audio === null || resources.journeyShared.audio.play === null) {
      return <SplashScreen />;
    }

    return (
      <JourneyStart
        journey={state.journey}
        shared={resources.journeyShared}
        setScreen={handleStartSetScreen}
        isOnboarding={false}
        onJourneyFinished={handleStartJourneyFinished}
        selectedEmotionAntonym={state.emotion.antonym}
        duration="3-minute"
      />
    );
  }

  if (step === 'journey') {
    return (
      <Journey
        journey={state.journey}
        shared={resources.journeyShared}
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
