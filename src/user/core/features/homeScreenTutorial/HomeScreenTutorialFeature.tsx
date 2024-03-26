import { useInappNotificationValueWithCallbacks } from '../../../../shared/hooks/useInappNotification';
import { useInappNotificationSessionValueWithCallbacks } from '../../../../shared/hooks/useInappNotificationSession';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { useFeatureFlag } from '../../../../shared/lib/useFeatureFlag';
import { Feature } from '../../models/Feature';
import { useHomeScreenImage } from '../homeScreen/hooks/useHomeScreenImage';
import { HomeScreenTutorial } from './HomeScreenTutorial';
import { HomeScreenTutorialResources } from './HomeScreenTutorialResources';
import { HomeScreenTutorialState } from './HomeScreenTutorialState';

export const HomeScreenTutorialFeature: Feature<
  HomeScreenTutorialState,
  HomeScreenTutorialResources
> = {
  identifier: 'homeScreenTutorial',
  useWorldState: () => {
    const enabledVWC = useFeatureFlag('series');
    const ian = useInappNotificationValueWithCallbacks({
      type: 'callbacks',
      props: () => ({ uid: 'oseh_ian_8bGx8_3WK_tF5t-1hmvMzw', suppress: !enabledVWC.get() }),
      callbacks: enabledVWC.callbacks,
    });

    return useMappedValuesWithCallbacks([enabledVWC, ian], (): HomeScreenTutorialState => {
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

    return state.ian?.showNow;
  },
  useResources: (stateVWC, requiredVWC, allStatesVWC) => {
    const homeScreenStateVWC = useMappedValueWithCallbacks(allStatesVWC, (s) => s.homeScreen, {
      outputEqualityFn: Object.is,
    });
    const backgroundImageStateVWC = useHomeScreenImage({
      requiredVWC,
      imageHandler: homeScreenStateVWC.get().imageHandler,
    });
    const sessionVWC = useInappNotificationSessionValueWithCallbacks({
      type: 'callbacks',
      props: () => ({ uid: stateVWC.get().ian?.uid ?? null }),
      callbacks: stateVWC.callbacks,
    });

    return useMappedValuesWithCallbacks(
      [backgroundImageStateVWC, sessionVWC, homeScreenStateVWC],
      () => {
        const homeScreenState = homeScreenStateVWC.get();
        return {
          loading:
            backgroundImageStateVWC.get().loading ||
            homeScreenState.streakInfo.type === 'loading' ||
            sessionVWC.get() === null,
          imageHandler: homeScreenState.imageHandler,
          streakInfo: homeScreenState.streakInfo,
          sessionInfo: homeScreenState.sessionInfo,
          backgroundImage: backgroundImageStateVWC.get(),
          session: sessionVWC.get(),
        };
      }
    );
  },
  component: (state, resources) => <HomeScreenTutorial state={state} resources={resources} />,
};
