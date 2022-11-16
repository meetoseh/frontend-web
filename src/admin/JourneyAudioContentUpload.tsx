import { ReactElement, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../shared/ApiConstants';
import { LoginContext } from '../shared/LoginContext';
import { FileUploadHandler, parseUploadInfoFromResponse } from '../shared/upload/FileUploadHandler';

/**
 * Shows a file selector. When they select a file, it starts a journey audio
 * content upload, then uploads the file there.
 *
 * Requires a login context
 */
export const JourneyAudioContentUpload = (): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [file, setFile] = useState<File | null>(null);
  const [upload, setUpload] = useState<ReactElement | null>(null);

  useEffect(() => {
    let active = true;
    startUpload();
    return () => {
      active = false;
    };

    async function startUpload() {
      setUpload(null);
      if (file === null) {
        return;
      }

      const response = await apiFetch(
        '/api/1/journeys/audio_contents/',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=UTF-8' },
          body: JSON.stringify({
            file_size: file.size,
          }),
        },
        loginContext
      );
      if (!active) {
        return;
      }
      if (!response.ok) {
        const text = await response.text();
        if (!active) {
          return;
        }
        console.error("Couldn't start journey audio content upload", response, text);
        return;
      }

      const data = await response.json();
      if (!active) {
        return;
      }

      setUpload(
        <FileUploadHandler
          file={file}
          uploadInfo={parseUploadInfoFromResponse(data)}
          onComplete={() => {
            if (active) {
              setFile(null);
            }
          }}
        />
      );
    }
  }, [file, loginContext]);

  if (loginContext.state !== 'logged-in') {
    return <></>;
  }
  return (
    upload ?? (
      <form style={styles.form}>
        <label style={styles.label}>Select Audio Content</label>
        <input
          style={styles.input}
          type="file"
          onChange={(e) => setFile(e.target.files?.item(0) ?? null)}
        />
      </form>
    )
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '20px',
  },
  label: {},
  input: {},
};
