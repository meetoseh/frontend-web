import { ReactElement } from 'react';
import { OsehImageState } from './OsehImageState';
import { ThumbhashImage } from './ThumbhashImage';

/**
 * Creates a component which renders an image whose state has already been loaded
 * as if by useOsehImageState.
 *
 * @returns The element to render
 */
export const OsehImageFromState = ({
  localUrl,
  displayWidth,
  displayHeight,
  alt,
  placeholderColor,
  thumbhash,
  explicitNoDrag,
}: OsehImageState & { explicitNoDrag?: boolean }): ReactElement => {
  if (localUrl === null && placeholderColor !== undefined) {
    return (
      <div
        style={{ width: displayWidth, height: displayHeight, backgroundColor: placeholderColor }}
        {...(explicitNoDrag ? { draggable: false } : {})}
      />
    );
  }

  if (localUrl === null && thumbhash !== null) {
    return (
      <ThumbhashImage
        thumbhash={thumbhash}
        width={displayWidth}
        height={displayHeight}
        alt={alt}
        explicitNoDrag={explicitNoDrag}
      />
    );
  }

  return (
    <img
      src={localUrl ?? require('../placeholder.png')}
      style={{ width: displayWidth, height: displayHeight, objectFit: 'fill' }}
      alt={alt}
      {...(explicitNoDrag ? { draggable: false } : {})}
    />
  );
};
