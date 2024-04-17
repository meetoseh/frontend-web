import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { apiFetch } from '../../../../shared/ApiConstants';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { useNetworkResponse } from '../../../../shared/hooks/useNetworkResponse';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { adaptActiveVWCToAbortSignal } from '../../../../shared/lib/adaptActiveVWCToAbortSignal';
import { StreakInfo, streakInfoKeyMap } from '../../../journey/models/StreakInfo';
import { Feature } from '../../models/Feature';
import { HomeScreenResources } from './HomeScreenResources';
import { HomeScreenSessionInfo, HomeScreenState } from './HomeScreenState';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { HomeScreen, HomeScreenTransition } from './HomeScreen';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useHomeScreenImage } from './hooks/useHomeScreenImage';
import { Emotion } from '../../../../shared/models/Emotion';
import { useTimezone } from '../../../../shared/hooks/useTimezone';
import { HomeScreenCopy } from './HomeScreenCopy';

export const HomeScreenFeature: Feature<HomeScreenState, HomeScreenResources> = {
  identifier: 'homeScreen',
  useWorldState: () => {
    const streakInfoVWC = useNetworkResponse<StreakInfo>(
      (active, loginContext) => {
        return adaptActiveVWCToAbortSignal(active, async (signal) => {
          const response = await apiFetch(
            '/api/1/users/me/streak',
            {
              method: 'GET',
              signal,
            },
            loginContext
          );

          if (!active.get()) {
            return null;
          }

          const raw = await response.json();
          if (!active.get()) {
            return null;
          }

          const parsed = convertUsingMapper(raw, streakInfoKeyMap);
          return parsed;
        });
      },
      {
        minRefreshTimeMS: 0,
      }
    );
    const sessionInfoVWC = useWritableValueWithCallbacks<HomeScreenSessionInfo>(() => ({
      classesTaken: 0,
    }));
    const imageHandler = useOsehImageStateRequestHandler({});
    const nextEnterTransition = useWritableValueWithCallbacks<HomeScreenTransition | undefined>(
      () => undefined
    );

    return useMappedValuesWithCallbacks(
      [streakInfoVWC, sessionInfoVWC, nextEnterTransition],
      (): HomeScreenState => ({
        streakInfo: streakInfoVWC.get(),
        sessionInfo: sessionInfoVWC.get(),
        nextEnterTransition: nextEnterTransition.get(),
        imageHandler,
        onClassTaken: () => {
          const info = sessionInfoVWC.get();
          setVWC(sessionInfoVWC, {
            ...info,
            classesTaken: info.classesTaken + 1,
          });
        },
        setNextEnterTransition: (transition) => {
          setVWC(nextEnterTransition, transition);
        },
      })
    );
  },
  isRequired: () => true,
  useResources: (stateVWC, requiredVWC, allStatesVWC) => {
    const imageHandler = stateVWC.get().imageHandler;
    const loadPrevented = useMappedValueWithCallbacks(requiredVWC, (r) => !r);
    const backgroundImageStateVWC = useHomeScreenImage({ requiredVWC, imageHandler });

    const emotionsNR = useNetworkResponse(
      (active, loginContext) =>
        adaptActiveVWCToAbortSignal(active, async (signal) => {
          const now = new Date();
          const response = await apiFetch(
            '/api/1/emotions/personalized',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                local_time: {
                  hour_24: now.getHours(),
                  minute: now.getMinutes(),
                },
                num_emotions: 16,
              }),
              signal,
            },
            loginContext
          );
          if (!response.ok) {
            throw response;
          }
          const data = await response.json();
          if (!active.get()) {
            return null;
          }
          return data.items as Emotion[];
        }),
      { loadPrevented }
    );

    const copyVariantVWC = useMappedValueWithCallbacks(stateVWC, (s) =>
      s.sessionInfo.classesTaken === 0 ? 'session_start' : 'session_end'
    );
    const timezone = useTimezone();
    const copyNR = useNetworkResponse(
      (active, loginContext) =>
        adaptActiveVWCToAbortSignal(active, async (signal) => {
          const response = await apiFetch(
            '/api/1/users/me/home_copy?variant=' +
              encodeURIComponent(copyVariantVWC.get()) +
              '&tz=' +
              encodeURIComponent(timezone) +
              '&tzt=browser',
            {
              method: 'GET',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              signal,
            },
            loginContext
          );
          if (!response.ok) {
            throw response;
          }
          const data = await response.json();
          if (!active.get()) {
            return null;
          }
          return data as HomeScreenCopy;
        }),
      { loadPrevented, dependsOn: [copyVariantVWC] }
    );

    return useMappedValuesWithCallbacks(
      [backgroundImageStateVWC, emotionsNR, copyNR],
      (): HomeScreenResources => {
        const bknd = backgroundImageStateVWC.get();
        const emotions = emotionsNR.get();
        const copy = copyNR.get();
        return {
          loading: bknd.loading,
          backgroundImage: bknd,
          emotions,
          copy,
          startGotoEmotion: (emotion) => {
            allStatesVWC.get().gotoEmotion.setShow({ emotion, anticipatory: true }, false);
            return (animationHints) => {
              allStatesVWC
                .get()
                .gotoEmotion.setShow({ emotion, anticipatory: false, animationHints }, true);
            };
          },
          gotoSeries: () => {
            allStatesVWC.get().seriesList.setForced({ enter: 'fade' }, true);
          },
          gotoAccount: () => {
            allStatesVWC.get().settings.setShow(true, true);
          },
          gotoUpdateGoal: () => {
            allStatesVWC.get().goalDaysPerWeek.setForced({ back: null });
          },
        };
      }
    );
  },
  component: (state, resources) => <HomeScreen state={state} resources={resources} />,
};
