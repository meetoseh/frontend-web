import { useMemo } from 'react';
import { useInappNotification } from '../../../../shared/hooks/useInappNotification';
import { OnboardingStep } from '../../models/OnboardingStep';
import { GoalDaysPerWeekResources } from './GoalDaysPerWeekResources';
import { GoalDaysPerWeekState } from './GoalDaysPerWeekState';
import { useWindowSize } from '../../../../shared/hooks/useWindowSize';
import { OsehImageProps, OsehImageState } from '../../../../shared/OsehImage';
import { useOsehImageStates } from '../../../../shared/OsehImage';
import { useInappNotificationSession } from '../../../../shared/hooks/useInappNotificationSession';
import { GoalDaysPerWeek } from './GoalDaysPerWeek';

const backgroundUid = 'oseh_if_0ykGW_WatP5-mh-0HRsrNw';

export const GoalDaysPerWeekStep: OnboardingStep<GoalDaysPerWeekState, GoalDaysPerWeekResources> = {
  identifier: 'goalDaysPerWeek',
  useWorldState: () => {
    const ian = useInappNotification('oseh_ian_onUsRRweMgFGAg_ZHorM2A', false);
    return useMemo(() => ({ ian }), [ian]);
  },
  useResources: (state, required) => {
    const windowSize = useWindowSize();
    const imageProps = useMemo<OsehImageProps[]>(() => {
      if (!required) {
        return [];
      }

      return [
        {
          uid: backgroundUid,
          jwt: null,
          displayWidth: windowSize.width,
          displayHeight: windowSize.height,
          alt: '',
          isPublic: true,
        },
      ];
    }, [required, windowSize]);
    const images = useOsehImageStates(imageProps);

    const background: OsehImageState | null = required && images.length > 0 ? images[0] : null;
    const session = useInappNotificationSession(required ? state.ian?.uid ?? null : null);

    return useMemo<GoalDaysPerWeekResources>(
      () => ({
        background,
        session,
        loading: background === null || background.loading || session === null,
      }),
      [background, session]
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
