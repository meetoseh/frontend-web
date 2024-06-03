import { ReactElement, useEffect, useMemo } from 'react';
import { OsehScreen, PeekedScreen, ScreenResources } from '../models/Screen';
import {
  Callbacks,
  ValueWithCallbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { ScreenQueueState, UseScreenQueueStateState } from './useScreenQueueState';
import { setVWC } from '../../../shared/lib/setVWC';
import { waitForValueWithCallbacksConditionCancelable } from '../../../shared/lib/waitForValueWithCallbacksCondition';
import { createCancelablePromiseFromCallbacks } from '../../../shared/lib/createCancelablePromiseFromCallbacks';
import { ScreenContext } from './useScreenContext';
import { Result } from '../../../shared/requests/RequestHandler';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { delayCancelableUntilResolved } from '../../../shared/lib/delayCancelableUntilResolved';
import { createUID } from '../../../shared/lib/createUID';

export type UseScreenQueueProps = {
  /**
   * The underlying screen queue to manipulate
   */
  screenQueueState: ScreenQueueState;
  /**
   * The shared state between all screens
   */
  screenContext: ScreenContext;
  /**
   * The screens which are supported by this client. This array is not
   * manipulated, so its safe to downcast the typed screens into this
   * array.
   */
  screens: readonly OsehScreen<string, ScreenResources, object, { __mapped?: true }>[];

  /**
   * Function to use for logging. To disable logging, pass no-ops.
   */
  logging: {
    log: (message: string) => void;
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
};

const DEFAULT_POP_ENDPOINT = '/api/1/users/me/screens/pop';

export type UseScreenQueueState =
  | {
      /**
       * - `loading-queue`: still trying to peek the queue for the first time
       */
      type: 'loading-queue';
      error?: undefined;
      component?: undefined;
    }
  | {
      /**
       * - `spinner`: we know what component we will render, but the resources for
       *   it are still loading
       */
      type: 'spinner';
      error?: undefined;
      component?: undefined;
    }
  | {
      /**
       * - `error`: an error occurred peeking or popping
       */
      type: 'error';
      /** A description of the error */
      error: ReactElement;
      component?: undefined;
    }
  | {
      /**
       * - `success`: we have a screen to show. we may have some prefetch screens,
       *   but we're not actively popping
       */
      type: 'success';
      error?: undefined;
      /** The component which should be rendered */
      component: ReactElement;
    }
  | {
      /**
       * - `preparing-pop`: The screen component called the provided `startPop` function,
       *   and we're still waiting for the pop to complete. During this time, we still render
       *   the screen we're popping.
       */
      type: 'preparing-pop';
      error?: undefined;
      component: ReactElement;
    }
  | {
      /**
       * - `finishing-pop`: The screen component called the provided `startPop` function
       *   and the callback that returned already, but we still don't know what the next
       *   component is. This is conceptually similar to spinner, but if the component is
       *   not undefined it must stay mounted behind the spinner in such a way that does
       *   not cause any rerenders in case an error occurs with the pop. This allows the
       *   component to treat errors that occur in the preparing-pop phase (where the
       *   component is mounted and thus can write the error to local state) and errors
       *   that occur after (which, if the component was unmounted, must be stored in the
       *   instance resources) the same, avoiding a class of bugs that would only show up
       *   under sufficient latency.
       */
      type: 'finishing-pop';
      error?: undefined;
      component: ReactElement;
    }
  | {
      /**
       * - `prepared-pop`: The screen component called the provided `startPop` function,
       *   and we finished with the pop and are ready to move on to the next screen once
       *   the screen component calls the callback from `startPop`.
       */
      type: 'prepared-pop';
      error?: undefined;
      component: ReactElement;
    };

export type UseScreenQueueResult = {
  value: ValueWithCallbacks<UseScreenQueueState>;
};

/**
 * A hook that manages the screen queue state and actually renders the screens.
 * This cannot handle anything else calling peek or pop on the screen queue state,
 * but traces are fine.
 *
 * Although this is best-effort safe to remount, remounts are not recommended as
 * a remount immediately after this peeks may lead to temporarily stale data if
 * the peek lands after the new effect is mounted.
 */
export const useScreenQueue = ({
  screenQueueState,
  screenContext,
  screens,
  logging,
}: UseScreenQueueProps): UseScreenQueueResult => {
  logging.info('useScreenQueue hook called');

  const valueVWC = useWritableValueWithCallbacks<UseScreenQueueState>(() => ({
    type: 'loading-queue',
  }));

  useEffect(() => {
    const effectUid = createUID();
    logging.info(`${effectUid} - useScreenQueue mounting effect`);

    let effectMounted = true;
    let counter = 0;
    let skipsInARow = 0;
    let cancel: () => void = () => {};

    const screensBySlug = new Map<
      string,
      OsehScreen<string, ScreenResources, object, { __mapped?: true }>
    >();
    for (const screen of screens) {
      if (screensBySlug.has(screen.slug)) {
        throw new Error(`duplicate screen slug: ${screen.slug}`);
      }
      screensBySlug.set(screen.slug, screen);
    }

    initState(++counter, screenQueueState.value.get(), true);
    return () => {
      if (effectMounted) {
        logging.info(`${effectUid} - useScreenQueue unmounting effect`);
      }

      effectMounted = false;
      cancel();
      cancel = () => {};
    };

    function reinit(id: number) {
      if (!effectMounted || id !== counter) {
        return;
      }

      initState(++counter, screenQueueState.value.get());
    }

    function initState(id: number, state: UseScreenQueueStateState, isStackPopped?: boolean) {
      if (!isStackPopped) {
        setTimeout(() => initState(id, state, true), 0);
        return;
      }

      if (!effectMounted || id !== counter) {
        return;
      }

      if (state.type === 'loading') {
        initLoading(++counter, state);
      } else if (state.type === 'error') {
        initError(++counter, state);
      } else if (state.type === 'success') {
        initPeeked(++counter, state);
      } else {
        throw new Error(`bad state: ${state}`);
      }
    }

    async function initLoading(id: number, state: UseScreenQueueStateState & { type: 'loading' }) {
      if (!effectMounted || id !== counter) {
        return;
      }
      cancel();
      if (!effectMounted || id !== counter) {
        return;
      }

      const active = createWritableValueWithCallbacks(true);
      const canceled = createCancelablePromiseFromCallbacks(active.callbacks);
      canceled.promise.catch(() => {});

      cancel = () => setVWC(active, false);
      if (!effectMounted || id !== counter) {
        throw new Error('unreachable (dangerous cancel() call in tight section)');
      }

      logging.info(`${effectUid} - loading-queue`);
      setVWC(valueVWC, { type: 'loading-queue' });
      if (!active.get()) {
        canceled.cancel();
        return;
      }

      const newStateCancelable = waitForValueWithCallbacksConditionCancelable(
        screenQueueState.value,
        (v) => v.type !== 'loading'
      );
      newStateCancelable.promise.catch(() => {});

      await Promise.race([canceled.promise, newStateCancelable.promise]);
      if (!effectMounted || id !== counter) {
        newStateCancelable.cancel();
        return;
      }

      canceled.cancel();
      const newState = await newStateCancelable.promise;
      if (!effectMounted || id !== counter) {
        return;
      }

      initState(++counter, newState);
    }

    async function initError(id: number, state: UseScreenQueueStateState & { type: 'error' }) {
      if (!effectMounted || id !== counter) {
        return;
      }
      cancel();
      if (!effectMounted || id !== counter) {
        return;
      }

      const active = createWritableValueWithCallbacks(true);
      const canceled = createCancelablePromiseFromCallbacks(active.callbacks);
      canceled.promise.catch(() => {});

      cancel = () => setVWC(active, false);
      if (!effectMounted || id !== counter) {
        throw new Error('unreachable (dangerous cancel() call in tight section)');
      }

      logging.error(`${effectUid} - error: ${state.error}`);
      setVWC(valueVWC, { type: 'error', error: state.error });
      if (!active.get()) {
        canceled.cancel();
        return;
      }

      const newStateCancelable = waitForValueWithCallbacksConditionCancelable(
        screenQueueState.value,
        (v) => !Object.is(v, state)
      );
      newStateCancelable.promise.catch(() => {});

      await Promise.race([canceled.promise, newStateCancelable.promise]);
      if (!effectMounted || id !== counter) {
        newStateCancelable.cancel();
        return;
      }

      canceled.cancel();
      const newState = await newStateCancelable.promise;
      if (!effectMounted || id !== counter) {
        return;
      }

      initState(++counter, newState);
    }

    async function initPeeked(id: number, state: UseScreenQueueStateState & { type: 'success' }) {
      if (!effectMounted || id !== counter) {
        return;
      }
      cancel();
      if (!effectMounted || id !== counter) {
        return;
      }

      const active = createWritableValueWithCallbacks(true);
      const canceled = createCancelablePromiseFromCallbacks(active.callbacks);
      canceled.promise.catch(() => {});

      cancel = () => setVWC(active, false);
      if (!effectMounted || id !== counter) {
        throw new Error('unreachable (dangerous cancel() call in tight section)');
      }

      let releaseFromLastLoop = () => {};

      logging.info(`${effectUid} - core loop initializing`);

      let loopCounter = 0;

      while (true) {
        const loopIsActive = createWritableValueWithCallbacks(true);

        const activeScreenInstance = state.result.active;
        const requestedSlug = activeScreenInstance.slug;
        const activeScreen = screensBySlug.get(requestedSlug);

        const loopUid = ++loopCounter;
        logging.info(
          `${effectUid} | ${loopUid} - core loop iteration with active slug ${requestedSlug}`
        );

        if (activeScreen === undefined) {
          skipsInARow++;
          if (skipsInARow > 10) {
            logging.error(`${effectUid} | ${loopUid} - too many skips in a row, going to error`);
            setVWC(valueVWC, { type: 'error', error: <>Too many skips in a row</> });
            return;
          }
          logging.warn(
            `${effectUid} | ${loopUid} - screen ${requestedSlug} is not supported, skipping`
          );
          releaseFromLastLoop();
          releaseFromLastLoop = () => {};

          const popPromise = screenQueueState.pop(
            state,
            {
              slug: 'skip',
              parameters: {},
            },
            DEFAULT_POP_ENDPOINT
          );
          await Promise.race([popPromise.promise, canceled.promise]);
          if (!active.get()) {
            popPromise.cancel();
            return;
          }
          logging.info(`${effectUid} | ${loopUid} - processed skip, delegating to reinit`);
          return reinit(++counter);
        }

        skipsInARow = 0;

        const repeekRequestedCallbacks = new Callbacks<undefined>();
        const repeekRequested = createCancelablePromiseFromCallbacks(repeekRequestedCallbacks);
        repeekRequested.promise.catch(() => {});

        const refreshScreen = (): CancelablePromise<RefreshResult> => {
          // We never actually resolve this promise. Instead, we will perform the
          // requested repeek, start loading the resources for a new instance of the active
          // and prefetched screens, then dispose of the current active and prefetched screens
          // and mount the new active screen, canceling this promise

          if (!active.get() || !loopIsActive.get()) {
            return {
              promise: Promise.reject(new Error('not safe to call here')),
              cancel: () => {},
              done: () => true,
            };
          }

          let done = false;
          let doReject = (e: any) => {};
          const result = {
            promise: new Promise<RefreshResult>((resolve, reject) => {
              doReject = reject;
            }),
            cancel: () => {
              done = true;
              doReject(new Error('canceled'));
            },
            done: () => done,
          };

          repeekRequestedCallbacks.call(undefined);

          active.callbacks.add(result.cancel);
          loopIsActive.callbacks.add(result.cancel);
          result.promise.finally(() => {
            active.callbacks.remove(result.cancel);
            loopIsActive.callbacks.remove(result.cancel);
          });

          if (!active.get() || !loopIsActive.get()) {
            result.cancel();
          }

          return result;
        };

        const activeScreenInstanceMapped = {
          slug: activeScreenInstance.slug,
          parameters: activeScreen.paramMapper(activeScreenInstance.parameters),
        };
        const activeResources = activeScreen.initInstanceResources(
          screenContext,
          activeScreenInstanceMapped,
          () =>
            delayCancelableUntilResolved(
              (u: RefreshResult) => ({
                promise: Promise.resolve(u.active),
                cancel: () => {},
                done: () => true,
              }),
              refreshScreen()
            )
        );

        const prefetchResources = state.result.prefetch.map((prefetchInstance, idx) => {
          const screen = screensBySlug.get(prefetchInstance.slug);
          if (screen === undefined) {
            return null;
          }

          const prefetchInstanceMapped = {
            slug: prefetchInstance.slug,
            parameters: screen.paramMapper(prefetchInstance.parameters),
          };

          return screen.initInstanceResources(screenContext, prefetchInstanceMapped, () =>
            delayCancelableUntilResolved(
              (u: RefreshResult) => ({
                promise: Promise.resolve(u.prefetch[idx]),
                cancel: () => {},
                done: () => true,
              }),
              refreshScreen()
            )
          );
        });

        logging.info(`${effectUid} | ${loopUid} - attached resource requests`);

        releaseFromLastLoop();
        releaseFromLastLoop = () => {};

        if (!active.get()) {
          setVWC(loopIsActive, false);
          repeekRequested.cancel();
          activeResources.dispose();
          prefetchResources.forEach((r) => r?.dispose());
          return;
        }

        if (!activeResources.ready.get()) {
          logging.info(
            `${effectUid} | ${loopUid} - using spinner while resources for ${activeScreenInstance.slug} are loading`
          );
          setVWC(valueVWC, { type: 'spinner' }, (a, b) => a.type === b.type);
          const activeResourcesReady = waitForValueWithCallbacksConditionCancelable(
            activeResources.ready,
            (v) => v
          );
          activeResourcesReady.promise.catch(() => {});
          await Promise.race([
            activeResourcesReady.promise,
            canceled.promise,
            repeekRequested.promise,
          ]);
          activeResourcesReady.cancel();

          if (repeekRequested.done() && active.get()) {
            logging.warn(
              `${effectUid} | ${loopUid} - repeeked during initial load, going to cancel, peek & reinit`
            );
            cancel();
            cancel = () => {};
            const reinitId = ++counter;

            // eslint-disable-next-line no-loop-func
            screenQueueState.peek().promise.finally(() => {
              // effectMounted, counter, and cancel are expected to mutate
              if (effectMounted && reinitId === counter) {
                logging.info(`${effectUid} | ${loopUid} - reiniting after repeek`);
                cancel();
                reinit(reinitId);
              }
            });
          } // PURPOSEFUL FALL THROUGH
          if (!active.get()) {
            setVWC(loopIsActive, false);
            repeekRequested.cancel();
            activeResources.dispose();
            prefetchResources.forEach((r) => r?.dispose());
            activeResourcesReady.cancel();
            return;
          }
        }

        let finishPopRequested = null as CancelablePromise<undefined> | null;

        const startPopRequestedCallbacks = new Callbacks<{
          trigger: {
            slug: string;
            parameters: any;
          } | null;
          endpoint: string | undefined;
          onError: ((err: unknown) => void) | undefined;
        }>();
        let startPopRequested = createCancelablePromiseFromCallbacks(startPopRequestedCallbacks);
        startPopRequested.promise.catch(() => {});

        const component = activeScreen.component({
          ctx: screenContext,
          screen: activeScreenInstanceMapped,
          resources: activeResources,
          startPop: (trigger, endpoint, onError) => {
            if (!active.get() || !loopIsActive.get() || finishPopRequested !== null) {
              console.warn('startPop called on disposed instance');
              return () => {};
            }

            const finishPopCallbacks = new Callbacks<undefined>();
            finishPopRequested = createCancelablePromiseFromCallbacks(finishPopCallbacks);

            startPopRequestedCallbacks.call({ trigger, endpoint, onError });
            return () => {
              if (!active.get() || !loopIsActive.get()) {
                console.warn('finishPop called on disposed instance');
                return;
              }
              finishPopCallbacks.call(undefined);
            };
          },
          trace: screenQueueState.trace.bind(screenQueueState, state),
          key: `${effectUid}-${loopUid}`,
        });

        logging.info(
          `${effectUid} | ${loopUid} - showing active screen ${activeScreenInstance.slug}`
        );
        setVWC(valueVWC, { type: 'success', component });

        while (true) {
          await Promise.race([
            canceled.promise,
            startPopRequested.promise,
            repeekRequested.promise,
          ]);

          if (!active.get()) {
            setVWC(loopIsActive, false);
            repeekRequested.cancel();
            activeResources.dispose();
            prefetchResources.forEach((r) => r?.dispose());
            finishPopRequested?.cancel();
            startPopRequested.cancel();
            return;
          }

          if (startPopRequested.done()) {
            const popTriggerInfo = await startPopRequested.promise;
            if (!active.get()) {
              setVWC(loopIsActive, false);
              repeekRequested.cancel();
              activeResources.dispose();
              prefetchResources.forEach((r) => r?.dispose());
              finishPopRequested?.cancel();
              startPopRequested.cancel();
              return;
            }

            const popTrigger = popTriggerInfo.trigger;
            const endpoint = popTriggerInfo.endpoint ?? DEFAULT_POP_ENDPOINT;
            const onError = popTriggerInfo.onError;

            logging.info(
              `${effectUid} | ${loopUid} - preparing to pop with trigger ${JSON.stringify(
                popTrigger,
                undefined,
                2
              )} via endpoint ${endpoint}; error handler set? ${onError !== undefined}`
            );
            setVWC(valueVWC, { type: 'preparing-pop', component });
            const popCancelable = screenQueueState.pop(state, popTrigger, endpoint, onError);

            const finishPopBound = finishPopRequested;
            if (finishPopBound === null) {
              throw new Error('unreachable');
            }

            await Promise.race([
              popCancelable.promise,
              finishPopBound.promise.catch(() => {}),
              canceled.promise,
            ]);

            if (active.get() && !popCancelable.done() && finishPopBound.done()) {
              logging.info(
                `${effectUid} | ${loopUid} - screen wanted to transition away before pop finished, ` +
                  `going to finishing-pop (a spinner) while holding the component`
              );
              setVWC(valueVWC, { type: 'finishing-pop', component });
              await Promise.race([popCancelable.promise, canceled.promise]);
            }

            if (!active.get()) {
              setVWC(loopIsActive, false);
              activeResources.dispose();
              prefetchResources.forEach((r) => r?.dispose());
              finishPopRequested?.cancel();
              startPopRequested.cancel();
              popCancelable.cancel();
              return;
            }

            if (!popCancelable.done()) {
              throw new Error('unreachable');
            }

            const popResult = await popCancelable.promise;
            if (
              active.get() &&
              (popResult.type !== 'success' || popResult.data.type !== 'success')
            ) {
              if (onError === undefined) {
                logging.warn(
                  `${effectUid} | ${loopUid} - pop failed without error handler, going to reinit`
                );
                cancel();
                reinit(++counter);
              } else {
                const screenState = screenQueueState.value.get();
                if (!Object.is(screenState, state)) {
                  logging.warn(
                    `${effectUid} | ${loopUid} - pop failed with error handler and screen changed, going to reinit; ` +
                      `old screen state: ${JSON.stringify(
                        state,
                        undefined,
                        2
                      )}; new screen state: ${JSON.stringify(screenState, undefined, 2)}`
                  );
                  cancel();
                  reinit(++counter);
                } else {
                  logging.info(
                    `${effectUid} | ${loopUid} - pop failed with error handler; pretending startPop wasn't called`
                  );

                  finishPopRequested?.cancel();
                  finishPopRequested = null;

                  startPopRequested = createCancelablePromiseFromCallbacks(
                    startPopRequestedCallbacks
                  );
                  setVWC(
                    valueVWC,
                    { type: 'success', component },
                    (a, b) =>
                      a.type === 'success' &&
                      b.type === 'success' &&
                      Object.is(a.component, b.component)
                  );
                  continue;
                }
              }
            } // PURPOSEFUL FALL THROUGH

            if (!active.get()) {
              setVWC(loopIsActive, false);
              activeResources.dispose();
              prefetchResources.forEach((r) => r?.dispose());
              finishPopRequested?.cancel();
              startPopRequested.cancel();
              return;
            }

            if (popResult.type !== 'success' || popResult.data.type !== 'success') {
              throw new Error('unreachable');
            }

            if (finishPopBound.done()) {
              logging.info(
                `${effectUid} | ${loopUid} - pop finished and already want to transition away, releasing ` +
                  `active screen resources and moving to next loop iteration`
              );
              setVWC(valueVWC, { type: 'finishing-pop', component }, (a, b) => a.type === b.type);
              activeResources.dispose();

              state = popResult.data;
              releaseFromLastLoop = () => {
                logging.info(`${effectUid} | ${loopUid} - releasing prefetch resources`);
                setVWC(loopIsActive, false);
                prefetchResources.forEach((r) => r?.dispose());
              };
              break;
            }

            logging.info(
              `${effectUid} | ${loopUid} - pop finished but screen is still transitioning away (happy path) (finishPop not called) ` +
                `starting to prefetch resources based on the latest peek and releasing all but the active screens ` +
                `resources on the old peek`
            );

            const newPrefetchResources = [
              popResult.data.result.active,
              ...popResult.data.result.prefetch,
            ].map((prefetchInstance, idx) => {
              const screen = screensBySlug.get(prefetchInstance.slug);
              if (screen === undefined) {
                return null;
              }

              const prefetchInstanceMapped = {
                slug: prefetchInstance.slug,
                parameters: screen.paramMapper(prefetchInstance.parameters),
              };

              return screen.initInstanceResources(screenContext, prefetchInstanceMapped, () => ({
                promise: Promise.reject(new Error('refresh not supported in this spot')),
                cancel: () => {},
                done: () => true,
              }));
            });
            prefetchResources.forEach((r) => r?.dispose());
            setVWC(valueVWC, { type: 'prepared-pop', component });
            await Promise.race([finishPopBound.promise.catch(() => {}), canceled.promise]);
            if (!active.get()) {
              setVWC(loopIsActive, false);
              activeResources.dispose();
              newPrefetchResources.forEach((r) => r?.dispose());
              return;
            }

            logging.info(
              `${effectUid} | ${loopUid} - finishPop called, moving to next loop iteration`
            );

            state = popResult.data;
            releaseFromLastLoop = () => {
              logging.info(`${effectUid} | ${loopUid} - releasing prefetch resources`);
              setVWC(loopIsActive, false);
              activeResources.dispose();
              newPrefetchResources.forEach((r) => r?.dispose());
            };
            break;
          }

          if (!repeekRequested.done()) {
            throw new Error('unreachable');
          } else {
            logging.info(
              `${effectUid} | ${loopUid} - repeek requested from active screen, starting peek`
            );

            const peekPromise = screenQueueState.peek();
            await Promise.race([peekPromise.promise, canceled.promise]);
            if (!active.get()) {
              setVWC(loopIsActive, false);
              peekPromise.cancel();
              activeResources.dispose();
              prefetchResources.forEach((r) => r?.dispose());
              finishPopRequested?.cancel();
              startPopRequested.cancel();
              return;
            }
            const newResult = await peekPromise.promise;
            if (
              active.get() &&
              (newResult.type !== 'success' || newResult.data.type !== 'success')
            ) {
              logging.warn(`${effectUid} | ${loopUid} - peek failed, delegating to reinit`);
              cancel();
              reinit(++counter);
              // PURPOSEFUL FALL THROUGH
            }
            finishPopRequested?.cancel();
            startPopRequested.cancel();
            if (!active.get()) {
              activeResources.dispose();
              prefetchResources.forEach((r) => r?.dispose());
              return;
            } else {
              if (newResult.type !== 'success' || newResult.data.type !== 'success') {
                throw new Error('unreachable');
              }
              logging.info(`${effectUid} | ${loopUid} - moving onto next loop iteration`);
              state = newResult.data;
              releaseFromLastLoop = () => {
                setVWC(loopIsActive, false);
                activeResources.dispose();
                prefetchResources.forEach((r) => r?.dispose());
              };
              break;
            }
          }
        }
      }
    }
  }, [screenQueueState, screens, logging, screenContext, valueVWC]);

  return useMemo(() => ({ value: valueVWC }), [valueVWC]);
};

type RefreshResult = {
  active: Result<PeekedScreen<string, object>>;
  prefetch: Result<PeekedScreen<string, object>>[];
};
