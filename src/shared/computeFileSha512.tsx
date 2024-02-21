import { sha512 } from 'js-sha512';
import { WritableValueWithCallbacks } from './lib/Callbacks';
import { setVWC } from './lib/setVWC';

const MAX_WORK_MS_PER_FRAME = 100; // 10fps loading bar
const MAX_HASH_CHUNK = 64 * 1024;

/**
 * Calculates the sha512 hash as a hex string of the given file. This is
 * done using the streaming API of the File interface, so the file is
 * not necessarily loaded into memory all at once, though for very small
 * files it may be.
 *
 * @param file The file to hash
 * @param progress If specified, we write how many bytes have been processed
 *   so far to this value.
 * @param signal If specified, the hash will be aborted if this signal is
 *  aborted.
 * @returns The SHA512 hash of the file
 */
export const computeFileSha512 = (
  file: File,
  progress?: WritableValueWithCallbacks<number>,
  signal?: AbortSignal
): Promise<string> => {
  return new Promise<string>(async (resolve, reject) => {
    const hasher = sha512.create();
    const stream = file.stream();
    const setProgress =
      progress === undefined
        ? () => {}
        : (bytes: number) => {
            setVWC(progress, bytes);
          };

    let bytesRead = 0;
    let frameStartedAt = performance.now();

    const maybeYield = async () => {
      const timeSinceFrameStart = performance.now() - frameStartedAt;
      if (timeSinceFrameStart < MAX_WORK_MS_PER_FRAME) {
        return;
      }

      await new Promise((resolve) => requestAnimationFrame(resolve));
      frameStartedAt = performance.now();
    };

    setProgress(0);

    const reader = stream.getReader();
    while (true) {
      signal?.throwIfAborted();
      await maybeYield();

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

      if (value === undefined) {
        throw new Error('Unexpected undefined value from file stream');
      }

      if (value.length < MAX_HASH_CHUNK) {
        hasher.update(value);
        bytesRead += value.length;
        setProgress(bytesRead);
      } else {
        for (let i = 0; i < value.length; i += MAX_HASH_CHUNK) {
          signal?.throwIfAborted();
          await maybeYield();
          hasher.update(value.slice(i, i + MAX_HASH_CHUNK));
          bytesRead += MAX_HASH_CHUNK;
          setProgress(bytesRead);
        }
      }
    }
  });
};
