import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { OnboardingStep } from '../../models/OnboardingStep';
import { DailyGoalResources } from './DailyGoalResources';
import { DailyGoalState } from './DailyGoalState';
import { LoginContext } from '../../../../shared/LoginContext';
import {
  OsehImageProps,
  OsehImageState,
  OsehImageStateChangedEvent,
  useOsehImageStatesRef,
} from '../../../../shared/OsehImage';
import { useWindowSize } from '../../../../shared/hooks/useWindowSize';
import { usePublicInteractivePrompt } from '../../../../shared/hooks/usePublicInteractivePrompt';
import { DailyGoal } from './DailyGoal';

/**
 * Determines when we last showed the daily goal prompt for the user with the
 * given sub on this device.
 */
const getLastShownAt = (sub: string): { response: string | null; at: Date } | null => {
  const storedValue = localStorage.getItem('daily-goal-prompt');
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
 * Stores that the given user saw the signup reward screen at the given time
 * @param sub The sub of the user
 * @param lastShownAt The time the user saw the screen
 * @param response The response the user gave
 */
const storeLastShownAt = (sub: string, lastShownAt: Date, response: string | null) => {
  localStorage.setItem(
    'daily-goal-prompt',
    JSON.stringify({
      sub,
      lastShownAt: lastShownAt.getTime(),
      response,
    })
  );
};

const backgroundImageUid = 'oseh_if_0ykGW_WatP5-mh-0HRsrNw';

export const DailyGoalStep: OnboardingStep<DailyGoalState, DailyGoalResources> = {
  identifier: 'dailyGoal',
  useWorldState: () => {
    const loginContext = useContext(LoginContext);
    const [isRecentSignup, setIsRecentSignup] = useState<boolean | undefined>(undefined);
    const [anticipatedResponse, setAnticipatedResponse] = useState<string | null | undefined>(
      undefined
    );
    const [dailyGoalResponse, setDailyGoalResponse] = useState<string | null | undefined>(
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
        setDailyGoalResponse(undefined);
        return;
      }

      const lastResponse = getLastShownAt(loginContext.userAttributes.sub);
      if (lastResponse === null) {
        setDailyGoalResponse(undefined);
        return;
      }

      setDailyGoalResponse(lastResponse.response);
    }, [loginContext]);

    const onContinue = useCallback(
      (response: string | null): DailyGoalState => {
        if (loginContext.state !== 'logged-in' || loginContext.userAttributes === null) {
          return {
            isRecentSignup: false,
            sawDailyGoal: false,
            dailyGoalSelection: undefined,
            anticipatedDailyGoalSelection: undefined,
            onSelection: (response) => {
              throw new Error('not available from onContinue');
            },
            onContinue: () => {
              throw new Error('not available from onContinue');
            },
          };
        }

        storeLastShownAt(loginContext.userAttributes.sub, new Date(), response);
        setDailyGoalResponse(response);
        setAnticipatedResponse(undefined);
        return {
          isRecentSignup,
          sawDailyGoal: true,
          dailyGoalSelection: response,
          anticipatedDailyGoalSelection: undefined,
          onSelection: (response) => {
            throw new Error('not available from onContinue');
          },
          onContinue: () => {
            throw new Error('onContinue should not be called from onContinue');
          },
        };
      },
      [loginContext, isRecentSignup]
    );

    return useMemo<DailyGoalState>(
      () => ({
        isRecentSignup,
        sawDailyGoal: dailyGoalResponse !== undefined,
        dailyGoalSelection: dailyGoalResponse,
        anticipatedDailyGoalSelection: anticipatedResponse,
        onSelection: setAnticipatedResponse,
        onContinue,
      }),
      [isRecentSignup, dailyGoalResponse, anticipatedResponse, onContinue]
    );
  },
  useResources: (worldState, required) => {
    const loginContext = useContext(LoginContext);
    const givenName = loginContext.userAttributes?.givenName ?? null;
    const images = useOsehImageStatesRef({});
    const windowSize = useWindowSize();
    const [background, setBackground] = useState<OsehImageState | null>(null);
    const prompt = usePublicInteractivePrompt({
      identifier: 'onboarding-prompt-feeling',
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

    return useMemo<DailyGoalResources>(
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
    if (worldState.isRecentSignup === undefined || worldState.sawDailyGoal === undefined) {
      return undefined;
    }

    return worldState.isRecentSignup && !worldState.sawDailyGoal;
  },

  component: (worldState, resources, doAnticipateState) => (
    <DailyGoal state={worldState} resources={resources} doAnticipateState={doAnticipateState} />
  ),
};
