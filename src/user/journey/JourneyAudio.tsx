import { ReactElement, useEffect, useRef } from 'react';
import { ErrorBlock } from '../../shared/forms/ErrorBlock';
import { OsehContentRef, useOsehContent } from '../../shared/OsehContent';
import { JourneyTime } from './hooks/useJourneyTime';

type JourneyAudioProps = {
  /**
   * The audio content for the journey
   */
  audioContent: OsehContentRef;

  /**
   * The journey time, so the audio can be synced up
   */
  journeyTime: JourneyTime;
};

/**
 * Plays the audio for the journey in the background, without controls. Shows
 * an error if the audio can't be played.
 */
export const JourneyAudio = ({ audioContent, journeyTime }: JourneyAudioProps): ReactElement => {
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

    function sleepUntilJourneyTime(targetTime: DOMHighResTimeStamp): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        if (!active) {
          reject('unmounted');
          return;
        }

        const predictedIndex = journeyTime.onTimeChanged.current.length;
        const tryRemoveOnTimeChanged = () => {
          for (
            let i = Math.min(predictedIndex, journeyTime.onTimeChanged.current.length - 1);
            i >= 0;
            i--
          ) {
            if (journeyTime.onTimeChanged.current[i] === onTimeChange) {
              journeyTime.onTimeChanged.current.splice(i, 1);
              return true;
            }
          }

          return false;
        };

        const onCancelled = () => {
          if (!tryRemoveOnTimeChanged()) {
            reject(new Error('onTimeChange callback not found in onTimeChanged list!'));
            return;
          }
          reject('unmounted');
        };
        onCancel.push(onCancelled);

        const onTimeChange = (lastTime: DOMHighResTimeStamp, newTime: DOMHighResTimeStamp) => {
          if (!active) {
            return;
          }
          if (newTime >= targetTime) {
            onCancel.splice(onCancel.indexOf(onCancelled), 1);

            if (!tryRemoveOnTimeChanged()) {
              reject(new Error('onTimeChange callback not found in onTimeChanged list!'));
              return;
            }

            resolve();
          }
        };

        journeyTime.onTimeChanged.current.push(onTimeChange);
      });
    }

    async function manageAudio() {
      console.log('manageAudio');
      if (!audio.paused) {
        console.log('  pausing');
        audio.pause();
      }

      const onLoadPromise = new Promise<void>((resolve) => {
        if (audio.readyState >= 4) {
          resolve();
          return;
        }

        const onLoaded = () => {
          resolve();
          window.removeEventListener('canplaythrough', onLoaded);
        };

        audio.addEventListener('canplaythrough', onLoaded);
      });

      if (journeyTime.time.current > 0) {
        if (audio.fastSeek) {
          audio.fastSeek(journeyTime.time.current / 1000);
        } else {
          audio.currentTime = journeyTime.time.current / 1000;
        }
      }

      console.log('  waiting for load');
      await onLoadPromise;
      if (!active) {
        console.log('  unmounted while waiting for load');
        return;
      }

      if (journeyTime.time.current < 0) {
        console.log('  waiting for time 0');
        await sleepUntilJourneyTime(0);
        if (!active) {
          console.log('  unmounted while waiting for time 0');
          return;
        }
      } else {
        if (audio.fastSeek) {
          audio.fastSeek(journeyTime.time.current / 1000);
        } else {
          audio.currentTime = journeyTime.time.current / 1000;
        }
      }

      console.log('  playing');
      await audio.play();
      if (!active) {
        console.log('  unmounted while playing');
      }
      console.log('  done');
      unmount();
    }
  }, [webExport, journeyTime.time, journeyTime.onTimeChanged]);

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
