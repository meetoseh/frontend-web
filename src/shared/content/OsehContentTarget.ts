import { ReactElement } from 'react';
import { CrudFetcherMapper, convertUsingMapper } from '../../admin/crud/CrudFetcher';
import { OsehContentRefLoadable } from './OsehContentRef';

/**
 * Describes the meta-information on a web export of a content file.
 */
export type ContentFileWebExport = {
  /**
   * The url where the mp4 can be downloaded
   */
  url: string;
  format: 'mp4';
  /**
   * The average bandwidth of the mp4 file, in bits per second.
   */
  bandwidth: number;
  codecs: string[];
  /**
   * The size of the mp4 file, in bytes.
   */
  fileSize: number;
  /**
   * What quality parameters were used to generate this export, which may
   * have influenced why this export was selected.
   */
  qualityParameters: any;
  /**
   * What format parameters describe this export, which may have influenced
   * why this export was selected.
   */
  formatParameters: any;
};

export const contentFileWebExportKeyMap: CrudFetcherMapper<ContentFileWebExport> = {
  file_size: 'fileSize',
  quality_parameters: 'qualityParameters',
  format_parameters: 'formatParameters',
};

/**
 * Describes a single content file export, but keeping track of the playlist it belongs to
 */
export type ContentFileWebExportRef = {
  /** The playlist the web export is part of */
  playlistRef: OsehContentRefLoadable;
  /** The actual web export to download */
  target: ContentFileWebExport;
  /** True if the target url is already presigned, false if not */
  presigned: boolean;
};

export type VideoFileData = {
  element: HTMLVideoElement;
  /** Width in physical pixels of the underlying content, if known */
  width?: number;
  /** Height in physical pixels of the underlying content, if known */
  height?: number;
};

export type AudioFileData = {
  element: HTMLAudioElement;
};

/**
 * Describes what a OsehContentRef can be converted to for the
 * web via an api request
 */
export type OsehAPIContentPlaylist = {
  /**
   * The exports that are available for the content
   */
  exports: ContentFileWebExport[];
  /**
   * The duration of each export in seconds (they should all be the same,
   * as they are just different encodings of the same content)
   */
  durationSeconds: number;
};

export const osehAPIContentPlaylistMapper: CrudFetcherMapper<OsehAPIContentPlaylist> = {
  exports: (_, v: any[]) => ({
    key: 'exports',
    value: v.map((i) => convertUsingMapper(i, contentFileWebExportKeyMap)),
  }),
  duration_seconds: 'durationSeconds',
};

/** Describes what we typically map a content ref to, which keeps track of the ref */
export type OsehContentPlaylist = {
  /** The ref that was loaded */
  ref: OsehContentRefLoadable;

  /** The underlying playlist */
  playlist: OsehAPIContentPlaylist;

  /** True if this playlist is presigned, false otherwise */
  presigned: boolean;
};

/**
 * Describes a loading, loaded, or failed-to-load target for a content file. This,
 * in particular, is used to decide where we can download the actual content file.
 * For the web, for maximum browser support we download a json file which tells us
 * where all the available files are, then select one from there. For native apps
 * the m3u8 file will already include that information, so this skips straight
 * to the loaded state.
 */
export type OsehContentTarget =
  | {
      /**
       * A discriminatory field to indicate if we're loading, loaded, or failed.
       */
      state: 'loading';
      /**
       * Null unless failed, in which case this is a ReactElement which can be
       * displayed to describe the failure.
       */
      error: null;
      /**
       * Null unless loaded, in which case this is the web export of the content
       * file. Note that on frontend-app this is replaced with nativeExport which
       * points to an m3u8 file.
       */
      webExport: null;
      /**
       * True if the content file urls have been presigned and thus can be played
       * without custom headers, false if presigning via the jwt is required.
       */
      presigned: null;
      /**
       * The jwt that provides access to the content file either via a query parameter
       * or via a bearer token. If presigned, this jwt is already embedded in the url,
       * but it will be included here regardless.
       */
      jwt: null;
    }
  | {
      state: 'loaded';
      error: null;
      webExport: ContentFileWebExport;
      presigned: boolean;
      jwt: string;
    }
  | { state: 'failed'; error: ReactElement; webExport: null; presigned: null; jwt: null };
