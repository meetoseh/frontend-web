import { CSSProperties, ReactElement, useEffect, useState } from 'react';
import { apiFetch, HTTP_API_URL } from '../shared/ApiConstants';

type ContentFileRef = {
  uid: string;
  jwt: string;
};

type ContentFileWebExport = {
  url: string;
  format: 'mp4';
  bandwidth: number;
  codecs: Array<'aac'>;
  fileSize: number;
  qualityParameters: any;
};

export const AdminViewContentFile = (): ReactElement => {
  const [uid, setUid] = useState<string>('');
  const [contentRef, setContentRef] = useState<ContentFileRef | null>(null);
  const [webExport, setWebExport] = useState<ContentFileWebExport | null>(null);

  useEffect(() => {
    let active = true;
    fetchContentRef();
    return () => {
      active = false;
    };

    async function fetchContentRef() {
      if (uid === '') {
        return;
      }

      const response = await apiFetch(
        `/api/1/content_files/dev_show/${uid}`,
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
        console.error("Couldn't fetch content file", response, text);
        return;
      }

      const data = await response.json();
      if (!active) {
        return;
      }

      setContentRef(data);
    }
  }, [uid]);

  useEffect(() => {
    let active = true;
    fetchWebExport();
    return () => {
      active = false;
    };

    async function fetchWebExport() {
      if (!contentRef) {
        return;
      }

      const response = await fetch(
        `${HTTP_API_URL}/api/1/content_files/${contentRef.uid}/web.json?presign=1`,
        {
          headers: {
            Authorization: `bearer ${contentRef.jwt}`,
          },
        }
      );
      if (!active) {
        return;
      }

      if (!response.ok) {
        const text = await response.text();
        if (!active) {
          return;
        }
        console.error("Couldn't fetch web export", response, text);
        return;
      }

      const data = await response.json();
      if (!active) {
        return;
      }
      const exports: Array<ContentFileWebExport> = data.exports;

      const biggestExport = exports.reduce((a, b) => {
        return a.fileSize > b.fileSize ? a : b;
      }, exports[0]);
      setWebExport(biggestExport);
    }
  }, [contentRef]);

  return (
    <div style={STYLES.form}>
      <div style={STYLES.formGroup}>
        <label>Content File UID</label>
        <input type="text" value={uid} onChange={(e) => setUid(e.target.value)} />
      </div>
      {webExport && (
        <audio controls>
          <source src={webExport.url} type="audio/mp4" />
        </audio>
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
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
};
