import { AudioFileData } from '../../content/OsehContentTarget';
import { OnLayoutAdapter } from '../../hooks/useLayoutSize';
import { useWritableValueWithCallbacks } from '../../lib/Callbacks';
import { setVWC } from '../../lib/setVWC';
import { OsehStyles } from '../../OsehStyles';
import { RenderGuardedComponent } from '../RenderGuardedComponent';
import { RecordedBars } from './RecordedBars';

/**
 * Shows the appropriate time vs intensity graph for the recorded audio
 * given the various options of number of bins. While the audio is playing,
 * this will "highlight" the part of the audio that has already been played.
 *
 * This has a fixed height, and must be placed in a flex container in the
 * row direction. It will grow as if by flex-grow: 1
 */
export const AutoWidthRecordedBars = (props: {
  audio: AudioFileData | undefined;
  audioDurationSeconds: number;
  intensity: Float32Array[];
  height: number;
}) => {
  const widthVWC = useWritableValueWithCallbacks<number>(() => 0);
  return (
    <OnLayoutAdapter
      component={(refVWC) => (
        <div
          className={OsehStyles.layout.column}
          style={{ flexGrow: 1, flexBasis: 0, position: 'relative', minHeight: props.height }}
          ref={(r) => setVWC(refVWC, r)}>
          <RenderGuardedComponent
            props={widthVWC}
            component={(width) => (
              <RecordedBars
                audio={props.audio}
                audioDurationSeconds={props.audioDurationSeconds}
                intensity={props.intensity}
                height={props.height}
                width={width}
              />
            )}
          />
        </div>
      )}
      onLayout={(e) => setVWC(widthVWC, e?.nativeEvent?.layout?.width ?? 0)}
    />
  );
};
