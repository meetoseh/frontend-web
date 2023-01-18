import { ReactElement, useEffect, useRef } from 'react';
import { ErrorBlock } from '../../shared/forms/ErrorBlock';
import { OsehContentRef, useOsehContent } from '../../shared/OsehContent';

type JourneyAudioProps = {
  /**
   * The audio content for the journey
   */
  audioContent: OsehContentRef;

  /**
   * Called when the audio is ready to play. Note that play() is privileged,
   * meaning that it must be called _immediately_ after a user interaction,
   * after the audio is loaded, or it will fail.
   *
   * @param loaded Whether the audio is loaded
   */
  setLoaded: (this: void, loaded: boolean) => void;

  /**
   * Called with a function that can be used to play the audio after a
   * user interaction, starting from the beginning. Note that it is
   * privileged, so there can be no delay between the user interaction
   * and the call to play()
   *
   * @param play A function that can be called to play the audio in
   *   a privileged context. May reject if not privileged.
   */
  doPlay: (this: void, play: ((this: void) => Promise<void>) | null) => void;
};

/**
 * Plays the audio for the journey in the background, without controls. Shows
 * an error if the audio can't be played.
 */
export const JourneyAudio = ({
  audioContent,
  setLoaded,
  doPlay,
}: JourneyAudioProps): ReactElement => {
  const { webExport, error } = useOsehContent(audioContent);
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (webExport === null || ref.current === null) {
      return;
    }

    const audio = ref.current;

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
      setLoaded(false);
      doPlay(null);
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

      doPlay(() => audio.play());
      setLoaded(true);
      unmount();
    }
  }, [webExport, doPlay, setLoaded]);

  return (
    <>
      {error && <ErrorBlock>{error}</ErrorBlock>}
      {webExport !== null ? (
        <audio ref={ref} preload="auto">
          <source src={webExport.url} type="audio/mp4" />
        </audio>
      ) : null}
    </>
  );
};
