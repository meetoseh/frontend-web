import { apiFetch } from '../ApiConstants';

/**
 * Uploads a single part of a file upload
 *
 * @param file The file to upload
 * @param partNumber The part number to upload
 * @param startByte The start byte of the part, inclusive
 * @param endByte The end byte of the part, exclusive
 * @param uid The file upload uid
 * @param jwt The file upload JWT for the file upload with the given uid
 * @param signal If specified, the upload will be aborted if this signal is
 *  aborted
 * @returns A promise which resolves when the part is uploaded successfully
 *   or when the part was determined to be a duplicate, and rejects if there
 *   is a network issue or the server returns an error besides a duplicate
 */
export const uploadPart = async (
  file: File,
  partNumber: number,
  startByte: number,
  endByte: number,
  uid: string,
  jwt: string,
  signal?: AbortSignal
) => {
  signal?.throwIfAborted();

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
      signal,
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
