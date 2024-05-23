import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import { createValuesWithCallbacksEffect } from '../../../../shared/hooks/createValuesWithCallbacksEffect';
import { OsehImageExportCropped } from '../../../../shared/images/OsehImageExportCropped';
import { DisplaySize } from '../../../../shared/images/OsehImageProps';
import { OsehImageRef } from '../../../../shared/images/OsehImageRef';
import { getPlaylistImageExportRefUsingFixedSize } from '../../../../shared/images/getPlaylistImageExportUsingFixedSize';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../../shared/lib/CancelablePromise';
import { mapCancelable } from '../../../../shared/lib/mapCancelable';
import { setVWC } from '../../../../shared/lib/setVWC';
import { RequestResult, Result } from '../../../../shared/requests/RequestHandler';
import { createChainedRequest } from '../../../../shared/requests/createChainedRequest';
import { unwrapRequestResult } from '../../../../shared/requests/unwrapRequestResult';
import { CourseRef } from '../../../favorites/lib/CourseRef';
import { ExpirableCourseRef } from '../../../series/lib/ExpirableCourseRef';
import { CourseJourneys } from '../../../series/lib/createSeriesJourneysRequestHandler';
import { CourseLikeState } from '../../../series/lib/createSeriesLikeStateRequestHandler';
import { ScreenContext } from '../../hooks/useScreenContext';
import { OsehScreen, PeekedScreen } from '../../models/Screen';
import { SeriesDetails } from './SeriesDetails';
import {
  SeriesDetailsAPIParams,
  SeriesDetailsMappedParams,
  seriesDetailsParamsMapper,
} from './SeriesDetailsParams';
import { SeriesDetailsResources } from './SeriesDetailsResources';

/**
 * Presents the details of the series indicated, allowing the user to either
 * take classes in the series or buy oseh+, depending on their entitlement.
 */
export const SeriesDetailsScreen: OsehScreen<
  'series_details',
  SeriesDetailsResources,
  SeriesDetailsAPIParams,
  SeriesDetailsMappedParams
