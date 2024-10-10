import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { RequestResult } from '../../../../shared/requests/RequestHandler';
import { ScreenResources } from '../../models/Screen';
import { VoiceNoteStateMachine } from '../journal_chat/lib/createVoiceNoteStateMachine';

export type JournalReflectionResponseResponseAvailable = {
  type: 'available';
  data:
    | { type: 'text'; value: string }
    | { type: 'voice'; request: RequestResult<VoiceNoteStateMachine> };
};
export type JournalReflectionResponseResponseLoading = { type: 'loading' };
export type JournalReflectionResponseResponseError = { type: 'error' };
export type JournalReflectionResponseResponse =
  | JournalReflectionResponseResponseAvailable
  | JournalReflectionResponseResponseLoading
  | JournalReflectionResponseResponseError;

export type JournalReflectionResponseResources = ScreenResources & {
  /**
   * The current reflection question; null while loading, undefined if an error
   * occurred. Provided as a series of paragraphs.
   */
  question: ValueWithCallbacks<{ entryCounter: number; paragraphs: string[] } | null | undefined>;

  /**
   * The value which should be filled in the response input. There are
   * necessarily two logical ways to set this value: when the user enters
   * something (which can happen very quickly) and when getting new information
   * from the saved response. However, the saved response can happen multiple
   * times seeming "randomly" due to autosaving, network interruptions, etc.
   * Thus, resolving the changes naively leads to lots of undesirable behavior
   * (generally of the category of the users cursor being moved or their text
   * reverting to a recent state).
   *
   * Thus, to avoid this and for consistency on the web and native, the screen
   * is only responsible for sending the response input via updateResponse and
   * receiving the response input via this value.
   */
  response: ValueWithCallbacks<JournalReflectionResponseResponse>;

  /**
   * Should be called whenever the users response changes. This is guarranteed
   * to update responseInput before returning if the input is accepted at all.
   *
   * The user input is accepted unless "ensureSaved" is currently running.
   */
  onUserChangedResponse: (
    userResponse:
      | { type: 'text'; value: string }
      | { type: 'voice'; voiceNote: VoiceNoteStateMachine }
  ) => void;

  /**
   * Immediately prevents additional calls to onUserChangedResponse and returns
   * a promise that is not resolved until the responseInput is saved on the
   * server and matches `savedResponse`. May reject if a network error occurs,
   * in which case the responseInput will be unchanged and the error should be
   * shown to the user, and they should be allowed to retry or cancel.
   */
  ensureSaved: () => Promise<void>;
};
