import { ReactElement, useEffect, useState } from 'react';
import { UploadInfo, UploadPart, UploadPartRange, convertToRange } from './UploadInfo';
import { uploadPart } from './uploadPart';

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
