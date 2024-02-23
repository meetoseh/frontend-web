import { OsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';

export type SeriesPreviewResources = {
  /**
   * True if some resources are still being loaded, false if the screen is
   * ready to present.
   */
  loading: boolean;

  /**
   * The image handler we use for series previews; by storing this here,
   * we can more quickly load the page when the user navigates back to it.
   */
  imageHandler: OsehImageStateRequestHandler;
};
