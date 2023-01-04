import { ReactElement, useEffect, useRef, useState } from 'react';
import { HTTP_API_URL } from './ApiConstants';
import { describeErrorFromResponse, ErrorBlock } from './forms/ErrorBlock';

export type OsehContentRef = {
  /**
   * The UID of the content file to show
   */
  uid: string;

  /**
   * The JWT to use to access the content file
   */
  jwt: string;
};

type OsehContentProps = OsehContentRef;

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
export const OsehContent = ({ uid, jwt }: OsehContentProps): ReactElement => {
  const [webExport, setWebExport] = useState<ContentFileWebExport | null>(null);
  const [error, setError] = useState<ReactElement | null>(null);
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let active = true;
    fetchWebExport();
    return () => {
      active = false;
    };

    async function fetchWebExport() {
      let response: Response;
      try {
        response = await fetch(`${HTTP_API_URL}/api/1/content_files/${uid}/web.json?presign=1`, {
          method: 'GET',
          headers: {
            Authorization: `bearer ${jwt}`,
          },
        });
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
  }, [uid, jwt]);

  useEffect(() => {
    if (webExport === null || ref.current === null) {
      return;
    }

    const audio = ref.current;
    if (audio.readyState === 0) {
      return;
    }

    if (!audio.paused) {
      audio.pause();
    }
    audio.load();
  }, [webExport]);

  return (
    <>
      {error && <ErrorBlock>{error}</ErrorBlock>}
      {webExport && (
        <audio ref={ref} controls>
          <source src={webExport.url} type="audio/mp4" />
        </audio>
      )}
    </>
  );
};
