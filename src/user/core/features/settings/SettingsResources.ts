import { ReactElement } from 'react';

/**
 * The resources required to display the settings screen
 */
export type SettingsResources = {
  /**
   * True if some resources are still being loaded, false if the screen is
   * ready to present.
   */
  loading: boolean;

  /**
   * If an error is preventing resources from being loaded, the error to
   * show, otherwise null.
   *
   * If the error is set, loading will be false but other resources may
   * still be in their unloaded state.
   */
  loadError: ReactElement | null;

  /**
   * True if the user has oseh pro, false if they don't, undefined if we
   * don't know yet.
   */
  havePro: boolean | undefined;
};
