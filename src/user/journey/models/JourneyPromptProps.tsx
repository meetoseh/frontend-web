import { LoginContextValue } from '../../../shared/LoginContext';
import { JourneyTime } from '../hooks/useJourneyTime';
import { JourneyStats } from '../hooks/useStats';
import { Prompt } from '../Journey';

/**
 * The standard props for the various styles of journey prompts.
 *
 * NOTE:
 *   This is here to avoid circular imports in the various prompt components.
 *   Specifically, JourneyPrompt references the individual ones (since its job
 *   is to select which component to use), and the individual ones reference
 *   the JourneyPromptProps (since they need to know what props to take)
 */
export type JourneyPromptProps = {
  /**
   * The UID of the journey to show the prompt of
   */
  journeyUid: string;
  /**
   * The JWT for adding events to the journey if the user responds to the
   * prompt
   */
  journeyJwt: string;
  /**
   * The session to add events to if the user responds to the prompt
   */
  sessionUid: string;
  /**
   * The meta-information on the prompt, i.e., its style and answer options
   */
  prompt: Prompt;
  /**
   * The statistics, linearly interpolated, to use to show how other users
   * are responding to the prompt
   */
  stats: JourneyStats;
  /**
   * The length of the journey in seconds, to prevent sending events after
   * the journey has ended
   */
  journeyDurationSeconds: number;
  /**
   * The mutable object that keeps track of the current journey time, so
   * that we can tell the server when the user responds to the prompt
   */
  journeyTime: JourneyTime;
  /**
   * The current login context to use if the user responds to the prompt
   */
  loginContext: LoginContextValue;
};
