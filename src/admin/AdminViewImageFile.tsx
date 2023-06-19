import { CSSProperties, ReactElement, useEffect, useState } from 'react';
import { apiFetch } from '../shared/ApiConstants';
import { useOsehImageStateRequestHandler } from '../shared/images/useOsehImageStateRequestHandler';
import { OsehImageRef } from '../shared/images/OsehImageRef';
import { OsehImage } from '../shared/images/OsehImage';

export const AdminViewImageFile = (): ReactElement => {
  const [uid, setUid] = useState<string>('');
  const [width, setWidth] = useState<number>(393);
  const [height, setHeight] = useState<number>(852);
  const [imgRef, setImgRef] = useState<OsehImageRef | null>(null);
  const imageHandler = useOsehImageStateRequestHandler({});

  useEffect(() => {
    let active = true;
    fetchImageRef();
    return () => {
      active = false;
    };

    async function fetchImageRef() {
      if (uid === '') {
        return;
      }

      const response = await apiFetch(
        `/api/1/image_files/dev_show/${uid}`,
        { method: 'GET' },
        null
      );

      if (!active) {
        return;
      }
      if (!response.ok) {
        const text = await response.text();
        if (!active) {
          return;
        }
        console.error("Couldn't fetch image file", response, text);
        return;
      }

      const data = await response.json();
      if (!active) {
        return;
      }

      setImgRef(data);
    }
  }, [uid]);

  return (
    <div style={STYLES.form}>
      <div style={STYLES.formGroup}>
        <label>Image File UID</label>
        <input type="text" value={uid} onChange={(e) => setUid(e.target.value)} />
      </div>
      <div style={STYLES.formGroup}>
        <label>Width</label>
        <input type="number" value={width} onChange={(e) => setWidth(e.target.valueAsNumber)} />
      </div>
      <div style={STYLES.formGroup}>
        <label>Height</label>
        <input type="number" value={height} onChange={(e) => setHeight(e.target.valueAsNumber)} />
      </div>
      {imgRef && (
        <OsehImage
          uid={imgRef.uid}
          jwt={imgRef.jwt}
          displayWidth={width}
          displayHeight={height}
          alt="Requested"
          handler={imageHandler}
        />
      )}
    </div>
  );
};

const STYLES: { [name: string]: CSSProperties } = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    maxWidth: '400px',
    marginBottom: '40px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
};
