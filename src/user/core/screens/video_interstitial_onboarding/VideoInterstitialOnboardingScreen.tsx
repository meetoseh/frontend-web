import { OsehContentRefLoadable } from '../../../../shared/content/OsehContentRef';
import { VideoFileData } from '../../../../shared/content/OsehContentTarget';
import { OsehMediaContentState } from '../../../../shared/content/OsehMediaContentState';
import { selectVideoTarget } from '../../../../shared/content/createVideoDataHandler';
import { createMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { RequestResult } from '../../../../shared/requests/RequestHandler';
import { createChainedRequest } from '../../../../shared/requests/createChainedRequest';
import { unwrapRequestResult } from '../../../../shared/requests/unwrapRequestResult';
import { OsehTranscript } from '../../../../shared/transcripts/OsehTranscript';
import { createLoginContextRequest } from '../../lib/createLoginContextRequest';
import { OsehScreen } from '../../models/Screen';
import { VideoInterstitial } from '../video_interstitial/VideoInterstitial';
import { VideoInterstitialResources } from '../video_interstitial/VideoInterstitialResources';
import {
  VideoInterstitialOnboardingAPIParams,
  VideoInterstitialOnboardingMappedParams,
} from './VideoInterstitialOnboardingParams';

/**
 * An extremely basic screen with a header, message, and ok button.
 */
export const VideoInterstitialOnboardingScreen: OsehScreen<
  'video_interstitial_onboarding',
  VideoInterstitialResources,
  VideoInterstitialOnboardingAPIParams,
  VideoInterstitialOnboardingMappedParams
> = {
  slug: 'video_interstitial_onboarding',
  paramMapper: (params) => ({
    ...params,
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const activeVWC = createWritableValueWithCallbacks(true);

    const getVideoRef = () =>
      createLoginContextRequest({
        ctx,
        handler: ctx.resources.onboardingVideoHandler,
      });

    const getPlaylist = () =>
      createChainedRequest(getVideoRef, ctx.resources.contentPlaylistHandler, {
        sync: (onboarding) => onboarding.video as OsehContentRefLoadable,
        async: undefined,
        cancelable: undefined,
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
      createChainedRequest(getVideoRef, ctx.resources.transcriptHandler, {
        sync: (onboarding) => onboarding.transcript,
        async: undefined,
        cancelable: undefined,
      });

    const transcriptRequestVWC =
      createWritableValueWithCallbacks<RequestResult<OsehTranscript> | null>(getTranscript());
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
