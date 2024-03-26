import { useContext } from 'react';
import { useInappNotificationValueWithCallbacks } from '../../../../shared/hooks/useInappNotification';
import { Feature } from '../../models/Feature';
import { GoalDaysPerWeekResources } from './GoalDaysPerWeekResources';
import { GoalDaysPerWeekForced, GoalDaysPerWeekState } from './GoalDaysPerWeekState';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import { useInappNotificationSessionValueWithCallbacks } from '../../../../shared/hooks/useInappNotificationSession';
import { GoalDaysPerWeek } from './GoalDaysPerWeek';
import { InterestsContext } from '../../../../shared/contexts/InterestsContext';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useReactManagedValueAsValueWithCallbacks } from '../../../../shared/hooks/useReactManagedValueAsValueWithCallbacks';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { OsehImageProps } from '../../../../shared/images/OsehImageProps';
import { useOsehImageStateValueWithCallbacks } from '../../../../shared/images/useOsehImageStateValueWithCallbacks';
import { useStaleOsehImageOnSwap } from '../../../../shared/images/useStaleOsehImageOnSwap';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';

const backgroundUid = 'oseh_if_0ykGW_WatP5-mh-0HRsrNw';

export const GoalDaysPerWeekFeature: Feature<GoalDaysPerWeekState, GoalDaysPerWeekResources> = {
  identifier: 'goalDaysPerWeek',
  useWorldState: () => {
    const ianVWC = useInappNotificationValueWithCallbacks({
      type: 'react-rerender',
      props: { uid: 'oseh_ian_IGPEKaUU10jd53raAKfhxg', suppress: false },
    });
    const forcedVWC = useWritableValueWithCallbacks<GoalDaysPerWeekForced | null>(() => null);
    useValueWithCallbacksEffect(ianVWC, (ian) => {
      if (ian !== null && ian.showNow && forcedVWC.get() === null) {
        setVWC(forcedVWC, { back: null });
      }
      return undefined;
    });

    return useMappedValuesWithCallbacks([ianVWC, forcedVWC], () => ({
      ian: ianVWC.get(),
      forced: forcedVWC.get(),
      setForced: (forced) => setVWC(forcedVWC, forced),
    }));
  },
  useResources: (stateVWC, requiredVWC, allStatesVWC) => {
    const ianUID = useMappedValuesWithCallbacks([requiredVWC, stateVWC], () =>
      requiredVWC.get() ? stateVWC.get().ian?.uid ?? null : null
    );
    const session = useInappNotificationSessionValueWithCallbacks({
      type: 'callbacks',
      props: () => ({ uid: ianUID.get() }),
      callbacks: ianUID.callbacks,
    });

    const initialGoalVWC = useMappedValueWithCallbacks(
      allStatesVWC,
      (s) => s.homeScreen.streakInfo.result?.goalDaysPerWeek ?? 3
    );

    return useMappedValuesWithCallbacks(
      [session, initialGoalVWC],
      (): GoalDaysPerWeekResources => ({
        session: session.get(),
        loading: session.get() === null,
        initialGoal: initialGoalVWC.get(),
        onGoalSet: (goal, action) => {
          const info = allStatesVWC.get().homeScreen.streakInfo;
          if (info.type === 'success') {
            info.replace({ ...info.result, goalDaysPerWeek: goal });
          }

          const forced = stateVWC.get().forced;
          if (forced !== null) {
            if (action === 'back' && forced.back === 'age') {
              allStatesVWC.get().age.setForced(true);
            }
            stateVWC.get().setForced(null);
          }
        },
      })
    );
  },
  isRequired: (state) => {
    if (state.forced !== null) {
      return true;
    }

    if (state.ian === null) {
      return undefined;
    }

    return state.ian.showNow;
  },
  component: (state, resources) => <GoalDaysPerWeek state={state} resources={resources} />,
};
