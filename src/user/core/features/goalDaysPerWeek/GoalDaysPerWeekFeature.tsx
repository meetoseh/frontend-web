import { useContext } from 'react';
import { useInappNotificationValueWithCallbacks } from '../../../../shared/hooks/useInappNotification';
import { Feature } from '../../models/Feature';
import { GoalDaysPerWeekResources } from './GoalDaysPerWeekResources';
import { GoalDaysPerWeekState } from './GoalDaysPerWeekState';
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

const backgroundUid = 'oseh_if_0ykGW_WatP5-mh-0HRsrNw';

export const GoalDaysPerWeekFeature: Feature<GoalDaysPerWeekState, GoalDaysPerWeekResources> = {
  identifier: 'goalDaysPerWeek',
  useWorldState: () => {
    const ianVWC = useInappNotificationValueWithCallbacks({
      type: 'react-rerender',
      props: { uid: 'oseh_ian_onUsRRweMgFGAg_ZHorM2A', suppress: false },
    });
    const forcedVWC = useWritableValueWithCallbacks<boolean>(() => false);
    return useMappedValuesWithCallbacks([ianVWC, forcedVWC], () => ({
      ian: ianVWC.get(),
      forced: forcedVWC.get(),
      setForced: (forced) => setVWC(forcedVWC, forced),
    }));
  },
  useResources: (stateVWC, requiredVWC, allStatesVWC) => {
    const windowSizeVWC = useWindowSizeValueWithCallbacks();
    const interestsRaw = useContext(InterestsContext);
    const interestsVWC = useReactManagedValueAsValueWithCallbacks(interestsRaw);
    const imageHandler = useOsehImageStateRequestHandler({});
    const backgroundProps = useMappedValuesWithCallbacks(
      [requiredVWC, windowSizeVWC],
      (): OsehImageProps => ({
        uid: requiredVWC.get() ? backgroundUid : null,
        jwt: null,
        displayWidth: windowSizeVWC.get().width,
        displayHeight: windowSizeVWC.get().height,
        alt: '',
        isPublic: true,
      })
    );
    const background = useStaleOsehImageOnSwap(
      useOsehImageStateValueWithCallbacks(
        {
          type: 'callbacks',
          props: () => backgroundProps.get(),
          callbacks: backgroundProps.callbacks,
        },
        imageHandler
      )
    );
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
      [background, session, interestsVWC, initialGoalVWC],
      (): GoalDaysPerWeekResources => ({
        background: background.get(),
        session: session.get(),
        loading:
          background.get().loading ||
          session.get() === null ||
          interestsVWC.get().state === 'loading',
        initialGoal: initialGoalVWC.get(),
        onGoalSet: (goal) => {
          const info = allStatesVWC.get().homeScreen.streakInfo;
          if (info.type === 'success') {
            info.replace({ ...info.result, goalDaysPerWeek: goal });
          }

          stateVWC.get().setForced(false);
        },
      })
    );
  },
  isRequired: (state, allStates) => {
    if (state.forced) {
      return true;
    }

    if (state.ian === null) {
      return undefined;
    }

    return (
      state.ian.showNow &&
      (allStates.pickEmotionJourney.classesTakenThisSession > 0 ||
        allStates.homeScreen.sessionInfo.classesTaken > 0)
    );
  },
  component: (state, resources) => <GoalDaysPerWeek state={state} resources={resources} />,
};
