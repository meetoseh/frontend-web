import { useCallback } from 'react';
import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { apiFetch } from '../../../../shared/ApiConstants';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { useNetworkResponse } from '../../../../shared/hooks/useNetworkResponse';
import { useTimezone } from '../../../../shared/hooks/useTimezone';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { adaptActiveVWCToAbortSignal } from '../../../../shared/lib/adaptActiveVWCToAbortSignal';
import { useFeatureFlag } from '../../../../shared/lib/useFeatureFlag';
import { StreakInfo, streakInfoKeyMap } from '../../../journey/models/StreakInfo';
import { Feature } from '../../models/Feature';
import { homeScreenImageMapper } from './HomeScreenImage';
import { HomeScreenResources } from './HomeScreenResources';
import { HomeScreenSessionInfo, HomeScreenState } from './HomeScreenState';
import { OsehImageProps } from '../../../../shared/images/OsehImageProps';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useOsehImageStateValueWithCallbacks } from '../../../../shared/images/useOsehImageStateValueWithCallbacks';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';
import { areOsehImageStatesEqual } from '../../../../shared/images/OsehImageState';
import { useStaleOsehImageOnSwap } from '../../../../shared/images/useStaleOsehImageOnSwap';
import { HomeScreen } from './HomeScreen';
import { Emotion } from '../pickEmotionJourney/Emotion';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';

export const HomeScreenFeature: Feature<HomeScreenState, HomeScreenResources> = {
  identifier: 'homeScreen',
  useWorldState: () => {
    const enabledVWC = useFeatureFlag('series');
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

    return useMappedValuesWithCallbacks([enabledVWC, streakInfoVWC, sessionInfoVWC], () => ({
      enabled: !!enabledVWC.get(),
      streakInfo: streakInfoVWC.get(),
      sessionInfo: sessionInfoVWC.get(),
      onClassTaken: () => {
        const info = sessionInfoVWC.get();
        setVWC(sessionInfoVWC, {
          ...info,
          classesTaken: info.classesTaken + 1,
        });
      },
    }));
  },
  isRequired: (worldState) => worldState.enabled,
  useResources: (stateVWC, requiredVWC, allStatesVWC) => {
    const imageHandler = useOsehImageStateRequestHandler({});
    const timezone = useTimezone();
    const windowSizeVWC = useWindowSizeValueWithCallbacks();
    const loadPrevented = useMappedValueWithCallbacks(requiredVWC, (r) => !r);
    const backgroundImageNR = useNetworkResponse(
      useCallback(
        (active, loginContext) => {
          return adaptActiveVWCToAbortSignal(active, async (signal) => {
            signal?.throwIfAborted();
            const response = await apiFetch(
              '/api/1/users/me/home_image?tz=' + encodeURIComponent(timezone) + '&tzt=browser',
              {
                method: 'GET',
                signal,
              },
              loginContext
            );
            if (!response.ok) {
              throw response;
            }
            const data = await response.json();
            return convertUsingMapper(data, homeScreenImageMapper);
          });
        },
        [timezone]
      ),
      { loadPrevented }
    );
    const backgroundImageDisplaySizeVWC = useMappedValueWithCallbacks(
      windowSizeVWC,
      () => ({
        width: windowSizeVWC.get().width,
        height: 258 + Math.max(Math.min(windowSizeVWC.get().height - 633, 92), 0),
      }),
      {
        outputEqualityFn: (a, b) => a.width === b.width && a.height === b.height,
      }
    );

    const backgroundImageProps = useMappedValuesWithCallbacks(
      [backgroundImageNR, requiredVWC, backgroundImageDisplaySizeVWC],
      (): OsehImageProps => {
        const req = requiredVWC.get();
        const himg = backgroundImageNR.get();
        const size = backgroundImageDisplaySizeVWC.get();
        return {
          uid: req && himg.type === 'success' ? himg.result.image.uid : null,
          jwt: req && himg.type === 'success' ? himg.result.image.jwt : null,
          displayWidth: size.width,
          displayHeight: size.height,
          alt: '',
        };
      }
    );

    const backgroundImageStateRawVWC = useOsehImageStateValueWithCallbacks(
      adaptValueWithCallbacksAsVariableStrategyProps(backgroundImageProps),
      imageHandler
    );

    const backgroundImageStateVWC = useStaleOsehImageOnSwap(
      useMappedValuesWithCallbacks(
        [backgroundImageNR, backgroundImageStateRawVWC],
        () => {
          const himg = backgroundImageNR.get();
          const state = backgroundImageStateRawVWC.get();
          if (himg.type !== 'success') {
            return state;
          }
          if (state.thumbhash !== null) {
            return state;
          }
          return { ...state, thumbhash: himg.result.thumbhash };
        },
        {
          outputEqualityFn: areOsehImageStatesEqual,
        }
      )
    );

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

    return useMappedValuesWithCallbacks(
      [backgroundImageStateVWC, emotionsNR],
      (): HomeScreenResources => {
        const bknd = backgroundImageStateVWC.get();
        const emotions = emotionsNR.get();
        return {
          loading: bknd.loading,
          imageHandler,
          backgroundImage: bknd,
          emotions,
          startGotoEmotion: (emotion) => {
            allStatesVWC.get().gotoEmotion.setShow({ emotion, anticipatory: true }, false);
            return () => {
              allStatesVWC.get().gotoEmotion.setShow({ emotion, anticipatory: false }, true);
            };
          },
          gotoSeries: () => {
            allStatesVWC.get().seriesList.setShow(true, true);
          },
          gotoAccount: () => {
            allStatesVWC.get().settings.setShow(true, true);
          },
          gotoUpdateGoal: () => {
            allStatesVWC.get().goalDaysPerWeek.setForced(true);
          },
        };
      }
    );
  },
  component: (state, resources) => <HomeScreen state={state} resources={resources} />,
};
