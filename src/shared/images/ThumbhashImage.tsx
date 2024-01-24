import { thumbHashToDataURL } from 'thumbhash';
import { base64URLToByteArray } from '../lib/colorUtils';
import { ReactElement, useMemo } from 'react';

export type ThumbhashImageProps = {
  /** The thumbhash, base64url encoded */
  thumbhash: string;
  /** The width to render the image at */
  width: number;
  /** The height to render the image at */
  height: number;
  /** Alt text for the image */
  alt: string;
};

export const ThumbhashImage = ({
  thumbhash,
  width,
  height,
  alt,
}: ThumbhashImageProps): ReactElement => {
  const dataUrl = useMemo(() => thumbHashToDataURL(base64URLToByteArray(thumbhash)), [thumbhash]);

  return <img src={dataUrl} width={width} height={height} alt={alt} />;
};
