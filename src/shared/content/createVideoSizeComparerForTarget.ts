import { compareSizes } from '../images/compareSizes';
import { ContentFileWebExport } from './OsehContentTarget';

/**
 * Creates the standard content file web export comparison function when you
 * are trying to display a video with the given real width and height.
 */
export const createVideoSizeComparerForTarget =
  (width: number, height: number): ((a: ContentFileWebExport, b: ContentFileWebExport) => number) =>
  (a, b) => {
    const aWidthRaw = a.formatParameters.width as number | undefined | null;
    const aHeightRaw = a.formatParameters.height as number | undefined | null;
    const bWidthRaw = b.formatParameters.width as number | undefined | null;
    const bHeightRaw = b.formatParameters.height as number | undefined | null;

    const aWidth = aWidthRaw ?? null;
    const aHeight = aHeightRaw ?? null;
    const bWidth = bWidthRaw ?? null;
    const bHeight = bHeightRaw ?? null;

    if (aWidth === null || aHeight === null || bWidth === null || bHeight === null) {
      if (aWidth !== null && aHeight !== null) {
        return -1;
      } else if (bWidth !== null && bHeight !== null) {
        return 1;
      }

      return 0;
    }

    const sizeComparison = compareSizes(
      { width, height },
      { width: aWidth, height: aHeight },
      { width: bWidth, height: bHeight }
    );
    if (sizeComparison !== 0) {
      return sizeComparison;
    }

    return b.bandwidth - a.bandwidth;
  };
