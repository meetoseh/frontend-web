import { InappNotification } from '../../../../shared/hooks/useInappNotification';
import { JourneyRef } from '../../../journey/models/JourneyRef';

/**
 * The state required to determine if the try ai journey prompt should be
 * shown, plus any state we want to share with other steps
 */
export type TryAIJourneyState = {
  /**
   * Information about the last time we saw this in-app notification, null
   * if it hasn't been loaded yet, undefined if it doesn't matter because
   * another limitation was already found (e.g., streak days is below 2)
   */
  ian: InappNotification | null | undefined;

  /**
   * The number of days in a row the user has been practicing. This particular
   * prompt only shows if they are on at least a 2 day streak. Null if still
   * loading, undefined if it doesn't matter (e.g., because this has been
   * shown too recently)
   */
  streakDays: number | null | undefined;

  /**
   * The journey that will be started if they select yes, null if it's still
   * loading, undefined if it's not needed because this shouldn't be shown
   * anyway. Checking this for undefined is the simplest way to determine if
   * this prompt should be shown
   */
  journey: JourneyRef | null | undefined;

  /**
   * Can be called to update our state to the given streak length in days,
   * useful for when the user completes a practice session as otherwise the
   * streak would not be refreshed until the page is refreshed
   *
   * @param streakDays The new streak length in days, or null if it should be
   *   fetched.
   */
  setStreakDays: (streakDays: number | null) => void;
};
