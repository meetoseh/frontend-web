import { useEffect, useRef } from 'react';
import { apiFetch } from '../../../shared/ApiConstants';
import { LoginContextValue } from '../../../shared/LoginContext';
import { JourneyTime } from './useJourneyTime';

type JoinLeaveKwargs = {
  /**
   * The uid of the journey the session is in
   */
  journeyUid: string;
  /**
   * The JWT to add events to the session within the journey
   */
  journeyJwt: string;
  /**
   * The uid of the session within the journey
   */
  sessionUid: string;
  /**
   * The duration of the journey in seconds
   */
  journeyDurationSeconds: number;
  /**
   * The current journey time, so we know when to post the events at
   */
  journeyTime: JourneyTime;
  /**
   * The login context for authentication
   */
  loginContext: LoginContextValue;
};

/**
 * Sends a join event when the journey time crosses over zero, and a leave
 * event when unmounted or the journey time crosses over the journey duration
 */
export const useJoinLeave = ({
  journeyUid,
  journeyJwt,
  sessionUid,
  journeyDurationSeconds,
  journeyTime,
  loginContext,
}: JoinLeaveKwargs) => {
  const joined = useRef<boolean>(false);
  const left = useRef<boolean>(false);

  useEffect(() => {
    if (loginContext.state !== 'logged-in') {
      return;
    }

    if (joined.current) {
      return;
    }

    let active = true;
    const onTimeChanged = (lastTime: DOMHighResTimeStamp, newTime: DOMHighResTimeStamp) => {
      if (newTime < 0) {
        return;
      }

      if (!active) {
        return;
      }

      if (!joined.current) {
        joined.current = true;
        createJoinEvent(Math.max(lastTime, 0));
      }
      unmount();
    };

    const predictedIndex = journeyTime.onTimeChanged.current.length;
    journeyTime.onTimeChanged.current.push(onTimeChanged);

    const unmount = () => {
      if (!active) {
        return;
      }
      active = false;
      for (let i = predictedIndex; i >= 0; i--) {
        if (journeyTime.onTimeChanged.current[i] === onTimeChanged) {
          journeyTime.onTimeChanged.current.splice(i, 1);
          break;
        }
      }
    };

    return unmount;

    async function createJoinEvent(time: DOMHighResTimeStamp) {
      try {
        const response = await apiFetch(
          '/api/1/journeys/events/join',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              journey_uid: journeyUid,
              journey_jwt: journeyJwt,
              session_uid: sessionUid,
              journey_time: time / 1000,
              data: {},
            }),
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }
      } catch (e) {
        if (e instanceof TypeError) {
          console.error('Failed to connect to server for join event:', e);
        } else if (e instanceof Response) {
          const body = await e.json();
          console.error('Failed to create join event:', body);
        } else {
          console.error('Failed to create join event (unknown error):', e);
        }
      }
    }
  }, [journeyUid, journeyJwt, sessionUid, journeyTime.onTimeChanged, loginContext]);

  useEffect(() => {
    if (loginContext.state !== 'logged-in') {
      return;
    }

    if (left.current) {
      return;
    }

    let active = true;
    const onTimeChanged = (lastTime: DOMHighResTimeStamp, newTime: DOMHighResTimeStamp) => {
      if (newTime < journeyDurationSeconds * 1000) {
        return;
      }

      if (!active) {
        return;
      }

      unmount();
    };

    const predictedIndex = journeyTime.onTimeChanged.current.length;
    journeyTime.onTimeChanged.current.push(onTimeChanged);

    const unmount = () => {
      if (!active) {
        return;
      }
      active = false;

      for (let i = predictedIndex; i >= 0; i--) {
        if (journeyTime.onTimeChanged.current[i] === onTimeChanged) {
          journeyTime.onTimeChanged.current.splice(i, 1);
          break;
        }
      }

      if (joined.current && !left.current) {
        left.current = true;
        createLeaveEvent(Math.min(journeyTime.time.current, journeyDurationSeconds * 1000));
      }

      window.removeEventListener('beforeunload', unmount);
    };

    window.addEventListener('beforeunload', unmount);
    return unmount;

    async function createLeaveEvent(time: DOMHighResTimeStamp) {
      try {
        const response = await apiFetch(
          '/api/1/journeys/events/leave',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              journey_uid: journeyUid,
              journey_jwt: journeyJwt,
              session_uid: sessionUid,
              journey_time: time / 1000,
              data: {},
            }),
            keepalive: true,
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }
      } catch (e) {
        if (e instanceof TypeError) {
          console.error('Failed to connect to server for leave event:', e);
        } else if (e instanceof Response) {
          const body = await e.json();
          console.error('Failed to create leave event:', body);
        } else {
          console.error('Failed to create leave event (unknown error):', e);
        }
      }
    }
  }, [
    journeyUid,
    journeyJwt,
    sessionUid,
    journeyDurationSeconds,
    journeyTime.onTimeChanged,
    journeyTime.time,
    loginContext,
  ]);
};
