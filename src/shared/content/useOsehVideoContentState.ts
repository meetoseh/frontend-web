import { ReactElement, useCallback } from 'react';
import { Callbacks, ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';
import { OsehContentTarget } from './OsehContentTarget';
import { setVWC } from '../lib/setVWC';
import { useValuesWithCallbacksEffect } from '../hooks/useValuesWithCallbacksEffect';
import { getEffectiveVideoTarget } from './createVideoSizeComparerForTarget';
import {
  OsehMediaContentState,
  OsehMediaContentStateError,
  OsehMediaContentStateLoaded,
  OsehMediaContentStateLoading,
} from './OsehMediaContentState';
import { describeError } from '../forms/ErrorBlock';
import { CancelablePromise } from '../lib/CancelablePromise';

export type UseOsehVideoContentStateProps = {
  target: ValueWithCallbacks<OsehContentTarget>;
  size: ValueWithCallbacks<{ width: number; height: number }>;
};

/**
 * Loads the video from the given target, if the target is loaded,
 * otherwise stays in a loading state. Note that the actual video
 * width and height may differ from the requested size; it should
 * be positioned center/center with overflow hidden.
 */
export const useOsehVideoContentState = ({
  target: targetVWC,
  size: sizeVWC,
}: UseOsehVideoContentStateProps): ValueWithCallbacks<OsehMediaContentState<HTMLVideoElement>> => {
  const result = useWritableValueWithCallbacks<OsehMediaContentState<HTMLVideoElement>>(() =>
    makeLoadingState()
  );

  useValuesWithCallbacksEffect(
    [targetVWC, sizeVWC],
    useCallback(() => {
      const targetUnch = targetVWC.get();
      if (targetUnch.state !== 'loaded') {
        setVWC(result, makeLoadingState(), (a, b) => a.state === b.state);
        return undefined;
      }

      const target = targetUnch;
      const size = sizeVWC.get();
      const cancelers = new Callbacks<undefined>();
      let active = true;
      fetchVideo();
      return () => {
        active = false;
        cancelers.call(undefined);
      };

      async function fetchVideo() {
        if (!active) {
          return;
        }

        const videoSrc =
          target.webExport.url + (target.presigned ? '' : `?jwt=${encodeURIComponent(target.jwt)}`);

        const video = document.createElement('video');
        video.setAttribute('preload', 'auto');

        const realWidthRaw = target.webExport.formatParameters.width as unknown;
        const realWidth = typeof realWidthRaw === 'number' ? realWidthRaw : null;
        const realHeightRaw = target.webExport.formatParameters.height as unknown;
        const realHeight = typeof realHeightRaw === 'number' ? realHeightRaw : null;

        if (realWidth !== null && realHeight !== null) {
          const effective = getEffectiveVideoTarget(size, { width: realWidth, height: realHeight });
          const logicalWidth = (realWidth * effective.pixelPhysicalSize) / devicePixelRatio;
          const logicalHeight = (realHeight * effective.pixelPhysicalSize) / devicePixelRatio;

          video.setAttribute('width', `${logicalWidth}`);
          video.setAttribute('height', `${logicalHeight}`);
        } else {
          video.setAttribute('width', `${size.width}`);
          video.setAttribute('height', `${size.height}`);
          video.setAttribute('object-fit', 'cover');
        }
        video.setAttribute('src', videoSrc);

        const doCleanupVideo = () => {
          video.pause();
          video.removeAttribute('src');
          video.load();
          cancelers.remove(doCleanupVideo);
        };
        cancelers.add(doCleanupVideo);
        if (!active) {
          doCleanupVideo();
          return;
        }

        if (!video.paused) {
          video.pause();
        }

        const videoReady = waitUntilVideoIsReady(video, videoSrc);
        cancelers.add(videoReady.cancel);
        if (!active) {
          videoReady.cancel();
        }

        try {
          await videoReady.promise;
        } catch (e) {
          if (!active) {
            return;
          }
          const err = await describeError(e);
          if (!active) {
            return;
          }
          setVWC(result, makeErrorState(err));
          return;
        } finally {
          cancelers.remove(videoReady.cancel);
        }

        if (!active) {
          return;
        }

        setVWC(result, makeLoadedState(video));
      }
    }, [result, sizeVWC, targetVWC])
  );

  return result;
};

/**
 * Returns a cancelable promise which resolves when the video is ready to
 * be shown and rejects if the video cannot be loaded.
 */
export const waitUntilVideoIsReady = (
  video: HTMLVideoElement,
  videoSrc: string
): CancelablePromise<void> => {
  if (video.readyState >= 4) {
    return {
      promise: Promise.resolve(),
      done: () => true,
      cancel: () => {},
    };
  }

  let resolve: () => void = () => {};
  let reject: (e: Error) => void = () => {};
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const innerCancelers = new Callbacks<undefined>();
  let done = false;

  const onCanceled = () => {
    innerCancelers.call(undefined);
    innerCancelers.clear();
    done = true;
    reject(new Error('canceled'));
  };

  const onLoaded = () => {
    innerCancelers.call(undefined);
    innerCancelers.clear();
    done = true;
    resolve();
  };

  const onPotentiallyResolvableIssue = () => {
    if (didResetLoad) {
      onLoaded();
    } else {
      resetLoad();
    }
  };

  const onRecheckNetworkStateTimeout = () => {
    recheckNetworkStateTimeout = null;

    if (video.networkState !== 2) {
      if (didResetLoad) {
        onLoaded();
      } else {
        resetLoad();
      }
    } else {
      recheckNetworkStateTimeout = setTimeout(onRecheckNetworkStateTimeout, 100);
    }
  };

  innerCancelers.add(() => video.removeEventListener('canplaythrough', onLoaded));
  innerCancelers.add(() => video.removeEventListener('suspend', onPotentiallyResolvableIssue));
  innerCancelers.add(() => video.removeEventListener('stalled', onPotentiallyResolvableIssue));
  innerCancelers.add(() => video.removeEventListener('error', onPotentiallyResolvableIssue));
  video.addEventListener('canplaythrough', onLoaded);
  video.addEventListener('suspend', onPotentiallyResolvableIssue);
  video.addEventListener('stalled', onPotentiallyResolvableIssue);
  video.addEventListener('error', onPotentiallyResolvableIssue);

  let recheckNetworkStateTimeout: NodeJS.Timeout | null = setTimeout(
    onRecheckNetworkStateTimeout,
    100
  );
  innerCancelers.add(() => {
    if (recheckNetworkStateTimeout !== null) {
      clearTimeout(recheckNetworkStateTimeout);
      recheckNetworkStateTimeout = null;
    }
  });

  let didResetLoad = false;
  const resetLoad = () => {
    if (didResetLoad) {
      return;
    }
    didResetLoad = true;

    if (video.networkState === 3) {
      video.src = videoSrc;
    }
    let timeout: NodeJS.Timeout | null = null;
    innerCancelers.add(() => {
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
    });

    const onLoadStart = () => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
    };

    timeout = setTimeout(() => {
      timeout = null;
      onLoaded();
    }, 250);

    innerCancelers.add(() => video.removeEventListener('loadstart', onLoadStart));
    video.addEventListener('loadstart', onLoadStart);
    video.load();
  };

  if (video.networkState !== 2) {
    resetLoad();
  }

  return {
    promise,
    done: () => done,
    cancel: onCanceled,
  };
};

const makeLoadingState = (): OsehMediaContentStateLoading => ({
  state: 'loading',
  loaded: false,
  error: null,
  element: null,
});

const makeErrorState = (error: ReactElement): OsehMediaContentStateError => ({
  state: 'error',
  loaded: false,
  error,
  element: null,
});

const makeLoadedState = (
  video: HTMLVideoElement
): OsehMediaContentStateLoaded<HTMLVideoElement> => ({
  state: 'loaded',
  loaded: true,
  error: null,
  element: video,
});
