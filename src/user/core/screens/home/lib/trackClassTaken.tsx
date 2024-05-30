import { getCurrentServerTimeMS } from '../../../../../shared/lib/getCurrentServerTimeMS';
import { shuffle } from '../../../../../shared/lib/shuffle';
import { waitForValueWithCallbacksConditionCancelable } from '../../../../../shared/lib/waitForValueWithCallbacksCondition';
import { DAYS_OF_WEEK } from '../../../../../shared/models/DayOfWeek';
import { ScreenContext } from '../../../hooks/useScreenContext';
import { createHistoryListRequest } from '../../history/lib/createHistoryListRequestHandler';
import { createOwnedListRequest } from '../../owned/lib/createOwnedListRequestHandler';

/**
 * A convenience function to track that a class was taken in the current session,
 * so that the SessionInfo handler includes the class. This is intended to be used
 * fire-and-forget style.
 */
export const trackClassTaken = (ctx: ScreenContext): void => {
  (async () => {
    const loginContext = ctx.login.value.get();
    if (loginContext.state !== 'logged-in') {
      return;
    }

    const req = ctx.resources.sessionStateHandler.request({
      ref: loginContext,
      refreshRef: () => {
        const innerLoginContext = ctx.login.value.get();
        if (innerLoginContext.state !== 'logged-in') {
          return {
            promise: Promise.resolve({
              type: 'expired',
              data: undefined,
              error: <>User is not logged in</>,
              retryAt: undefined,
            }),
            done: () => true,
            cancel: () => {},
          };
        }

        return {
          promise: Promise.resolve({
            type: 'success',
            data: innerLoginContext,
            error: undefined,
            retryAt: undefined,
          }),
          done: () => true,
          cancel: () => {},
        };
      },
    });

    try {
      const data = await waitForValueWithCallbacksConditionCancelable(
        req.data,
        (d) => d.type !== 'loading'
      ).promise;
      if (data.type !== 'success') {
        return;
      }

      data.data.onClassTaken();
    } finally {
      req.release();
    }
  })().catch((e) => {
    console.error('error tracking class taken (session state)', e);
  });

  (async () => {
    const loginContext = ctx.login.value.get();
    if (loginContext.state !== 'logged-in') {
      return;
    }

    const nowServer = await getCurrentServerTimeMS();
    const nowServerDateInLocalTZ = new Date(nowServer);
    const nowDayOfWeekIdxSunday0 = nowServerDateInLocalTZ.getDay();
    const nowDayOfWeekIdxMonday0 = (nowDayOfWeekIdxSunday0 + 6) % 7;
    const nowDayOfWeekName = DAYS_OF_WEEK[nowDayOfWeekIdxMonday0];

    ctx.resources.streakHandler.evictOrReplace(loginContext, (old) => {
      if (old === undefined) {
        return { type: 'make-request', data: undefined };
      }

      let streakIncreased = !old.daysOfWeek.includes(nowDayOfWeekName);

      return {
        type: 'data',
        data: {
          streak: old.streak + (streakIncreased ? 1 : 0),
          daysOfWeek: old.daysOfWeek.concat(...(streakIncreased ? [nowDayOfWeekName] : [])),
          goalDaysPerWeek: old.goalDaysPerWeek,
          journeys: old.journeys + 1,
          prevBestAllTimeStreak: old.prevBestAllTimeStreak,
        },
      };
    });
  })().catch((e) => {
    console.error('error tracking class taken (streak)', e);
  });

  (async () => {
    const loginContext = ctx.login.value.get();
    if (loginContext.state !== 'logged-in') {
      return;
    }

    ctx.resources.emotionsHandler.evictOrReplace(loginContext, (old) => {
      if (old === undefined) {
        return { type: 'make-request', data: undefined };
      }

      const cp = old.slice();
      shuffle(cp);
      return { type: 'data', data: cp };
    });
  })().catch((e) => {
    console.error('error tracking class taken (emotions)', e);
  });

  (async () => {
    const loginContext = ctx.login.value.get();
    if (loginContext.state !== 'logged-in') {
      return;
    }

    ctx.resources.historyListHandler.evictOrReplace(createHistoryListRequest(), (old) => {
      if (old === undefined) {
        return { type: 'make-request', data: undefined };
      }
      old.reset();
      return { type: 'data', data: old };
    });

    ctx.resources.ownedListHandler.evictOrReplace(createOwnedListRequest(), (old) => {
      if (old === undefined) {
        return { type: 'make-request', data: undefined };
      }
      old.reset();
      return { type: 'data', data: old };
    });
  })().catch((e) => {
    console.error('error tracking class taken (history & owned lists)', e);
  });
};
