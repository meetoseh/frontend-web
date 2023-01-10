import { ReactElement, useContext, useEffect, useState } from 'react';
import { LoginContext } from '../../shared/LoginContext';
import { DailyEvent, keyMap } from './DailyEvent';
import styles from './CurrentDailyEventLoader.module.css';
import { describeErrorFromResponse, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { apiFetch } from '../../shared/ApiConstants';
import { convertUsingKeymap } from '../../admin/crud/CrudFetcher';
import { DailyEventView } from './DailyEventView';
import { JourneyRef } from '../journey/Journey';
import { Buffer } from 'buffer';

type CurrentDailyEventLoaderProps = {
  /**
   * Called when the current daily event starts loading or has been loaded. Can
   * be used to display a splash screen rather than placeholders
   *
   * @param loaded True if the current daily event has been loaded, false otherwise
   */
  setLoaded: (this: void, loaded: boolean) => void;

  /**
   * Called when we receive a ref to the journey that the user should be directed
   * to
   *
   * @param journey The journey that the user should be directed to
   */
  setJourney: (this: void, journey: JourneyRef) => void;
};

export const CurrentDailyEventLoader = ({
  setLoaded,
  setJourney,
}: CurrentDailyEventLoaderProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [dailyEvent, setDailyEvent] = useState<DailyEvent | null>(null);
  const [jwtIsExpired, setJWTIsExpired] = useState(false);
  const [dailyEventLoading, setDailyEventLoading] = useState(true);
  const [error, setError] = useState<ReactElement | null>(null);

  useEffect(() => {
    let active = true;
    fetchCurrentDailyEvent();
    return () => {
      active = false;
    };

    async function fetchCurrentDailyEvent() {
      setError(null);
      if (loginContext.state !== 'logged-in') {
        return;
      }

      try {
        const response = await apiFetch('/api/1/daily_events/now', {}, loginContext);
        if (!active) {
          return;
        }

        if (!response.ok) {
          throw response;
        }

        const data = await response.json();
        if (!active) {
          return;
        }
        const event = convertUsingKeymap(data, keyMap);
        setDailyEvent(event);
        setJWTIsExpired(false);
      } catch (e) {
        if (!active) {
          return;
        }

        if (e instanceof TypeError) {
          setError(<>Failed to connect to server. Check your internet connection.</>);
        } else if (e instanceof Response) {
          const err = await describeErrorFromResponse(e);
          if (!active) {
            return;
          }
          setError(err);
        } else {
          setError(<>An unknown error occurred</>);
        }
      }
    }
  }, [loginContext, jwtIsExpired]);

  useEffect(() => {
    if (dailyEvent === null) {
      return;
    }

    if (jwtIsExpired) {
      return;
    }

    let visibilityEventKey: string | null = null;
    let visibilityStateKey: string | null = null;
    for (let [stateKey, eventKey] of [
      ['hidden', 'visibilitychange'],
      ['webkitHidden', 'webkitvisibilitychange'],
      ['mozHidden', 'mozvisibilitychange'],
      ['msHidden', 'msvisibilitychange'],
    ]) {
      if (stateKey in document) {
        visibilityEventKey = eventKey;
        visibilityStateKey = stateKey;
        break;
      }
    }

    let active = true;
    let timeout: NodeJS.Timeout | null = null;
    let visibilityHandler: (() => void) | null = null;

    const onTimeout = () => {
      if (!active) {
        return;
      }
      if (
        visibilityEventKey !== null &&
        visibilityStateKey !== null &&
        !!(document as any)[visibilityStateKey] /* noqa */
      ) {
        if (visibilityHandler === null) {
          visibilityHandler = onTimeout;
          document.addEventListener(visibilityEventKey, visibilityHandler);
        }
        return;
      }

      setJWTIsExpired(true);
      timeout = null;
    };

    const jwtBodyBase64 = dailyEvent.jwt.split('.')[1];
    const jwtBody = JSON.parse(Buffer.from(jwtBodyBase64, 'base64').toString('utf8'));
    const expirationMs = jwtBody.exp * 1000;
    const nowMs = Date.now();

    const wantRefreshAt = expirationMs - 60_000;

    if (wantRefreshAt < nowMs) {
      setJWTIsExpired(true);
    } else {
      const timeUntilExpirationMs = wantRefreshAt - nowMs;
      timeout = setTimeout(onTimeout, timeUntilExpirationMs);
    }

    const unmount = () => {
      if (!active) {
        return;
      }

      active = false;
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
      if (visibilityEventKey !== null && visibilityHandler !== null) {
        document.removeEventListener(visibilityEventKey, visibilityHandler);
        visibilityHandler = null;
      }
    };
    return unmount;
  }, [dailyEvent, jwtIsExpired]);

  useEffect(() => {
    setLoaded(dailyEvent !== null && !dailyEventLoading);
  }, [dailyEvent, dailyEventLoading, setLoaded]);

  return (
    <>
      {error && (
        <div className={styles.errorContainer}>
          <ErrorBlock>{error}</ErrorBlock>
        </div>
      )}
      {dailyEvent && (
        <DailyEventView
          event={dailyEvent}
          setLoading={setDailyEventLoading}
          setJourney={setJourney}
        />
      )}
    </>
  );
};
