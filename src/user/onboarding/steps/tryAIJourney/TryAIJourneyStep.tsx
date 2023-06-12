import { useContext, useMemo, useState } from 'react';
import { OnboardingStep } from '../../models/OnboardingStep';
import { TryAIJourneyResources } from './TryAIJourneyResources';
import { TryAIJourneyState } from './TryAIJourneyState';
import { LoginContext } from '../../../../shared/LoginContext';
import { useInappNotification } from '../../../../shared/hooks/useInappNotification';
import { apiFetch } from '../../../../shared/ApiConstants';
import { useSingletonEffect } from '../../../../shared/lib/useSingletonEffect';
import { JourneyRef, journeyRefKeyMap } from '../../../journey/models/JourneyRef';
import { convertUsingKeymap } from '../../../../admin/crud/CrudFetcher';
import { useInappNotificationSession } from '../../../../shared/hooks/useInappNotificationSession';
import { useWindowSize } from '../../../../shared/hooks/useWindowSize';
import { OsehImageProps, useOsehImageStates } from '../../../../shared/OsehImage';
import { useJourneyShared } from '../../../journey/hooks/useJourneyShared';
import { TryAIJourney } from './TryAIJourney';

const backgroundImageUid = 'oseh_if_0ykGW_WatP5-mh-0HRsrNw';

/**
 * Prompts the user to see if they want to try an ai journey. If they select
 * yes they go through the interactive prompt, then the audio screen, but
 * see a swapped out post-class screen asking if they liked it.
 */
export const TryAIJourneyStep: OnboardingStep<TryAIJourneyState, TryAIJourneyResources> = {
  identifier: 'tryAIJourney',
  useWorldState: () => {
    const loginContext = useContext(LoginContext);
    const ian = useInappNotification('oseh_ian_ncpainTP_XZJpWQ9ZIdGQA', false);
    const [streakDays, setStreakDays] = useState<number | null | undefined>(null);
    const [journey, setJourney] = useState<JourneyRef | null | undefined>(null);

    useSingletonEffect(
      (onDone) => {
        if (loginContext.state === 'loading') {
          setStreakDays(null);
          onDone();
          return;
        }

        if (loginContext.state !== 'logged-in') {
          setStreakDays(undefined);
          onDone();
          return;
        }

        if (ian === null) {
          setStreakDays(null);
          onDone();
          return;
        }

        if (!ian.showNow) {
          setStreakDays(undefined);
          onDone();
          return;
        }

        if (streakDays !== null && streakDays !== undefined) {
          onDone();
          return;
        }

        let active = true;
        loadStreak();
        return () => {
          active = false;
        };

        async function loadStreakInner() {
          const response = await apiFetch('/api/1/users/me/streak', {}, loginContext);

          if (!response.ok) {
            throw response;
          }

          const data: { streak: number } = await response.json();
          if (active) {
            setStreakDays(data.streak);
          }
        }

        async function loadStreak() {
          try {
            await loadStreakInner();
          } catch (e) {
            console.error('failed to load streak: ', e);
            setStreakDays(0);
          } finally {
            onDone();
          }
        }
      },
      [ian, loginContext, streakDays]
    );

    useSingletonEffect(
      (onDone) => {
        if (loginContext.state === 'loading') {
          setJourney(null);
          onDone();
          return;
        }

        if (loginContext.state !== 'logged-in') {
          setJourney(undefined);
          onDone();
          return;
        }

        if (loginContext.userAttributes !== null) {
          // this is just a superfluous check to ensure that this step is
          // disabled for now
          setJourney(null);
          onDone();
          return;
        }

        if (ian === null) {
          setJourney(null);
          onDone();
          return;
        }

        if (streakDays === null) {
          setJourney(null);
          onDone();
          return;
        }

        if (streakDays === undefined) {
          setJourney(undefined);
          onDone();
          return;
        }

        if (streakDays < 7) {
          setJourney(undefined);
          onDone();
          return;
        }

        if (journey !== null && journey !== undefined) {
          onDone();
          return;
        }

        let active = true;
        loadJourney();
        return () => {
          active = false;
        };

        async function loadJourneyInner() {
          const response = await apiFetch(
            '/api/1/users/me/start_ai_journey',
            {
              method: 'POST',
            },
            loginContext
          );
          if (response.status === 404) {
            // no ai journeys available
            if (active && journey === null) {
              setJourney(undefined);
            }
            return;
          }
          if (!response.ok) {
            throw response;
          }

          const data = await response.json();
          const newJourney = convertUsingKeymap(data, journeyRefKeyMap);
          if (active) {
            setJourney(newJourney);
          }
        }

        async function loadJourney() {
          try {
            await loadJourneyInner();
          } catch (e) {
            console.error('failed to load journey: ', e);
            if (active && journey === null) {
              setJourney(undefined);
            }
          } finally {
            onDone();
          }
        }
      },
      [loginContext, ian, streakDays, journey]
    );

    return useMemo<TryAIJourneyState>(
      () => ({
        ian,
        streakDays,
        journey,
        setStreakDays,
      }),
      [ian, streakDays, journey]
    );
  },
  useResources: (state, required) => {
    const session = useInappNotificationSession(state.ian?.uid ?? null);
    const windowSize = useWindowSize();
    const imageProps = useMemo<OsehImageProps[]>(() => {
      if (!required) {
        return [];
      }

      return [
        {
          uid: backgroundImageUid,
          jwt: null,
          displayWidth: windowSize.width,
          displayHeight: windowSize.height,
          alt: '',
          isPublic: true,
        },
      ];
    }, [windowSize.width, windowSize.height, required]);
    const images = useOsehImageStates(imageProps);
    const background = images[0] ?? null;
    const shared = useJourneyShared(required ? state.journey ?? null : null);

    return useMemo<TryAIJourneyResources>(
      () => ({
        session,
        promptBackground: background,
        shared,
        loading:
          !required ||
          state.ian === null ||
          state.ian === undefined ||
          state.streakDays === null ||
          state.streakDays === undefined ||
          state.journey === null ||
          state.journey === undefined ||
          background === null ||
          background.loading ||
          shared.imageLoading,
      }),
      [required, session, state, background, shared]
    );
  },
  isRequired: (state) => {
    if (state.journey === null) {
      return undefined;
    }
    return state.journey !== undefined;
  },
  component: (state, resources, doAnticipateState) => (
    <TryAIJourney state={state} resources={resources} doAnticipateState={doAnticipateState} />
  ),
};
