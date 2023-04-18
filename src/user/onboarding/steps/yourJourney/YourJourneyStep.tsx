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
import { YourJourneyState } from './YourJourneyState';
import { YourJourneyResources } from './YourJourneyResources';
import { YourJourney } from './YourJourney';

/**
 * Determines when we last showed the signup reward screen for the user with the
 * given sub on this device.
 */
const getLastShownAt = (sub: string): Date | null => {
  const storedValue = localStorage.getItem('your-journey');
  if (
    storedValue === undefined ||
    storedValue === null ||
    storedValue === '' ||
    storedValue[0] !== '{'
  ) {
    return null;
  }

  try {
    const parsed: { sub?: string; lastShownAt?: number } = JSON.parse(storedValue);
    if (parsed.sub !== sub || parsed.lastShownAt === undefined) {
      return null;
    }
    return new Date(parsed.lastShownAt);
  } catch (e) {
    return null;
  }
};

/**
 * Stores that the given user saw the signup reward screen at the given time
 * @param sub The sub of the user
 * @param lastShownAt The time the user saw the screen
 */
const storeLastShownAt = (sub: string, lastShownAt: Date) => {
  localStorage.setItem(
    'your-journey',
    JSON.stringify({
      sub,
      lastShownAt: lastShownAt.getTime(),
    })
  );
};

const backgroundImageUid = 'oseh_if_0ykGW_WatP5-mh-0HRsrNw';

export const YourJourneyStep: OnboardingStep<YourJourneyState, YourJourneyResources> = {
  identifier: 'yourJourney',
  useWorldState: () => {
    const loginContext = useContext(LoginContext);
    const [isRecentSignup, setIsRecentSignup] = useState<boolean | undefined>(undefined);
    const [sawYourJourney, setSawYourJourney] = useState<boolean | undefined>(undefined);

    useEffect(() => {
      if (loginContext.state !== 'logged-in') {
        setIsRecentSignup(undefined);
        return;
      }

      setIsRecentSignup(localStorage.getItem('onboard') === '1');
    }, [loginContext]);

    useEffect(() => {
      if (loginContext.state !== 'logged-in' || loginContext.userAttributes === null) {
        setSawYourJourney(undefined);
        return;
      }

      const lastSeenAt = getLastShownAt(loginContext.userAttributes.sub);
      setSawYourJourney(
        lastSeenAt !== null && lastSeenAt.getTime() + 24 * 60 * 60 * 1000 > Date.now()
      );
    }, [loginContext]);

    const onContinue = useCallback((): YourJourneyState => {
      if (loginContext.state !== 'logged-in' || loginContext.userAttributes === null) {
        return {
          isRecentSignup: false,
          sawYourJourney: false,
          onContinue: () => {
            throw new Error('onContinue should not be called from onContinue');
          },
        };
      }

      storeLastShownAt(loginContext.userAttributes.sub, new Date());
      setSawYourJourney(true);
      return {
        isRecentSignup,
        sawYourJourney: true,
        onContinue: () => {
          throw new Error('onContinue should not be called from onContinue');
        },
      };
    }, [loginContext, isRecentSignup]);

    return useMemo<YourJourneyState>(
      () => ({
        isRecentSignup,
        sawYourJourney,
        onContinue,
      }),
      [isRecentSignup, sawYourJourney, onContinue]
    );
  },
  useResources: (worldState, required, allStates) => {
    const loginContext = useContext(LoginContext);
    const givenName = loginContext.userAttributes?.givenName ?? null;
    const images = useOsehImageStatesRef({});
    const windowSize = useWindowSize();
    const [background, setBackground] = useState<OsehImageState | null>(null);

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

    return useMemo<YourJourneyResources>(
      () => ({
        givenName,
        background,
        loading: background === null || background.loading,
        courseCopy: allStates.courseClasses.tookCourse,
      }),
      [givenName, background, allStates.courseClasses.tookCourse]
    );
  },

  isRequired: (worldState) => {
    if (worldState.isRecentSignup === undefined || worldState.sawYourJourney === undefined) {
      return undefined;
    }

    return worldState.isRecentSignup && !worldState.sawYourJourney;
  },

  component: (worldState, resources, doAnticipateState) => (
    <YourJourney state={worldState} resources={resources} doAnticipateState={doAnticipateState} />
  ),
};
