import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { OsehContentRefLoadable } from '../../../../shared/content/OsehContentRef';
import { VideoFileData } from '../../../../shared/content/OsehContentTarget';
import { OsehMediaContentState } from '../../../../shared/content/OsehMediaContentState';
import { selectVideoTarget } from '../../../../shared/content/createVideoDataHandler';
import { createMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../../shared/lib/CancelablePromise';
import { mapCancelable } from '../../../../shared/lib/mapCancelable';
import { setVWC } from '../../../../shared/lib/setVWC';
import { RequestResult, Result } from '../../../../shared/requests/RequestHandler';
import { createChainedRequest } from '../../../../shared/requests/createChainedRequest';
import { unwrapRequestResult } from '../../../../shared/requests/unwrapRequestResult';
import { OsehTranscript } from '../../../../shared/transcripts/OsehTranscript';
import { OsehTranscriptRef } from '../../../../shared/transcripts/OsehTranscriptRef';
import { OsehScreen } from '../../models/Screen';
import { convertScreenConfigurableTriggerWithOldVersion } from '../../models/ScreenConfigurableTrigger';
import { screenContentKeyMap } from '../../models/ScreenContent';
import { VideoInterstitial } from './VideoInterstitial';
import {
  VideoInterstitialAPIParams,
  VideoInterstitialMappedParams,
} from './VideoInterstitialParams';
import { VideoInterstitialResources } from './VideoInterstitialResources';

/**
 * An extremely basic screen with a header, message, and ok button.
 */
export const VideoInterstitialScreen: OsehScreen<
  'video_interstitial',
  VideoInterstitialResources,
  VideoInterstitialAPIParams,
  VideoInterstitialMappedParams
> = {
  slug: 'video_interstitial',
  paramMapper: (params) => ({
    ...params,
    trigger: convertScreenConfigurableTriggerWithOldVersion(params.trigger, params.triggerv75),
    video: convertUsingMapper(params.video, screenContentKeyMap),
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const activeVWC = createWritableValueWithCallbacks(true);
    const getPlaylist = () =>
      ctx.resources.contentPlaylistHandler.request({
        ref: { uid: screen.parameters.video.content.uid, jwt: screen.parameters.video.content.jwt },
        refreshRef: (): CancelablePromise<Result<OsehContentRefLoadable>> => {
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
            (s): Result<OsehContentRefLoadable> =>
              s.type !== 'success'
                ? s
                : {
                    type: 'success',
                    data: {
                      uid: s.data.parameters.video.content.uid,
                      jwt: s.data.parameters.video.content.jwt,
                    },
                    error: undefined,
                    retryAt: undefined,
                  }
          );
        },
      });

    const getVideoData = () =>
      createChainedRequest(getPlaylist, ctx.resources.videoDataHandler, {
        sync: (exp) => selectVideoTarget({ playlist: exp, size: ctx.windowSizeImmediate.get() }),
        async: undefined,
        cancelable: undefined,
      });

    const videoDataRequestVWC =
      createWritableValueWithCallbacks<RequestResult<VideoFileData> | null>(getVideoData());
    const [videoDataVWC, cleanupVideoDataUnwrapper] = unwrapRequestResult(
      videoDataRequestVWC,
      (d) => d.data,
      () => null
    );

    const [videoVWC, cleanupVideoMapper] = createMappedValueWithCallbacks(
      videoDataVWC,
      (d): OsehMediaContentState<HTMLVideoElement> => {
        if (d === null) {
          return { state: 'loading', loaded: false, error: null, element: null };
        }
        return { state: 'loaded', loaded: true, error: null, element: d.element };
      }
    );

    const getTranscript = () =>
      ctx.resources.transcriptHandler.request({
        ref: screen.parameters.video.transcript,
        refreshRef: (): CancelablePromise<Result<OsehTranscriptRef>> => {
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
            (s): Result<OsehTranscriptRef> =>
              s.type !== 'success'
                ? s
                : s.data.parameters.video.transcript === null
                ? {
                    type: 'error',
                    data: undefined,
                    error: <>transcript is no longer available</>,
                    retryAt: undefined,
                  }
                : {
                    type: 'success',
                    data: s.data.parameters.video.transcript,
                    error: undefined,
                    retryAt: undefined,
                  }
          );
        },
      });

    const transcriptRequestVWC =
      createWritableValueWithCallbacks<RequestResult<OsehTranscript> | null>(
        screen.parameters.video.transcript === null ? null : getTranscript()
      );
    const [transcriptVWC, cleanupTranscriptUnwrapper] = unwrapRequestResult(
      transcriptRequestVWC,
      (d) => d.data,
      (d) => (d === null ? undefined : null)
    );

    return {
      ready: createWritableValueWithCallbacks(true),
      video: videoVWC,
      transcript: transcriptVWC,
      dispose: () => {
        setVWC(activeVWC, false);
        cleanupVideoDataUnwrapper();
        cleanupVideoMapper();
        const data = videoDataRequestVWC.get();
        if (data !== null) {
          data.release();
          setVWC(videoDataRequestVWC, null);
        }
        cleanupTranscriptUnwrapper();
        const transcript = transcriptRequestVWC.get();
        if (transcript !== null) {
          transcript.release();
          setVWC(transcriptRequestVWC, null);
        }
      },
    };
  },
  component: (props) => <VideoInterstitial {...props} />,
};
