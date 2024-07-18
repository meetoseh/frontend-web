import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { RequestResult } from '../../../../shared/requests/RequestHandler';
import { createChainedRequest } from '../../../../shared/requests/createChainedRequest';
import { unwrapRequestResult } from '../../../../shared/requests/unwrapRequestResult';
import { createLoginContextRequest } from '../../lib/createLoginContextRequest';
import { OsehScreen } from '../../models/Screen';
import { createChainedImageFromPlaylist } from '../../lib/createChainedImageFromPlaylist';
import { StreakInfo } from '../../../journey/models/StreakInfo';
import { SimpleHomeResources } from './SimpleHomeResources';
import { SimpleHomeAPIParams, SimpleHomeMappedParams } from './SimpleHomeParams';
import { HomeCopy } from '../home/lib/createHomeCopyRequestHandler';
import { SimpleHome } from './SimpleHome';

/**
 * The home screen variant with a full screen background image, a header for navigation,
 * copy in the center, and a cta at the bottom.
 */
export const SimpleHomeScreen: OsehScreen<
  'simple_home',
  SimpleHomeResources,
  SimpleHomeAPIParams,
  SimpleHomeMappedParams
> = {
  slug: 'simple_home',
  paramMapper: (params) => ({
    ...params,
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const getSessionState = () =>
      createLoginContextRequest({ ctx, handler: ctx.resources.sessionStateHandler });
    const getHomeCopy = () =>
      createChainedRequest(getSessionState, ctx.resources.homeCopyHandler, {
        sync: (prevData) => {
          const loginContextRaw = ctx.login.value.get();
          if (loginContextRaw.state !== 'logged-in') {
            throw new Error('getHomeCopy but not logged in');
          }
          return prevData.snapshot(loginContextRaw);
        },
        async: undefined,
        cancelable: undefined,
      });
    const getHomeImage = () =>
      createChainedRequest(getSessionState, ctx.resources.homeImageHandler, {
        sync: (prevData) => {
          const loginContextRaw = ctx.login.value.get();
          if (loginContextRaw.state !== 'logged-in') {
            throw new Error('getHomeCopy but not logged in');
          }
          return prevData.snapshot(loginContextRaw);
        },
        async: undefined,
        cancelable: undefined,
      });
    const mapHomeImageSize = ({ width, height }: { width: number; height: number }) => ({
      width,
      height,
    });

    const getHomeImagePlaylist = () =>
      createChainedRequest(getHomeImage, ctx.resources.privatePlaylistHandler, {
        sync: (prevData) => prevData.image,
        async: undefined,
        cancelable: undefined,
      });

    const homeImage = createChainedImageFromPlaylist({
      ctx,
      getPlaylist: getHomeImagePlaylist,
      sizeMapper: mapHomeImageSize,
    });

    const copyRequest = createWritableValueWithCallbacks<RequestResult<HomeCopy> | null>(null);
    const cleanupCopyRequest = createValueWithCallbacksEffect(ctx.login.value, () => {
      const req = getHomeCopy();
      setVWC(copyRequest, req);
      return () => {
        req.release();
        if (Object.is(copyRequest.get(), req)) {
          setVWC(copyRequest, null);
        }
      };
    });
    const [copyUnwrapped, cleanupUnwrapCopy] = unwrapRequestResult(
      copyRequest,
      (d) => d.data,
      () => null
    );

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
      ready: createWritableValueWithCallbacks(true),
      copy: copyUnwrapped,
      image: homeImage.image,
      imageThumbhash: homeImage.thumbhash,
      streak: streakUnwrapped,
      dispose: () => {
        homeImage.dispose();
        cleanupCopyRequest();
        cleanupUnwrapCopy();
        cleanupStreakRequest();
        cleanupUnwrapStreak();
      },
    };
  },
  component: (props) => <SimpleHome {...props} />,
};
