import { useInappNotificationValueWithCallbacks } from '../../../../shared/hooks/useInappNotification';
import { useInappNotificationSessionValueWithCallbacks } from '../../../../shared/hooks/useInappNotificationSession';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
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
    const ian = useInappNotificationValueWithCallbacks({
      type: 'react-rerender',
      props: { uid: 'oseh_ian_8bGx8_3WK_tF5t-1hmvMzw', suppress: false },
    });

    return useMappedValuesWithCallbacks([ian], (): HomeScreenTutorialState => {
      return {
        ian: ian.get(),
      };
    });
  },
  isRequired: (state) => {
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
          onMount: () => {
            allStatesVWC.get().homeScreen.setNextEnterTransition({ type: 'none', ms: 0 });
          },
        };
      }
    );
  },
  component: (state, resources) => <HomeScreenTutorial state={state} resources={resources} />,
};
