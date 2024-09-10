import { CancelablePromise } from './CancelablePromise';

/** Creates a cancelable promise that resolves on the next animation frame */
export const waitForAnimationFrameCancelable = (): CancelablePromise<DOMHighResTimeStamp> => {
  let done = false;
  let _instantResolved: DOMHighResTimeStamp | null = null;
  let _instantRejected: any = null;
  let resolve: (now: DOMHighResTimeStamp) => void = (now) => {
    done = true;
    _instantResolved = now;
  };
  let reject: (reason: any) => void = (reason) => {
    done = true;
    _instantRejected = reason;
  };
  const promise = new Promise<DOMHighResTimeStamp>((_resolve, _reject) => {
    if (_instantResolved !== null) {
      _resolve(_instantResolved);
      return;
    }
    if (_instantRejected !== null) {
      _reject(_instantRejected);
      return;
    }

    resolve = (v) => {
      done = true;
      _resolve(v);
    };
    reject = () => {
      done = true;
      _reject();
    };
  });

  let frameId: number | null = requestAnimationFrame(onFrame);

  return {
    done: () => done,
    cancel: onCancel,
    promise,
  };

  function onFrame(time: DOMHighResTimeStamp) {
    frameId = null;
    if (!done) {
      resolve(time);
    }
  }

  function onCancel() {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    if (!done) {
      reject(new Error('canceled'));
    }
  }
};
