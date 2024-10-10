import { CancelablePromise } from '../../../../../shared/lib/CancelablePromise';
import { RequestHandler, Result } from '../../../../../shared/requests/RequestHandler';
import { getJwtExpiration } from '../../../../../shared/lib/getJwtExpiration';
import {
  createVoiceNoteStateMachineForRemoteDownload,
  VoiceNoteStateMachine,
  VoiceNoteStateRemoteResources,
} from './createVoiceNoteStateMachine';
import { LoginContextValue } from '../../../../../shared/contexts/LoginContext';
import { InterestsContextProvidedValue } from '../../../../../shared/contexts/InterestsContext';

export type VoiceNoteStateMachineRef = {
  /** The UID of the voice note to get */
  voiceNoteUID: string;

  /** The JWT to access the remote voice note */
  voiceNoteJWT: string;
};

export type VoiceNoteStateMachineMinimalRef = Pick<VoiceNoteStateMachineRef, 'voiceNoteUID'>;

/**
 * Creates a request handler for a journal entry manager, which is an
 * object that can load the state of a journal entry chat
 */
export const createVoiceNoteStateMachineRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
  resources,
  loginContext,
  interestsContext,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
  /** the request handlers used for the audio data */
  resources: VoiceNoteStateRemoteResources;
  /** the login context to use */
  loginContext: LoginContextValue;
  /** the interests context to use */
  interestsContext: InterestsContextProvidedValue;
}): RequestHandler<
  VoiceNoteStateMachineMinimalRef,
  VoiceNoteStateMachineRef,
  VoiceNoteStateMachine
> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef: getDataFromRef(resources, loginContext, interestsContext),
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

const getRefUid = (ref: VoiceNoteStateMachineMinimalRef): string => ref.voiceNoteUID;
const getDataFromRef =
  (
    resources: VoiceNoteStateRemoteResources,
    loginContext: LoginContextValue,
    interestsContext: InterestsContextProvidedValue
  ) =>
  (ref: VoiceNoteStateMachineRef): CancelablePromise<Result<VoiceNoteStateMachine>> => {
    const state = createVoiceNoteStateMachineForRemoteDownload({
      voiceNote: {
        uid: ref.voiceNoteUID,
        jwt: ref.voiceNoteJWT,
      },
      resources,
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
const compareRefs = (a: VoiceNoteStateMachineRef, b: VoiceNoteStateMachineRef): number =>
  getJwtExpiration(b.voiceNoteJWT) - getJwtExpiration(a.voiceNoteJWT);
