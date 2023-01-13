import { ReactElement, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../../shared/ApiConstants';
import { computeFileSha512 } from '../../shared/computeFileSha512';
import { describeErrorFromResponse, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { LoginContext, LoginContextValue } from '../../shared/LoginContext';
import {
  FileUploadHandler,
  parseUploadInfoFromResponse,
  UploadInfo,
} from '../../shared/upload/FileUploadHandler';
import { convertUsingKeymap } from '../crud/CrudFetcher';
import { JourneyBackgroundImage } from './background_images/JourneyBackgroundImage';
import { keyMap as journeyBackgroundImageKeyMap } from './background_images/JourneyBackgroundImages';
import styles from './CreateJourneyUploadAudioContent.module.css';

type CreateJourneyUploadBackgroundImageProps = {
  /**
   * Called when the user has uploaded a new background image
   */
  onUploaded: (this: void, image: JourneyBackgroundImage) => void;
};

export const CreateJourneyUploadBackgroundImage = ({
  onUploaded,
}: CreateJourneyUploadBackgroundImageProps): ReactElement => {
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
          console.log('Found matching existing image file', existing);
          setUploadState('picking-file');
          onUploaded(existing);
          return;
        }
      } catch (e) {
        if (!active) {
          return;
        }

        if (e instanceof TypeError) {
          console.error(e);
          setError(<>Unable to connect to server. Check your internet connection.</>);
          setUploadState('picking-file');
          return;
        }

        if (e instanceof Response) {
          const err = await describeErrorFromResponse(e);
          if (!active) {
            return;
          }

          setError(err);
          setUploadState('picking-file');
          return;
        }

        console.error(e);
        setError(<>Unknown error.</>);
        setUploadState('picking-file');
        return;
      }

      let response: Response;
      try {
        response = await apiFetch(
          '/api/1/journeys/background_images/',
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

        if (e instanceof TypeError) {
          console.error('assuming network error: ', e);
          setError(<>Unable to connect to server. Check your internet connection.</>);
          setUploadState('picking-file');
          return;
        }

        if (e instanceof Response) {
          const err = await describeErrorFromResponse(e);
          if (!active) {
            return;
          }

          setError(err);
          setUploadState('picking-file');
          return;
        }

        console.error(e);
        setError(<>An unexpected error occurred while uploading. Contact support.</>);
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
            console.log('Found matching image file content', found);
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
          Our servers will crop the image into many different resolutions and will compress each
          crop into many different formats. Each user will only download the best possible file and
          format for their device and network conditions. In order to get the correct aspect ratio
          for each export, the server will crop toward the center. There are three primary aspect
          ratios to consider:
        </p>

        <ol>
          <li>
            mobile: around <strong>2:1</strong>
          </li>
          <li>
            share to instagram: <strong>9:16</strong>
          </li>
          <li>
            desktop: around <strong>16:9</strong>
          </li>
        </ol>

        <p>
          The minimum resolution is 1920x1920, to accomodate 1920x1080 desktop and 1080x1920 share
          to instagram. The highest quality available image should be uploaded to minimize
          compression artifacts.
        </p>
      </div>

      <div className={styles.fileInputContainer}>
        <input
          type="file"
          className={styles.fileInput}
          accept="image/*"
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
): Promise<JourneyBackgroundImage | null> {
  const response = await apiFetch(
    '/api/1/journeys/background_images/search',
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
    return convertUsingKeymap(existCheckData.items[0], journeyBackgroundImageKeyMap);
  }
  return null;
}
