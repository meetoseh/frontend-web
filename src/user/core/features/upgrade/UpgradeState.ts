import { UpgradeContext } from './UpgradeContext';

/**
 * The state required to decide if the upgrade screen should be shown
 * and any state we want to share with other features
 */
export type UpgradeState = {
  /**
   * If this screen wants to be shown, the upgrade context. null if this
   * screen doesn't want to be shown, undefined if that is still being
   * determined
   */
  context: UpgradeContext | undefined | null;

  /**
   * Can be called to set the context for the upgrade screen if it's
   * not loading.
   * @param context The context to set
   * @param updateWindowHistory true if the window history should be
   *   updated, false otherwise.
   */
  setContext: (context: UpgradeContext | null, updateWindowHistory: boolean) => void;
};
