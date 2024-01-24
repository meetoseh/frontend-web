import { ReactElement, useCallback, useContext, useMemo, useState } from 'react';
import {
  Visitor,
  useVisitorValueWithCallbacks,
} from '../../shared/hooks/useVisitorValueWithCallbacks';
import { LoginContext, LoginContextValue } from '../../shared/contexts/LoginContext';
import { SplashScreen } from '../splash/SplashScreen';
import { JourneyRef, journeyRefKeyMap } from './models/JourneyRef';
import { useJourneyShared } from './hooks/useJourneyShared';
import { apiFetch } from '../../shared/ApiConstants';
import { convertUsingKeymap } from '../../admin/crud/CrudFetcher';
import { JourneyStartScreen } from './screens/JourneyStartScreen';
import { JourneyLobbyScreen } from './screens/JourneyLobbyScreen';
import { Journey } from './screens/Journey';
import { JourneyRouterScreenId } from './JourneyRouter';
import { InterestsProvider } from '../../shared/contexts/InterestsContext';
import { useAnyImageStateValueWithCallbacksLoading } from '../../shared/images/useAnyImageStateValueWithCallbacksLoading';
import { useUnwrappedValueWithCallbacks } from '../../shared/hooks/useUnwrappedValueWithCallbacks';
import { useMappedValueWithCallbacks } from '../../shared/hooks/useMappedValueWithCallbacks';
import { useValuesWithCallbacksEffect } from '../../shared/hooks/useValuesWithCallbacksEffect';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { ValueWithCallbacks } from '../../shared/lib/Callbacks';
import { useMappedValuesWithCallbacks } from '../../shared/hooks/useMappedValuesWithCallbacks';

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
  const loginContextRaw = useContext(LoginContext);
  const visitor = useVisitorValueWithCallbacks();
  return (
    <InterestsProvider loginContext={loginContextRaw} visitor={visitor}>
      <JourneyPublicLinkInner loginContext={loginContextRaw} visitor={visitor} />
    </InterestsProvider>
  );
};

const JourneyPublicLinkInner = ({
  loginContext: loginContextRaw,
  visitor: visitorVWC,
}: {
  loginContext: LoginContextValue;
  visitor: ValueWithCallbacks<Visitor>;
}): ReactElement => {
  const code = useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('code');
  }, []);
  const [journey, setJourney] = useState<JourneyRef | null>(null);
  const shared = useJourneyShared({ type: 'react-rerender', props: journey });
  const [screen, setScreen] = useState<'loading' | 'lobby' | 'start' | 'journey'>('loading');
  const [startedAudio, setStartedAudio] = useState(false);

  useValuesWithCallbacksEffect(
    [loginContextRaw.value, visitorVWC],
    useCallback(() => {
      const loginContextUnch = loginContextRaw.value.get();
      const visitor = visitorVWC.get();
      if (loginContextUnch.state === 'loading' || visitor.loading || journey !== null) {
        return;
      }
      if (code === null) {
        console.error('no code in query parameter');
        window.location.assign(window.location.origin);
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
          loginContextUnch.state === 'logged-in' ? loginContextUnch : null
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
        }
      }
    }, [journey, code, loginContextRaw, visitorVWC])
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
  const settingUpVWC = useMappedValuesWithCallbacks([loginContextRaw.value, visitorVWC], () => {
    const loginContextUnch = loginContextRaw.value.get();
    const visitor = visitorVWC.get();
    return (
      visitor.loading ||
      journey === null ||
      darkenedImageLoading ||
      audioLoading ||
      loginContextUnch.state === 'loading'
    );
  });

  useValuesWithCallbacksEffect(
    [loginContextRaw.value, settingUpVWC],
    useCallback(() => {
      const settingUp = settingUpVWC.get();
      const loginContextUnch = loginContextRaw.value.get();
      if (screen !== 'loading' || settingUp) {
        return undefined;
      }

      if (loginContextUnch.state === 'logged-in') {
        setScreen('lobby');
        return;
      }
      setScreen('start');
    }, [settingUpVWC, screen, loginContextRaw])
  );

  const onFinished = useCallback(() => {
    window.location.assign(window.location.origin);
  }, []);

  const handleSetScreen = useCallback(
    (newScreen: JourneyRouterScreenId | ((s: JourneyRouterScreenId) => JourneyRouterScreenId)) => {
      if (typeof newScreen === 'function') {
        newScreen = newScreen(screen === 'loading' ? 'start' : screen);
      }

      const loginContextUnch = loginContextRaw.value.get();

      if (newScreen === 'lobby' && loginContextUnch.state === 'logged-in') {
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
    [loginContextRaw, shared, startedAudio, onFinished, screen]
  );

  return (
    <RenderGuardedComponent
      props={settingUpVWC}
      component={(settingUp) => {
        if (screen === 'loading' || settingUp || journey === null) {
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
              takeAnother={null}
            />
          );
        }

        if (screen === 'start' || !startedAudio) {
          return (
            <JourneyStartScreen
              journey={journey}
              shared={shared}
              setScreen={handleSetScreen}
              isOnboarding={false}
              onJourneyFinished={onFinished}
              takeAnother={null}
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
            takeAnother={null}
          />
        );
      }}
    />
  );
};
