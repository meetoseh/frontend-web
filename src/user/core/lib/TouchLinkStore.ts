import { Callbacks } from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { TouchLink } from './createTouchLinkRequestHandler';

/**
 * The format that we store in local storage when we see a link code in
 * the url
 */
export type StoredTouchLinkCode = {
  /**
   * The link we saw
   */
  link: TouchLink;
  /**
   * When the link was seen
   */
  seenAt: Date;
};

/** True if something is writing/reading from the touch link store, false otherwise */
let _lock = false;
/** The callbacks to notify when the lock is released */
let _lockReleasedCallbacks = new Callbacks<undefined>();

const withLock = <T>(
  fn: () => Promise<T> | CancelablePromise<T | null>
): CancelablePromise<T | null> => {
  let done = false;
  const cancelers = new Callbacks<undefined>();
  let cancel = () => {
    done = true;
    cancel = () => {};
    cancelers.call(undefined);
  };
  return {
    done: () => done,
    cancel: () => cancel(),
    promise: (async () => {
      while (_lock) {
        if (done) {
          return null;
        }
        // the whole point is that these variables are mutable
        // eslint-disable-next-line no-loop-func
        await new Promise<void>((resolve) => {
          if (!_lock || done) {
            resolve();
            return;
          }

          const cb = () => {
            _lockReleasedCallbacks.remove(cb);
            cancelers.remove(cb);
            resolve();
          };
          _lockReleasedCallbacks.add(cb);
          cancelers.add(cb);
        });
      }

      if (done) {
        return null;
      }

      _lock = true;
      try {
        const v = fn();
        if (v instanceof Promise) {
          return await v;
        }
        cancelers.add(v.cancel);
        return await v.promise;
      } finally {
        done = true;
        cancel = () => {};
        _lock = false;
        _lockReleasedCallbacks.call(undefined);
      }
    })(),
  };
};

/**
 * Reads the stored touch link code from local storage, if there is one,
 * otherwise returns null
 */
export const readStoredTouchLinkCode = (): CancelablePromise<StoredTouchLinkCode | null> => {
  return withLock(async () => {
    const raw = localStorage.getItem('touchLink');
    if (raw === null) {
      return null;
    }
    const parsed = JSON.parse(raw);
    parsed.seenAt = new Date(parsed.seenAt);
    return parsed as StoredTouchLinkCode;
  });
};

/**
 * Writes the stored touch link code to local storage, or deletes it if the
 * code is null
 */
export const writeStoredTouchLinkCode = (
  code: StoredTouchLinkCode | null
): CancelablePromise<void> => {
  return withLock(async () => {
    if (code === null) {
      localStorage.removeItem('touchLink');
      return;
    }

    localStorage.setItem('touchLink', JSON.stringify(code));
  }) as CancelablePromise<void>;
};
