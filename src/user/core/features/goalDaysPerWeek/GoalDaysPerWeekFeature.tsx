import { useContext, useMemo } from 'react';
import { useInappNotification } from '../../../../shared/hooks/useInappNotification';
import { Feature } from '../../models/Feature';
import { GoalDaysPerWeekResources } from './GoalDaysPerWeekResources';
import { GoalDaysPerWeekState } from './GoalDaysPerWeekState';
import { useWindowSize } from '../../../../shared/hooks/useWindowSize';
import { useInappNotificationSession } from '../../../../shared/hooks/useInappNotificationSession';
import { GoalDaysPerWeek } from './GoalDaysPerWeek';
import { InterestsContext } from '../../../../shared/contexts/InterestsContext';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { OsehImageState } from '../../../../shared/images/OsehImageState';
import { useOsehImageState } from '../../../../shared/images/useOsehImageState';

const backgroundUid = 'oseh_if_0ykGW_WatP5-mh-0HRsrNw';

export const GoalDaysPerWeekFeature: Feature<GoalDaysPerWeekState, GoalDaysPerWeekResources> = {
  identifier: 'goalDaysPerWeek',
  useWorldState: () => {
    const ian = useInappNotification('oseh_ian_onUsRRweMgFGAg_ZHorM2A', false);
    return useMemo(() => ({ ian }), [ian]);
  },
  useResources: (state, required) => {
    const windowSize = useWindowSize();
    const interests = useContext(InterestsContext);
    const imageHandler = useOsehImageStateRequestHandler({});
    const background: OsehImageState = useOsehImageState(
      {
        uid: required ? backgroundUid : null,
        jwt: null,
        displayWidth: windowSize.width,
        displayHeight: windowSize.height,
        alt: '',
        isPublic: true,
      },
      imageHandler
    );
    const session = useInappNotificationSession(required ? state.ian?.uid ?? null : null);

    return useMemo<GoalDaysPerWeekResources>(
      () => ({
        background,
        session,
        loading:
          background === null ||
          background.loading ||
          session === null ||
          interests.state === 'loading',
      }),
      [background, session, interests.state]
    );
  },
  isRequired: (state, allStates) => {
    if (state.ian === null) {
      return undefined;
    }

    return state.ian.showNow && allStates.pickEmotionJourney.classesTakenThisSession > 0;
  },
  component: (state, resources, doAnticipateState) => (
    <GoalDaysPerWeek state={state} resources={resources} doAnticipateState={doAnticipateState} />
  ),
};
