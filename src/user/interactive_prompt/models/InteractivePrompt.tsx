import { CrudFetcherKeyMap } from '../../../admin/crud/CrudFetcher';
import { Prompt } from './Prompt';

/**
 * An interactive prompt describes some question/activity posed to the
 * user, and the user's response is tracked to form a time series of
 * events. These time series are normalized to all start at the same
 * time and the user sees the "ghosts" of all other users' responses
 * overlaid on their own, as well as potentially any other truly
 * live users.
 */
export type InteractivePrompt = {
  /**
   * The primary stable external identifier for the interactive prompt
   */
  uid: string;

  /**
   * A JWT that allows fetching information about the prompt and, when
   * combined with the session uid, allows the user to submit responses
   */
  jwt: string;

  /**
   * The primary stable external identifier for the session the user
   * can submit responses in
   */
  sessionUid: string;

  /**
   * The activity that the user is being prompted to do
   */
  prompt: Prompt;

  /**
   * How long the interactive portion of the prompt lasts, in seconds
   */
  durationSeconds: number;
};

/**
 * Maps the api response for an interactive prompt to our internal
 * representation
 */
export const interactivePromptKeyMap: CrudFetcherKeyMap<InteractivePrompt> = {
  session_uid: 'sessionUid',
  duration_seconds: 'durationSeconds',
};
