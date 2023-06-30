import { ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Visitor, useVisitor } from '../../shared/hooks/useVisitor';
import { LoginContext, LoginContextValue } from '../../shared/contexts/LoginContext';
import { SplashScreen } from '../splash/SplashScreen';
import { JourneyRef, journeyRefKeyMap } from './models/JourneyRef';
import { useJourneyShared } from './hooks/useJourneyShared';
import { useSingletonEffect } from '../../shared/lib/useSingletonEffect';
import { apiFetch } from '../../shared/ApiConstants';
import { convertUsingKeymap } from '../../admin/crud/CrudFetcher';
import { JourneyStart } from './screens/JourneyStart';
import { JourneyLobbyScreen } from './screens/JourneyLobbyScreen';
import { Journey } from './screens/Journey';
import { JourneyRouterScreenId } from './JourneyRouter';
import { InterestsProvider } from '../../shared/contexts/InterestsContext';
import { useAnyImageStateValueWithCallbacksLoading } from '../../shared/images/useAnyImageStateValueWithCallbacksLoading';
import { useUnwrappedValueWithCallbacks } from '../../shared/hooks/useUnwrappedValueWithCallbacks';
import { useMappedValueWithCallbacks } from '../../shared/hooks/useMappedValueWithCallbacks';

/**
 * This is a top-level component intended to be used for the /jpl route.
 * Specifically, it takes the code in the query parameter and uses that to
 * start the journey corresponding to the journey public link with that code.
 *
 * This does not require that the user is logged in, but should be contained
 * within a login context: the behavior differs depending on whether the user
 * is logged in or not.
 *
 * This should not be within a visitor context: the visitor is handled specially
 * as it is required when the user is not logged in. In particular, this means this
 * should not be within an interests provider.
 */
export const JourneyPublicLink = (): ReactElement => {
  const loginContext = useContext(LoginContext);
  const visitor = useVisitor();
  return (
    <InterestsProvider loginContext={loginContext} visitor={visitor}>
      <JourneyPublicLinkInner loginContext={loginContext} visitor={visitor} />
    </InterestsProvider>
  );
};

const JourneyPublicLinkInner = ({
  loginContext,
  visitor,
}: {
  loginContext: LoginContextValue;
  visitor: Visitor;
}): ReactElement => {
  const code = useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('code');
  }, []);
  const [journey, setJourney] = useState<JourneyRef | null>(null);
  const shared = useJourneyShared({ type: 'react-rerender', props: journey });
  const [screen, setScreen] = useState<'loading' | 'lobby' | 'start' | 'journey'>('loading');
  const [startedAudio, setStartedAudio] = useState(false);

  useSingletonEffect(
    (onDone) => {
      if (loginContext.state === 'loading' || visitor.loading || journey !== null) {
        onDone();
        return;
      }
      if (code === null) {
        console.error('no code in query parameter');
        window.location.href = '/';
        onDone();
        return;
      }

      const vis = visitor;

      let active = true;
      fetchJourney();
      return () => {
        active = false;
      };

      async function fetchJourneyInner() {
        const response = await apiFetch(
          '/api/1/journeys/public_links/start',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              ...(vis.uid !== null ? { Visitor: vis.uid } : {}),
            },
            body: JSON.stringify({
              code,
              source: 'browser',
            }),
          },
          loginContext
        );
        if (!response.ok) {
          throw response;
        }

        const data = await response.json();
        const journey = convertUsingKeymap(data.journey, journeyRefKeyMap);
        const visitorUid = data.visitor_uid;
        if (vis.uid !== visitorUid) {
          vis.setVisitor(visitorUid);
        }
        setJourney(journey);
      }

      async function fetchJourney() {
        try {
          await fetchJourneyInner();
        } catch (e) {
          if (active) {
            console.error('error fetching journey:', e);
            window.location.href = '/';
          }
        } finally {
          onDone();
        }
      }
    },
    [loginContext, visitor, journey, code]
  );

  const darkenedImageLoading = useAnyImageStateValueWithCallbacksLoading(
    [useMappedValueWithCallbacks(shared, (s) => s.darkenedImage)],
    true
  );
  const audioLoading = useUnwrappedValueWithCallbacks(
    useMappedValueWithCallbacks(
      shared,
      (s) => !s.audio.loaded || (!startedAudio && s.audio.play === null)
    )
  );
  const settingUp =
    visitor.loading ||
    loginContext.state === 'loading' ||
    journey === null ||
    darkenedImageLoading ||
    audioLoading;

  useEffect(() => {
    if (screen !== 'loading' || settingUp) {
      return;
    }

    if (loginContext.state === 'logged-in') {
      setScreen('lobby');
      return;
    }
    setScreen('start');
  }, [settingUp, screen, loginContext]);

  const onFinished = useCallback(() => {
    window.location.href = '/';
  }, []);

  const handleSetScreen = useCallback(
    (newScreen: JourneyRouterScreenId | ((s: JourneyRouterScreenId) => JourneyRouterScreenId)) => {
      if (typeof newScreen === 'function') {
        newScreen = newScreen(screen === 'loading' ? 'start' : screen);
      }

      if (newScreen === 'lobby' && loginContext.state === 'logged-in') {
        setScreen('lobby');
        return;
      }

      if (newScreen === 'start' || newScreen === 'lobby') {
        setScreen('start');
        return;
      }

      if (newScreen === 'journey') {
        if (!startedAudio) {
          shared.get().audio.play?.call(undefined);
          setStartedAudio(true);
        }
        setScreen('journey');
        return;
      }

      onFinished();
    },
    [loginContext, shared, startedAudio, onFinished, screen]
  );

  if (screen === 'loading' || settingUp) {
    return <SplashScreen />;
  }

  if (screen === 'lobby') {
    return (
      <JourneyLobbyScreen
        journey={journey}
        shared={shared}
        setScreen={handleSetScreen}
        isOnboarding={false}
        onJourneyFinished={onFinished}
      />
    );
  }

  if (screen === 'start' || !startedAudio) {
    return (
      <JourneyStart
        journey={journey}
        shared={shared}
        setScreen={handleSetScreen}
        isOnboarding={false}
        onJourneyFinished={onFinished}
      />
    );
  }

  return (
    <Journey
      journey={journey}
      shared={shared}
      setScreen={handleSetScreen}
      isOnboarding={false}
      onJourneyFinished={onFinished}
    />
  );
};
