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
  codecs: string[];
  fileSize: number;
  qualityParameters: any;
  formatParameters: any;
};

export const AdminViewContentFile = (): ReactElement => {
  const [uid, setUid] = useState<string>('');
  const [contentRef, setContentRef] = useState<ContentFileRef | null>(null);
  const [webExport, setWebExport] = useState<ContentFileWebExport | null>(null);
  const [androidPlaylist, setAndroidPlaylist] = useState<string | null>(null);
  const [androidVod, setAndroidVod] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchContentRef();
    return () => {
      active = false;
    };

    async function fetchContentRef() {
      setContentRef(null);

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
      setWebExport(null);

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
      const exports: Array<ContentFileWebExport> = (data.exports as any[]).map((v) => ({
        url: v.url,
        format: v.format,
        bandwidth: v.bandwidth,
        codecs: v.codecs,
        fileSize: v.file_size,
        qualityParameters: v.quality_parameters,
        formatParameters: v.format_parameters,
      }));

      const biggestExport = exports.reduce((a, b) => {
        return a.fileSize > b.fileSize ? a : b;
      }, exports[0]);
      setWebExport(biggestExport);
    }
  }, [contentRef]);

  useEffect(() => {
    let active = true;
    fetchAndroidPlaylist();
    return () => {
      active = false;
    };

    async function fetchAndroidPlaylist() {
      setAndroidPlaylist(null);

      if (!contentRef) {
        return;
      }

      const response = await fetch(
        `${HTTP_API_URL}/api/1/content_files/${contentRef.uid}/android.m3u8?presign=1`,
        {
          headers: {
            Authorization: `bearer ${contentRef.jwt}`,
          },
        }
      );
      if (!active) {
        return;
      }
      const text = await response.text();
      if (!active) {
        return;
      }
      if (!response.ok) {
        console.error("Couldn't fetch android playlist", response, text);
        return;
      }

      setAndroidPlaylist(text);
    }
  }, [contentRef]);

  useEffect(() => {
    let active = true;
    fetchAndroidVod();
    return () => {
      active = false;
    };

    async function fetchAndroidVod() {
      setAndroidVod(null);

      if (!androidPlaylist) {
        return;
      }

      const firstVodUrl = androidPlaylist
        .split('\n')
        .find((line) => line.length > 0 && !line.startsWith('#'));
      if (!firstVodUrl) {
        console.error('failed to find an android vod url');
        return;
      }

      const response = await fetch(firstVodUrl);
      if (!active) {
        return;
      }

      const text = await response.text();
      if (!active) {
        return;
      }
      if (!response.ok) {
        console.error("Couldn't fetch android vod", response, text);
        return;
      }

      setAndroidVod(text);
    }
  }, [androidPlaylist]);

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
      {androidPlaylist !== null && (
        <div style={STYLES.formGroup}>
          <label>Android Playlist (~{androidPlaylist.length.toLocaleString()} bytes):</label>
          <pre style={{ overflowX: 'auto' }}>{androidPlaylist}</pre>
        </div>
      )}
      {androidVod !== null && (
        <div style={STYLES.formGroup}>
          <label>Android Vod (~{androidVod.length.toLocaleString()} bytes):</label>
          <pre style={{ overflowX: 'auto' }}>{androidVod}</pre>
        </div>
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
