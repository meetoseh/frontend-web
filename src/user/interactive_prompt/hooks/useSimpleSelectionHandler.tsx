import { useEffect, useRef } from 'react';
import { InteractivePrompt } from '../models/InteractivePrompt';
import { JoinLeave } from './useJoinLeave';
import { PromptTime, PromptTimeEvent } from './usePromptTime';
import { SimpleSelectionChangedEvent, SimpleSelectionRef } from './useSimpleSelection';

type SimpleSelectionHandlerProps<T> = {
  /**
   * The selection which should trigger the function call.
   */
  selection: SimpleSelectionRef<T>;

  /**
   * The prompt that the selection is for, to avoid calling the function
   * after the prompt has ended
   */
  prompt: InteractivePrompt;

  /**
   * The join leave state, so that we don't try calling the function
   * if we failed to join or have already left, since the session
   * is frozen in those cases.
   */
  joinLeave: JoinLeave;

  /**
   * The prompt time, so that we can avoid calling the function
   * multiple times at the same prompt time (which will typically
   * result in errors as the backend will reject two events at the
   * same time), as well as to pass the event time to the callback
   */
  promptTime: PromptTime;

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
  selection,
  prompt,
  joinLeave,
  promptTime,
  callback,
  tEquals,
}: SimpleSelectionHandlerProps<T>) {
  const callbackRef = useRef(callback);
  const tEqualsRef = useRef(tEquals);

  useEffect(() => {
    const tOrNullEquals = (a: T | null, b: T | null): boolean => {
      if (a === null || b === null || tEqualsRef.current === undefined) {
        return a === b;
      }
      return tEqualsRef.current(a, b);
    };
    const callback = (selected: T, promptTime: number): Promise<void> | void => {
      if (callbackRef.current === undefined) {
        return;
      }
      return callbackRef.current(selected, promptTime);
    };

    let active = true;
    let callbackSelection = selection.selection.current;
    let lastEventAt = 0;
    // if delayedEvent is true; two things are true:
    // 1. onPromptTimeEvent is registered as a callback on promptTime
    // 2. callbackSelection may differ from selection.selection.current
    let delayedEvent = false;
    let callbackRunning = false;

    selection.onSelectionChanged.current.add(onSelectionEvent);
    return () => {
      active = false;
      selection.onSelectionChanged.current.remove(onSelectionEvent);
      if (delayedEvent) {
        promptTime.onTimeChanged.current.remove(onPromptTimeEvent);
      }
    };

    function onSelectionEvent(
      event: SimpleSelectionChangedEvent<T> | { isSynthetic: true; current: T }
    ) {
      if (!active) {
        return;
      }

      if (delayedEvent) {
        // This will be handled when the delay ends
        return;
      }

      if (joinLeave.info.current.error !== null || joinLeave.info.current.left) {
        // Can't handle events if we've failed to join or have already left
        return;
      }

      if (promptTime.time.current >= prompt.durationSeconds * 1000) {
        // Can't handle events after the prompt ends
        return;
      }

      if (tOrNullEquals(event.current, callbackSelection)) {
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

      if (!joinLeave.info.current.joined) {
        // Delay events until we've actually joined the session
        delayEvent();
        return;
      }

      if (lastEventAt >= promptTime.time.current) {
        // Delay to prevent calling the callback multiple times at the same
        // prompt time
        delayEvent();
        return;
      }

      runCallback();
    }

    function delayEvent() {
      delayedEvent = true;
      promptTime.onTimeChanged.current.add(onPromptTimeEvent);
    }

    function cancelDelayedEvent() {
      if (delayedEvent) {
        delayedEvent = false;
        promptTime.onTimeChanged.current.remove(onPromptTimeEvent);
      }
    }

    async function runCallback() {
      const selected = selection.selection.current;
      const now = promptTime.time.current;
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

      if (
        !tOrNullEquals(selection.selection.current, selected) &&
        selection.selection.current !== null
      ) {
        onSelectionEvent({ isSynthetic: true, current: selection.selection.current });
      }
    }

    function onPromptTimeEvent(event: PromptTimeEvent) {
      if (!active || !delayedEvent) {
        // This handler should have been removed
        return;
      }

      if (joinLeave.info.current.error !== null) {
        // Failed to join, no point in trying to handle events
        cancelDelayedEvent();
        return;
      }

      if (joinLeave.info.current.left) {
        // Already left, no point in trying to handle events
        cancelDelayedEvent();
        return;
      }

      if (promptTime.time.current >= prompt.durationSeconds * 1000) {
        // Prompt ended, no point in trying to handle events
        cancelDelayedEvent();
        return;
      }

      if (tOrNullEquals(selection.selection.current, callbackSelection)) {
        // Before we managed to call the callback, the selection changed
        // back to what it was, so we no longer need to call the callback
        cancelDelayedEvent();
        return;
      }

      if (callbackRunning) {
        // Still waiting on the callback to finish
        return;
      }

      if (lastEventAt >= event.current) {
        // Still waiting for a new prompt time
        return;
      }

      if (!joinLeave.info.current.joined) {
        // Still waiting to join
        return;
      }

      runCallback();
    }
  }, [selection, prompt, joinLeave, promptTime]);
}
