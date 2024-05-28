import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { OsehContentRefLoadable } from '../../../../shared/content/OsehContentRef';
import { AudioFileData } from '../../../../shared/content/OsehContentTarget';
import { OsehMediaContentState } from '../../../../shared/content/OsehMediaContentState';
import { selectAudioTarget } from '../../../../shared/content/createAudioDataHandler';
import { createMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../../shared/lib/CancelablePromise';
import { mapCancelable } from '../../../../shared/lib/mapCancelable';
import { setVWC } from '../../../../shared/lib/setVWC';
import { RequestResult, Result } from '../../../../shared/requests/RequestHandler';
import { createChainedRequest } from '../../../../shared/requests/createChainedRequest';
import { unwrapRequestResult } from '../../../../shared/requests/unwrapRequestResult';
import { initBackground } from '../../lib/initBackground';
import { OsehScreen } from '../../models/Screen';
import { screenContentKeyMap } from '../../models/ScreenContent';
import { screenImageKeyMap } from '../../models/ScreenImage';
import { AudioInterstitial } from './AudioInterstitial';
import {
  AudioInterstitialAPIParams,
  AudioInterstitialMappedParams,
} from './AudioInterstitialParams';
import { AudioInterstitialResources } from './AudioInterstitialResources';

/**
 * An extremely basic audio interstitial
 */
export const AudioInterstitialScreen: OsehScreen<
  'audio_interstitial',
  AudioInterstitialResources,
  AudioInterstitialAPIParams,
  AudioInterstitialMappedParams
> = {
  slug: 'audio_interstitial',
  paramMapper: (params) => ({
    ...params,
    background: convertUsingMapper(params.background, screenImageKeyMap),
    audio: convertUsingMapper(params.audio, screenContentKeyMap),
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const activeVWC = createWritableValueWithCallbacks(true);
    const getPlaylist = () =>
      ctx.resources.contentPlaylistHandler.request({
        ref: { uid: screen.parameters.audio.content.uid, jwt: screen.parameters.audio.content.jwt },
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
                      uid: s.data.parameters.audio.content.uid,
                      jwt: s.data.parameters.audio.content.jwt,
                    },
                    error: undefined,
                    retryAt: undefined,
                  }
          );
        },
      });

    const getAudioData = () =>
      createChainedRequest(getPlaylist, ctx.resources.audioDataHandler, {
        sync: (exp) => selectAudioTarget({ playlist: exp }),
        async: undefined,
        cancelable: undefined,
      });

    const dataRequestVWC = createWritableValueWithCallbacks<RequestResult<AudioFileData> | null>(
      getAudioData()
    );
    const [dataVWC, cleanupDataUnwrapper] = unwrapRequestResult(
      dataRequestVWC,
      (d) => d.data,
      () => null
    );

    const [audioVWC, cleanupAudioMapper] = createMappedValueWithCallbacks(
      dataVWC,
      (d): OsehMediaContentState<HTMLAudioElement> => {
        if (d === null) {
          return { state: 'loading', loaded: false, error: null, element: null };
        }
        return { state: 'loaded', loaded: true, error: null, element: d.element };
      }
    );
    const [background, cleanupBackground] = initBackground(ctx, screen, refreshScreen);

    return {
      ready: createWritableValueWithCallbacks(true),
      background,
      audio: audioVWC,
      dispose: () => {
        setVWC(activeVWC, false);
        cleanupDataUnwrapper();
        cleanupAudioMapper();
        cleanupBackground();
        const data = dataRequestVWC.get();
        if (data !== null) {
          data.release();
          setVWC(dataRequestVWC, null);
        }
      },
    };
  },
  component: (props) => <AudioInterstitial {...props} />,
};
