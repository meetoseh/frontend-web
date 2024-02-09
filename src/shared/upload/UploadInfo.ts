import { JobRef } from '../jobProgress/JobRef';

/**
 * Describes a single part within a multipart upload.
 */
export type UploadPart = {
  /**
   * The part number, which starts at 1 and increases by 1 for each part.
   */
  number: number;

  /**
   * The start of the byte range, inclusive
   */
  startByte: number;

  /**
   * The end of the byte range, exclusive
   */
  endByte: number;
};

/**
 * Describes multiple contiguous parts within a multipart upload, where
 * each part has the same size.
 */
export type UploadPartRange = {
  /**
   * The part number that starts this range, inclusive
   */
  startNumber: number;
  /**
   * The start_byte of the first part, inclusive
   */
  startByte: number;
  /**
   * The number of parts in this range
   */
  numberOfParts: number;
  /**
   * The size, in bytes, of each part in this range
   */
  partSize: number;
};

/**
 * Describes the required authorization for uploading a file, and how the file
 * should be split up.
 */
export type UploadInfo = {
  /**
   * The uid of the file upload
   */
  uid: string;

  /**
   * The JWT to use for uploading the file
   */
  jwt: string;

  /**
   * How the file should be split up into parts
   */
  parts: Array<UploadPart | UploadPartRange>;

  /**
   * If progress information is available, a ref to the job that
   * will process the file after it's uploaded
   */
  progress?: JobRef;
};

/**
 * Parses a FileUploadResponse from the server into an UploadInfo object, which
 * contains the same info but with different casing.
 *
 * @param data The data from the server
 * @returns The parsed UploadInfo object
 */
export const parseUploadInfoFromResponse = (data: any): UploadInfo => {
  return {
    uid: data.uid,
    jwt: data.jwt,
    parts: data.parts.map((part: any) => {
      if (part.hasOwnProperty('number')) {
        return {
          number: part.number,
          startByte: part.start_byte,
          endByte: part.end_byte,
        };
      }

      return {
        startNumber: part.start_number,
        startByte: part.start_byte,
        numberOfParts: part.number_of_parts,
        partSize: part.part_size,
      };
    }),
    progress: data.progress ?? undefined,
  };
};

/**
 * Converts a part or part range into the equivalent part range, by
 * upgrading a single part to a part range with a single part.
 *
 * @param part The part or part range to convert
 * @returns The part range equivalent to the given part
 */
export const convertToRange = (part: UploadPart | UploadPartRange): UploadPartRange => {
  if (part.hasOwnProperty('startNumber')) {
    return part as UploadPartRange;
  }

  const singlePart = part as UploadPart;
  return {
    startNumber: singlePart.number,
    startByte: singlePart.startByte,
    numberOfParts: 1,
    partSize: singlePart.endByte - singlePart.startByte,
  };
};
