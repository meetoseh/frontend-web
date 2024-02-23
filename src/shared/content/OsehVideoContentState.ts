import { ReactElement } from 'react';

export type OsehVideoContentStateLoading = {
  state: 'loading';
  play: null;
  stop: null;
  loaded: false;
  error: null;
  video: null;
};

export type OsehVideoContentStateError = {
  state: 'error';
  play: null;
  stop: null;
  loaded: false;
  /**
   * An element describing the error that occurred while loading the video.
   */
  error: ReactElement;
  video: null;
};

export type OsehVideoContentStateLoaded = {
  state: 'loaded';
  /**
   * A function that can be used to play the video, if the video is ready to
   * be played, otherwise null. Note that play() is privileged, meaning that
   * it must be called _immediately_ after a user interaction
   */
  play: (this: void) => Promise<void>;

  /**
   * A function that can be used to stop the video, if the video is playing.
   */
  stop: (this: void) => Promise<void>;

  /**
   * A convenience boolean which is true if the video is ready to be played.
   * This is equivalent to (play !== null), but more semantically meaningful.
   */
  loaded: true;

  error: null;

  /**
   * A reference to the underlying video element. This needs to be rendered, and
   * is useful for more advanced use cases.
   */
  video: HTMLVideoElement;
};

/**
 * Describes a loading or loaded video content file. This can be played or stopped.
 * On the web, playing or stopping requires a privileged context.
 */
export type OsehVideoContentState =
  | OsehVideoContentStateLoading
  | OsehVideoContentStateError
  | OsehVideoContentStateLoaded;
