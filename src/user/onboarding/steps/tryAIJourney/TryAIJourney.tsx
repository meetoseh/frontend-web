import { useCallback, useContext, useRef, useState } from 'react';
import { OnboardingStepComponentProps } from '../../models/OnboardingStep';
import { TryAIJourneyResources } from './TryAIJourneyResources';
import { TryAIJourneyState } from './TryAIJourneyState';
import { useStartSession } from '../../../../shared/hooks/useInappNotificationSession';
import { SplashScreen } from '../../../splash/SplashScreen';
import { TryAIJourneyPrompt } from './components/TryAIJourneyPrompt';
import { JourneyLobbyScreen } from '../../../journey/screens/JourneyLobbyScreen';
import { JourneyStart } from '../../../journey/screens/JourneyStart';
import { Journey } from '../../../journey/screens/Journey';
import { TryAIJourneyPostScreen } from './components/TryAIJourneyPostScreen';
import { apiFetch } from '../../../../shared/ApiConstants';
import { LoginContext } from '../../../../shared/LoginContext';

/**
 * Asks the user if they want to try a completely ai-generated journey,
 * and if they say yes, takes them through the prompt and journey and
 * then swaps the post screen to see if they liked it.
 */
export const TryAIJourney = ({
  state,
  resources,
  doAnticipateState,
}: OnboardingStepComponentProps<TryAIJourneyState, TryAIJourneyResources>) => {
  const loginContext = useContext(LoginContext);
  const [step, setStep] = useState<'asking' | 'interactivePrompt' | 'start' | 'journey' | 'post'>(
    'asking'
  );
  const startedAudioRef = useRef<boolean>(false);
  useStartSession(resources.session);

  const onAskingYes = useCallback(() => {
    if (state.journey === null || state.journey === undefined) {
      throw new Error('journey is null or undefined');
    }
    const journey = state.journey;
    if (resources.session !== null) {
      (async (session) => {
        await session.storeAction('yes', null);
        await session.storeAction('start_prompt', { uid: journey.uid, title: journey.title });
      })(resources.session);
    }
    (async () => {
      const response = await apiFetch(
        '/api/1/users/me/started_ai_journey',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            journey_jwt: journey.jwt,
          }),
        },
        loginContext
      );

      if (!response.ok) {
        console.warn('Failed to store ai journey in user history: ', response);
      }
    })();
    setStep('interactivePrompt');
  }, [resources.session, state.journey, loginContext]);

  const onAskingNo = useCallback(() => {
    resources.session?.storeAction('no', null);
    resources.session?.reset();
    const newState = state.ian?.onShown();
    doAnticipateState.call(undefined, { ...state, ian: newState }, Promise.resolve());
  }, [state, resources.session, doAnticipateState]);

  const onAskingX = useCallback(() => {
    resources.session?.storeAction('x', null);
    resources.session?.reset();
    const newState = state.ian?.onShown();
    doAnticipateState.call(undefined, { ...state, ian: newState }, Promise.resolve());
  }, [state, resources.session, doAnticipateState]);

  const onPromptDone = useCallback(() => {
    if (
      !startedAudioRef.current &&
      resources.shared.audio !== null &&
      resources.shared.audio.play !== null
    ) {
      resources.shared.audio.play();
      startedAudioRef.current = true;
    }

    if (startedAudioRef) {
      resources.session?.storeAction('start_audio', null);
      setStep('journey');
    } else {
      // audio wasn't loaded in time, so another screen is shown before they can
      // start the audio
      setStep('start');
    }
  }, [resources]);

  const onStartContinue = useCallback(() => {
    if (
      !startedAudioRef.current &&
      resources.shared.audio !== null &&
      resources.shared.audio.play !== null
    ) {
      resources.shared.audio.play();
      startedAudioRef.current = true;
    }

    if (startedAudioRef) {
      resources.session?.storeAction('start_audio', null);
      setStep('journey');
    } else {
      // this shouldn't happen; we should have shown a spinner before the
      // start screen
      console.log('audio still not loaded; ignoring start request');
    }
  }, [resources]);

  const onStopAudioEarly = useCallback(
    (currentTime: number) => {
      startedAudioRef.current = false;

      resources.session?.storeAction('stop_audio_early', { current_time: currentTime });
      setStep('post');
    },
    [resources]
  );

  const onStopAudioNormally = useCallback(() => {
    startedAudioRef.current = false;

    resources.session?.storeAction('stop_audio_normally', null);
    setStep('post');
  }, [resources]);

  const onThumbsUp = useCallback(() => {
    resources.session?.storeAction('thumbs_up', null);
  }, [resources]);

  const onThumbsDown = useCallback(() => {
    resources.session?.storeAction('thumbs_down', null);
  }, [resources]);

  const onPostContinue = useCallback(() => {
    resources.session?.storeAction('continue', null);
    resources.session?.reset();
    const newState = state.ian?.onShown();
    doAnticipateState.call(undefined, { ...state, ian: newState }, Promise.resolve());
  }, [state, resources.session, doAnticipateState]);

  if (step === 'asking') {
    return (
      <TryAIJourneyPrompt
        state={state}
        resources={resources}
        onYes={onAskingYes}
        onNo={onAskingNo}
        onClose={onAskingX}
      />
    );
  }

  if (step === 'interactivePrompt') {
    if (state.journey === null || state.journey === undefined) {
      return <SplashScreen />;
    }

    return (
      <JourneyLobbyScreen
        journey={state.journey}
        shared={resources.shared}
        setScreen={onPromptDone}
        onJourneyFinished={onPromptDone}
        isOnboarding={false}
      />
    );
  }

  if (
    step === 'start' &&
    (resources.shared.audio === null || resources.shared.audio.play === null)
  ) {
    return <SplashScreen />;
  }

  if (step === 'start') {
    if (state.journey === null || state.journey === undefined) {
      return <SplashScreen />;
    }

    return (
      <JourneyStart
        journey={state.journey}
        shared={resources.shared}
        setScreen={onStartContinue}
        onJourneyFinished={onStartContinue}
        isOnboarding={false}
      />
    );
  }

  if (step === 'journey') {
    if (state.journey === null || state.journey === undefined) {
      return <SplashScreen />;
    }

    return (
      <Journey
        journey={state.journey}
        shared={resources.shared}
        setScreen={onStopAudioNormally}
        onJourneyFinished={onStopAudioNormally}
        isOnboarding={false}
        onCloseEarly={onStopAudioEarly}
      />
    );
  }

  if (step === 'post') {
    return (
      <TryAIJourneyPostScreen
        state={state}
        resources={resources}
        onThumbsUp={onThumbsUp}
        onThumbsDown={onThumbsDown}
        onClose={onPostContinue}
        onContinue={onPostContinue}
      />
    );
  }

  throw new Error(`unknown step: ${step}`);
};
