import {
  Dispatch,
  MutableRefObject,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LoginContext } from '../../../../shared/LoginContext';
import { OnboardingStep } from '../../models/OnboardingStep';
import { OnboardingClassResources } from './OnboardingClassResources';
import { OnboardingClassState } from './OnboardingClassState';
import { JourneyRef, journeyRefKeyMap } from '../../../journey/models/JourneyRef';
import { useJourneyShared } from '../../../journey/hooks/useJourneyShared';
import { JourneyShared } from '../../../journey/models/JourneyShared';
import { apiFetch } from '../../../../shared/ApiConstants';
import { convertUsingKeymap } from '../../../../admin/crud/CrudFetcher';
import { OnboardingClass } from './OnboardingClass';

/**
 * Determines when we last showed the onboarding class for the user with the
 * given sub on this device.
 */
const getLastShownAt = (sub: string): Date | null => {
  const storedValue = localStorage.getItem('onboarding-class');
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
 * Stores that the given user saw the onboarding class at the given time
 * @param sub The sub of the user
 * @param lastShownAt The time the user saw the screen
 */
const storeLastShownAt = (sub: string, lastShownAt: Date) => {
  localStorage.setItem(
    'onboarding-class',
    JSON.stringify({
      sub,
      lastShownAt: lastShownAt.getTime(),
    })
  );
};

const classUidByResponse: Record<string, string> = {
  Connect: 'oseh_j_y6ShNBstkH0ZcKGWY1pLng',
  Destress: 'oseh_j_dIIyr8ANGGMgzK6piHbVWA',
  Relax: 'oseh_j_JtdEIj6CXignWc_4mwrCBQ',
};
const classUids = Object.values(classUidByResponse);
const fallbackResponse = 'Relax';

export const OnboardingClassStep: OnboardingStep<OnboardingClassState, OnboardingClassResources> = {
  identifier: 'onboardingClass',
  useWorldState: () => {
    const loginContext = useContext(LoginContext);
    const [isRecentSignup, setIsRecentSignup] = useState<boolean | undefined>(undefined);
    const [sawClass, setSawClass] = useState<boolean | undefined>(undefined);

    useEffect(() => {
      if (loginContext.state !== 'logged-in') {
        setIsRecentSignup(undefined);
        return;
      }

      setIsRecentSignup(localStorage.getItem('onboard') === '1');
    }, [loginContext]);

    useEffect(() => {
      if (loginContext.state !== 'logged-in' || loginContext.userAttributes === null) {
        setSawClass(undefined);
        return;
      }

      const lastSeenAt = getLastShownAt(loginContext.userAttributes.sub);
      setSawClass(lastSeenAt !== null && lastSeenAt.getTime() + 24 * 60 * 60 * 1000 > Date.now());
    }, [loginContext]);

    const onContinue = useCallback((): OnboardingClassState => {
      if (loginContext.state !== 'logged-in' || loginContext.userAttributes === null) {
        return {
          isRecentSignup: false,
          sawClass: false,
          onContinue: () => {
            throw new Error('onContinue should not be called from onContinue');
          },
        };
      }

      storeLastShownAt(loginContext.userAttributes.sub, new Date());
      setSawClass(true);
      return {
        isRecentSignup,
        sawClass: true,
        onContinue: () => {
          throw new Error('onContinue should not be called from onContinue');
        },
      };
    }, [loginContext, isRecentSignup]);

    return useMemo<OnboardingClassState>(
      () => ({
        isRecentSignup,
        sawClass,
        onContinue,
      }),
      [isRecentSignup, sawClass, onContinue]
    );
  },

  useResources: (state, required, allStates) => {
    // Since we load the journeys in anticipation, we want to be sure
    // that we don't unload journeys that we loaded in anticipation.
    const loginContext = useContext(LoginContext);
    const journeyRefs: Map<
      string,
      [JourneyRef | null, Dispatch<SetStateAction<JourneyRef | null>>]
    > = new Map();
    for (const uid of classUids) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      journeyRefs.set(uid, useState<JourneyRef | null>(null));
    }

    const journeyShared: Map<string, JourneyShared> = new Map();
    for (const uid of classUids) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      journeyShared.set(uid, useJourneyShared(journeyRefs.get(uid)![0]));
    }

    const [currentUid, isFinal] = ((): [string | null, boolean] => {
      if (required === undefined) {
        return [null, true];
      }

      if (allStates.dailyGoal.dailyGoalSelection !== undefined) {
        if (allStates.dailyGoal.dailyGoalSelection === null) {
          return [classUidByResponse[fallbackResponse], true];
        }

        return [
          classUidByResponse[allStates.dailyGoal.dailyGoalSelection] ??
            classUidByResponse[fallbackResponse],
          true,
        ];
      }

      if (
        allStates.dailyGoal.anticipatedDailyGoalSelection !== undefined &&
        allStates.dailyGoal.anticipatedDailyGoalSelection !== null
      ) {
        return [
          classUidByResponse[allStates.dailyGoal.anticipatedDailyGoalSelection] ??
            classUidByResponse[fallbackResponse],
          false,
        ];
      }

      return [null, false];
    })();

    // cleanup when isFinal
    useEffect(() => {
      if (!isFinal) {
        return;
      }

      for (const uid of classUids) {
        if (uid === currentUid) {
          continue;
        }

        journeyRefs.get(uid)![1](null);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUid, isFinal]);

    // load current, but never try to load the same one twice at once, esp if it fails
    const loading = useRef<Map<string, Promise<JourneyRef>>>() as MutableRefObject<
      Map<string, Promise<JourneyRef>>
    >;
    if (loading.current === undefined) {
      loading.current = new Map();
    }

    const currentRef = currentUid === null ? null : journeyRefs.get(currentUid)![0];
    useEffect(() => {
      if (loginContext.state !== 'logged-in' || currentUid === null || currentRef !== null) {
        return;
      }

      let active = true;
      loadCurrent();
      return () => {
        active = false;
      };

      async function loadInner(uid: string): Promise<JourneyRef> {
        const response = await apiFetch(
          '/api/1/users/me/start_introductory_journey?' + new URLSearchParams({ uid }).toString(),
          {
            method: 'POST',
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }

        const data = await response.json();
        return convertUsingKeymap(data, journeyRefKeyMap);
      }

      async function loadCurrent() {
        if (currentUid === null) {
          return;
        }

        while (active) {
          const promise = loading.current.get(currentUid);
          if (promise === undefined) {
            break;
          }

          const result = await promise;
          if (active) {
            journeyRefs.get(currentUid)![1](result);
            loading.current.delete(currentUid);
            return;
          }
        }

        if (!active) {
          return;
        }

        const promise = loadInner(currentUid);
        loading.current.set(currentUid, promise);
        const result = await promise;
        if (active) {
          journeyRefs.get(currentUid)![1](result);
          loading.current.delete(currentUid);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUid, loginContext, currentRef]);

    const currentShared = currentUid === null ? null : journeyShared.get(currentUid)!;

    const playing = useRef<boolean>() as MutableRefObject<boolean>;
    if (playing.current === undefined) {
      playing.current = false;
    }

    return useMemo<OnboardingClassResources>(
      () => ({
        journey: currentRef,
        shared: currentShared,
        loading:
          currentRef === null ||
          currentShared === null ||
          !currentShared.audio?.loaded ||
          currentShared.imageLoading,
        playing,
      }),
      [currentRef, currentShared]
    );
  },

  isRequired: (state) => {
    if (state.isRecentSignup === undefined || state.sawClass === undefined) {
      return undefined;
    }

    return state.isRecentSignup && !state.sawClass;
  },

  component: (state, resources, doAnticipateState) => (
    <OnboardingClass state={state} resources={resources} doAnticipateState={doAnticipateState} />
  ),

  onMountingSoon: (state, resources, pending, allStates) => {
    if (
      allStates.dailyGoal.dailyGoalSelection === undefined ||
      resources === undefined ||
      resources.journey === null ||
      resources.shared === null ||
      resources.shared.audio === null ||
      resources.shared.audio.play === null ||
      resources.shared.audio.stop === null ||
      resources.playing.current
    ) {
      return;
    }
    const stop = resources.shared.audio.stop;

    const expectedUid =
      classUidByResponse[allStates.dailyGoal.dailyGoalSelection ?? fallbackResponse] ??
      classUidByResponse[fallbackResponse];

    if (resources.journey.uid !== expectedUid) {
      return;
    }

    try {
      resources.shared.audio.play();
    } catch (e) {
      console.log('onMountingSoon failed to play audio anyway:', e);
      return;
    }

    resources.playing.current = true;
    pending.catch((e) => {
      console.log('clawback engaged for onboarding class audio', e);
      stop()
        .catch((e) => {
          console.error('failed to stop playing audio!', e);
        })
        .finally(() => {
          resources.playing.current = false;
        });
    });
  },
};
