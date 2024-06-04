import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { Emotion } from '../../../../shared/models/Emotion';
import { RequestResult } from '../../../../shared/requests/RequestHandler';
import { unwrapRequestResult } from '../../../../shared/requests/unwrapRequestResult';
import { createLoginContextRequest } from '../../lib/createLoginContextRequest';
import { OsehScreen } from '../../models/Screen';
import { ChooseAFeeling } from './ChooseAFeeling';
import { ChooseAFeelingAPIParams, ChooseAFeelingMappedParams } from './ChooseAFeelingParams';
import { ChooseAFeelingResources } from './ChooseAFeelingResources';

/**
 * A basic screen where the user can pick an emotion
 */
export const ChooseAFeelingScreen: OsehScreen<
  'choose_a_feeling',
  ChooseAFeelingResources,
  ChooseAFeelingAPIParams,
  ChooseAFeelingMappedParams
> = {
  slug: 'choose_a_feeling',
  paramMapper: (params) => ({
    ...params,
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
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
      emotions: emotionsUnwrapped,
      dispose: () => {
        cleanupEmotionsRequest();
        cleanupUnwrapEmotions();
      },
    };
  },
  component: (props) => <ChooseAFeeling {...props} />,
};
