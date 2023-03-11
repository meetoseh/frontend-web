import { MutableRefObject, useContext, useEffect, useMemo, useRef } from 'react';
import { apiFetch } from '../../../shared/ApiConstants';
import { Callbacks } from '../../../shared/lib/Callbacks';
import { LoginContext } from '../../../shared/LoginContext';
import { InteractivePrompt } from '../models/InteractivePrompt';
import { PromptTime, waitUntilUsingPromptTime } from './usePromptTime';

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

  useEffect(() => {
    if (infoRef.current.joined) {
      return;
    }

    let active = true;
    const cancelers = new Callbacks<undefined>();
    const unmount = () => {
      if (!active) {
        return;
      }
      active = false;
      cancelers.call(undefined);
      cancelers.clear();
    };

    handleEvents()
      .catch((e) => {
        console.error('Error handling join/leave events: ', e);
        setInfo(Object.assign({}, infoRef.current, { error: e }));
      })
      .finally(unmount);
    return unmount;

    async function handleEvents() {
      if (infoRef.current.error !== null) {
        setInfo(Object.assign({}, infoRef.current, { error: null }));
      }

      let timePrevious: DOMHighResTimeStamp | null = null;
      await waitUntilUsingPromptTime(promptTime, (event) => {
        if (event.current >= 0) {
          timePrevious = Math.max(0, event.old);
          return true;
        }
        return false;
      });
      if (timePrevious === null) {
        throw new Error('timePrevious should not be null');
      }

      const cancelPromise = new Promise((resolve) => {
        cancelers.add(resolve);
      });
      const eventPromise = sendEvent('join', timePrevious);
      await Promise.race([cancelPromise, eventPromise]);
      if (!active) {
        return;
      }

      setInfo(Object.assign({}, infoRef.current, { joined: true }));
      let alreadyLeft = false;
      const onBeforeUnload = () => {
        if (!alreadyLeft) {
          alreadyLeft = true;
          const leftAt = Math.min(prompt.durationSeconds * 1000, promptTime.time.current);
          sendEvent('leave', leftAt);
        }
      };
      window.addEventListener('beforeunload', onBeforeUnload);

      await Promise.race([
        cancelPromise,
        waitUntilUsingPromptTime(
          promptTime,
          (event) => event.current >= prompt.durationSeconds * 1000
        ),
      ]);
      if (alreadyLeft) {
        return;
      }
      window.removeEventListener('beforeunload', onBeforeUnload);

      alreadyLeft = true;
      const leftAt = Math.min(prompt.durationSeconds * 1000, promptTime.time.current);
      await sendEvent('leave', leftAt);
      if (!active) {
        return;
      }

      setInfo(Object.assign({}, infoRef.current, { left: true }));
    }

    function setInfo(newInfo: JoinLeaveInfo) {
      const oldInfo = infoRef.current;
      infoRef.current = newInfo;
      infoChangedRef.current.call({ old: oldInfo, current: newInfo });
    }

    async function sendEvent(name: 'join' | 'leave', eventPromptTime: number) {
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
  }, [prompt, promptTime, loginContext]);

  return useMemo(
    () => ({
      info: infoRef,
      onInfoChanged: infoChangedRef,
    }),
    []
  );
};
