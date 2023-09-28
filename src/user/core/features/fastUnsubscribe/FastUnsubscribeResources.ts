import { ReactElement } from 'react';
import { SocialUrls } from '../../../login/LoginApp';
import { DailyReminders } from './FastUnsubscribeLoggedIn';

export type FastUnsubscribeVariant = 'logged-in' | 'logged-out';

/**
 * The resources required for displaying the fast unsubscribe screen
 */
export type FastUnsubscribeResources = {
  /**
   * The variant of the screen to show; undefined if it's still be determining,
   * null if the fast unsubscribe screen should not be shown
   */
  variant: FastUnsubscribeVariant | null | undefined;

  /**
   * The urls to use for signing in. Null if not showing sign in buttons,
   * undefined if still loading
   */
  socialUrls: SocialUrls | null | undefined;

  /**
   * If an error occurred loading the social urls, the error that occurred,
   * otherwise null. Undefined if still loading
   */
  socialUrlsError: ReactElement | null | undefined;

  /**
   * The daily reminders for the logged in user, undefined if still loading
   * or not needed.
   */
  dailyReminders: DailyReminders | undefined;

  /**
   * The link code that was clicked, which can be used to unsubscribe
   * an email address without logging in. Undefined if the fast unsubscribe
   * screen should not be shown
   */
  code: string | undefined;

  /**
   * A function that should be called when teh user dismisses the unsubscribe
   * screen.
   */
  onDismiss: () => void;

  /**
   * A function that should be called when the user clicks the "go to settings"
   * button
   */
  dismissAndGotoSettings: () => void;

  /**
   * True if we are still loading resources required for displaying the
   * fast unsubscribe screen, false otherwise
   */
  loading: boolean;
};
