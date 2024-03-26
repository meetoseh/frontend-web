import { useInappNotificationValueWithCallbacks } from '../../../../shared/hooks/useInappNotification';
import { useInappNotificationSessionValueWithCallbacks } from '../../../../shared/hooks/useInappNotificationSession';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useFeatureFlag } from '../../../../shared/lib/useFeatureFlag';
import { Feature } from '../../models/Feature';
import { GoalCategories } from './GoalCategories';
import { GoalCategoriesResources } from './GoalCategoriesResources';
import { GoalCategoriesState } from './GoalCategoriesState';

export const GoalCategoriesFeature: Feature<GoalCategoriesState, GoalCategoriesResources> = {
  identifier: 'goalCategories',
  useWorldState: () => {
    const enabledVWC = useFeatureFlag('series');
    const forcedVWC = useWritableValueWithCallbacks(() => false);
    const ian = useInappNotificationValueWithCallbacks({
      type: 'callbacks',
      props: () => ({ uid: 'oseh_ian_8SptGFOfn3GfFOqA_dHsjA', suppress: !enabledVWC.get() }),
      callbacks: enabledVWC.callbacks,
    });

    // prevents us from flashing the screen under certain network errors
    useValueWithCallbacksEffect(ian, (ian) => {
      if (ian !== null && enabledVWC.get() && ian.showNow) {
        setVWC(forcedVWC, true);
      }
      return undefined;
    });

    return useMappedValuesWithCallbacks([enabledVWC, forcedVWC, ian], (): GoalCategoriesState => {
      const enabled = enabledVWC.get();
      return {
        enabled: enabled === undefined ? false : enabled,
        forced: forcedVWC.get(),
        ian: ian.get(),
        setForced: (v) => setVWC(forcedVWC, v),
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
    return state.forced || state.ian?.showNow;
  },
  useResources: (stateVWC, requiredVWC, allStatesVWC) => {
    const sessionVWC = useInappNotificationSessionValueWithCallbacks({
      type: 'callbacks',
      props: () => ({ uid: stateVWC.get().ian?.uid ?? null }),
      callbacks: stateVWC.callbacks,
    });

    return useMappedValuesWithCallbacks([sessionVWC], () => ({
      loading: sessionVWC.get() === null,
      session: sessionVWC.get(),
      onContinue: () => {
        allStatesVWC.get().age.setForced(true);
        stateVWC.get().setForced(false);
      },
    }));
  },
  component: (state, resources) => <GoalCategories state={state} resources={resources} />,
};