> = {
  slug: 'series_details',
  paramMapper: (params) => convertUsingMapper(params, seriesDetailsParamsMapper),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const activeVWC = createWritableValueWithCallbacks(true);
    const backgroundImage = getBackgroundImage(ctx, screen, refreshScreen);
    const likeStateRequest =
      createWritableValueWithCallbacks<RequestResult<CourseLikeState> | null>(
        ctx.resources.seriesLikeStateHandler.request({
          ref: {
            course: { uid: screen.parameters.series.uid, jwt: screen.parameters.series.jwt },
            reportExpired: refreshScreen,
          },
          refreshRef: () => {
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

            return mapCancelable(
              refreshScreen(),
              (s): Result<ExpirableCourseRef> =>
                s.type !== 'success'
                  ? s
                  : {
                      type: 'success',
                      data: {
                        course: {
                          uid: screen.parameters.series.uid,
                          jwt: screen.parameters.series.jwt,
                        },
                        reportExpired: refreshScreen,
                      },
                      error: undefined,
                      retryAt: undefined,
                    }
            );
          },
        })
      );
    const [likeStateUnwrapped, cleanupLikeStateUnwrapper] = unwrapRequestResult(
      likeStateRequest,
      (d) => d.data,
      () => null
    );
    const getJourneys = () =>
      ctx.resources.seriesJourneysHandler.request({
        ref: { uid: screen.parameters.series.uid, jwt: screen.parameters.series.jwt },
        refreshRef: () => {
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

          return mapCancelable(
            refreshScreen(),
            (s): Result<CourseRef> =>
              s.type !== 'success'
                ? s
                : {
                    type: 'success',
                    data: {
                      uid: screen.parameters.series.uid,
                      jwt: screen.parameters.series.jwt,
                    },
                    error: undefined,
                    retryAt: undefined,
                  }
          );
        },
      });

    const journeysRequest = createWritableValueWithCallbacks<RequestResult<CourseJourneys> | null>(
      getJourneys()
    );
    const [journeysUnwrapped, cleanupJourneysUnwrapper] = unwrapRequestResult(
      journeysRequest,
      (d) => d.data,
      () => null
    );
    const journeyBackgroundHeights = createWritableValueWithCallbacks<
      WritableValueWithCallbacks<number>[]
    >([]);
    const cleanupJourneyBackgroundHeightsEffect = createValueWithCallbacksEffect(
      journeysUnwrapped,
      (journeys) => {
        if (journeys === null) {
          setVWC(journeyBackgroundHeights, []);
          return undefined;
        }

        const original = journeyBackgroundHeights.get();
        if (original.length === journeys.journeys.length) {
          return undefined;
        }

        const fixed = Array(journeys.journeys.length).fill(createWritableValueWithCallbacks(80));
        setVWC(journeyBackgroundHeights, fixed);
        return undefined;
      }
    );

    const journeyBackgrounds = createWritableValueWithCallbacks<
      ValueWithCallbacks<OsehImageExportCropped | null>[]
    >([]);

    const cleanupJourneyBackgroundsEffect = createValuesWithCallbacksEffect(
      [ctx.contentWidth, journeysUnwrapped, journeyBackgroundHeights],
      () => {
        const journeys = journeysUnwrapped.get();
        if (journeys === null) {
          setVWC(journeyBackgrounds, []);
          return undefined;
        }

        const backgroundHeightVWCs = journeyBackgroundHeights.get();
        if (backgroundHeightVWCs.length !== journeys.journeys.length) {
          setVWC(journeyBackgrounds, []);
          return undefined;
        }

        const width = ctx.contentWidth.get();

        const requests = journeys.journeys.map(
          (
            journey,
            journeyIdx
          ): [
            WritableValueWithCallbacks<RequestResult<OsehImageExportCropped> | null>,
            () => void
          ] => {
            const result =
              createWritableValueWithCallbacks<RequestResult<OsehImageExportCropped> | null>(null);

            if (journey.journey.darkenedBackground.jwt === null) {
              return [result, () => {}];
            }

            const cleanupHeightEffect = createValueWithCallbacksEffect(
              backgroundHeightVWCs[journeyIdx],
              (height) => {
                const getPlaylist = () =>
                  createChainedRequest(getJourneys, ctx.resources.privatePlaylistHandler, {
                    sync: (journeys) => {
                      if (journeys.journeys.length <= journeyIdx) {
                        throw new Error('Journey index out of bounds');
                      }

                      const ref = journeys.journeys[journeyIdx].journey.darkenedBackground;
                      if (ref.jwt === null) {
                        throw new Error('Expected private playlist, got public playlist');
                      }

                      return ref;
                    },
                    async: undefined,
                    cancelable: undefined,
                  });
                const getExport = () =>
                  createChainedRequest(getPlaylist, ctx.resources.imageDataHandler, {
                    sync: (playlist) =>
                      getPlaylistImageExportRefUsingFixedSize({
                        size: {
                          displayWidth: width,
                          displayHeight: height,
                        },
                        playlist,
                        usesWebp: ctx.usesWebp,
                        usesSvg: ctx.usesSvg,
                      }),
                    async: undefined,
                    cancelable: undefined,
                  });
                const getExportCropped = () =>
                  createChainedRequest(getExport, ctx.resources.imageCropHandler, {
                    sync: (exp) => ({
                      export: exp,
                      cropTo: {
                        displayWidth: width,
                        displayHeight: height,
                      } as DisplaySize,
                    }),
                    async: undefined,
                    cancelable: undefined,
                  });
                const req = getExportCropped();
                setVWC(result, req);
                return () => {
                  req.release();
                  setVWC(result, null);
                };
              }
            );
            return [result, cleanupHeightEffect];
          }
        );
        const unwrappers = requests.map((r) =>
          unwrapRequestResult(
            r[0],
            (d) => d.data,
            () => null
          )
        );

        setVWC(
          journeyBackgrounds,
          unwrappers.map((u) => u[0])
        );
        return () => {
          for (const u of unwrappers) {
            u[1]();
          }
          for (const r of requests) {
            r[1]();
            const req = r[0].get();
            if (req !== null) {
              req.release();
              setVWC(r[0], null);
            }
          }
        };
      }
    );

    return {
      backgroundThumbhash: backgroundImage.thumbhash,
      background: backgroundImage.image,
      likeState: likeStateUnwrapped,
      journeys: journeysUnwrapped,
      journeyBackgroundHeights,
      journeyBackgrounds,
      ready: createWritableValueWithCallbacks(true),
      dispose: () => {
        setVWC(activeVWC, false);
        backgroundImage.dispose();
        cleanupLikeStateUnwrapper();
        cleanupJourneysUnwrapper();
        cleanupJourneyBackgroundHeightsEffect();
        cleanupJourneyBackgroundsEffect();
        const likeState = likeStateRequest.get();
        if (likeState !== null) {
          likeState.release();
          setVWC(likeStateRequest, null);
        }
        const journeys = journeysRequest.get();
        if (journeys !== null) {
          journeys.release();
          setVWC(journeysRequest, null);
        }
      },
    };
  },
  component: (props) => <SeriesDetails {...props} />,
};

