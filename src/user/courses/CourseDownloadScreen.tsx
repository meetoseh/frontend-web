import { ReactElement, useMemo, useState } from 'react';
import styles from './CourseDownloadScreen.module.css';
import { OsehImage } from '../../shared/images/OsehImage';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { Button } from '../../shared/forms/Button';
import { useSingletonEffect } from '../../shared/lib/useSingletonEffect';
import { apiFetch } from '../../shared/ApiConstants';
import { SplashScreen } from '../splash/SplashScreen';
import { useOsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { BoxError, DisplayableError } from '../../shared/lib/errors';

type CourseRef = {
  uid: string;
  jwt: string;
};

/**
 * The stable url the user lands on to download a course. A code should
 * be included in the query parameter `code` which is used to get the
 * course ref from the server, which can then be downloaded when the
 * user clicks "Download".
 */
export const CourseDownloadScreen = (): ReactElement => {
  const code = useMemo<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('code');
  }, []);
  const [downloadLink, setDownloadLink] = useState<string | null>(null);
  const [error, setError] = useState<DisplayableError | null>(null);
  const imageHandler = useOsehImageStateRequestHandler({});
  const windowSize = useWindowSize();

  useSingletonEffect(
    (onDone) => {
      if (code === null) {
        setError(
          new DisplayableError(
            'client',
            'fetch download link',
            'no code provided in query parameters'
          )
        );
        onDone();
        return;
      }

      let active = true;
      fetchDownloadLink();
      return () => {
        active = false;
      };

      async function fetchDownloadLinkInner() {
        const response = await apiFetch(
          '/api/1/courses/start_download_with_code',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ code }),
          },
          null
        );

        if (!response.ok) {
          throw response;
        }

        const ref: CourseRef = await response.json();

        const downloadResponse = await apiFetch(
          `/api/1/courses/download/${ref.uid}.zip`,
          {
            method: 'GET',
            headers: { Authorization: `bearer ${ref.jwt}` },
          },
          null
        );

        if (!downloadResponse.ok) {
          throw downloadResponse;
        }

        const blob = await downloadResponse.blob();
        const url = URL.createObjectURL(blob);
        if (active) {
          setDownloadLink(url);
        }
      }

      async function fetchDownloadLink() {
        try {
          await fetchDownloadLinkInner();
        } catch (e) {
          const error =
            e instanceof DisplayableError
              ? e
              : new DisplayableError('client', 'fetch download link', `${e}`);
          if (active) {
            setError(error);
          }
        } finally {
          onDone();
        }
      }
    },
    [code]
  );

  console.log('downloadLink', downloadLink);

  if (error === null && downloadLink === null) {
    return <SplashScreen type="wordmark" />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImage
          uid="oseh_if_0ykGW_WatP5-mh-0HRsrNw"
          jwt={null}
          displayWidth={windowSize.width}
          displayHeight={windowSize.height}
          alt=""
          isPublic={true}
          placeholderColor="#01181e"
          handler={imageHandler}
        />
      </div>
      <div className={styles.innerContainer}>
        <div className={styles.primaryContainer}>
          {error !== null ? (
            <div style={{ marginBottom: '40px' }}>
              <BoxError error={error} />
            </div>
          ) : (
            <>
              <div className={styles.download} />
              <div className={styles.title}>Download all classes by clicking the button below</div>
            </>
          )}
          <Button
            type="button"
            variant="filled"
            onClick={error === null ? downloadLink ?? '#' : '/'}
            download={downloadLink !== null ? true : undefined}
            fullWidth>
            {error === null ? <>Download Now</> : <>Back to Safety</>}
          </Button>
        </div>
      </div>
    </div>
  );
};
