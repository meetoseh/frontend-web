import { CancelablePromise } from '../lib/CancelablePromise';
import {
  convertLogicalHeightToPhysicalHeight,
  convertLogicalSizeToPhysicalSize,
  convertLogicalWidthToPhysicalWidth,
} from './DisplayRatioHelper';
import { OsehImageExportCropped } from './OsehImageExportCropped';
import { OsehImageExportCroppedRef } from './OsehImageExportCroppedRef';
import { reduceImageSizeExactly } from './compareSizes';
import { RequestHandler, Result } from '../requests/RequestHandler';
import { createGetDataFromRefUsingSignal } from './createGetDataFromRefUsingSignal';
import { manipulateImage } from './manipulateImage';

/**
 * Handles taking a downloaded image export and preparing it to be rendered at
 * a given display resolution, which might not require doing anything, or might
 * require cropping, rescaling, or both.
 */
export const createImageCropRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<OsehImageExportCroppedRef, OsehImageExportCropped> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef,
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: OsehImageExportCroppedRef): string => {
  return `${ref.export.item.uid}-${ref.cropTo.displayWidth}x${ref.cropTo.displayHeight}`;
};

const getDataFromRef: (
  ref: OsehImageExportCroppedRef
) => CancelablePromise<Result<OsehImageExportCropped>> = createGetDataFromRefUsingSignal({
  inner: async (ref, signal): Promise<OsehImageExportCropped> => {
    const isVector = ref.export.item.format === 'svg';
    if (ref.cropTo.displayWidth !== null && ref.cropTo.displayHeight !== null) {
      // they requested that we render this image at a specific logical size.
      // we always handle this as follows: first we crop the image to the
      // correct aspect ratio, then we scale as necessary

      const requestedRatio = reduceImageSizeExactly({
        width: ref.cropTo.displayWidth,
        height: ref.cropTo.displayHeight,
      });

      const requestedPhysicalSize = convertLogicalSizeToPhysicalSize({
        width: ref.cropTo.displayWidth,
        height: ref.cropTo.displayHeight,
      });

      let srcSize = { width: ref.export.item.width, height: ref.export.item.height };
      if (isVector) {
        // since we can scale the image losslessly, lets pick an optimal size to start at.
        const scaleFactor = Math.max(
          requestedPhysicalSize.width / srcSize.width,
          requestedPhysicalSize.height / srcSize.height
        );
        srcSize = {
          width: Math.ceil(srcSize.width * scaleFactor),
          height: Math.ceil(srcSize.height * scaleFactor),
        };
      }

      const srcRatio = reduceImageSizeExactly(srcSize);

      let resultSize = { width: srcSize.width, height: srcSize.height };
      let cropTo: { left: number; top: number; width: number; height: number } | undefined =
        undefined;
      let rescaleTo: { width: number; height: number } | undefined = undefined;

      // requestedRatio.width / requestedRatio.height < srcRatio.width / srcRatio.height
      if (requestedRatio.width * srcRatio.height < requestedRatio.height * srcRatio.width) {
        // the requested image is taller than the source image, so we need to crop from the
        // sides to fix the aspect ratio
        const croppedHeight = resultSize.height;
        const croppedWidth = Math.ceil(
          (croppedHeight * requestedRatio.width) / requestedRatio.height
        );
        const totalXCrop = resultSize.width - croppedWidth;
        if (totalXCrop > 0) {
          cropTo = {
            left: Math.floor(totalXCrop / 2),
            top: 0,
            width: croppedWidth,
            height: croppedHeight,
          };
          resultSize = { width: croppedWidth, height: croppedHeight };
        }
      } else if (requestedRatio.width * srcRatio.height > requestedRatio.height * srcRatio.width) {
        // the requested image is wider than the source image, so we need to crop from the
        // top and bottom to fix the aspect ratio
        const croppedWidth = resultSize.width;
        const croppedHeight = Math.ceil(
          (croppedWidth * requestedRatio.height) / requestedRatio.width
        );
        const totalYCrop = resultSize.height - croppedHeight;
        if (totalYCrop > 0) {
          cropTo = {
            left: 0,
            top: Math.floor(totalYCrop / 2),
            width: croppedWidth,
            height: croppedHeight,
          };
          resultSize = { width: croppedWidth, height: croppedHeight };
        }
      }

      // fix the rest with rescaling
      if (
        resultSize.width !== requestedPhysicalSize.width ||
        resultSize.height !== requestedPhysicalSize.height
      ) {
        rescaleTo = { width: requestedPhysicalSize.width, height: requestedPhysicalSize.height };
        resultSize = { width: requestedPhysicalSize.width, height: requestedPhysicalSize.height };
      }

      const newUrl = await manipulateImage(
        ref.export.localUrl,
        srcSize,
        cropTo,
        rescaleTo,
        getRefUid(ref)
      );
      return {
        export: ref.export,
        cropTo: ref.cropTo,
        croppedTo: resultSize,
        croppedToDisplay: {
          displayWidth: ref.cropTo.displayWidth,
          displayHeight: ref.cropTo.displayHeight,
        },
        croppedUrl: newUrl,
      };
    }

    // they requested to render the image at its natural aspect ratio,
    // fixing only one of the two dimensions. we handle this exclusively
    // with scaling.

    const srcSize = { width: ref.export.item.width, height: ref.export.item.height };
    if (isVector) {
      srcSize.width = Math.round(convertLogicalWidthToPhysicalWidth(srcSize.width));
      srcSize.height = Math.round(convertLogicalHeightToPhysicalHeight(srcSize.height));
    }

    let targetDisplaySize: { displayWidth: number; displayHeight: number };

    if (ref.cropTo.displayWidth === null) {
      targetDisplaySize = {
        displayWidth: ref.cropTo.displayHeight * (srcSize.width / srcSize.height),
        displayHeight: ref.cropTo.displayHeight,
      };
    } else {
      targetDisplaySize = {
        displayWidth: ref.cropTo.displayWidth,
        displayHeight: ref.cropTo.displayWidth * (srcSize.height / srcSize.width),
      };
    }

    let rescaleTo = convertLogicalSizeToPhysicalSize({
      width: targetDisplaySize.displayWidth,
      height: targetDisplaySize.displayHeight,
    });

    const newUrl = await manipulateImage(
      ref.export.localUrl,
      srcSize,
      undefined,
      rescaleTo,
      getRefUid(ref)
    );

    return {
      export: ref.export,
      cropTo: ref.cropTo,
      croppedTo: rescaleTo,
      croppedToDisplay: targetDisplaySize,
      croppedUrl: newUrl,
    };
  },
});
const compareRefs = (a: OsehImageExportCroppedRef, b: OsehImageExportCroppedRef): number => 0;
