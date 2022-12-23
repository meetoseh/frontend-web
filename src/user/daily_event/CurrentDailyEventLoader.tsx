import { ReactElement, useContext, useEffect, useState } from 'react';
import { LoginContext } from '../../shared/LoginContext';
import { DailyEvent, keyMap } from './DailyEvent';
import styles from './CurrentDailyEventLoader.module.css';
import { describeErrorFromResponse, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { apiFetch } from '../../shared/ApiConstants';
import { convertUsingKeymap } from '../../admin/crud/CrudFetcher';
import { DailyEventView } from './DailyEventView';

type CurrentDailyEventLoaderProps = {
  /**
   * Called when the current daily event starts loading or has been loaded. Can
   * be used to display a splash screen rather than placeholders
   *
   * @param loaded True if the current daily event has been loaded, false otherwise
   */
  setLoaded: (this: void, loaded: boolean) => void;
};

export const CurrentDailyEventLoader = ({
  setLoaded,
}: CurrentDailyEventLoaderProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [dailyEvent, setDailyEvent] = useState<DailyEvent | null>(null);
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
  }, [loginContext]);

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
      {dailyEvent && <DailyEventView event={dailyEvent} setLoading={setDailyEventLoading} />}
    </>
  );
};
