import { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OsehAudioContentState } from './OsehAudioContentState';
import { OsehContentTarget } from './OsehContentTarget';
import { Callbacks, ValueWithCallbacks } from '../lib/Callbacks';

/**
 * Loads the specified audio target and returns a state object which can be used
 * to play or stop the audio. A loading or failed target will result in a perpetual
 * loading state.
 */
export const useOsehAudioContentState = (target: OsehContentTarget): OsehAudioContentState => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCallbacksRef = useRef<Callbacks<undefined>>() as MutableRefObject<
    Callbacks<undefined>
  >;
  const [play, setPlayRaw] = useState<((this: void) => Promise<void>) | null>(null);
  const [stop, setStopRaw] = useState<((this: void) => Promise<void>) | null>(null);

  if (audioCallbacksRef.current === undefined) {
    audioCallbacksRef.current = new Callbacks();
  }

  // convenience function for using setPlay; setPlay(() => {}) doesn't work
  // as expected since it will actually be treated as the functional variant
  // of setPlay, which is not what we want
  const setPlaySafe = useCallback((play: ((this: void) => Promise<void>) | null) => {
    setPlayRaw(() => play);
  }, []);

  const setStopSafe = useCallback((stop: ((this: void) => Promise<void>) | null) => {
    setStopRaw(() => stop);
  }, []);

  const outerTarget = target;
  useEffect(() => {
    if (outerTarget.state !== 'loaded') {
      if (audioRef.current !== null) {
        audioRef.current = null;
        audioCallbacksRef.current.call(undefined);
        setPlaySafe(null);
        setStopSafe(null);
      }
      return;
    }
    const target = outerTarget;

    const audioSrc =
      target.webExport.url + (target.presigned ? '' : `?jwt=${encodeURIComponent(target.jwt)}`);

    let aud = audioRef.current;
    if (aud !== null && aud.src !== audioSrc) {
      aud = null;
      audioRef.current = null;
      audioCallbacksRef.current.call(undefined);
    }

    if (aud === null) {
      aud = new Audio();
      aud.preload = 'auto';
      aud.src = audioSrc;
      audioRef.current = aud;
      audioCallbacksRef.current.call(undefined);
    }

    const audio = aud;

    let active = true;
    const onCancel: (() => void)[] = [];
    manageAudio();
    const unmount = () => {
      if (!active) {
        return;
      }
      active = false;
      const cpCancellers = onCancel.slice();
      for (const cancel of cpCancellers) {
        cancel();
      }
    };
    return unmount;

    async function manageAudio() {
      setPlaySafe(null);
      setStopSafe(null);
      if (!audio.paused) {
        audio.pause();
      }

      const onLoadPromise = new Promise<void>((resolve) => {
        const cancelers: (() => void)[] = [];
        const cancel = () => {
          for (const canceler of cancelers) {
            canceler();
          }
        };

        if (audio.readyState >= 4) {
          cancel();
          resolve();
          return;
        }

        const onLoaded = () => {
          cancel();
          resolve();
        };

        const onPotentiallyResolvableIssue = () => {
          if (didResetLoad) {
            cancel();
            resolve();
          } else {
            resetLoad();
          }
        };

        const onRecheckNetworkStateTimeout = () => {
          recheckNetworkStateTimeout = null;

          if (audio.networkState !== 2) {
            if (didResetLoad) {
              cancel();
              resolve();
            } else {
              resetLoad();
            }
          } else {
            recheckNetworkStateTimeout = setTimeout(onRecheckNetworkStateTimeout, 100);
          }
        };

        cancelers.push(() => audio.removeEventListener('canplaythrough', onLoaded));
        cancelers.push(() => audio.removeEventListener('suspend', onPotentiallyResolvableIssue));
        cancelers.push(() => audio.removeEventListener('stalled', onPotentiallyResolvableIssue));
        cancelers.push(() => audio.removeEventListener('error', onPotentiallyResolvableIssue));
        audio.addEventListener('canplaythrough', onLoaded);
        audio.addEventListener('suspend', onPotentiallyResolvableIssue);
        audio.addEventListener('stalled', onPotentiallyResolvableIssue);
        audio.addEventListener('error', onPotentiallyResolvableIssue);

        let recheckNetworkStateTimeout: NodeJS.Timeout | null = setTimeout(
          onRecheckNetworkStateTimeout,
          100
        );
        cancelers.push(() => {
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

          if (audio.networkState === 3) {
            audio.src = audioSrc;
          }
          let timeout: NodeJS.Timeout | null = null;
          cancelers.push(() => {
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
            cancel();
            resolve();
          }, 250);

          cancelers.push(() => audio.removeEventListener('loadstart', onLoadStart));
          audio.addEventListener('loadstart', onLoadStart);
          audio.load();
        };

        if (audio.networkState !== 2) {
          resetLoad();
        }
      });

      await onLoadPromise;
      if (!active) {
        return;
      }

      setPlaySafe(() => audio.play());
      setStopSafe(async () => audio.pause());
      unmount();
    }
  }, [setPlaySafe, setStopSafe, outerTarget]);

  const audio = useMemo<ValueWithCallbacks<HTMLAudioElement | null>>(
    () => ({
      get: () => audioRef.current,
      callbacks: audioCallbacksRef.current,
    }),
    []
  );

  return useMemo<OsehAudioContentState>(
    () => ({
      play,
      stop,
      loaded: play !== null,
      error: null,
      audio,
    }),
    [play, stop, audio]
  );
};
