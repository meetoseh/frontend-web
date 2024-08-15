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
 * Displays the journey background image in the correct size for a journal
 * card within a journal entry view
 */
export const JournalEntryViewJournalCardBackground = ({
  uid,
  jwt,
  ctx,
}: {
  /** UID of the image file */
  uid: string;
  /** JWT for the image file */
  jwt: string;
  /** Screen context for sizing and loading */
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
      sizeMapper: () => ({
        width: ctx.contentWidth.get(),
        height: 71,
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

  return <GridImageBackground image={imageVWC} thumbhash={thumbhashVWC} borderRadius={10} />;
};
