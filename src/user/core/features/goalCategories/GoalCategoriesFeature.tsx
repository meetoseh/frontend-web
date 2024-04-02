import { useInappNotificationValueWithCallbacks } from '../../../../shared/hooks/useInappNotification';
import { useInappNotificationSessionValueWithCallbacks } from '../../../../shared/hooks/useInappNotificationSession';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { Feature } from '../../models/Feature';
import { GoalCategories } from './GoalCategories';
import { GoalCategoriesResources } from './GoalCategoriesResources';
import { GoalCategoriesForced, GoalCategoriesState } from './GoalCategoriesState';

export const GoalCategoriesFeature: Feature<GoalCategoriesState, GoalCategoriesResources> = {
  identifier: 'goalCategories',
  useWorldState: () => {
    const forcedVWC = useWritableValueWithCallbacks<GoalCategoriesForced | null>(() => null);
    const ian = useInappNotificationValueWithCallbacks({
      type: 'react-rerender',
      props: { uid: 'oseh_ian_8SptGFOfn3GfFOqA_dHsjA', suppress: false },
    });

    // prevents us from flashing the screen under certain network errors
    useValueWithCallbacksEffect(ian, (ian) => {
      if (ian !== null && ian.showNow) {
        setVWC(
          forcedVWC,
          { enter: 'fade' } as GoalCategoriesForced,
          (a, b) => (a !== null) === (b !== null)
        );
      }
      return undefined;
    });

    return useMappedValuesWithCallbacks([forcedVWC, ian], (): GoalCategoriesState => {
      return {
        forced: forcedVWC.get(),
        ian: ian.get(),
        setForced: (v) => setVWC(forcedVWC, v),
      };
    });
  },
  isRequired: (state) => {
    return state.forced !== null || state.ian?.showNow;
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
        allStatesVWC.get().age.setForced({ enter: 'swipe-left' });
        stateVWC.get().setForced(null);
      },
    }));
  },
  component: (state, resources) => <GoalCategories state={state} resources={resources} />,
};
