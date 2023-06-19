import { ReactElement, useContext, useEffect, useState } from 'react';
import { JourneyAudioContent } from './audio_contents/JourneyAudioContent';
import {
  FileUploadHandler,
  parseUploadInfoFromResponse,
  UploadInfo,
} from '../../shared/upload/FileUploadHandler';
import styles from './CreateJourneyUploadAudioContent.module.css';
import {
  describeError,
  describeErrorFromResponse,
  ErrorBlock,
} from '../../shared/forms/ErrorBlock';
import { apiFetch } from '../../shared/ApiConstants';
import { LoginContext, LoginContextValue } from '../../shared/contexts/LoginContext';
import { convertUsingKeymap } from '../crud/CrudFetcher';
import { keyMap as journeyAudioContentKeyMap } from './audio_contents/JourneyAudioContents';
import { computeFileSha512 } from '../../shared/computeFileSha512';

type CreateJourneyUploadAudioContentProps = {
  /**
   * Called when the user has uploaded a new audio content.
   */
  onUploaded: (this: void, audioContent: JourneyAudioContent) => void;
};

/**
 * Allows the user to upload a single journey audio content, then calls
 * the given callback with the new audio content.
 *
 * Currently this is pretty hacky in order to get the reference, but
 * once we can follow jobs to completion it should be much easier.
 */
export const CreateJourneyUploadAudioContent = ({
  onUploaded,
}: CreateJourneyUploadAudioContentProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<
    'picking-file' | 'preparing' | 'uploading' | 'processing'
  >('picking-file');
  const [uploadHandler, setUploadHandler] = useState<ReactElement | null>(null);
  const [error, setError] = useState<ReactElement | null>(null);

  useEffect(() => {
    let active = true;
    uploadFile();
    return () => {
      active = false;
    };

    async function uploadFile() {
      if (file === null) {
        return;
      }

      setError(null);
      setUploadState('preparing');

      let fileSha512: string;
      const startedHashingAt = performance.now();
      try {
        fileSha512 = await computeFileSha512(file);
      } catch (e) {
        if (!active) {
          return;
        }
        console.error(e);
        setError(<>Unable to read file. Verify its on a local drive.</>);
        setUploadState('picking-file');
        return;
      }
      const hashingTime = performance.now() - startedHashingAt;
      console.log(
        `Hashed ${file.size.toLocaleString()} byte file in ~${hashingTime.toLocaleString(
          undefined,
          { maximumFractionDigits: 0 }
        )}ms.`
      );
      console.log('fileSha512', fileSha512);

      try {
        const existing = await findBySha512(loginContext, fileSha512);
        if (existing !== null) {
          if (!active) {
            return;
          }
          console.log('Found matching existing audio content', existing);
          setUploadState('picking-file');
          onUploaded(existing);
          return;
        }
      } catch (e) {
        if (!active) {
          return;
        }

        console.error(e);
        const err = await describeError(e);
        if (!active) {
          return;
        }
        setError(err);
        setUploadState('picking-file');
        return;
      }

      let response: Response;
      try {
        response = await apiFetch(
          '/api/1/journeys/audio_contents/',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ file_size: file.size }),
          },
          loginContext
        );
      } catch (e) {
        if (!active) {
          return;
        }
        console.error(e);
        setError(<>Unable to connect to server. Check your internet connection.</>);
        setUploadState('picking-file');
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
        setUploadState('picking-file');
        return;
      }

      let refData: any;
      try {
        refData = await response.json();
      } catch (e) {
        console.error(e);
        setError(
          <>
            Unable to download server response, or server did not provide json. Check your internet
            connection.
          </>
        );
        setUploadState('picking-file');
        return;
      }
      if (!active) {
        return;
      }

      let uploadInfo: UploadInfo;
      try {
        uploadInfo = parseUploadInfoFromResponse(refData);
      } catch (e) {
        console.error(e);
        setError(<>Unable to parse server response.</>);
        setUploadState('picking-file');
        return;
      }

      const uploaded = new Promise<void>((resolve, reject) => {
        setUploadHandler(
          <FileUploadHandler
            file={file}
            uploadInfo={uploadInfo}
            onComplete={resolve}
            onError={reject}
          />
        );
      });
      setUploadState('uploading');

      try {
        await uploaded;
      } catch (e) {
        if (!active) {
          return;
        }

        console.error(e);
        const err = await describeError(e);
        if (!active) {
          return;
        }
        setError(err);
        setUploadState('picking-file');
        return;
      }

      if (!active) {
        return;
      }

      setUploadState('processing');
      for (let i = 0; i < 600; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (!active) {
          return;
        }

        try {
          const found = await findBySha512(loginContext, fileSha512);
          if (!active) {
            return;
          }

          if (found !== null) {
            console.log('Found matching audio content', found);
            setUploadState('picking-file');
            onUploaded(found);
            return;
          }
        } catch (e) {
          console.error(e);

          if (e instanceof Response && [502, 504].indexOf(e.status) >= 0) {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            continue;
          }

          setError(
            <>
              The upload completed, but an error occurred waiting for the server to finish
              processing. It should show up in Choose within a few minutes.
            </>
          );
          setUploadState('picking-file');
          return;
        }
      }

      if (!active) {
        return;
      }

      setError(<>Timed out waiting for processing to complete. Contact support.</>);
      setUploadState('picking-file');
    }
  }, [file, loginContext, onUploaded]);

  return uploadState === 'picking-file' ? (
    <div className={styles.container}>
      <div className={styles.title}>Select a File</div>

      {error && <ErrorBlock>{error}</ErrorBlock>}

      <div className={styles.help}>
        <p>
          Our servers will compress the file into several formats, which will ensure every device
          gets the best possible experience. This works best if the uploaded audio files are
          uploaded with 2 channels at 44.1 kHz, with 24-bit depth and a bitrate of 2116.8 kbps. At
          these settings, the file size should be around 265 Kb/second, or just under 16 Mb for a 60
          second file.
        </p>

        <p>
          This will first check if the file already exists on the server, and if so, will use that
          instead of uploading a new copy.
        </p>
      </div>

      <div className={styles.fileInputContainer}>
        <input
          type="file"
          className={styles.fileInput}
          accept="audio/wav"
          onChange={(e) => {
            if (e.target.files) {
              setFile(e.target.files[0]);
            }
          }}
        />
      </div>
    </div>
  ) : (
    <div className={styles.container}>
      <div className={styles.title}>Uploading...</div>

      {error && <ErrorBlock>{error}</ErrorBlock>}

      {uploadState === 'preparing' && (
        <div className={styles.help}>Getting ready to upload the file...</div>
      )}

      {uploadState === 'uploading' ? uploadHandler : null}

      {uploadState === 'processing' && (
        <div className={styles.help}>
          Waiting for the server to process the file. This may take a few minutes.
        </div>
      )}
    </div>
  );
};

async function findBySha512(
  loginContext: LoginContextValue,
  fileSha512: string
): Promise<JourneyAudioContent | null> {
  const response = await apiFetch(
    '/api/1/journeys/audio_contents/search',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        filters: {
          original_file_sha512: {
            operator: 'eq',
            value: fileSha512,
          },
        },
        limit: 1,
      }),
    },
    loginContext
  );
  if (!response.ok) {
    throw response;
  }

  let existCheckData: { items: any[] } = await response.json();

  if (existCheckData.items.length > 0) {
    return convertUsingKeymap(existCheckData.items[0], journeyAudioContentKeyMap);
  }
  return null;
}
