import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { OnboardingStep } from '../../models/OnboardingStep';
import { LoginContext } from '../../../../shared/LoginContext';
import {
  OsehImageProps,
  OsehImageState,
  OsehImageStateChangedEvent,
  useOsehImageStatesRef,
} from '../../../../shared/OsehImage';
import { useWindowSize } from '../../../../shared/hooks/useWindowSize';
import { usePublicInteractivePrompt } from '../../../../shared/hooks/usePublicInteractivePrompt';
import { IntrospectionState } from './IntrospectionState';
import { IntrospectionResources } from './IntrospectionResources';
import { Introspection } from './Introspection';

/**
 * Determines when we last showed the introspection prompt for the user with the
 * given sub on this device.
 */
const getLastShownAt = (sub: string): { response: string | null; at: Date } | null => {
  const storedValue = localStorage.getItem('introspection-prompt');
  if (
    storedValue === undefined ||
    storedValue === null ||
    storedValue === '' ||
    storedValue[0] !== '{'
  ) {
    return null;
  }

  try {
    const parsed: { sub?: string; lastShownAt?: number; response?: string | null } =
      JSON.parse(storedValue);
    if (parsed.sub !== sub || parsed.lastShownAt === undefined || parsed.response === undefined) {
      return null;
    }
    return { response: parsed.response, at: new Date(parsed.lastShownAt) };
  } catch (e) {
    return null;
  }
};

/**
 * Stores that the given user saw the introspection prompt at the given time
 * @param sub The sub of the user
 * @param lastShownAt The time the user saw the screen
 * @param response The response the user gave
 */
const storeLastShownAt = (sub: string, lastShownAt: Date, response: string | null) => {
  localStorage.setItem(
    'introspection-prompt',
    JSON.stringify({
      sub,
      lastShownAt: lastShownAt.getTime(),
      response,
    })
  );
};

const backgroundImageUid = 'oseh_if_0ykGW_WatP5-mh-0HRsrNw';

export const IntrospectionStep: OnboardingStep<IntrospectionState, IntrospectionResources> = {
  identifier: 'introspection',
  useWorldState: () => {
    const loginContext = useContext(LoginContext);
    const [isRecentSignup, setIsRecentSignup] = useState<boolean | undefined>(undefined);
    const [introspectionResponse, setIntrospectionResponse] = useState<string | null | undefined>(
      undefined
    );

    useEffect(() => {
      if (loginContext.state !== 'logged-in') {
        setIsRecentSignup(undefined);
        return;
      }

      setIsRecentSignup(localStorage.getItem('onboard') === '1');
    }, [loginContext]);

    useEffect(() => {
      if (loginContext.state !== 'logged-in' || loginContext.userAttributes === null) {
        setIntrospectionResponse(undefined);
        return;
      }

      const lastResponse = getLastShownAt(loginContext.userAttributes.sub);
      if (lastResponse === null) {
        setIntrospectionResponse(undefined);
        return;
      }

      setIntrospectionResponse(lastResponse.response);
    }, [loginContext]);

    const onContinue = useCallback(
      (response: string | null): IntrospectionState => {
        if (loginContext.state !== 'logged-in' || loginContext.userAttributes === null) {
          return {
            isRecentSignup: false,
            sawIntrospection: false,
            introspectionSelection: undefined,
            onContinue: () => {
              throw new Error('not available from onContinue');
            },
          };
        }

        if (isRecentSignup) {
          localStorage.removeItem('onboard');
          setIsRecentSignup(false);
        }
        storeLastShownAt(loginContext.userAttributes.sub, new Date(), response);
        setIntrospectionResponse(response);
        return {
          isRecentSignup: false,
          sawIntrospection: true,
          introspectionSelection: response,
          onContinue: () => {
            throw new Error('onContinue should not be called from onContinue');
          },
        };
      },
      [loginContext, isRecentSignup]
    );

    return useMemo<IntrospectionState>(
      () => ({
        isRecentSignup,
        sawIntrospection: introspectionResponse !== undefined,
        introspectionSelection: introspectionResponse,
        onContinue,
      }),
      [isRecentSignup, introspectionResponse, onContinue]
    );
  },
  useResources: (worldState, required) => {
    const loginContext = useContext(LoginContext);
    const givenName = loginContext.userAttributes?.givenName ?? null;
    const images = useOsehImageStatesRef({});
    const windowSize = useWindowSize();
    const [background, setBackground] = useState<OsehImageState | null>(null);
    const prompt = usePublicInteractivePrompt({
      identifier: 'onboarding-prompt-feeling-result',
      load: required,
    });

    useEffect(() => {
      const oldProps = images.handling.current.get(backgroundImageUid);
      if (!required) {
        if (oldProps !== undefined) {
          images.handling.current.delete(backgroundImageUid);
          images.onHandlingChanged.current.call({
            old: oldProps,
            current: null,
            uid: backgroundImageUid,
          });
        }
        return;
      }

      if (
        oldProps?.displayWidth === windowSize.width &&
        oldProps?.displayHeight === windowSize.height
      ) {
        return;
      }

      const newProps: OsehImageProps = {
        uid: backgroundImageUid,
        jwt: null,
        displayWidth: windowSize.width,
        displayHeight: windowSize.height,
        alt: '',
        isPublic: true,
      };

      images.handling.current.set(backgroundImageUid, newProps);
      images.onHandlingChanged.current.call({
        old: oldProps ?? null,
        current: newProps,
        uid: backgroundImageUid,
      });
    }, [required, windowSize, images]);

    useEffect(() => {
      const background = images.state.current.get(backgroundImageUid);
      setBackground(background ?? null);

      images.onStateChanged.current.add(handleStateChanged);
      return () => {
        images.onStateChanged.current.remove(handleStateChanged);
      };

      function handleStateChanged(e: OsehImageStateChangedEvent) {
        if (e.uid !== backgroundImageUid) {
          return;
        }

        setBackground(e.current);
      }
    }, [images]);

    return useMemo<IntrospectionResources>(
      () => ({
        givenName,
        background,
        prompt: prompt,
        loading: background === null || background.loading,
      }),
      [givenName, background, prompt]
    );
  },

  isRequired: (worldState) => {
    if (worldState.isRecentSignup === undefined || worldState.sawIntrospection === undefined) {
      return undefined;
    }

    return worldState.isRecentSignup && !worldState.sawIntrospection;
  },

  component: (worldState, resources, doAnticipateState) => (
    <Introspection state={worldState} resources={resources} doAnticipateState={doAnticipateState} />
  ),
};
