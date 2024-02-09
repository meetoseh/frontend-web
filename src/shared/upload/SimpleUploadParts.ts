import { UploadInfo, UploadPart, UploadPartRange, convertToRange } from './UploadInfo';

/**
 * Convenience type for working with uploadinfo without directly
 * distinguishing between parts and part ranges
 */
export type SimpleUploadParts = {
  /**
   * The original upload info
   */
  original: UploadInfo;
  /**
   * The number of the last part, inclusive
   */
  endPartNumber: number;
  /**
   * The total number of bytes in the upload
   */
  totalBytes: number;

  /**
   * Fetches the part with the given number from the original.
   *
   * @param partNumber The part number to fetch
   * @returns The part with the given number
   */
  getPart: (partNumber: number) => UploadPart;
};

/**
 * Converts an upload info into a simple upload parts object
 *
 * @param info The upload info to convert
 * @returns The simple upload parts object
 */
export const getSimpleUploadParts = (info: UploadInfo): SimpleUploadParts => {
  const ranges = info.parts.map((p) => convertToRange(p));

  let lastPartIndex = 0;

  const tryGetPart = (partNumber: number, range: UploadPartRange): UploadPart | null => {
    if (partNumber < range.startNumber) {
      return null;
    }
    if (partNumber >= range.startNumber + range.numberOfParts) {
      return null;
    }

    return {
      number: partNumber,
      startByte: range.startByte + (partNumber - range.startNumber) * range.partSize,
      endByte: range.startByte + (partNumber - range.startNumber + 1) * range.partSize,
    };
  };

  const lastRange = ranges[ranges.length - 1];

  return {
    original: info,
    endPartNumber: lastRange.startNumber + lastRange.numberOfParts - 1,
    totalBytes: lastRange.startByte + lastRange.numberOfParts * lastRange.partSize,
    getPart: (partNumber: number) => {
      let result = tryGetPart(partNumber, ranges[lastPartIndex]);
      if (result !== null) {
        return result;
      }

      if (lastPartIndex + 1 < ranges.length) {
        result = tryGetPart(partNumber, ranges[lastPartIndex + 1]);
        if (result !== null) {
          lastPartIndex++;
          return result;
        }
      }

      if (lastPartIndex > 0) {
        result = tryGetPart(partNumber, ranges[lastPartIndex - 1]);
        if (result !== null) {
          lastPartIndex--;
          return result;
        }
      }

      for (let idx = 0; idx < ranges.length; idx++) {
        result = tryGetPart(partNumber, ranges[idx]);
        if (result !== null) {
          lastPartIndex = idx;
          return result;
        }
      }

      console.error('parts:', info.parts);
      console.error('ranges:', ranges);
      throw new Error(`Part ${partNumber} not found`);
    },
  };
};
