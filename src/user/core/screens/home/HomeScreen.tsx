import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { RequestResult } from '../../../../shared/requests/RequestHandler';
import { createChainedRequest } from '../../../../shared/requests/createChainedRequest';
import { unwrapRequestResult } from '../../../../shared/requests/unwrapRequestResult';
import { createLoginContextRequest } from '../../lib/createLoginContextRequest';
import { OsehScreen } from '../../models/Screen';
import { Home } from './Home';
import { HomeAPIParams, HomeMappedParams } from './HomeParams';
import { HomeResources } from './HomeResources';
import { HomeCopy } from './lib/createHomeCopyRequestHandler';
import { createChainedImageFromPlaylist } from '../../lib/createChainedImageFromPlaylist';
import { createMappedRequestResult } from '../../lib/createMappedRequestResult';
import { createChainedImageFromRef } from '../../lib/createChainedImageFromRef';
import { StreakInfo } from '../../../journey/models/StreakInfo';
import { Emotion } from '../../../../shared/models/Emotion';

/**
 * The standard home screen with home copy, emotion buttons, and bottom nav
 */
export const HomeScreen: OsehScreen<'home', HomeResources, HomeAPIParams, HomeMappedParams> = {
  slug: 'home',
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
      width: width,
      height: 258 + Math.max(Math.min(height - 633, 92), 0),
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

    const getProfilePicture = () =>
      createMappedRequestResult(
        createLoginContextRequest({ ctx, handler: ctx.resources.profilePictureHandler }),
        (optRef) => (optRef.type === 'available' ? { type: 'success', data: optRef.data } : null)
      );

    const profilePicture = createChainedImageFromRef({
      ctx,
      getRef: getProfilePicture,
      sizeMapper: () => ({ width: 32, height: 32 }),
    });

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

    const getEmotions = () =>
      createLoginContextRequest({ ctx, handler: ctx.resources.emotionsHandler });

    const emotionsRequest = createWritableValueWithCallbacks<RequestResult<Emotion[]> | null>(null);
    const cleanupEmotionsRequest = createValueWithCallbacksEffect(ctx.login.value, () => {
      const req = getEmotions();
      setVWC(emotionsRequest, req);
      return () => {
        req.release();
        if (Object.is(emotionsRequest.get(), req)) {
          setVWC(emotionsRequest, null);
        }
      };
    });
    const [emotionsUnwrapped, cleanupUnwrapEmotions] = unwrapRequestResult(
      emotionsRequest,
      (d) => d.data,
      () => null
    );

    return {
      ready: createWritableValueWithCallbacks(true),
      copy: copyUnwrapped,
      imageSizeImmediate: homeImage.sizeImmediate,
      image: homeImage.image,
      imageThumbhash: homeImage.thumbhash,
      profilePicture: profilePicture.image,
      streak: streakUnwrapped,
      emotions: emotionsUnwrapped,
      dispose: () => {
        homeImage.dispose();
        cleanupCopyRequest();
        cleanupUnwrapCopy();
        profilePicture.dispose();
        cleanupStreakRequest();
        cleanupUnwrapStreak();
        cleanupEmotionsRequest();
        cleanupUnwrapEmotions();
      },
    };
  },
  component: (props) => <Home {...props} />,
};
