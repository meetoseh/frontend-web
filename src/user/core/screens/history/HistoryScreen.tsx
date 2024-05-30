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
import { History } from './History';
import { HistoryAPIParams, HistoryMappedParams } from './HistoryParams';
import { HistoryResources } from './HistoryResources';
import {
  HistoryListRequest,
  createHistoryListRequest,
} from './lib/createHistoryListRequestHandler';

/**
 * Allows the user to see what journeys they have already taken
 */
export const HistoryScreen: OsehScreen<
  'history',
  HistoryResources,
  HistoryAPIParams,
  HistoryMappedParams
> = {
  slug: 'history',
  paramMapper: (params) => ({
    ...params,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const activeVWC = createWritableValueWithCallbacks(true);
    const getList = () =>
      ctx.resources.historyListHandler.request({
        ref: createHistoryListRequest(),
        refreshRef: (): CancelablePromise<Result<HistoryListRequest>> => {
          if (!activeVWC.get()) {
            return {
              promise: Promise.resolve({
                type: 'expired',
                data: undefined,
                error: <>Screen is not mounted</>,
                retryAt: undefined,
              }),
              done: () => true,
              cancel: () => {},
            };
          }
          return {
            promise: Promise.resolve({
              type: 'success',
              data: createHistoryListRequest(),
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
  component: (props) => <History {...props} />,
};
