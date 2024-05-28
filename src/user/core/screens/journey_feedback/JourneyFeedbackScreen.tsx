import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { mapCancelable } from '../../../../shared/lib/mapCancelable';
import { setVWC } from '../../../../shared/lib/setVWC';
import { RequestResult, Result } from '../../../../shared/requests/RequestHandler';
import { unwrapRequestResult } from '../../../../shared/requests/unwrapRequestResult';
import { initImage } from '../../lib/initImage';
import { OsehScreen } from '../../models/Screen';
import { screenJourneyMapper } from '../../models/ScreenJourney';
import { JourneyFeedback } from './JourneyFeedback';
import { JourneyFeedbackAPIParams, JourneyFeedbackMappedParams } from './JourneyFeedbackParams';
import { JourneyFeedbackResources } from './JourneyFeedbackResources';
import { ExpirableJourneyRef } from './lib/ExpirableJourneyRef';
import { JourneyMinimalRef } from './lib/JourneyMinimalRef';
import { JourneyShareableInfo } from './lib/createIsJourneyShareableRequestHandler';
import { JourneyLikeState } from './lib/createJourneyLikeStateRequestHandler';

/**
 * Allows the user to give feedback on a journey
 */
export const JourneyFeedbackScreen: OsehScreen<
  'journey_feedback',
  JourneyFeedbackResources,
  JourneyFeedbackAPIParams,
  JourneyFeedbackMappedParams
> = {
  slug: 'journey_feedback',
  paramMapper: (params) => ({
    ...params,
    journey: convertUsingMapper(params.journey, screenJourneyMapper),
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const background = initImage({
      ctx,
      screen,
      refreshScreen,
      paramMapper: (p) => p.journey.blurredBackgroundImage,
      sizeMapper: (s) => s,
    });
    const share = initImage({
      ctx,
      screen,
      refreshScreen,
      paramMapper: (p) => p.journey.darkenedBackgroundImage,
      sizeMapper: () => ({ width: ctx.contentWidth.get(), height: 237 }),
    });

    const getIsShareable = () =>
      ctx.resources.journeyIsShareableHandler.request({
        ref: { uid: screen.parameters.journey.uid },
        refreshRef: () =>
          mapCancelable(
            refreshScreen(),
            (s): Result<JourneyMinimalRef> =>
              s.type !== 'success'
                ? s
                : {
                    type: 'success',
                    data: { uid: s.data.parameters.journey.uid },
                    error: undefined,
                    retryAt: undefined,
                  }
          ),
      });

    const shareableRequestVWC =
      createWritableValueWithCallbacks<RequestResult<JourneyShareableInfo> | null>(null);
    const cleanupShareableRequest = (() => {
      const req = getIsShareable();
      setVWC(shareableRequestVWC, req);
      return () => {
        req.release();
        if (Object.is(shareableRequestVWC.get(), req)) {
          shareableRequestVWC.set(null);
        }
      };
    })();

    const [isShareableUnwrapped, cleanupUnwrapIsShareable] = unwrapRequestResult(
      shareableRequestVWC,
      (d) => d.data,
      () => null
    );

    const getJourneyLikeState = () =>
      ctx.resources.journeyLikeStateHandler.request({
        ref: { journey: screen.parameters.journey, reportExpired: refreshScreen },
        refreshRef: () =>
          mapCancelable(
            refreshScreen(),
            (s): Result<ExpirableJourneyRef> =>
              s.type !== 'success'
                ? s
                : {
                    type: 'success',
                    data: { journey: s.data.parameters.journey, reportExpired: refreshScreen },
                    error: undefined,
                    retryAt: undefined,
                  }
          ),
      });

    const likeStateVWC = createWritableValueWithCallbacks<RequestResult<JourneyLikeState> | null>(
      null
    );

    const cleanupLikeState = (() => {
      const req = getJourneyLikeState();
      setVWC(likeStateVWC, req);
      return () => {
        req.release();
        if (Object.is(likeStateVWC.get(), req)) {
          likeStateVWC.set(null);
        }
      };
    })();

    const [likeState, cleanupLikeStateUnwrap] = unwrapRequestResult(
      likeStateVWC,
      (d) => d.data,
      () => null
    );

    return {
      ready: createWritableValueWithCallbacks(true),
      background: {
        image: background.image,
        thumbhash: background.thumbhash,
      },
      share: {
        image: share.image,
        thumbhash: share.thumbhash,
        sizeImmediate: share.sizeImmediate,
      },
      isShareable: isShareableUnwrapped,
      likeState,
      dispose: () => {
        background.dispose();
        share.dispose();
        cleanupShareableRequest();
        cleanupUnwrapIsShareable();
        cleanupLikeState();
        cleanupLikeStateUnwrap();
      },
    };
  },
  component: (props) => <JourneyFeedback {...props} />,
};
