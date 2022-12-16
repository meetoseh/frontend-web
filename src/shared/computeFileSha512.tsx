import { sha512 } from 'js-sha512';

/**
 * Calculates the sha512 hash as a hex string of the given file. This is
 * done using the streaming API of the File interface, so the file is
 * not necessarily loaded into memory all at once, though for very small
 * files it may be.
 *
 * @param file The file to hash
 * @returns The SHA512 hash of the file
 */
export const computeFileSha512 = (file: File): Promise<string> => {
  return new Promise<string>(async (resolve, reject) => {
    const hasher = sha512.create();
    const stream = file.stream();

    const reader = stream.getReader();
    while (true) {
      let done: boolean;
      let value: Uint8Array | undefined;
      try {
        const res = await reader.read();
        done = res.done;
        value = res.value;
      } catch (e) {
        reader.releaseLock();
        reject(e);
        return;
      }

      if (done) {
        reader.releaseLock();
        resolve(hasher.hex());
        return;
      }

      hasher.update(value!);
    }
  });
};
