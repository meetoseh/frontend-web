import { ScreenContext } from '../../../hooks/useScreenContext';
import { createFavoritesListRequest } from '../../favorites/lib/createFavoritesListRequestHandler';
import { createHistoryListRequest } from '../../history/lib/createHistoryListRequestHandler';
import { createOwnedListRequest } from '../../owned/lib/createOwnedListRequestHandler';

/**
 * A convenience function to track that the logged in users favorites might
 * have changed. This is intended to be used fire-and-forget style.
 */
export const trackFavoritesChanged = (
  ctx: ScreenContext,
  opts?: {
    skipFavoritesList?: boolean;
    skipHistoryList?: boolean;
    skipOwnedList?: boolean;
  }
): void => {
  if (!opts?.skipFavoritesList) {
    (async () => {
      ctx.resources.favoritesListHandler.evictOrReplace(createFavoritesListRequest(), () => ({
        type: 'make-request',
        data: undefined,
      }));
    })().catch((e) => {
      console.error('error tracking favorites changed (favorites list)', e);
    });
  }
  if (!opts?.skipHistoryList) {
    (async () => {
      ctx.resources.historyListHandler.evictOrReplace(createHistoryListRequest(), () => ({
        type: 'make-request',
        data: undefined,
      }));
    })().catch((e) => {
      console.error('error tracking favorites changed (history list)', e);
    });
  }
  if (!opts?.skipOwnedList) {
    (async () => {
      ctx.resources.ownedListHandler.evictOrReplace(createOwnedListRequest(), () => ({
        type: 'make-request',
        data: undefined,
      }));
    })().catch((e) => {
      console.error('error tracking favorites changed (owned list)', e);
    });
  }
};
