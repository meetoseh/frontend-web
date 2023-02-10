import { ReactElement, RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OsehContentRef, useOsehContent } from '../../../shared/OsehContent';

export type JourneyAudio = {
  /**
   * A function that can be used to play the audio, if the audio is ready to
   * be played, otherwise null. Note that play() is privileged, meaning that
   * it must be called _immediately_ after a user interaction, after the audio
   * is loaded, or it will fail.
   */
  play: ((this: void) => Promise<void>) | null;

  /**
   * A function that can be used to stop the audio, if the audio is playing.
   */
  stop: ((this: void) => Promise<void>) | null;

  /**
   * A convenience boolean which is true if the audio is ready to be played.
   * This is equivalent to (play !== null), but more semantically meaningful.
   */
  loaded: boolean;

  /**
   * If an error occurred and this will never finish loading, this will be
   * an element describing the error. Otherwise, this will be null.
   */
  error: ReactElement | null;

  /**
   * A reference to the underlying audio element, if it has been created.
   * This is useful for more advanced use cases.
   */
  audioRef: RefObject<HTMLAudioElement | null>;
};

/**
 * Handles preparing the given audio content as indicated by the given
 * content ref to be played.
 */
export const useJourneyAudio = (audioContent: OsehContentRef | null): JourneyAudio => {
  const { webExport, error } = useOsehContent(audioContent ?? { uid: null, jwt: null });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [play, setPlayRaw] = useState<((this: void) => Promise<void>) | null>(null);
  const [stop, setStopRaw] = useState<((this: void) => Promise<void>) | null>(null);

  // convenience function for using setPlay; setPlay(() => {}) doesn't work
  // as expected since it will actually be treated as the functional variant
  // of setPlay, which is not what we want
  const setPlaySafe = useCallback((play: ((this: void) => Promise<void>) | null) => {
    setPlayRaw(() => play);
  }, []);

  const setStopSafe = useCallback((stop: ((this: void) => Promise<void>) | null) => {
    setStopRaw(() => stop);
  }, []);

  useEffect(() => {
    if (webExport === null) {
      if (audioRef.current !== null) {
        audioRef.current = null;
        setPlaySafe(null);
        setStopSafe(null);
      }
      return;
    }

    let aud = audioRef.current;
    if (aud !== null && aud.src !== webExport.url) {
      audioRef.current = null;
      aud = null;
    }

    if (aud === null) {
      aud = new Audio();
      aud.preload = 'auto';
      aud.src = webExport.url;
      audioRef.current = aud;
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
            audio.src = webExport!.url;
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
  }, [setPlaySafe, setStopSafe, webExport]);

  return useMemo(
    () => ({
      play,
      stop,
      loaded: play !== null,
      error,
      audioRef,
    }),
    [play, stop, error]
  );
};
