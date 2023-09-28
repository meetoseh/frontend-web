import { Callbacks } from '../../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../../shared/lib/CancelablePromise';
import { TouchLinkInfo } from './TouchLinkState';

/**
 * Describes a link that we already fetched from the server
 */
export type FetchedLink = {
  /**
   * Where the link leads
   */
  link: TouchLinkInfo;

  /**
   * The uid assigned to the on_click event
   */
  onClickUid: string;

  /**
   * True if we've already assigned a user to the click, false otherwise
   */
  setUser: boolean;
};

/**
 * The format that we store in local storage when we see a link code in
 * the url
 */
export type StoredTouchLinkCode = {
  /*
   * The code that was detected
   */
  code: string;
  /**
   * If the link associated with the code has already been fetched, the link,
   * otherwise null. Note that if the code turns out to be invalid the code
   * shouldn't be saved in local storage
   */
  link: FetchedLink | null;
  /**
   * When the code was seen
   */
  codeSeenAt: Date;
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
    const raw = localStorage.getItem('touchLinkCode');
    if (raw === null) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return {
      code: parsed.code,
      link: parsed.link,
      codeSeenAt: new Date(parsed.codeSeenAt),
    };
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
      localStorage.removeItem('touchLinkCode');
      return;
    }

    localStorage.setItem(
      'touchLinkCode',
      JSON.stringify({
        code: code.code,
        link: code.link,
        codeSeenAt: code.codeSeenAt.toISOString(),
      })
    );
  }) as CancelablePromise<void>;
};
