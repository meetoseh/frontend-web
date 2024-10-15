import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { createValuesWithCallbacksEffect } from '../../../../shared/hooks/createValuesWithCallbacksEffect';
import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import { createMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
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
import {
  JournalEntryManager,
  JournalEntryManagerRef,
} from '../journal_chat/lib/createJournalEntryManagerHandler';
import { VoiceNoteStateMachine } from '../journal_chat/lib/createVoiceNoteStateMachine';
import {
  JournalChatState,
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

    const getJournalEntryManager = (): RequestResult<JournalEntryManager> => {
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

      return ctx.resources.journalEntryManagerHandler.request({
        ref: {
          journalEntryUID: screen.parameters.journalEntry.uid,
          journalEntryJWT: screen.parameters.journalEntry.jwt,
        },
        refreshRef: (): CancelablePromise<Result<JournalEntryManagerRef>> => {
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
            (s): Result<JournalEntryManagerRef> =>
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
      createWritableValueWithCallbacks<RequestResult<JournalEntryManager> | null>(null);
    const cleanupJournalEntryManagerRequester = (() => {
      const request = getJournalEntryManager();
      setVWC(journalEntryManagerVWC, request);
      return () => {
        if (Object.is(journalEntryJWTVWC.get(), request)) {
          setVWC(journalEntryJWTVWC, null);
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

    const [journalEntryUIDVWC, cleanupJournalEntryUIDUnwrapper] = createMappedValueWithCallbacks(
      journalEntryManagerUnwrappedVWC,
      (d) => d?.journalEntryUID ?? null
    );
    const journalEntryJWTVWC = createWritableValueWithCallbacks<string | null>(null);
    const cleanupJournalEntryJWTUnwrapper = createValueWithCallbacksEffect(
      journalEntryManagerUnwrappedVWC,
      (d) => {
        if (d === null) {
          setVWC(journalEntryJWTVWC, null);
          return undefined;
        }

        return createValueWithCallbacksEffect(d.journalEntryJWT, (jwt) => {
          setVWC(journalEntryJWTVWC, jwt);
          return undefined;
        });
      }
    );

    const chatVWC = createWritableValueWithCallbacks<JournalChatState | null | undefined>(null);
    const cleanupChatUnwrapper = createValueWithCallbacksEffect(
      journalEntryManagerUnwrappedVWC,
      (d) => {
        if (d === null) {
          setVWC(chatVWC, null);
          return undefined;
        }

        return createValueWithCallbacksEffect(d.chat, (chat) => {
          setVWC(chatVWC, chat);
          return undefined;
        });
      }
    );

    const retryCounterVWC = createWritableValueWithCallbacks(0);
    const cleanupJournalEntryManagerRefresher = createValuesWithCallbacksEffect(
      [
        journalEntryManagerVWC,
        journalEntryManagerUnwrappedVWC,
        ctx.login.value,
        ctx.interests.visitor.value,
      ],
      () => {
        const requestRaw = journalEntryManagerVWC.get();
        if (requestRaw === null) {
          return;
        }
        const request = requestRaw.data;
        const active = createWritableValueWithCallbacks(true);
        handle();
        return () => {
          setVWC(active, false);
        };

        async function handle() {
          if (!active.get()) {
            return;
          }
          const d = journalEntryManagerUnwrappedVWC.get();

          if (d === null) {
            return undefined;
          }

          const nowServer = await getCurrentServerTimeMS();
          if (!active.get()) {
            return;
          }

          if (d.isExpiredOrDisposed(nowServer)) {
            const raw = request.get();
            if (raw.type === 'success') {
              setVWC(retryCounterVWC, 0);
              raw.reportExpired();
            }
            return;
          }

          const user = ctx.login.value.get();
          if (user.state !== 'logged-in') {
            return;
          }

          const visitor = ctx.interests.visitor.value.get();
          if (visitor.loading) {
            return;
          }

          if ((d.chat.get() === null || d.chat.get() === undefined) && d.task.get() === null) {
            setVWC(retryCounterVWC, 0);
            d.refresh(user, ctx.interests.visitor);
          }
        }
      }
    );

    const questionVWC = createWritableValueWithCallbacks<
      { entryCounter: number; paragraphs: string[] } | null | undefined
    >(null);
    const serverResponseVWC = createWritableValueWithCallbacks<
      | {
          entryCounter: number;
          value:
            | { type: 'text'; value: string }
            | { type: 'voice'; request: RequestResult<VoiceNoteStateMachine> };
        }
      | 'loading'
      | 'error'
      | 'dne'
    >('loading');

    const cleanupJournalEntryManagerRetrier = createValueWithCallbacksEffect(
      journalEntryManagerUnwrappedVWC,
      () => {
        const requestRaw = journalEntryManagerVWC.get();
        if (requestRaw === null) {
          return;
        }
        const request = requestRaw.data;

        return createValueWithCallbacksEffect(request, () => {
          const data = request.get();
          if (data.type !== 'success') {
            return undefined;
          }

          const manager = data.data;
          const active = createWritableValueWithCallbacks(true);
          retryUntilHaveQuestion();
          return () => {
            setVWC(active, false);
          };

          async function retryUntilHaveQuestion() {
            const canceled = waitForValueWithCallbacksConditionCancelable(active, (a) => !a);
            canceled.promise.catch(() => {});
            if (!active.get()) {
              canceled.cancel();
              return;
            }

            let chat = manager.chat.get();
            let chatChanged = waitForValueWithCallbacksConditionCancelable(
              manager.chat,
              (c) => !Object.is(c, chat)
            );
            chatChanged.promise.catch(() => {});
            let task = manager.task.get();
            let taskChanged = waitForValueWithCallbacksConditionCancelable(
              manager.task,
              (t) => !Object.is(t, task)
            );
            taskChanged.promise.catch(() => {});

            while (true) {
              if (!active.get()) {
                canceled.cancel();
                chatChanged.cancel();
                taskChanged.cancel();
                return;
              }

              if (chatChanged.done()) {
                chat = manager.chat.get();
                chatChanged = waitForValueWithCallbacksConditionCancelable(
                  manager.chat,
                  (
                    (chat) => (c) =>
                      !Object.is(c, chat)
                  )(chat)
                );
                chatChanged.promise.catch(() => {});
                continue;
              }

              if (taskChanged.done()) {
                task = manager.task.get();
                taskChanged = waitForValueWithCallbacksConditionCancelable(
                  manager.task,
                  (
                    (task) => (t) =>
                      !Object.is(t, task)
                  )(task)
                );
                taskChanged.promise.catch(() => {});
                continue;
              }

              if (chat === undefined) {
                setVWC(questionVWC, undefined);
                setVWC(serverResponseVWC, 'error');
                await Promise.race([taskChanged.promise, chatChanged.promise, canceled.promise]);
                continue;
              }

              if (chat === null) {
                setVWC(questionVWC, null);
                setVWC(serverResponseVWC, 'loading');
                await Promise.race([chatChanged.promise, taskChanged.promise, canceled.promise]);
                continue;
              }

              let question: { entryCounter: number; paragraphs: string[] } | null = null;
              let response:
                | {
                    entryCounter: number;
                    value:
                      | { type: 'text'; value: string }
                      | { type: 'voice'; request: RequestResult<VoiceNoteStateMachine> };
                  }
                | 'dne' = 'dne';
              for (let i = chat.data.length - 1; i >= 0; i--) {
                const entryItem = chat.data[i];
                if (
                  (entryItem.type === 'reflection-question' ||
                    entryItem.type === 'reflection-response') &&
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
                    if (response !== 'dne' && response.value.type === 'voice') {
                      response.value.request.release();
                    }
                    response = {
                      entryCounter: i + 1,
                      value: {
                        type: 'voice',
                        request: ctx.resources.voiceNoteHandler.request({
                          ref: {
                            voiceNoteUID: voiceNotePart.voice_note_uid,
                            voiceNoteJWT: voiceNotePart.voice_note_jwt,
                          },
                          refreshRef: () => {
                            const inner = refreshScreen();
                            return {
                              promise: inner.promise.then((r) => {
                                if (r.type === 'success') {
                                  return {
                                    type: 'error',
                                    data: undefined,
                                    error: new DisplayableError(
                                      'server-refresh-required',
                                      'refresh voice note'
                                    ),
                                    retryAt: undefined,
                                  };
                                }
                                return r;
                              }),
                              done: inner.done,
                              cancel: inner.cancel,
                            };
                          },
                        }),
                      },
                    };
                  } else {
                    if (entryItem.type === 'reflection-question') {
                      question = { entryCounter: i + 1, paragraphs: parts };
                    } else if (entryItem.type === 'reflection-response') {
                      if (response !== 'dne' && response.value.type === 'voice') {
                        response.value.request.release();
                      }
                      response = {
                        entryCounter: i + 1,
                        value: { type: 'text', value: parts.join('\n\n') },
                      };
                    }
                  }
                }
              }

              if (task !== null) {
                await Promise.race([chatChanged.promise, taskChanged.promise, canceled.promise]);
                continue;
              }

              setVWC(questionVWC, question);
              setVWC(serverResponseVWC, response);
              await Promise.race([taskChanged.promise, chatChanged.promise, canceled.promise]);
            }
          }
        });
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
          notActive.cancel();

          if (!active.get()) {
            doneSaving.cancel();
            throw new Error('ensureSaved not finished before dispose');
          }

          const v = await doneSaving.promise;
          if (v === false) {
            return;
          }
          if (v === true) {
            throw new Error('impossible');
          }
          throw v.error;
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
              serverResponseVWC,
              (r) => r !== 'loading'
            );
            responseFound.promise.catch(() => {});
            await Promise.race([notActive.promise, responseFound.promise]);
            if (!active.get()) {
              responseFound.cancel();
              return;
            }
            const initialResponse = await responseFound.promise;
            if (initialResponse === 'error' || initialResponse === 'loading') {
              setVWC(clientResponseVWC, { type: 'error' });
              return;
            }

            setVWC(clientResponseVWC, {
              type: 'available',
              data:
                initialResponse === 'dne'
                  ? { type: 'text' as 'text', value: '' }
                  : initialResponse.value,
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
        const question = questionVWC.get();
        if (question === null || question === undefined) {
          console.warn('cannot submit edit: no question available');
          return Promise.reject(new Error('no question available'));
        }

        const currentResponse = serverResponseVWC.get();
        if (currentResponse === 'error' || currentResponse === 'loading') {
          console.warn('cannot submit edit: response not available');
          return Promise.reject(new Error('response not available'));
        }

        const journalEntryManager = journalEntryManagerUnwrappedVWC.get();
        if (journalEntryManager === null) {
          return Promise.reject(new Error('journal entry manager not available'));
        }

        const user = ctx.login.value.get();
        if (user.state !== 'logged-in') {
          return Promise.reject(new Error('user not logged in'));
        }

        const [responseFormat, responseValue] = (() => {
          if (userResponse.type === 'text') {
            return ['text', userResponse.value] as const;
          }

          const state = userResponse.voiceNote.state.get();
          if (
            state.type !== 'uploading' &&
            state.type !== 'transcribing' &&
            state.type !== 'local-ready' &&
            state.type !== 'remote-initializing' &&
            state.type !== 'remote-initialized' &&
            state.type !== 'remote-downloading-audio' &&
            state.type !== 'remote-selecting-export' &&
            state.type !== 'remote-ready'
          ) {
            throw new Error('voice note not ready');
          }

          return [
            'parts',
            JSON.stringify([{ type: 'voice_note', voice_note_uid: state.voiceNote.uid }]),
          ];
        })();

        await journalEntryManager.refresh(user, ctx.interests.visitor, {
          endpoint:
            currentResponse === 'dne'
              ? screen.parameters.add.endpoint
              : screen.parameters.edit.endpoint,
          bonusParams: async (clientKey) => ({
            version: SCREEN_VERSION,
            ...(currentResponse !== 'dne' ? { entry_counter: currentResponse.entryCounter } : {}),
            reflection_response_format: responseFormat,
            encrypted_reflection_response: await clientKey.key.encrypt(
              responseValue,
              await getCurrentServerTimeMS()
            ),
          }),
          sticky: true,
        });
        const journalEntryUID = journalEntryUIDVWC.get();
        if (journalEntryUID !== null) {
          ctx.resources.journalEntryMetadataHandler.evictOrReplace({ uid: journalEntryUID });
        }
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
        cleanupJournalEntryUIDUnwrapper();
        cleanupJournalEntryJWTUnwrapper();
        cleanupChatUnwrapper();
        cleanupJournalEntryManagerRefresher();
        cleanupJournalEntryManagerRetrier();
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
