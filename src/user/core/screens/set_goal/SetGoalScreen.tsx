import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { RequestResult } from '../../../../shared/requests/RequestHandler';
import { unwrapRequestResult } from '../../../../shared/requests/unwrapRequestResult';
import { StreakInfo } from '../../../journey/models/StreakInfo';
import { createLoginContextRequest } from '../../lib/createLoginContextRequest';
import { OsehScreen } from '../../models/Screen';
import { SetGoal } from './SetGoal';
import { SetGoalAPIParams, SetGoalMappedParams } from './SetGoalParams';
import { SetGoalResources } from './SetGoalResources';

/**
 * Allows the user to set their goal
 */
export const SetGoalScreen: OsehScreen<
  'set_goal',
  SetGoalResources,
  SetGoalAPIParams,
  SetGoalMappedParams
> = {
  slug: 'set_goal',
  paramMapper: (params) => ({
    ...params,
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const getStreak = () =>
      createLoginContextRequest({ ctx, handler: ctx.resources.streakHandler });

    const streakRequest = createWritableValueWithCallbacks<RequestResult<StreakInfo> | null>(null);
    const cleanupStreakRequest = createValueWithCallbacksEffect(ctx.login.value, () => {
      const req = getStreak();
      setVWC(streakRequest, req);
      return () => {
        req.release();
        if (Object.is(streakRequest.get(), req)) {
          setVWC(streakRequest, null);
        }
      };
    });
    const [streakUnwrapped, cleanupUnwrapStreak] = unwrapRequestResult(
      streakRequest,
      (d) => d.data,
      () => null
    );

    return {
      streak: streakUnwrapped,
      ready: createWritableValueWithCallbacks(true),
      dispose: () => {
        cleanupStreakRequest();
        cleanupUnwrapStreak();
      },
    };
  },
  component: (props) => <SetGoal {...props} />,
};
