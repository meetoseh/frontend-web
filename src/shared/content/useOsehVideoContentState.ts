import { ReactElement, useCallback } from 'react';
import { Callbacks, ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';
import { OsehContentTarget } from './OsehContentTarget';
import {
  OsehVideoContentState,
  OsehVideoContentStateError,
  OsehVideoContentStateLoaded,
  OsehVideoContentStateLoading,
} from './OsehVideoContentState';
import { setVWC } from '../lib/setVWC';
import { describeError } from '../forms/ErrorBlock';
import { useValuesWithCallbacksEffect } from '../hooks/useValuesWithCallbacksEffect';
import { getEffectiveVideoTarget } from './createVideoSizeComparerForTarget';

export type UseOsehVideoContentStateProps = {
  target: ValueWithCallbacks<OsehContentTarget>;
  size: ValueWithCallbacks<{ width: number; height: number }>;
};

/**
 * Loads the video from the given target, if the target is loaded,
 * otherwise stays in a loading state.
 */
export const useOsehVideoContentState = ({
  target: targetVWC,
  size: sizeVWC,
}: UseOsehVideoContentStateProps): ValueWithCallbacks<OsehVideoContentState> => {
  const result = useWritableValueWithCallbacks<OsehVideoContentState>(() => makeLoadingState());

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
          if (realWidth !== size.width) {
            video.style.marginLeft = `${(size.width - logicalWidth) / 2}px`;
          }
          if (realHeight !== size.height) {
            video.style.marginTop = `${(size.height - logicalHeight) / 2}px`;
          }
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

        const onLoadPromise = new Promise<void>((resolve, reject) => {
          const innerCancelers = new Callbacks<undefined>();

          if (video.readyState >= 4) {
            innerCancelers.call(undefined);
            resolve();
            return;
          }

          const onCanceled = () => {
            cancelers.remove(onCanceled);
            innerCancelers.call(undefined);
            reject(new Error('canceled'));
          };

          const onLoaded = () => {
            cancelers.remove(onCanceled);
            innerCancelers.call(undefined);
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

          cancelers.add(onCanceled);
          innerCancelers.add(() => video.removeEventListener('canplaythrough', onLoaded));
          innerCancelers.add(() =>
            video.removeEventListener('suspend', onPotentiallyResolvableIssue)
          );
          innerCancelers.add(() =>
            video.removeEventListener('stalled', onPotentiallyResolvableIssue)
          );
          innerCancelers.add(() =>
            video.removeEventListener('error', onPotentiallyResolvableIssue)
          );
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
        });

        try {
          await onLoadPromise;
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
        }

        if (!active) {
          return;
        }

        setVWC(
          result,
          makeLoadedState(
            () => video.play(),
            async () => video.pause(),
            video
          )
        );
      }
    }, [result, sizeVWC, targetVWC])
  );

  return result;
};

const makeLoadingState = (): OsehVideoContentStateLoading => ({
  state: 'loading',
  play: null,
  stop: null,
  loaded: false,
  error: null,
  video: null,
});

const makeErrorState = (error: ReactElement): OsehVideoContentStateError => ({
  state: 'error',
  play: null,
  stop: null,
  loaded: false,
  error,
  video: null,
});

const makeLoadedState = (
  play: (this: void) => Promise<void>,
  stop: (this: void) => Promise<void>,
  video: HTMLVideoElement
): OsehVideoContentStateLoaded => ({
  state: 'loaded',
  play,
  stop,
  loaded: true,
  error: null,
  video,
});