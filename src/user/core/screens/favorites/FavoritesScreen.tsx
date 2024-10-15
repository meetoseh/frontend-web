import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import {
  OsehImageRequestedState,
  createOsehImageStateRequestHandler,
} from '../../../../shared/images/useOsehImageStateRequestHandler';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../../shared/lib/CancelablePromise';
import { InfiniteListing } from '../../../../shared/lib/InfiniteListing';
import { setVWC } from '../../../../shared/lib/setVWC';
import { RequestResult, Result } from '../../../../shared/requests/RequestHandler';
import { unwrapRequestResult } from '../../../../shared/requests/unwrapRequestResult';
import { MinimalJourney } from '../../../favorites/lib/MinimalJourney';
import { OsehScreen } from '../../models/Screen';
import { Favorites } from './Favorites';
import { FavoritesAPIParams, FavoritesMappedParams } from './FavoritesParams';
import { FavoritesResources } from './FavoritesResources';
import { convertTriggerWithExit } from '../../lib/convertTriggerWithExit';
import {
  FavoritesListRequest,
  createFavoritesListRequest,
} from './lib/createFavoritesListRequestHandler';
import { DisplayableError } from '../../../../shared/lib/errors';

/**
 * Allows the user to see their favorited classes
 */
export const FavoritesScreen: OsehScreen<
  'favorites',
  FavoritesResources,
  FavoritesAPIParams,
  FavoritesMappedParams
> = {
  slug: 'favorites',
  paramMapper: (params) => ({
    entrance: params.entrance,
    back: convertTriggerWithExit(params.back),
    journey: convertTriggerWithExit(params.journey),
    history: convertTriggerWithExit(params.history),
    owned: convertTriggerWithExit(params.owned),
    home: convertTriggerWithExit(params.home),
    series: convertTriggerWithExit(params.series),
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const activeVWC = createWritableValueWithCallbacks(true);
    const getList = () =>
      ctx.resources.favoritesListHandler.request({
        ref: createFavoritesListRequest(),
        refreshRef: (): CancelablePromise<Result<FavoritesListRequest>> => {
          if (!activeVWC.get()) {
            return {
              promise: Promise.resolve({
                type: 'expired',
                data: undefined,
                error: new DisplayableError(
                  'server-refresh-required',
                  'get favorites',
                  'screen is not mounted'
                ),
                retryAt: undefined,
              }),
              done: () => true,
              cancel: () => {},
            };
          }
          return {
            promise: Promise.resolve({
              type: 'success',
              data: createFavoritesListRequest(),
              error: undefined,
              retryAt: undefined,
            }),
            done: () => true,
            cancel: () => {},
          };
        },
      });

    const listRequest = createWritableValueWithCallbacks<RequestResult<
      InfiniteListing<MinimalJourney>
    > | null>(null);
    const cleanupListRequest = (() => {
      const req = getList();
      setVWC(listRequest, req);
      return () => {
        req.release();
        if (Object.is(listRequest.get(), req)) {
          setVWC(listRequest, null);
        }
      };
    })();
    const [listUnwrapped, cleanupListUnwrapper] = unwrapRequestResult(
      listRequest,
      (d) => d.data,
      () => null
    );

    const imageHandler = createOsehImageStateRequestHandler({
      privatePlaylistHandler: ctx.resources.privatePlaylistHandler,
      publicPlaylistHandler: ctx.resources.publicPlaylistHandler,
      imageDataHandler: ctx.resources.imageDataHandler,
      imageCropHandler: ctx.resources.imageCropHandler,
    });

    const cleanupInstructorImagePrefetches = createValueWithCallbacksEffect(
      listUnwrapped,
      (listRaw) => {
        if (listRaw === null) {
          return undefined;
        }
        const list = listRaw;

        let requests: OsehImageRequestedState[] = [];

        list.itemsChanged.add(onItemsChanged);
        onItemsChanged();
        return () => {
          list.itemsChanged.remove(onItemsChanged);
          cleanup();
        };

        function onItemsChanged() {
          cleanup();
          if (list.items === null) {
            return;
          }

          requests = list.items.map((item) =>
            imageHandler.request({
              uid: item.instructor.image.uid,
              jwt: item.instructor.image.jwt,
              displayWidth: 14,
              displayHeight: 14,
              alt: '',
            })
          );
        }

        function cleanup() {
          requests.forEach((r) => r.release());
          requests = [];
        }
      }
    );

    return {
      ready: createWritableValueWithCallbacks(true),
      imageHandler,
      list: listUnwrapped,
      dispose: () => {
        setVWC(activeVWC, false);
        cleanupListRequest();
        cleanupListUnwrapper();
        cleanupInstructorImagePrefetches();
      },
    };
  },
  component: (props) => <Favorites {...props} />,
};
