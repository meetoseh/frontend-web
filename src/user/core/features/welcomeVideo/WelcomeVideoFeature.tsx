import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { apiFetch } from '../../../../shared/ApiConstants';
import { createVideoSizeComparerForTarget } from '../../../../shared/content/createVideoSizeComparerForTarget';
import { useOsehContentTargetValueWithCallbacks } from '../../../../shared/content/useOsehContentTargetValueWithCallbacks';
import { useOsehVideoContentState } from '../../../../shared/content/useOsehVideoContentState';
import { useInappNotificationValueWithCallbacks } from '../../../../shared/hooks/useInappNotification';
import { useInappNotificationSessionValueWithCallbacks } from '../../../../shared/hooks/useInappNotificationSession';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { useNetworkResponse } from '../../../../shared/hooks/useNetworkResponse';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import { OsehImageProps } from '../../../../shared/images/OsehImageProps';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { useOsehImageStateValueWithCallbacks } from '../../../../shared/images/useOsehImageStateValueWithCallbacks';
import { useStaleOsehImageOnSwap } from '../../../../shared/images/useStaleOsehImageOnSwap';
import { adaptActiveVWCToAbortSignal } from '../../../../shared/lib/adaptActiveVWCToAbortSignal';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';
import { useFeatureFlag } from '../../../../shared/lib/useFeatureFlag';
import { onboardingVideoKeyMap } from '../../../../shared/models/OnboardingVideo';
import { Feature } from '../../models/Feature';
import { WelcomeVideo } from './WelcomeVideo';
import { WelcomeVideoResources } from './WelcomeVideoResources';
import { WelcomeVideoState } from './WelcomeVideoState';

export const WelcomeVideoFeature: Feature<WelcomeVideoState, WelcomeVideoResources> = {
  identifier: 'welcomeVideo',
  useWorldState: () => {
    const enabledVWC = useFeatureFlag('series');
    const ian = useInappNotificationValueWithCallbacks({
      type: 'callbacks',
      props: () => ({ uid: 'oseh_ian_Ua7cSqwMg3atEEG4sf1R5w', suppress: !enabledVWC.get() }),
      callbacks: enabledVWC.callbacks,
    });

    return useMappedValuesWithCallbacks([enabledVWC, ian], () => {
      const enabled = enabledVWC.get();
      return {
        enabled: enabled === undefined ? false : enabled,
        ian: ian.get(),
      };
    });
  },
  isRequired: (state) => {
    if (state.enabled === null) {
      return undefined;
    }
    if (!state.enabled) {
      return false;
    }
    if (state.ian === null) {
      return undefined;
    }
    return state.ian.showNow;
  },
  useResources: (stateVWC, requiredVWC) => {
    const imageHandler = useOsehImageStateRequestHandler({});
    const windowSizeVWC = useWindowSizeValueWithCallbacks();

    const sessionVWC = useInappNotificationSessionValueWithCallbacks({
      type: 'callbacks',
      props: () => ({ uid: stateVWC.get().ian?.uid ?? null }),
      callbacks: stateVWC.callbacks,
    });

    const onboardingVideoNR = useNetworkResponse(
      (active, loginContext) =>
        adaptActiveVWCToAbortSignal(active, async (signal) => {
          if (!requiredVWC.get()) {
            return null;
          }

          const response = await apiFetch(
            '/api/1/onboarding/welcome-video',
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
          return convertUsingMapper(data, onboardingVideoKeyMap);
        }),
      {
        dependsOn: [requiredVWC],
      }
    );

    const coverImagePropsVWC = useMappedValuesWithCallbacks(
      [onboardingVideoNR, windowSizeVWC],
      (): OsehImageProps => {
        const vid = onboardingVideoNR.get();
        const size = windowSizeVWC.get();

        const ref = vid.type === 'success' ? vid.result.thumbnail : null;
        return {
          uid: ref === null ? null : ref.uid,
          jwt: ref === null ? null : ref.jwt,
          displayWidth: size.width,
          displayHeight: size.height,
          alt: '',
          thumbhashOnly: true,
        };
      }
    );
    const coverImageStateVWC = useStaleOsehImageOnSwap(
      useOsehImageStateValueWithCallbacks(
        adaptValueWithCallbacksAsVariableStrategyProps(coverImagePropsVWC),
        imageHandler
      )
    );
    const videoTargetVWC = useOsehContentTargetValueWithCallbacks({
      ref: useMappedValueWithCallbacks(onboardingVideoNR, (vid) => {
        if (vid.type === 'success') {
          return vid.result.video;
        }
        return null;
      }),
      comparer: useMappedValueWithCallbacks(windowSizeVWC, (size) =>
        createVideoSizeComparerForTarget(size.width, size.height)
      ),
      presign: true,
    });
    const videoStateVWC = useOsehVideoContentState({
      target: videoTargetVWC,
      size: windowSizeVWC,
    });

    return useMappedValuesWithCallbacks(
      [requiredVWC, sessionVWC, onboardingVideoNR, coverImageStateVWC, videoStateVWC],
      () => {
        const req = requiredVWC.get();
        const session = sessionVWC.get();
        const onboardingVideo = onboardingVideoNR.get();
        const coverImage = coverImageStateVWC.get();
        const video = videoStateVWC.get();

        return {
          loading:
            !req ||
            session === null ||
            onboardingVideo.type !== 'success' ||
            coverImage.thumbhash === null,
          session,
          onboardingVideo,
          coverImage,
          video,
        };
      }
    );
  },
  component: (state, resources) => <WelcomeVideo state={state} resources={resources} />,
};
