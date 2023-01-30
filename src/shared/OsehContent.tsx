import { CSSProperties, ReactElement, useEffect, useRef, useState } from 'react';
import { HTTP_API_URL } from './ApiConstants';
import { describeErrorFromResponse, ErrorBlock } from './forms/ErrorBlock';

export type OsehContentRef = {
  /**
   * The UID of the content file to show. If null, we will show nothing.
   */
  uid: string | null;

  /**
   * The JWT to use to access the content file. If null, we will show nothing.
   */
  jwt: string | null;
};

type OsehContentProps = OsehContentRef & {
  /**
   * How the content file should be shown. Defaults to 'audio', meaning it
   * will be handled as audio-only content. For 'video', we may select a
   * different export and will show as a video.
   */
  showAs?: 'audio' | 'video';

  /**
   * True if the url needs presigning, false if the url does not need
   * presigning. Typically true if we want to use native controls and false if
   * we want to use custom controls.
   */
  presign?: boolean;
};

type ContentFileWebExport = {
  url: string;
  format: 'mp4';
  bandwidth: number;
  codecs: Array<'aac'>;
  fileSize: number;
  qualityParameters: any;
};

/**
 * Shows an audio file from Oseh, with controls and error handling
 */
export const OsehContent = ({
  uid,
  jwt,
  showAs = 'audio',
  playerStyle = undefined,
}: OsehContentProps & { playerStyle?: CSSProperties | undefined }): ReactElement => {
  const { webExport, error } = useOsehContent({ uid, jwt });
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (webExport === null || ref.current === null) {
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
  }, [webExport]);

  return (
    <>
      {error && <ErrorBlock>{error}</ErrorBlock>}
      {webExport && showAs === 'audio' ? (
        <audio ref={ref} controls style={playerStyle}>
          <source src={webExport.url} type="audio/mp4" />
        </audio>
      ) : null}
      {webExport && showAs === 'video' ? (
        <video ref={ref} controls style={playerStyle}>
          <source src={webExport.url} type="video/mp4" />
        </video>
      ) : null}
    </>
  );
};

/**
 * A hook for getting the web export for an Oseh content file. This is
 * useful for if you need fine-tuned control over the audio/video player,
 * but want to reuse the logic for downloading the playlist and selecting
 * the export.
 */
export const useOsehContent = ({
  uid,
  jwt,
  showAs = 'audio',
  presign = true,
}: OsehContentProps): { error: ReactElement | null; webExport: ContentFileWebExport | null } => {
  const [webExport, setWebExport] = useState<ContentFileWebExport | null>(null);
  const [error, setError] = useState<ReactElement | null>(null);

  useEffect(() => {
    let active = true;
    fetchWebExport();
    return () => {
      active = false;
    };

    async function fetchWebExport() {
      if (uid === null || jwt === null) {
        return;
      }

      let response: Response;
      try {
        response = await fetch(
          `${HTTP_API_URL}/api/1/content_files/${uid}/web.json?${new URLSearchParams({
            presign: presign ? '1' : '0',
          })}`,
          {
            method: 'GET',
            headers: {
              Authorization: `bearer ${jwt}`,
            },
          }
        );
      } catch (e) {
        if (!active) {
          return;
        }
        console.error(e);
        setError(<>Failed to connect to server. Check your internet connection.</>);
        return;
      }

      if (!active) {
        return;
      }

      if (!response.ok) {
        const err = await describeErrorFromResponse(response);
        if (!active) {
          return;
        }
        setError(err);
        return;
      }

      const data: {
        exports: {
          url: string;
          format: string;
          bandwidth: number;
          codecs: string[];
          file_size: number;
          quality_parameters: any;
        }[];
        duration_seconds: number;
      } = await response.json();
      if (!active) {
        return;
      }

      let bestExport: ContentFileWebExport | null = null;
      let bestBandwidth = 0;
      for (const exportData of data.exports) {
        if (exportData.format !== 'mp4') {
          continue;
        }
        if (exportData.bandwidth > bestBandwidth) {
          bestExport = {
            url: exportData.url,
            format: exportData.format,
            bandwidth: exportData.bandwidth,
            codecs: exportData.codecs as Array<'aac'>,
            fileSize: exportData.file_size,
            qualityParameters: exportData.quality_parameters,
          };
          bestBandwidth = exportData.bandwidth;
        }
      }

      if (bestExport === null) {
        setError(
          <>No suitable export found for this audio file. Please contact the site administrator.</>
        );
        return;
      }

      setWebExport(bestExport);
    }
  }, [uid, jwt, presign]);

  return { error, webExport };
};
