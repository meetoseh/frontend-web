import { ReactElement } from 'react';
import styles from './GridImageBackground.module.css';
import { ValueWithCallbacks } from '../lib/Callbacks';
import { OsehImageExportCropped } from '../images/OsehImageExportCropped';
import { RenderGuardedComponent } from './RenderGuardedComponent';
import { GridDarkGrayBackground } from './GridDarkGrayBackground';
import { base64URLToByteArray } from '../lib/colorUtils';
import { thumbHashToDataURL } from 'thumbhash';

/**
 * An element which fills the background using grid-area: 1 / 1 / -1 / -1
 * with the given image, or the gradient background if the image is null.
 */
export const GridImageBackground = ({
  image: imageVWC,
  thumbhash: thumbhashVWC,
  borderRadius,
}: {
  image: ValueWithCallbacks<OsehImageExportCropped | null>;
  thumbhash?: ValueWithCallbacks<string | null>;
  borderRadius?: number;
}): ReactElement => {
  return (
    <RenderGuardedComponent
      props={imageVWC}
      component={(image) => {
        if (image === null) {
          if (thumbhashVWC === undefined) {
            return <GridDarkGrayBackground />;
          }

          return (
            <RenderGuardedComponent
              props={thumbhashVWC}
              component={(thumbhash) => {
                if (thumbhash === null) {
                  return <GridDarkGrayBackground />;
                }
                const thumbhashUrl = thumbHashToDataURL(base64URLToByteArray(thumbhash));
                return <WithSrc src={thumbhashUrl} borderRadius={borderRadius} />;
              }}
            />
          );
        }

        return <WithSrc src={image.croppedUrl} borderRadius={borderRadius} />;
      }}
    />
  );
};

const WithSrc = ({ src, borderRadius }: { src: string; borderRadius?: number }): ReactElement => {
  return (
    <div className={styles.imageWrapper}>
      <img
        src={src}
        className={styles.image}
        alt=""
        style={borderRadius === undefined ? undefined : { borderRadius: `${borderRadius}px` }}
      />
    </div>
  );
};
