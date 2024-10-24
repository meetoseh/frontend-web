import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import { createMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import {
  createWritableValueWithCallbacks,
  ValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../../shared/lib/CancelablePromise';
import { createCancelableTimeout } from '../../../../shared/lib/createCancelableTimeout';
import { DisplayableError } from '../../../../shared/lib/errors';
import { getCurrentServerTimeMS } from '../../../../shared/lib/getCurrentServerTimeMS';
import { mapCancelable } from '../../../../shared/lib/mapCancelable';
import { SCREEN_VERSION } from '../../../../shared/lib/screenVersion';
import { setVWC } from '../../../../shared/lib/setVWC';
import { waitForValueWithCallbacksConditionCancelable } from '../../../../shared/lib/waitForValueWithCallbacksCondition';
import { RequestResult, Result } from '../../../../shared/requests/RequestHandler';
import { unwrapRequestResult } from '../../../../shared/requests/unwrapRequestResult';
import { OsehScreen } from '../../models/Screen';
import { screenConfigurableTriggerMapper } from '../../models/ScreenConfigurableTrigger';
import { VoiceNoteStateMachine } from '../journal_chat/lib/createVoiceNoteStateMachine';
import {
  JournalChatState,
  JournalEntryItemData,
  JournalEntryItemTextualPartVoiceNote,
} from '../journal_chat/lib/JournalChatState';
import { JournalReflectionResponse } from './JournalReflectionResponse';
import {
  JourneyReflectionResponseAPIParams,
  JourneyReflectionResponseMappedParams,
} from './JournalReflectionResponseParams';
import {
  JournalReflectionResponseResources,
  JournalReflectionResponseResponse,
} from './JournalReflectionResponseResources';
import * as JEStateMachine from '../journal_chat/lib/createJournalEntryStateMachine';
import { JournalEntryStateMachineRef } from '../journal_chat/lib/createJournalEntryStateMachineRequestHandler';
import { VISITOR_SOURCE } from '../../../../shared/lib/visitorSource';
import { createTypicalSmartAPIFetchMapper } from '../../../../shared/lib/smartApiFetch';

/**
 * Shows the last journal reflection question and allows the user to respond
 * to it.
 */
export const JournalReflectionResponseScreen: OsehScreen<
  'journal_reflection_response',
  JournalReflectionResponseResources,
  JourneyReflectionResponseAPIParams,
  JourneyReflectionResponseMappedParams
> = {
  slug: 'journal_reflection_response',
  paramMapper: (api) => ({
    entrance: api.entrance,
    header: api.header,
    add: api.add,
    edit: api.edit,
    journalEntry: api.journal_entry,
    cta: {
      text: api.cta.text,
      trigger: convertUsingMapper(api.cta.trigger, screenConfigurableTriggerMapper),
      exit: api.cta.exit,
    },
    close: {
      variant: api.close.variant,
      trigger: convertUsingMapper(api.close.trigger, screenConfigurableTriggerMapper),
      exit: api.close.exit,
    },
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const activeVWC = createWritableValueWithCallbacks(true);

    const getJournalEntryManager = (): RequestResult<JEStateMachine.JournalEntryStateMachine> => {
      if (screen.parameters.journalEntry === null) {
        return {
          data: createWritableValueWithCallbacks({
            type: 'error',
            data: undefined,
            error: new DisplayableError('server-refresh-required', 'journal entry not provided'),
            retryAt: undefined,
          }),
          release: () => {},
        };
      }

      return ctx.resources.journalEntryStateMachineHandler.request({
        ref: {
          journalEntryUID: screen.parameters.journalEntry.uid,
          journalEntryJWT: screen.parameters.journalEntry.jwt,
        },
        refreshRef: (): CancelablePromise<Result<JournalEntryStateMachineRef>> => {
          if (!activeVWC.get()) {
            return {
              promise: Promise.resolve({
                type: 'expired',
                data: undefined,
                error: new DisplayableError('server-refresh-required', 'screen is not mounted'),
                retryAt: undefined,
              }),
              done: () => true,
              cancel: () => {},
            };
          }

          return mapCancelable(
            refreshScreen(),
            (s): Result<JournalEntryStateMachineRef> =>
              s.type !== 'success'
                ? s
                : s.data.parameters.journalEntry === null
                ? {
                    type: 'error',
                    data: undefined,
                    error: new DisplayableError(
                      'server-refresh-required',
                      'journal entry not provided'
                    ),
                    retryAt: undefined,
                  }
                : {
                    type: 'success',
                    data: {
                      journalEntryUID: s.data.parameters.journalEntry.uid,
                      journalEntryJWT: s.data.parameters.journalEntry.jwt,
                    },
                    error: undefined,
                    retryAt: undefined,
                  }
          );
        },
      });
    };

    const journalEntryManagerVWC =
      createWritableValueWithCallbacks<RequestResult<JEStateMachine.JournalEntryStateMachine> | null>(
        null
      );
    const cleanupJournalEntryManagerRequester = (() => {
      const request = getJournalEntryManager();
      setVWC(journalEntryManagerVWC, request);
      return () => {
        if (Object.is(journalEntryManagerVWC.get(), request)) {
          setVWC(journalEntryManagerVWC, null);
        }
        request.release();
      };
    })();
    const [journalEntryManagerUnwrappedVWC, cleanupJournalEntryManagerUnwrapper] =
      unwrapRequestResult(
        journalEntryManagerVWC,
        (d) => d.data,
        () => null
      );

    const [journalEntryStateUnwrappedVWC, cleanupJournalEntryStateUnwrapper] = (() => {
      const result = createWritableValueWithCallbacks<JEStateMachine.State | null>(null);
      const cleanup = createValueWithCallbacksEffect(journalEntryManagerUnwrappedVWC, (d) => {
        if (d === null) {
          setVWC(result, null);
          return undefined;
        }

        return createValueWithCallbacksEffect(d.state, (s) => {
          setVWC(result, s);
          return undefined;
        });
      });
      return [result, cleanup];
    })();
    const [chatWrappedVWC, cleanupChatWrappedUnwrapper] = createMappedValueWithCallbacks(
      journalEntryStateUnwrappedVWC,
      (d): ValueWithCallbacks<JournalChatState> | null | undefined => {
        if (d === null) {
          return null;
        }
        if (d.type === 'error' || d.type === 'released') {
          return undefined;
        }
        if (
          d.type === 'initializing' ||
          d.type === 'preparing-references' ||
          d.type === 'preparing-client-key' ||
          d.type === 'authorizing'
        ) {
          return null;
        }
        return d.value.displayable;
      }
    );
    const [chatVWC, cleanupChatUnwrapper] = (() => {
      const result = createWritableValueWithCallbacks<JournalChatState | null | undefined>(null);
      const cleanup = createValueWithCallbacksEffect(chatWrappedVWC, (d) => {
        if (d === undefined) {
          setVWC(result, undefined);
          return undefined;
        }
        if (d === null) {
          setVWC(result, null);
          return undefined;
        }
        return createValueWithCallbacksEffect(d, (s) => {
          setVWC(result, s);
          return undefined;
        });
      });
      return [result, cleanup];
    })();
    const [extractedVWC, cleanupChatExtractor] = createMappedValueWithCallbacks(chatVWC, (c) => {
      if (c === null) {
        return null;
      }
      if (c === undefined) {
        return undefined;
      }
      return extractQuestionAndResponse(c);
    });
    const [questionVWC, cleanupQuestionVWC] = createMappedValueWithCallbacks(
      extractedVWC,
      (e) => e?.question,
      {
        outputEqualityFn: Object.is,
      }
    );

    const clientResponseVWC = createWritableValueWithCallbacks<JournalReflectionResponseResponse>({
      type: 'loading',
    });
    let {
      onUserChangedResponse,
      ensureSaved,
      dispose: cleanupAutosaveLoop,
    } = (() => {
      /*
       * Within this section we never read from clientResponseVWC, we exclusively
       * write to it. We are the exclusive writer to clientResponseVWC. We do not
       * listen to callbacks on clientResponseVWC; we pass messages via userInput,
       * which is exclusively written to by onUserChangedResponse and exclusively
       * read from within the loop.
       *
       * active - dispose hasn't been called yet
       * ensuringSaved - set to true by ensureSaved, picked up by the loop
       *   and set to false after the save is complete
       * userInput - set by onUserChangedResponse, picked up by the loop
       *   and set to null once we've seen it (checked and set within the
       *   same event loop tick). naturally combines multiple calls that the
       *   loop doesn't care about.
       */

      const active = createWritableValueWithCallbacks(true);
      const ensuringSaved = createWritableValueWithCallbacks<
        boolean | { type: 'error'; error: any }
      >(false);
      const userInput = createWritableValueWithCallbacks<
        | { type: 'text'; value: string }
        | {
            type: 'voice';
            voiceNote: VoiceNoteStateMachine;
            request: RequestResult<VoiceNoteStateMachine>;
          }
        | null
      >(null);

      let errorsSinceSuccess = 0;
      let lastErrorAt: number | null = null;

      handleLoop();

      return {
        onUserChangedResponse: (
          v: { type: 'text'; value: string } | { type: 'voice'; voiceNote: VoiceNoteStateMachine }
        ) => {
          if (!active.get()) {
            throw new Error('onUserChangedResponse after dispose');
          }
          if (ensuringSaved.get()) {
            throw new Error('onUserChangedResponse while ensuringSaved');
          }
          if (clientResponseVWC.get().type !== 'available') {
            throw new Error('onUserChangedResponse while response not available');
          }

          const oldClientResponse = clientResponseVWC.get();
          if (oldClientResponse.type === 'available' && oldClientResponse.data.type === 'voice') {
            oldClientResponse.data.request.release();
          }

          const oldUserInput = userInput.get();
          if (oldUserInput !== null && oldUserInput.type === 'voice') {
            oldUserInput.request.release();
          }

          if (v.type === 'text') {
            setVWC(clientResponseVWC, { type: 'available', data: v });
            setVWC(userInput, v);
            return;
          }

          const state = v.voiceNote.state.get();
          if (
            state.type !== 'uploading' &&
            state.type !== 'transcribing' &&
            state.type !== 'local-ready' &&
            state.type !== 'remote-ready'
          ) {
            throw new Error('voice note not ready');
          }

          const refreshRef = () => {
            const inner = refreshScreen();
            return {
              promise: inner.promise.then(
                (r) =>
                  ({
                    type: 'error',
                    data: undefined,
                    error: new DisplayableError('server-refresh-required', 'refresh voice note'),
                    retryAt: undefined,
                  } as const)
              ),
              done: inner.done,
              cancel: inner.cancel,
            };
          };

          const userInputRequest = ctx.resources.voiceNoteHandler.requestWithData({
            ref: { voiceNoteUID: state.voiceNote.uid, voiceNoteJWT: state.voiceNote.jwt },
            refreshRef,
            data: v.voiceNote,
          });
          const clientResponseRequest = ctx.resources.voiceNoteHandler.request({
            ref: { voiceNoteUID: state.voiceNote.uid, voiceNoteJWT: state.voiceNote.jwt },
            refreshRef,
          });
          setVWC(clientResponseVWC, {
            type: 'available',
            data: { type: 'voice', request: clientResponseRequest },
          });
          setVWC(userInput, { type: 'voice', voiceNote: v.voiceNote, request: userInputRequest });
        },
        ensureSaved: async () => {
          if (!active.get()) {
            throw new Error('ensureSaved after dispose');
          }
          setVWC(ensuringSaved, true);

          const notActive = waitForValueWithCallbacksConditionCancelable(active, (a) => !a);
          notActive.promise.catch(() => {});
          const doneSaving = waitForValueWithCallbacksConditionCancelable(
            ensuringSaved,
            (e) => e !== true
          );
          doneSaving.promise.catch(() => {});
          await Promise.race([notActive.promise, doneSaving.promise]);

          if (!active.get()) {
            notActive.cancel();
            doneSaving.cancel();
            throw new Error('ensureSaved not finished before dispose');
          }

          const v = await doneSaving.promise;
          if (v === true) {
            notActive.cancel();
            throw new Error('impossible');
          }
          if (v !== false) {
            notActive.cancel();
            throw v.error;
          }

          const journalEntryManager = journalEntryManagerUnwrappedVWC.get();
          if (journalEntryManager === null) {
            notActive.cancel();
            throw new Error('journal entry manager not available');
          }

          const stateIsFinal = waitForValueWithCallbacksConditionCancelable(
            journalEntryManager.state,
            (s) => s.type === 'ready' || s.type === 'error' || s.type === 'released'
          );
          stateIsFinal.promise.catch(() => {});
          await Promise.race([notActive.promise, stateIsFinal.promise]);
          if (!active.get()) {
            stateIsFinal.cancel();
            return;
          }
        },
        dispose: () => {
          setVWC(active, false);
        },
      };

      async function handleLoop() {
        const notActive = waitForValueWithCallbacksConditionCancelable(active, (a) => !a);
        notActive.promise.catch(() => {});

        try {
          // setup only: transition from loading to available (or error out)
          {
            const responseFound = waitForValueWithCallbacksConditionCancelable(
              extractedVWC,
              (r) => r !== null
            );
            responseFound.promise.catch(() => {});
            await Promise.race([notActive.promise, responseFound.promise]);
            if (!active.get()) {
              responseFound.cancel();
              return;
            }
            const initialResponse = await responseFound.promise;
            if (!active.get()) {
              return;
            }
            if (initialResponse === null || initialResponse === undefined) {
              setVWC(clientResponseVWC, { type: 'error' });
              return;
            }

            setVWC(clientResponseVWC, {
              type: 'available',
              data:
                initialResponse.response === null
                  ? { type: 'text' as 'text', value: '' }
                  : initialResponse.response.value.type === 'text'
                  ? {
                      type: 'text' as 'text',
                      value: initialResponse.response.value.value,
                    }
                  : {
                      type: 'voice',
                      request: ctx.resources.voiceNoteHandler.request({
                        ref: {
                          voiceNoteUID: initialResponse.response.value.ref.uid,
                          voiceNoteJWT: initialResponse.response.value.ref.jwt,
                        },
                        refreshRef: () => {
                          const inner = refreshScreen();
                          return {
                            promise: inner.promise.then(
                              () =>
                                ({
                                  type: 'error',
                                  data: undefined,
                                  error: new DisplayableError(
                                    'server-refresh-required',
                                    'refresh voice note'
                                  ),
                                  retryAt: undefined,
                                } as const)
                            ),
                            done: inner.done,
                            cancel: inner.cancel,
                          };
                        },
                      }),
                    },
            });
          }

          while (true) {
            if (!active.get()) {
              return;
            }

            {
              const newValue = userInput.get();
              if (ensuringSaved.get() === true) {
                if (newValue === null) {
                  setVWC(ensuringSaved, false);
                  continue;
                }

                userInput.set(null);
                userInput.callbacks.call(undefined);

                const oldRequest = newValue.type === 'voice' ? newValue.request : undefined;
                const newValueWithoutReq =
                  newValue.type === 'voice'
                    ? ({ type: 'voice', voiceNote: newValue.voiceNote } as const)
                    : newValue;

                try {
                  await doSave(newValueWithoutReq);
                } finally {
                  oldRequest?.release();
                }
                continue;
              }

              if (newValue !== null) {
                userInput.set(null);
                userInput.callbacks.call(undefined);

                const autoSaveTimeout = createCancelableTimeout(5000);
                autoSaveTimeout.promise.catch(() => {});
                const errorTimeout = waitErrorCooldownCancelable();
                errorTimeout.promise.catch(() => {});
                const saveRequested = waitForValueWithCallbacksConditionCancelable(
                  ensuringSaved,
                  (e) => e === true
                );
                saveRequested.promise.catch(() => {});
                const newInput = waitForValueWithCallbacksConditionCancelable(
                  userInput,
                  (v) => v !== null
                );
                newInput.promise.catch(() => {});
                await Promise.race([
                  notActive.promise,
                  Promise.all([autoSaveTimeout.promise, errorTimeout.promise]),
                  saveRequested.promise,
                  newInput.promise,
                ]);
                autoSaveTimeout.cancel();
                errorTimeout.cancel();
                saveRequested.cancel();
                newInput.cancel();

                if (!active.get() || userInput.get() !== null) {
                  if (newValue.type === 'voice') {
                    newValue.request.release();
                  }
                  continue;
                }

                const oldRequest = newValue.type === 'voice' ? newValue.request : undefined;
                const newValueWithoutReq =
                  newValue.type === 'voice'
                    ? ({ type: 'voice', voiceNote: newValue.voiceNote } as const)
                    : newValue;
                try {
                  await doSave(newValueWithoutReq);
                } finally {
                  oldRequest?.release();
                }
                continue;
              }

              if (newValue === null) {
                const saveRequested = waitForValueWithCallbacksConditionCancelable(
                  ensuringSaved,
                  (e) => e === true
                );
                saveRequested.promise.catch(() => {});
                const newUserInput = waitForValueWithCallbacksConditionCancelable(
                  userInput,
                  (v) => v !== null
                );
                newUserInput.promise.catch(() => {});
                await Promise.race([
                  notActive.promise,
                  saveRequested.promise,
                  newUserInput.promise,
                ]);
                saveRequested.cancel();
                newUserInput.cancel();
                continue;
              }
            }
          }
        } finally {
          notActive.cancel();

          const newValue = userInput.get();
          if (newValue !== null && newValue.type === 'voice') {
            newValue.request.release();
            setVWC(userInput, null);
          }
        }
      }

      async function doSave(
        newValue:
          | { type: 'text'; value: string }
          | {
              type: 'voice';
              voiceNote: VoiceNoteStateMachine;
              request?: undefined;
            }
      ) {
        try {
          await updateResponse(newValue);
          onSuccessfulSave();
          // NOTE: not safe to set ensuringSaved here, since
          // although we saved successfully, the input may have
          // changed in the meantime.
        } catch (e) {
          onFailedSave();
          if (active.get()) {
            if (userInput.get() === null) {
              if (newValue.type === 'text') {
                userInput.set(newValue);
                userInput.callbacks.call(undefined);
                return;
              } else {
                const state = newValue.voiceNote.state.get();
                if (
                  state.type === 'uploading' ||
                  state.type === 'transcribing' ||
                  state.type === 'local-ready' ||
                  state.type === 'remote-initializing' ||
                  state.type === 'remote-initialized' ||
                  state.type === 'remote-selecting-export' ||
                  state.type === 'remote-downloading-audio' ||
                  state.type === 'remote-ready'
                ) {
                  const newRequest = ctx.resources.voiceNoteHandler.request({
                    ref: { voiceNoteUID: state.voiceNote.uid, voiceNoteJWT: state.voiceNote.jwt },
                    refreshRef: () => {
                      const inner = refreshScreen();
                      return {
                        promise: inner.promise.then(
                          () =>
                            ({
                              type: 'error',
                              data: undefined,
                              error: new DisplayableError(
                                'server-refresh-required',
                                'refresh voice note'
                              ),
                              retryAt: undefined,
                            } as const)
                        ),
                        done: inner.done,
                        cancel: inner.cancel,
                      };
                    },
                  });
                  userInput.set({
                    type: 'voice',
                    voiceNote: newValue.voiceNote,
                    request: newRequest,
                  });
                  userInput.callbacks.call(undefined);
                }
              }
            }
          }
          ensuringSaved.set({ type: 'error', error: e });
          ensuringSaved.callbacks.call(undefined);
        }
      }

      function waitErrorCooldownCancelable(): CancelablePromise<void> {
        if (errorsSinceSuccess === 0) {
          return {
            done: () => true,
            promise: Promise.resolve(),
            cancel: () => {},
          };
        }

        const errorTimeMS =
          Math.pow(2, Math.min(errorsSinceSuccess, 6) - 1) * 1000 + Math.random() * 1000;
        const realErrorAt = lastErrorAt ?? Date.now();
        const timeUntilDelayOver = realErrorAt + errorTimeMS - Date.now();
        if (timeUntilDelayOver <= 0) {
          return {
            done: () => true,
            promise: Promise.resolve(),
            cancel: () => {},
          };
        }

        return createCancelableTimeout(timeUntilDelayOver);
      }

      function onSuccessfulSave() {
        errorsSinceSuccess = 0;
        lastErrorAt = null;
      }

      function onFailedSave() {
        errorsSinceSuccess++;
        lastErrorAt = Date.now();
      }

      /** actually store a response via the add or edit endpoint */
      async function updateResponse(
        userResponse:
          | { type: 'text'; value: string }
          | {
              type: 'voice';
              voiceNote: VoiceNoteStateMachine;
            }
      ) {
        const extracted = extractedVWC.get();
        if (extracted === null || extracted === undefined || extracted.question === null) {
          console.warn('cannot submit edit: no question available');
          throw new Error('no question available');
        }

        const journalEntryManager = journalEntryManagerUnwrappedVWC.get();
        if (journalEntryManager === null) {
          throw new Error('journal entry manager not available');
        }

        const state = journalEntryManager.state.get();
        if (state.type !== 'ready') {
          throw new Error('journal entry manager not ready');
        }
        const journalEntryUID = state.journalEntryRef.uid;

        const vnState = userResponse.type !== 'voice' ? null : userResponse.voiceNote.state.get();
        if (
          vnState !== null &&
          vnState.type !== 'uploading' &&
          vnState.type !== 'transcribing' &&
          vnState.type !== 'local-ready' &&
          vnState.type !== 'remote-initializing' &&
          vnState.type !== 'remote-initialized' &&
          vnState.type !== 'remote-downloading-audio' &&
          vnState.type !== 'remote-selecting-export' &&
          vnState.type !== 'remote-ready'
        ) {
          throw new Error('voice note not ready');
        }

        const [responseFormat, responseValue] = (() => {
          if (userResponse.type === 'text') {
            return ['text', userResponse.value] as const;
          }

          if (vnState === null) {
            throw new Error('impossible');
          }

          return [
            'parts',
            JSON.stringify([{ type: 'voice_note', voice_note_uid: vnState.voiceNote.uid }]),
          ];
        })();

        const path =
          extracted.response === null
            ? screen.parameters.add.endpoint
            : screen.parameters.edit.endpoint;

        const expectedResponsePart = ((): JournalEntryItemData => {
          if (userResponse.type === 'text') {
            const text = userResponse.value;
            const paragraphs = text
              .split('\n')
              .map((p) => p.trim())
              .filter((p) => p.length > 0);
            return {
              type: 'reflection-response',
              display_author: 'self',
              data: {
                type: 'textual',
                parts: paragraphs.map((p) => ({ type: 'paragraph' as const, value: p })),
              },
            };
          }

          if (vnState === null) {
            throw new Error('impossible');
          }

          return {
            type: 'reflection-response',
            display_author: 'self',
            data: {
              type: 'textual',
              parts: [
                {
                  transcription: {
                    uid: '',
                    phrases: [],
                  },
                  type: 'voice_note',
                  voice_note_uid: vnState.voiceNote.uid,
                  voice_note_jwt: vnState.voiceNote.jwt,
                },
              ],
            },
          };
        })();

        const anticipated = JEStateMachine.deepClonePrimitives(state.value.displayable.get());
        if (extracted.response !== null) {
          anticipated.data[extracted.response.entryCounter - 1] = expectedResponsePart;
        } else {
          anticipated.data.push(expectedResponsePart);
        }
        anticipated.integrity = '';

        await journalEntryManager.sendMessage({
          type: 'incremental-refresh',
          get: async (user, visitor, clientKey, ref) => ({
            path,
            init: {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
                Authorization: `bearer ${user.authTokens.idToken}`,
                ...((v) =>
                  v.loading || v.uid === null
                    ? {}
                    : ({
                        Visitor: v.uid,
                      } as Record<string, string>))(visitor.value.get()),
              },
              body: JSON.stringify({
                platform: VISITOR_SOURCE,
                version: SCREEN_VERSION,
                journal_entry_uid: ref.uid,
                journal_entry_jwt: ref.jwt,
                journal_client_key_uid: clientKey.uid,
                ...(extracted.response === null
                  ? {}
                  : { entry_counter: extracted.response.entryCounter }),
                reflection_response_format: responseFormat,
                encrypted_reflection_response: await clientKey.key.encrypt(
                  responseValue,
                  await getCurrentServerTimeMS()
                ),
              }),
            },
            retryer: 'default',
            mapper: createTypicalSmartAPIFetchMapper({
              mapJSON: (v) => v,
              action: 'update reflection response',
            }),
          }),
          anticipated,
        }).promise;
        ctx.resources.journalEntryMetadataHandler.evictOrReplace({ uid: journalEntryUID });
        ctx.resources.journalEntryListHandler.evictAll();
      }
    })();

    return {
      ready: createWritableValueWithCallbacks(true),
      question: questionVWC,
      response: clientResponseVWC,
      onUserChangedResponse,
      ensureSaved,
      dispose: () => {
        setVWC(activeVWC, false);
        cleanupJournalEntryManagerRequester();
        cleanupJournalEntryManagerUnwrapper();
        cleanupJournalEntryStateUnwrapper();
        cleanupChatWrappedUnwrapper();
        cleanupChatUnwrapper();
        cleanupChatExtractor();
        cleanupQuestionVWC();
        cleanupAutosaveLoop();

        const currentResponse = clientResponseVWC.get();
        if (currentResponse.type === 'available' && currentResponse.data.type === 'voice') {
          currentResponse.data.request.release();
          setVWC(clientResponseVWC, { type: 'error' });
        }
      },
    };
  },
  component: (params) => <JournalReflectionResponse {...params} />,
};

const extractQuestionAndResponse = (
  chat: JournalChatState
): {
  question: { entryCounter: number; paragraphs: string[] } | null;
  response: {
    entryCounter: number;
    value: { type: 'text'; value: string } | { type: 'voice'; ref: { uid: string; jwt: string } };
  } | null;
} => {
  let question: { entryCounter: number; paragraphs: string[] } | null = null;
  let response: {
    entryCounter: number;
    value: { type: 'text'; value: string } | { type: 'voice'; ref: { uid: string; jwt: string } };
  } | null = null;
  for (let i = chat.data.length - 1; i >= 0; i--) {
    const entryItem = chat.data[i];
    if (
      (entryItem.type === 'reflection-question' || entryItem.type === 'reflection-response') &&
      entryItem.data.type === 'textual'
    ) {
      const textData = entryItem.data;
      const parts = [];
      let voiceNotePart: JournalEntryItemTextualPartVoiceNote | null = null;
      for (let j = 0; j < textData.parts.length; j++) {
        const part = textData.parts[j];
        if (part.type === 'paragraph') {
          parts.push(part.value);
        } else if (part.type === 'voice_note') {
          voiceNotePart = part;
        }
      }
      if (voiceNotePart !== null && entryItem.type === 'reflection-response') {
        response = {
          entryCounter: i + 1,
          value: {
            type: 'voice',
            ref: { uid: voiceNotePart.voice_note_uid, jwt: voiceNotePart.voice_note_jwt },
          },
        };
      } else {
        if (entryItem.type === 'reflection-question') {
          question = { entryCounter: i + 1, paragraphs: parts };
        } else if (entryItem.type === 'reflection-response') {
          response = {
            entryCounter: i + 1,
            value: { type: 'text', value: parts.join('\n\n') },
          };
        }
      }
    }
  }
  return { question, response };
};
