import { CancelablePromise } from '../../../../../shared/lib/CancelablePromise';
import { RequestHandler, Result } from '../../../../../shared/requests/RequestHandler';
import { getJwtExpiration } from '../../../../../shared/lib/getJwtExpiration';
import { LoginContextValue } from '../../../../../shared/contexts/LoginContext';
import { InterestsContextProvidedValue } from '../../../../../shared/contexts/InterestsContext';
import {
  createJournalEntryStateMachine,
  JournalEntryStateMachine,
} from './createJournalEntryStateMachine';

export type JournalEntryStateMachineRef = {
  /** The UID of the journal entry to sync */
  journalEntryUID: string;

  /** The JWT to access the journal entry */
  journalEntryJWT: string;
};

export type JournalEntryStateMachineMinimalRef = Pick<
  JournalEntryStateMachineRef,
  'journalEntryUID'
>;

/**
 * Creates a request handler for a journal entry state machine, which is an
 * object that makes its state visible and can be passed messages to transition
 * between states.
 */
export const createJournalEntryStateMachineRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
  loginContext,
  interestsContext,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
  /** the login context to use */
  loginContext: LoginContextValue;
  /** the interests context to use */
  interestsContext: InterestsContextProvidedValue;
}): RequestHandler<
  JournalEntryStateMachineMinimalRef,
  JournalEntryStateMachineRef,
  JournalEntryStateMachine
> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef: getDataFromRef(loginContext, interestsContext),
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
    cleanupData: (data) => {
      if (data.state.get().type !== 'released') {
        data.sendMessage({ type: 'release' });
      }
    },
  });
};

const getRefUid = (ref: JournalEntryStateMachineMinimalRef): string => ref.journalEntryUID;
const getDataFromRef =
  (loginContext: LoginContextValue, interestsContext: InterestsContextProvidedValue) =>
  (ref: JournalEntryStateMachineRef): CancelablePromise<Result<JournalEntryStateMachine>> => {
    const state = createJournalEntryStateMachine({
      journalEntry: { uid: ref.journalEntryUID, jwt: ref.journalEntryJWT },
      loginContext,
      visitor: interestsContext.visitor,
    });
    return {
      promise: Promise.resolve({
        type: 'success',
        data: state,
        error: undefined,
        retryAt: undefined,
      }),
      done: () => true,
      cancel: () => {},
    };
  };
const compareRefs = (a: JournalEntryStateMachineRef, b: JournalEntryStateMachineRef): number =>
  getJwtExpiration(b.journalEntryJWT) - getJwtExpiration(a.journalEntryJWT);
