import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import { createMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { largestPhysicalPerLogical } from '../../../../shared/images/DisplayRatioHelper';
import { createOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { Callbacks, createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../../shared/lib/CancelablePromise';
import { InfiniteListing } from '../../../../shared/lib/InfiniteListing';
import { setVWC } from '../../../../shared/lib/setVWC';
import { RequestResult, Result } from '../../../../shared/requests/RequestHandler';
import { unwrapRequestResult } from '../../../../shared/requests/unwrapRequestResult';
import { ExternalCourse } from '../../../series/lib/ExternalCourse';
import {
  SeriesListRequest,
  createSeriesListRequest,
} from '../../../series/lib/createSeriesListRequestHandler';
import { OsehScreen } from '../../models/Screen';
import { SeriesList } from './SeriesList';
import {
  SeriesListAPIParams,
  SeriesListMappedParams,
  seriesListParamsMapper,
} from './SeriesListParams';
import { SeriesListResources } from './SeriesListResources';

/**
 * Displays the list of series which we have on offer
 */
export const SeriesListScreen: OsehScreen<
  'series_list',
  SeriesListResources,
  SeriesListAPIParams,
  SeriesListMappedParams
> = {
  slug: 'series_list',
  paramMapper: (params) => convertUsingMapper(params, seriesListParamsMapper),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const activeVWC = createWritableValueWithCallbacks(true);
    const getList = () =>
      ctx.resources.seriesListHandler.request({
        ref: createSeriesListRequest(),
        refreshRef: (): CancelablePromise<Result<SeriesListRequest>> => {
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
              data: createSeriesListRequest(),
              error: undefined,
              retryAt: undefined,
            }),
            done: () => true,
            cancel: () => {},
          };
        },
      });

    const listRequestVWC = createWritableValueWithCallbacks<RequestResult<
      InfiniteListing<ExternalCourse>
    > | null>(getList());
    const [listUnwrappedVWC, cleanupListUnwrapped] = unwrapRequestResult(
      listRequestVWC,
      (d) => d.data,
      () => null
    );

    const imageHandler = createOsehImageStateRequestHandler({
      privatePlaylistHandler: ctx.resources.privatePlaylistHandler,
      publicPlaylistHandler: ctx.resources.publicPlaylistHandler,
      imageDataHandler: ctx.resources.imageDataHandler,
      imageCropHandler: ctx.resources.imageCropHandler,
    });

    const [imageSizeVWC, cleanupImageSize] = createMappedValueWithCallbacks(
      ctx.contentWidth,
      (width) => {
        const height =
          Math.floor(width * (427 / 342) * largestPhysicalPerLogical) / largestPhysicalPerLogical;
        return { width, height };
      },
      {
        outputEqualityFn: (a, b) => a.width === b.width && a.height === b.height,
      }
    );

    const cleanupPrefetchImages = createValueWithCallbacksEffect(listUnwrappedVWC, (listRaw) => {
      if (listRaw === null) {
        return undefined;
      }
      const list = listRaw;
      return createValueWithCallbacksEffect(
        { get: () => list.items, callbacks: list.itemsChanged as any as Callbacks<undefined> },
        (itemsRaw) => {
          if (itemsRaw === null || itemsRaw.length === 0) {
            return undefined;
          }
          const items = itemsRaw;

          return createValueWithCallbacksEffect(
            imageSizeVWC,
            (size) => {
              const images = items.map((i) =>
                imageHandler.request({
                  uid: i.backgroundImage.uid,
                  jwt: i.backgroundImage.jwt,
                  displayWidth: size.width,
                  displayHeight: size.height,
                  alt: '',
                })
              );
              const logos = items.map((i) =>
                i.logo === null
                  ? null
                  : imageHandler.request({
                      uid: i.logo.uid,
                      jwt: i.logo.jwt,
                      displayWidth: size.width - 32,
                      displayHeight: null,
                      compareAspectRatio: (a, b) => a.height / a.width - b.height / b.width,
                      alt: '',
                    })
              );

              return () => {
                images.forEach((i) => i.release());
                logos.forEach((i) => i?.release());
              };
            },
            {
              applyBeforeCancel: true,
            }
          );
        }
      );
    });

    const [imageHeightVWC, cleanupImageHeight] = createMappedValueWithCallbacks(
      imageSizeVWC,
      (size) => size.height
    );

    return {
      ready: createWritableValueWithCallbacks(true),
      list: listUnwrappedVWC,
      imageHandler,
      imageHeight: imageHeightVWC,
      dispose: () => {
        setVWC(activeVWC, false);
        cleanupListUnwrapped();
        cleanupImageSize();
        cleanupPrefetchImages();
        cleanupImageHeight();
        const req = listRequestVWC.get();
        if (req !== null) {
          req.release();
          setVWC(listRequestVWC, null);
        }
      },
    };
  },
  component: (props) => <SeriesList {...props} />,
};
