import { MutableRefObject, useEffect, useRef } from 'react';
import { InteractivePrompt } from '../models/InteractivePrompt';
import { JoinLeave } from './useJoinLeave';
import {
  VariableStrategyProps,
  useVariableStrategyPropsAsValueWithCallbacks,
} from '../../../shared/anim/VariableStrategyProps';
import { PromptTime } from './usePromptTime';

type SimpleSelectionHandlerProps<T> = {
  /**
   * The selection which should trigger the function call.
   */
  selection: VariableStrategyProps<T>;

  /**
   * The prompt that the selection is for, to avoid calling the function
   * after the prompt has ended
   */
  prompt: VariableStrategyProps<InteractivePrompt>;

  /**
   * The join leave state, so that we don't try calling the function
   * if we failed to join or have already left, since the session
   * is frozen in those cases.
   */
  joinLeave: VariableStrategyProps<JoinLeave>;

  /**
   * The prompt time, so that we can avoid calling the function
   * multiple times at the same prompt time (which will typically
   * result in errors as the backend will reject two events at the
   * same time), as well as to pass the event time to the callback
   */
  promptTime: VariableStrategyProps<PromptTime>;

  /**
   * The callback to call with the new selected value and the prompt time
   * when it occurred (or a nearby later prompt time if there was already
   * a selection at the same prompt time). Note that if the selections are
   * going very quickly this may skip over a few, but once it stops changing
   * it will always be called with the latest value (if it's possible to
   * do so)
   *
   * Changing this value will take into effect on the next call without
   * unmounting any effects.
   *
   * @param selected The new selected value
   * @param promptTime The prompt time at which the selection occurred
   * @returns If a promise is returned, the callback will not be called again
   *   until the promise resolves or rejects.
   */
  callback: (selected: T, promptTime: number) => Promise<void> | void;

  /**
   * How to determine if two selections are equal. If not provided, the
   * default is to use ===
   * @param a
   * @param b
   * @returns If a and b are equal
   */
  tEquals?: (a: T, b: T) => boolean;
};

/**
 * A hook-like function to call the given function whenever the selection
 * changes, but only at most once per prompt time, and only if the session is
 * active (we've joined and not left) and the prompt is ending. This is
 * primarily used to store in the backend the users selection, though in theory
 * it could be used for other purposes.
 */
