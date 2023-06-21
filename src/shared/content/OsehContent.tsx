import { CSSProperties, ReactElement, useEffect, useRef } from 'react';
import { OsehContentProps } from './OsehContentProps';
import { useOsehContentTarget } from './useOsehContentTarget';
import { ErrorBlock } from '../forms/ErrorBlock';

/**
 * Shows an audio file from Oseh, with controls and error handling
 */
export const OsehContent = ({
  uid,
  jwt,
  showAs = 'audio',
  playerStyle = undefined,
}: OsehContentProps & { playerStyle?: CSSProperties | undefined }): ReactElement => {
  const target = useOsehContentTarget({ uid, jwt });
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (target.state !== 'loaded' || ref.current === null) {
      return;
    }

    const media: HTMLMediaElement = ref.current;
    if (media.readyState === 0) {
      return;
    }

    if (!media.paused) {
      media.pause();
    }
    media.load();
  }, [target]);

  return (
    <>
      {target.error && <ErrorBlock>{target.error}</ErrorBlock>}
      {target.state === 'loaded' && showAs === 'audio' ? (
        <audio ref={ref} controls style={playerStyle}>
          <source src={target.webExport.url} type="audio/mp4" />
        </audio>
      ) : null}
      {target.state === 'loaded' && showAs === 'video' ? (
        <video ref={ref} controls style={playerStyle}>
          <source src={target.webExport.url} type="video/mp4" />
        </video>
      ) : null}
    </>
  );
};
