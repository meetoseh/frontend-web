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
import { HomeCopy } from '../home/lib/createHomeCopyRequestHandler';
import { HomeV4Resources } from './HomeV4Resources';
import { HomeV4APIParams, HomeV4MappedParams } from './HomeV4Params';
import { screenConfigurableTriggerMapper } from '../../models/ScreenConfigurableTrigger';
import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { HomeV4 } from './HomeV4';

/**
 * Similiar to SimpleHome, but rearranged a bit. The version for iOS app version 4.2.1
 * aka v84.
 */
export const HomeV4Screen: OsehScreen<
  'homev4',
  HomeV4Resources,
  HomeV4APIParams,
  HomeV4MappedParams
> = {
  slug: 'homev4',
  paramMapper: (params) => ({
    entrance: params.entrance,
    menu: {
      exit: params.menu.exit,
      trigger: convertUsingMapper(params.menu.trigger, screenConfigurableTriggerMapper),
    },
    goal: {
      exit: params.goal.exit,
      trigger: convertUsingMapper(params.goal.trigger, screenConfigurableTriggerMapper),
    },
    classes: {
      exit: params.classes.exit,
      trigger: convertUsingMapper(params.classes.trigger, screenConfigurableTriggerMapper),
    },
    favorites: {
      exit: params.favorites.exit,
      trigger: convertUsingMapper(params.favorites.trigger, screenConfigurableTriggerMapper),
    },
    checkin: {
      exit: params.checkin.exit,
      trigger: convertUsingMapper(params.checkin.trigger, screenConfigurableTriggerMapper),
      text: params.checkin.text,
    },
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
  component: (props) => <HomeV4 {...props} />,
};
