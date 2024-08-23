import { CSSProperties, ReactElement, useEffect, useMemo } from 'react';
import { OsehImageRef } from '../../../shared/images/OsehImageRef';
import { ScreenContext } from '../hooks/useScreenContext';
import {
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { createChainedImageFromRef } from '../lib/createChainedImageFromRef';
import { createValuesWithCallbacksEffect } from '../../../shared/hooks/createValuesWithCallbacksEffect';
import { setVWC } from '../../../shared/lib/setVWC';
import { thumbHashToDataURL } from 'thumbhash';
import { base64URLToByteArray } from '../../../shared/lib/colorUtils';
import { OsehColors } from '../../../shared/OsehColors';

/**
 * Renders an image from the given ref with the given settings. The speed can be improved
 * by preloading in the Screen, but that won't need to coordinate directly with these props
 * to work.
 */
export const ScreenDynamicImage = ({
  ctx,
  imgRef,
  width,
  height,
  borderRadius,
}: {
  ctx: ScreenContext;
  imgRef: OsehImageRef;
  width: number;
  height: number;
  /** either border radius for all corners, or in order:
   * top-left, top-right, bottom-right, bottom-left
   */
  borderRadius?: number | [number, number, number, number];
}): ReactElement => {
  const borderRadiusStyle = useMemo((): CSSProperties => {
    if (borderRadius === undefined) {
      return {};
    }
    if (typeof borderRadius === 'number') {
      return { borderRadius: `${borderRadius}px` };
    }
    return {
      borderTopLeftRadius: `${borderRadius[0]}px`,
      borderTopRightRadius: `${borderRadius[1]}px`,
      borderBottomRightRadius: `${borderRadius[2]}px`,
      borderBottomLeftRadius: `${borderRadius[3]}px`,
    };
  }, [borderRadius]);
  const imageUrlVWC = useWritableValueWithCallbacks<string | null>(() => null);

  useEffect(() => {
    const image = createChainedImageFromRef({
      ctx,
      getRef: () => ({
        data: createWritableValueWithCallbacks({
          type: 'success',
          data: imgRef,
          error: undefined,
          reportExpired: () => {},
        }),
        release: () => {},
      }),
      sizeMapper: () => ({ width, height }),
    });

    const cleanupMapper = createValuesWithCallbacksEffect([image.image, image.thumbhash], () => {
      const img = image.image.get();
      if (img !== null) {
        setVWC(imageUrlVWC, img.croppedUrl);
        return undefined;
      }

      const thumbhash = image.thumbhash.get();
      if (thumbhash !== null) {
        const thumbUrl = thumbHashToDataURL(base64URLToByteArray(thumbhash));
        setVWC(imageUrlVWC, thumbUrl);
        return undefined;
      }

      setVWC(imageUrlVWC, null);
      return undefined;
    });

    return () => {
      cleanupMapper();
      image.dispose();
    };
  }, [ctx, imgRef, width, height]);

  return (
    <RenderGuardedComponent
      props={imageUrlVWC}
      component={(url) => {
        if (url === null) {
          return (
            <div
              style={{
                width,
                height,
                backgroundColor: OsehColors.v4.primary.dark,
                ...borderRadiusStyle,
                paddingLeft: `${width}px`,
                paddingTop: `${height}px`,
              }}
            />
          );
        }

        return <img src={url} style={{ width, height, ...borderRadiusStyle }} />;
      }}
    />
  );
};
