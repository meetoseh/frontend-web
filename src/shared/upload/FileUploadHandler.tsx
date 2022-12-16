import { ReactElement, useEffect, useState } from 'react';
import { apiFetch } from '../ApiConstants';

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
  };
};
/**
 * Converts a part or part range into the equivalent part range, by
 * upgrading a single part to a part range with a single part.
 *
 * @param part The part or part range to convert
 * @returns The part range equivalent to the given part
 */
const convertToRange = (part: UploadPart | UploadPartRange): UploadPartRange => {
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

type FileUploadHandlerProps = {
  /**
   * The file to upload
   */
  file: File;

  /**
   * How to upload the file
   */
  uploadInfo: UploadInfo;

  /**
   * Called when the upload completes successfully
   */
  onComplete: () => void;

  /**
   * Called if an error occurs during the upload
   */
  onError?: ((error: any) => void) | null;
};

const uploadPart = async (
  file: File,
  partNumber: number,
  startByte: number,
  endByte: number,
  uid: string,
  jwt: string
) => {
  const formData = new FormData();
  formData.append('file', file.slice(startByte, endByte, 'application/octet-stream'), file.name);
  const response = await apiFetch(
    `/api/1/file_uploads/${uid}/${partNumber}`,
    {
      method: 'POST',
      headers: {
        Authorization: `bearer ${jwt}`,
      },
      body: formData,
    },
    null
  );
  if (!response.ok) {
    if (response.status === 409) {
      const data = await response.json();
      if (data.type === 'part_already_uploaded') {
        return;
      }
    }
    throw response;
  }
};

/**
 * Fetches a single part out of a compressed list of parts, which is represented
 * as a list of parts and part ranges.
 *
 * @param parts The compressed parts list
 * @param partNumber The part number you want
 * @returns The part with the given part number
 */
const getSinglePart = (
  parts: Array<UploadPart | UploadPartRange>,
  partNumber: number
): UploadPart => {
  // most of the time the list is 2 items so linear is fine
  for (const part of parts) {
    const partRange = convertToRange(part);
    const partEndNumberExcl = partRange.startNumber + partRange.numberOfParts;
    if (partNumber >= partRange.startNumber && partNumber < partEndNumberExcl) {
      return {
        number: partNumber,
        startByte: partRange.startByte + (partNumber - partRange.startNumber) * partRange.partSize,
        endByte:
          partRange.startByte + (partNumber - partRange.startNumber + 1) * partRange.partSize,
      };
    }
  }

  throw new Error(`Part ${partNumber} not found`);
};
/**
 * Splits the given file into parts and uploads them as specified in the
 * uploadInfo, with multiple parts uploading in parallel.
 */
export const FileUploadHandler = ({
  file,
  uploadInfo,
  onComplete,
  onError = null,
}: FileUploadHandlerProps): ReactElement => {
  const [uploadedBytes, setUploadedBytes] = useState<number>(0);

  useEffect(() => {
    let active = true;
    uploadFileWrapper();
    return () => {
      active = false;
    };

    async function uploadFileWrapper() {
      try {
        await uploadFile();
      } catch (e) {
        if (!active) {
          return;
        }

        if (onError) {
          onError(e);
        } else {
          throw e;
        }
      }
    }

    async function uploadFile() {
      const lastPart = convertToRange(uploadInfo.parts[uploadInfo.parts.length - 1]);
      const endPartNumber = lastPart.startNumber + lastPart.numberOfParts;
      const bytesTotal = lastPart.startByte + lastPart.numberOfParts * lastPart.partSize;
      const parallel = 5;

      if (bytesTotal !== file.size) {
        throw new Error(
          `File size mismatch: upload requires ${bytesTotal} bytes but the file has ${file.size} bytes`
        );
      }

      let numUploading = 0;
      const uploading: { [partNumberAsStr: string]: Promise<void> } = {};
      let nextPartNumber = 1;

      while (nextPartNumber < endPartNumber || numUploading > 0) {
        if (!active) {
          return;
        }

        while (nextPartNumber < endPartNumber && numUploading < parallel) {
          numUploading++;
          uploading[nextPartNumber.toString()] = /* eslint-disable-line no-loop-func*/ (async (
            file,
            part,
            uploadInfo
          ) => {
            await uploadPart(
              file,
              part.number,
              part.startByte,
              part.endByte,
              uploadInfo.uid,
              uploadInfo.jwt
            );
            if (!active) {
              return;
            }

            delete uploading[part.number.toString()];
            numUploading--;
            setUploadedBytes((uploadedBytes) => uploadedBytes + part.endByte - part.startByte);
          })(file, getSinglePart(uploadInfo.parts, nextPartNumber), uploadInfo);
          nextPartNumber++;
        }

        await Promise.race(Object.values(uploading));
      }

      onComplete();
    }
  }, [file, uploadInfo, onComplete, onError]);

  return <progress value={(uploadedBytes / file.size) * 100} max={100} />;
};
