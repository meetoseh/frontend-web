import { useEffect } from 'react';
import { useWritableValueWithCallbacks } from '../../lib/Callbacks';
import { setVWC } from '../../lib/setVWC';
import { RenderGuardedComponent } from '../RenderGuardedComponent';
import { Play } from '../icons/Play';
import { OsehColors } from '../../OsehColors';
import { OsehStyles } from '../../OsehStyles';
import { Pause } from '../icons/Pause';

/**
 * Shows a play icon while the audio is paused and a pause icon while the
 * audio is playing
 */
export const AudioPlayPauseIcon = (props: { audio: HTMLAudioElement }) => {
  const playingVWC = useWritableValueWithCallbacks(() => !props.audio.paused);

  useEffect(() => {
    props.audio.addEventListener('play', onPlay);
    props.audio.addEventListener('pause', onPause);
    setVWC(playingVWC, !props.audio.paused);
    return () => {
      props.audio.removeEventListener('play', onPlay);
      props.audio.removeEventListener('pause', onPause);
    };

    function onPlay() {
      setVWC(playingVWC, true);
    }

    function onPause() {
      setVWC(playingVWC, false);
    }
  }, [props.audio, playingVWC]);

  return (
    <RenderGuardedComponent
      props={playingVWC}
      component={(playing) =>
        !playing ? (
          <>
            <Play
              icon={{ width: 32 }}
              container={{ width: 32, height: 32 }}
              startPadding={{ x: { fraction: 0.5 }, y: { fraction: 0.5 } }}
              color={OsehColors.v4.primary.light}
            />
            <div className={OsehStyles.assistive.srOnly}>Play</div>
          </>
        ) : (
          <>
            <Pause
              icon={{ width: 15 }}
              container={{ width: 32, height: 32 }}
              startPadding={{ x: { fraction: 0.5 }, y: { fraction: 0.5 } }}
              color={OsehColors.v4.primary.light}
            />
            <div className={OsehStyles.assistive.srOnly}>Pause</div>
          </>
        )
      }
    />
  );
};
