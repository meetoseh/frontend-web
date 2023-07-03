import { ReactElement, useEffect, useMemo, useState } from 'react';
import { OsehContentProps } from './OsehContentProps';
import { ContentFileWebExport, OsehContentTarget } from './OsehContentTarget';
import { HTTP_API_URL } from '../ApiConstants';
import { describeError } from '../forms/ErrorBlock';

/**
 * A hook for getting the target to download for an Oseh content file. On the
 * web simple mp4s are used and hence this downloads a json file in a custom
 * format which lists all the available targets, then selects one. On native
 * apps the m3u8 format is used which comes with bandwidth selection and hence
 * this is essentially a no-op.
 */
export const useOsehContentTarget = ({
  uid,
  jwt,
  showAs = 'audio',
  presign = true,
}: OsehContentProps): OsehContentTarget => {
  const [webExport, setWebExport] = useState<ContentFileWebExport | null>(null);
  const [error, setError] = useState<ReactElement | null>(null);

  useEffect(() => {
    let active = true;
    fetchWebExportWrapper();
    return () => {
      active = false;
    };

    async function fetchWebExportWrapper() {
      setError(null);
      if (uid === null || jwt === null) {
        setWebExport(null);
        return;
      }

      try {
        const webExport = await fetchWebExport(uid, jwt, presign);
        if (!active) {
          return;
        }
        setWebExport(webExport);
      } catch (e) {
        setError(e as ReactElement);
      }
    }
  }, [uid, jwt, presign]);

  return useMemo<OsehContentTarget>(() => {
    if (jwt === null || (webExport === null && error === null)) {
      return {
        state: 'loading',
        error: null,
        webExport: null,
        presigned: null,
        jwt: null,
      };
    }

    if (error !== null) {
      return {
        state: 'failed',
        error,
        webExport: null,
        presigned: null,
        jwt: null,
      };
    }

    if (webExport === null) {
      throw new Error('this is impossible: webExport is null, error is neither null nor non-null');
    }

    return {
      state: 'loaded',
      error: null,
      webExport,
      presigned: presign,
      jwt,
    };
  }, [jwt, presign, webExport, error]);
};

/**
 * Fetches the best web export for a content file with the given uid and jwt,
 * presigning as requested.
 *
 * If this rejects, the rejection will be a ReactElement describing the error.
 */
export const fetchWebExport = async (
  uid: string,
  jwt: string,
  presign: boolean
): Promise<ContentFileWebExport> => {
  try {
    const response = await fetch(
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
    if (!response.ok) {
      throw response;
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
      return Promise.reject(
        <>No suitable export found for this audio file. Please contact the site administrator.</>
      );
    }

    return bestExport;
  } catch (e) {
    return Promise.reject(await describeError(e));
  }
};
