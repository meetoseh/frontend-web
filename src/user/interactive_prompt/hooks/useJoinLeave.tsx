import { MutableRefObject, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { apiFetch } from '../../../shared/ApiConstants';
import { Callbacks } from '../../../shared/lib/Callbacks';
import { createCancelablePromiseFromCallbacks } from '../../../shared/lib/createCancelablePromiseFromCallbacks';
import { LoginContext, LoginContextValue } from '../../../shared/LoginContext';
import { InteractivePrompt } from '../models/InteractivePrompt';
import { PromptTime, waitUntilUsingPromptTimeCancelable } from './usePromptTime';

/**
 * The information exported from the join/leave hook.
 */
export type JoinLeaveInfo = {
  /**
   * Whether the user has joined the room.
   */
  joined: boolean;

  /**
   * Whether the user has left the room.
   */
  left: boolean;

  /**
   * If an error occurred preventing join/leave events, the
   * error that occurred, otherwise null.
   */
  error: any | null;
};

export type JoinLeaveChangedEvent = {
  /**
   * The join/leave info prior to the change.
   */
  old: JoinLeaveInfo;

  /**
   * The join/leave info after the change.
   */
  current: JoinLeaveInfo;
};

export type JoinLeave = {
  /**
   * A ref object that points to the current information
   */
  info: MutableRefObject<JoinLeaveInfo>;

  /**
   * The callbacks to call when the join/leave info changes
   */
  onInfoChanged: MutableRefObject<Callbacks<JoinLeaveChangedEvent>>;
};

type JoinLeaveProps = {
  /**
   * The prompt we are generating join/leave events for
   */
  prompt: InteractivePrompt;

  /**
   * The prompt time that we use to decide when to generate the
   * events.
   */
  promptTime: PromptTime;
};

/**
 * A hook-like function which generates a join event when the prompt
 * time passes over 0 and a leave event when unmounted or the prompt
 * time passes over the duration.
 *
 * This returns an object that can be used to check which events have
 * been sent, but it does not trigger state updates to do so. A callbacks
 * list is available if you want to be notified when the events are
 * sent.
 */
export const useJoinLeave = ({ prompt, promptTime }: JoinLeaveProps) => {
  const loginContext = useContext(LoginContext);
  const infoRef = useRef<JoinLeaveInfo>() as MutableRefObject<JoinLeaveInfo>;
  if (infoRef.current === undefined) {
    infoRef.current = { joined: false, left: false, error: null };
  }

  const infoChangedRef = useRef<Callbacks<JoinLeaveChangedEvent>>() as MutableRefObject<
    Callbacks<JoinLeaveChangedEvent>
  >;
  if (infoChangedRef.current === undefined) {
    infoChangedRef.current = new Callbacks();
  }

  const updateInfo = useCallback((newInfo: JoinLeaveInfo) => {
    const oldInfo = infoRef.current;
    infoRef.current = newInfo;
    infoChangedRef.current.call({ old: oldInfo, current: newInfo });
  }, []);

  const sendingEventRef = useRef(false);
  const sendingEventChangedRef = useRef<Callbacks<boolean>>() as MutableRefObject<
    Callbacks<boolean>
  >;
  if (sendingEventChangedRef.current === undefined) {
    sendingEventChangedRef.current = new Callbacks();
  }

  useEffect(() => {
    let active = true;
    let cancelers = new Callbacks<undefined>();
    handleJoin();
    return () => {
      active = false;
      cancelers.call(undefined);
    };

    async function handleJoinInner() {
      if (!active) {
        return;
      }

      if (promptTime.time.current < 0) {
        const timePromise = waitUntilUsingPromptTimeCancelable(promptTime, (e) => e.current >= 0);
        timePromise.promise.catch(() => {});
        const cancelPromise = createCancelablePromiseFromCallbacks(cancelers);
        cancelPromise.promise.catch(() => {});

        await Promise.race([timePromise.promise, cancelPromise.promise]);
        timePromise.cancel();
        cancelPromise.cancel();
        if (!active) {
          return;
        }
      }

      await waitUntilNotSendingEvent();
      if (!active) {
        return;
      }

      if (!infoRef.current.joined) {
        sendingEventRef.current = true;
        sendingEventChangedRef.current.call(true);
        try {
          await sendEvent('join', promptTime.time.current, prompt, loginContext);
          updateInfo(Object.assign({}, infoRef.current, { joined: true }));
        } catch (e) {
          updateInfo(Object.assign({}, infoRef.current, { error: e }));
        } finally {
          sendingEventRef.current = false;
          sendingEventChangedRef.current.call(false);
        }
      }

      let alreadyLeft = false;
      const endTime = prompt.durationSeconds * 1000;

      await waitUntilNotSendingEvent();
      if (!active) {
        return;
      }

      sendingEventRef.current = true;
      sendingEventChangedRef.current.call(true);

      const onLeft = async (skipCallbacks: boolean) => {
        if (alreadyLeft) {
          return;
        }
        alreadyLeft = true;
        const leftAt = Math.min(endTime, promptTime.time.current);
        try {
          await sendEvent('leave', leftAt, prompt, loginContext);
          if (!skipCallbacks) {
            updateInfo(Object.assign({}, infoRef.current, { left: true }));
          }
        } catch (e) {
          if (!skipCallbacks) {
            updateInfo(Object.assign({}, infoRef.current, { error: e }));
          }
        } finally {
          if (!skipCallbacks) {
            sendingEventRef.current = false;
            sendingEventChangedRef.current.call(false);
          }
        }
      };

      const onBeforeUnload = () => {
        onLeft(true);
      };

      window.addEventListener('beforeunload', onBeforeUnload);
      cancelers.add(() => {
        window.removeEventListener('beforeunload', onBeforeUnload);
      });

      const timePromise = waitUntilUsingPromptTimeCancelable(
        promptTime,
        (e) => e.current >= endTime
      );
      timePromise.promise.catch(() => {});

      const cancelPromise = createCancelablePromiseFromCallbacks(cancelers);
      cancelPromise.promise.catch(() => {});

      await Promise.race([timePromise.promise, cancelPromise.promise]);
      timePromise.cancel();
      cancelPromise.cancel();
      onLeft(false);
    }

    async function handleJoin() {
      if (infoRef.current.error !== null) {
        updateInfo(Object.assign({}, infoRef.current, { error: null }));
      }

      try {
        await handleJoinInner();
      } catch (e) {
        if (!infoRef.current.joined) {
          updateInfo(Object.assign({}, infoRef.current, { error: e }));
        }
      }
    }

    async function waitUntilNotSendingEvent() {
      while (sendingEventRef.current) {
        const changedPromise = createCancelablePromiseFromCallbacks(sendingEventChangedRef.current);
        changedPromise.promise.catch(() => {});
        const cancelPromise = createCancelablePromiseFromCallbacks(cancelers);
        cancelPromise.promise.catch(() => {});

        await Promise.race([changedPromise.promise, cancelPromise.promise]);
        changedPromise.cancel();
        cancelPromise.cancel();
        if (!active) {
          return;
        }
      }
    }
  });

  return useMemo(
    () => ({
      info: infoRef,
      onInfoChanged: infoChangedRef,
    }),
    []
  );
};

async function sendEvent(
  name: 'join' | 'leave',
  eventPromptTime: number,
  prompt: InteractivePrompt,
  loginContext: LoginContextValue
) {
  const response = await apiFetch(
    `/api/1/interactive_prompts/events/${name}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        interactive_prompt_uid: prompt.uid,
        interactive_prompt_jwt: prompt.jwt,
        session_uid: prompt.sessionUid,
        prompt_time: eventPromptTime / 1000.0,
        data: {},
      }),
      keepalive: true,
    },
    loginContext
  );

  if (!response.ok) {
    throw response;
  }
}
