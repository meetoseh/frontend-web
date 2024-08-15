import { ReactElement, useEffect } from 'react';
import { OsehImageExportCropped } from '../../../../../shared/images/OsehImageExportCropped';
import {
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../../shared/lib/Callbacks';
import { ScreenContext } from '../../../hooks/useScreenContext';
import { createChainedImageFromRef } from '../../../lib/createChainedImageFromRef';
import { createValueWithCallbacksEffect } from '../../../../../shared/hooks/createValueWithCallbacksEffect';
import { setVWC } from '../../../../../shared/lib/setVWC';
import { GridImageBackground } from '../../../../../shared/components/GridImageBackground';

/**
 * Displays the journey background image in the correct size for the top
 * part of a journey card within the journal chat screen.
 */
export const JourneyCardTopBackgroundImage = ({
  uid,
  jwt,
  ctx,
}: {
  uid: string;
  jwt: string;
  ctx: ScreenContext;
}): ReactElement => {
  const thumbhashVWC = useWritableValueWithCallbacks<string | null>(() => null);
  const imageVWC = useWritableValueWithCallbacks<OsehImageExportCropped | null>(() => null);

  useEffect(() => {
    const inner = createChainedImageFromRef({
      ctx,
      getRef: () => ({
        data: createWritableValueWithCallbacks({
          type: 'success',
          data: { uid, jwt },
          error: undefined,
          reportExpired: () => {},
        }),
        release: () => {},
      }),
      sizeMapper: (ws) => ({
        width: Math.min(ws.width - 24, 296),
        height: 120,
      }),
    });

    const cleanupThumbhashAttacher = createValueWithCallbacksEffect(inner.thumbhash, (th) => {
      setVWC(thumbhashVWC, th);
      return undefined;
    });
    const cleanupImageAttacher = createValueWithCallbacksEffect(inner.image, (im) => {
      setVWC(imageVWC, im);
      return undefined;
    });
    return () => {
      cleanupThumbhashAttacher();
      cleanupImageAttacher();
      inner.dispose();
      setVWC(imageVWC, null);
    };
  }, [uid, jwt, ctx, thumbhashVWC, imageVWC]);

  return <GridImageBackground image={imageVWC} thumbhash={thumbhashVWC} />;
};
