import { InappNotification } from '../../../../shared/hooks/useInappNotification';

export type MergeProvider = 'SignInWithApple' | 'Google' | 'Direct' | 'Dev';

export type MergeSuggestion = {
  /**
   * The provider that, if the user logs in with, they may be able
   * to authenticate a merge with their existing account.
   */
  provider: MergeProvider;
};

/**
 * The state required to determine if the MergeAccount feature
 * should be displayed as well as any data that may be needed
 * by other features
 */
export type MergeAccountState = {
  /**
   * If we should suggest they try logging in using other providers,
   * the providers to suggest.
   *
   * If we should not suggest they try logging in using other providers,
   * null.
   *
   * If we are still determining, undefined.
   */
  mergeSuggestions: MergeSuggestion[] | null | undefined;

  /**
   * The in-app notification for this screen or null if it hasn't been
   * loaded yet. Note that may not bother loading the notification
   * if we know we will not show the feature based on mergeSuggestions.
   */
  ian: InappNotification | null;

  /**
   * A function that should be called after the user handles the
   * merge suggestions.
   */
  onSuggestionsDismissed: () => Promise<void>;
};
