type RasterizeSvgArgs = {
  /**
   * The url where the svg can be found
   */
  url: string;

  /**
   * The width and height to render the svg at, in device pixels or logical
   * pixels. If this differs from the container size, the svg is drawn in the
   * center of the container.
   */
  svgRenderSize: { unit: 'devicePixels' | 'logicalPixels'; width: number; height: number };

  /**
   * The width and height of the container that the svg will be rendered in,
   * in device pixels. A power of 2 makes using the svg as a texture faster
   * and easier. Use `'auto'` to get the smallest square power of 2 that
   * fits the svg.
   */
  containerSize: { unit: 'devicePixels'; width: number; height: number } | 'auto';

  /**
   * When set, the svg is rendered at a higher resolution, then scaled down when drawn on the
   * canvas as a simple form of anti-aliasing. This is primarily helpful for complicated svgs
   * rendering at very small sizes.
   */
  superSample?: number;
};

/**
 * Rasterizes the given svg into an image element rendered via image/png.
 */
export const rasterizeSvg = ({
  url,
  svgRenderSize,
  containerSize,
  superSample = 1,
}: RasterizeSvgArgs): Promise<HTMLImageElement> => {
  const svgDevicePixelsRenderSize =
    svgRenderSize.unit === 'devicePixels'
      ? { width: svgRenderSize.width, height: svgRenderSize.height }
      : {
          width: svgRenderSize.width * window.devicePixelRatio,
          height: svgRenderSize.height * window.devicePixelRatio,
        };

  const containerDevicePixelsSize = (() => {
    if (containerSize !== 'auto') {
      return { width: containerSize.width, height: containerSize.height };
    }

    const biggestDimension = Math.max(
      svgDevicePixelsRenderSize.width,
      svgDevicePixelsRenderSize.height
    );
    const smallestPowerOf2 = Math.pow(2, Math.ceil(Math.log2(biggestDimension)));
    return { width: smallestPowerOf2, height: smallestPowerOf2 };
  })();

  return _rasterizeUsingDevicePixels(
    url,
    svgDevicePixelsRenderSize,
    containerDevicePixelsSize,
    superSample
  );
};

const _rasterizeUsingDevicePixels = async (
  url: string,
  svgRenderSize: { width: number; height: number },
  containerSize: { width: number; height: number },
  superSample: number
): Promise<HTMLImageElement> => {
  console.log('rendering svg in a container of ', containerSize, ' logical pixels');
  const svg = await _rasterizeDirectly(url, {
    width: svgRenderSize.width * superSample,
    height: svgRenderSize.height * superSample,
  });

  const canvas = document.createElement('canvas');
  canvas.width = containerSize.width;
  canvas.height = containerSize.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  const xOffset = (containerSize.width - svgRenderSize.width) / 2;
  const yOffset = (containerSize.height - svgRenderSize.height) / 2;

  ctx.drawImage(svg, xOffset, yOffset, svgRenderSize.width, svgRenderSize.height);
  const src = canvas.toDataURL('image/png');
  return _rasterizeDirectly(src, containerSize);
};

const _rasterizeDirectly = (
  url: string,
  size: { width: number; height: number }
): Promise<HTMLImageElement> => {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onerror = (e) => reject(new Error(`Failed to load image from ${url}: ${e}`));
    img.onload = () => resolve(img);
    img.width = size.width;
    img.height = size.height;
    img.src = url;
  });
};
