import { InappNotificationSession } from '../../../../shared/hooks/useInappNotificationSession';

/**
 * The resources required to show the merge account feature but
 * which do not need to be shared with other features.
 */
export type MergeAccountResources = {
  /**
   * The in-app notification session, if it's been loaded, for this screen. Otherwise,
   * null
   */
  session: InappNotificationSession | null;

  /**
   * The given name of the user, if known
   */
  givenName: string | null;

  /**
   * The options that should be presented for logging in, null if still loading.
   */
  providerUrls: {
    Google: string | null;
    SignInWithApple: string | null;
    Direct: string | null;
    Dev: string | null;
  } | null;

  /**
   * May be called when mergeToken is null to set it to undefined in the confirm
   * merge feature. Used by the app and kept here for consistency.
   */
  onShowingSecureLogin: () => void;

  /**
   * May be called when mergeToken is undefined to set it to the given value in
   * the confirm merge feature. Used by the app and kept here for consistency.
   */
  onSecureLoginCompleted: (mergeToken: string | null) => void;

  /**
   * True if this is still loading more resources, false if the component
   * is ready to be mounted
   */
  loading: boolean;
};
