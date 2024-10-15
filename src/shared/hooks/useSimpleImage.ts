import { ReactElement, useEffect, useMemo, useState } from 'react';
import { DisplayableError } from '../lib/errors';

type UseSimpleImageProps = {
  /**
   * The URL of the image to download.
   */
  url: string;

  /**
   * The width hint for the image. For svgs, this is the width in device
   * pixels to render the svg at.
   */
  width: number;

  /**
   * The height hint for the image. For svgs, this is the height in device
   * pixels to render the svg at.
   */
  height: number;
};

/**
 * Downloads the image from the given URL and returns it as an HTMLImageElement
 * once it's loaded, and null otherwise.
 */
export const useSimpleImage = ({
  url,
  width,
  height,
}: UseSimpleImageProps): { image: HTMLImageElement | null; error: DisplayableError | null } => {
  const [result, setResult] = useState<{ src: string; image: HTMLImageElement } | null>(null);
  const [error, setError] = useState<DisplayableError | null>(null);

  useEffect(() => {
    if (result?.src === url) {
      return;
    }

    let active = true;
    downloadImage();
    return () => {
      active = false;
    };

    function downloadImage() {
      setError(null);

      const image = new Image();
      image.addEventListener('load', () => {
        if (active) {
          setResult({ src: url, image });
        }
      });
      image.addEventListener('error', async (e) => {
        if (active) {
          console.error('error while downloading', url, ':', e);
          const error = new DisplayableError('client', 'download image', `${e}`);
          if (active) {
            setResult(null);
            setError(error);
          }
        }
      });

      image.width = width;
      image.height = height;
      image.src = url;
    }
  }, [url, result, width, height]);

  return useMemo(
    () => ({
      image: result?.src === url ? result.image : null,
      error,
    }),
    [result, error, url]
  );
};
