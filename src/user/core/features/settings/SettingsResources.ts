import { ReactElement } from 'react';
import { IdentitiesState } from './hooks/useIdentities';

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

  /**
   * The users identities. May be in an errored state, but won't be loading
   * unless loading is true.
   */
  identities: IdentitiesState;

  /**
   * A function which can be called to change to the edit notification
   * times screen.
   */
  gotoEditReminderTimes: () => void;

  /**
   * A function which can be called to change to the history screen
   */
  gotoMyLibrary: () => void;
};
