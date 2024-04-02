import { useInappNotificationValueWithCallbacks } from '../../../../shared/hooks/useInappNotification';
import { useInappNotificationSessionValueWithCallbacks } from '../../../../shared/hooks/useInappNotificationSession';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { Feature } from '../../models/Feature';
import { Age } from './Age';
import { AgeResources } from './AgeResources';
import { AgeForced, AgeState } from './AgeState';

export const AgeFeature: Feature<AgeState, AgeResources> = {
  identifier: 'age',
  useWorldState: () => {
    const forcedVWC = useWritableValueWithCallbacks<AgeForced | null>(() => null);
    const ian = useInappNotificationValueWithCallbacks({
      type: 'react-rerender',
      props: { uid: 'oseh_ian_xRWoSM6A_F7moeaYSpcaaQ', suppress: false },
    });

    // prevents us from flashing the screen under certain network errors
    useValueWithCallbacksEffect(ian, (ian) => {
      if (ian !== null && ian.showNow) {
        setVWC(forcedVWC, { enter: 'fade' } as const, (a, b) => (a === null) === (b === null));
      }
      return undefined;
    });

    return useMappedValuesWithCallbacks([forcedVWC, ian], (): AgeState => {
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
      onBack: () => {
        allStatesVWC.get().goalCategories.setForced({ enter: 'swipe-right' });
        stateVWC.get().setForced(null);
      },
      onContinue: () => {
        allStatesVWC.get().goalDaysPerWeek.setForced({ back: 'age' });
        stateVWC.get().setForced(null);
      },
    }));
  },
  component: (state, resources) => <Age state={state} resources={resources} />,
};