export function useSimpleSelectionHandler<T>({
  selection: selectionVariableStrategy,
  prompt: promptVariableStrategy,
  joinLeave: joinLeaveVariableStrategy,
  promptTime: promptTimeVariableStrategy,
  callback,
  tEquals,
}: SimpleSelectionHandlerProps<T>) {
  const callbackRef = useRef<
    (selected: T, promptTime: number) => Promise<void> | void
  >() as MutableRefObject<(selected: T, promptTime: number) => Promise<void> | void>;
  const tEqualsRef = useRef<(a: T, b: T) => boolean>();

  callbackRef.current = callback;
  tEqualsRef.current = tEquals;

  const selectionVWC = useVariableStrategyPropsAsValueWithCallbacks(selectionVariableStrategy);
  const promptVWC = useVariableStrategyPropsAsValueWithCallbacks(promptVariableStrategy);
  const joinLeaveVWC = useVariableStrategyPropsAsValueWithCallbacks(joinLeaveVariableStrategy);
  const promptTimeVWC = useVariableStrategyPropsAsValueWithCallbacks(promptTimeVariableStrategy);

  useEffect(() => {
    const tOrNullEquals = (a: T | null, b: T | null): boolean => {
      if (a === null || b === null || tEqualsRef.current === undefined) {
        return a === b;
      }
      return tEqualsRef.current(a, b);
    };
    const callback = (selected: T, promptTime: number): Promise<void> | void => {
      return callbackRef.current(selected, promptTime);
    };

    let active = true;
    let callbackSelection = selectionVWC.get();
    let lastEventAt = 0;
    // if delayedEvent is true; two things are true:
    // 1. onPromptTimeEvent is registered as a callback on promptTime
    // 2. callbackSelection may differ from selection.selection.current
    let delayedEvent = false;
    let callbackRunning = false;

    selectionVWC.callbacks.add(onSelectionEvent);
    return () => {
      active = false;
      selectionVWC.callbacks.remove(onSelectionEvent);
      if (delayedEvent) {
        promptTimeVWC.callbacks.remove(onPromptTimeEvent);
      }
    };

    function onSelectionEvent() {
      if (!active) {
        return;
      }

      if (delayedEvent) {
        // This will be handled when the delay ends
        return;
      }

      if (joinLeaveVWC.get().error !== null || joinLeaveVWC.get().leaving) {
        // Can't handle events if we've failed to join or are in the process of leaving / have left
        return;
      }

      if (promptTimeVWC.get().time >= promptVWC.get().durationSeconds * 1000) {
        // Can't handle events after the prompt ends
        return;
      }

      if (tOrNullEquals(selectionVWC.get(), callbackSelection)) {
        // No change
        return;
      }

      if (callbackRunning) {
        // Delay to prevent having the callback running multiple times at the
        // same time. However, since the runCallback function will generate
        // a synthetic event anyway when it's done, we don't even have to
        // register the prompt time listener
        return;
      }

      if (joinLeaveVWC.get().joinedAt === null) {
        // Delay events until we've actually joined the session
        delayEvent();
        return;
      }

      if (lastEventAt >= promptTimeVWC.get().time) {
        // Delay to prevent calling the callback multiple times at the same
        // prompt time
        delayEvent();
        return;
      }

      runCallback();
    }

    function delayEvent() {
      delayedEvent = true;
      promptTimeVWC.callbacks.add(onPromptTimeEvent);
    }

    function cancelDelayedEvent() {
      if (delayedEvent) {
        delayedEvent = false;
        promptTimeVWC.callbacks.remove(onPromptTimeEvent);
      }
    }

    async function runCallback() {
      const selected = selectionVWC.get();
      const now = promptTimeVWC.get().time;
      if (selected === null) {
        throw new Error('runCallback while selected is null');
      }

      callbackRunning = true;
      try {
        await callback(selected, now);
      } catch (e) {
        console.error('Error ignored in simpleSelectionHandler callback', callback, ': ', e);
      }
      lastEventAt = now;
      callbackSelection = selected;
      callbackRunning = false;
      cancelDelayedEvent();

      if (!tOrNullEquals(selectionVWC.get(), selected) && selectionVWC.get() !== null) {
        onSelectionEvent();
      }
    }

    function onPromptTimeEvent() {
      if (!active || !delayedEvent) {
        // This handler should have been removed
        return;
      }

      if (joinLeaveVWC.get().error !== null) {
        // Failed to join, no point in trying to handle events
        cancelDelayedEvent();
        return;
      }

      if (joinLeaveVWC.get().leaving) {
        // Already left, no point in trying to handle events
        cancelDelayedEvent();
        return;
      }

      if (promptTimeVWC.get().time >= promptVWC.get().durationSeconds * 1000) {
        // Prompt ended, no point in trying to handle events
        cancelDelayedEvent();
        return;
      }

      if (tOrNullEquals(selectionVWC.get(), callbackSelection)) {
        // Before we managed to call the callback, the selection changed
        // back to what it was, so we no longer need to call the callback
        cancelDelayedEvent();
        return;
      }

      if (callbackRunning) {
        // Still waiting on the callback to finish
        return;
      }

      if (lastEventAt >= promptTimeVWC.get().time) {
        // Still waiting for a new prompt time
        return;
      }

      if (!joinLeaveVWC.get().joinedAt === null) {
        // Still waiting to join
        return;
      }

      runCallback();
    }
  }, [selectionVWC, promptVWC, joinLeaveVWC, promptTimeVWC]);
}