const getBackgroundImage = (
  ctx: ScreenContext,
  screen: PeekedScreen<'series_details', SeriesDetailsMappedParams>,
  refreshScreen: () => CancelablePromise<
    Result<PeekedScreen<'series_details', SeriesDetailsMappedParams>>
  >
): {
  thumbhash: ValueWithCallbacks<string | null>;
  image: ValueWithCallbacks<OsehImageExportCropped | null>;
  dispose: () => void;
} => {
  const refRaw = screen.parameters.series.detailsBackgroundImage;
  if (refRaw === null) {
    return {
      thumbhash: createWritableValueWithCallbacks(null),
      image: createWritableValueWithCallbacks(null),
      dispose: () => {},
    };
  }
  const activeVWC = createWritableValueWithCallbacks(true);
  const ref = refRaw;
  const getPlaylist = () =>
    ctx.resources.privatePlaylistHandler.request({
      ref: { uid: ref.uid, jwt: ref.jwt },
      refreshRef: (): CancelablePromise<Result<OsehImageRef>> => {
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

        return mapCancelable(refreshScreen(), (s): Result<OsehImageRef> => {
          if (s.type !== 'success') {
            return s;
          }
          if (s.data.parameters.series.detailsBackgroundImage === null) {
            return {
              type: 'expired',
              data: undefined,
              error: <>No background image</>,
              retryAt: undefined,
            };
          }
          return {
            type: 'success',
            data: s.data.parameters.series.detailsBackgroundImage,
            error: undefined,
            retryAt: undefined,
          };
        });
      },
    });

  const thumbhashVWC = createWritableValueWithCallbacks<string | null>(null);
  const getExport = () =>
    createChainedRequest(
      getPlaylist,
      ctx.resources.imageDataHandler,
      {
        sync: (playlist) =>
          getPlaylistImageExportRefUsingFixedSize({
            size: {
              displayWidth: ctx.windowSizeImmediate.get().width,
              displayHeight: ctx.windowSizeImmediate.get().height,
            },
            playlist,
            usesWebp: ctx.usesWebp,
            usesSvg: ctx.usesSvg,
          }),
        async: undefined,
        cancelable: undefined,
      },
      {
        onRefChanged: (newRef) => {
          if (!activeVWC.get() || newRef === null) {
            return;
          }
          setVWC(thumbhashVWC, newRef.item.thumbhash);
        },
      }
    );

  const getExportCropped = () =>
    createChainedRequest(getExport, ctx.resources.imageCropHandler, {
      sync: (exp) => ({
        export: exp,
        cropTo: {
          displayWidth: ctx.windowSizeImmediate.get().width,
          displayHeight: ctx.windowSizeImmediate.get().height,
        } as DisplaySize,
      }),
      async: undefined,
      cancelable: undefined,
    });

  const imageVWC = createWritableValueWithCallbacks<RequestResult<OsehImageExportCropped> | null>(
    null
  );

  const cleanupWindowResizeEffect = createValueWithCallbacksEffect(ctx.windowSizeDebounced, () => {
    if (!activeVWC.get()) {
      return undefined;
    }
    const oldReq = imageVWC.get();

    const req = getExportCropped();
    if (!activeVWC.get()) {
      req.release();
      return undefined;
    }

    setVWC(imageVWC, req);
    if (oldReq !== null) {
      oldReq.release();
    }
    return undefined;
  });

  const [imageUnwrapped, cleanupImageUnwrapper] = unwrapRequestResult(
    imageVWC,
    (d) => d.data,
    () => null
  );

  return {
    image: imageUnwrapped,
    thumbhash: thumbhashVWC,
    dispose: () => {
      setVWC(activeVWC, false);
      cleanupWindowResizeEffect();
      cleanupImageUnwrapper();
      const req = imageVWC.get();
      if (req !== null) {
        req.release();
        setVWC(imageVWC, null);
      }
    },
  };
};
