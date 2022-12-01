import { CSSProperties, ReactElement, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../../shared/ApiConstants';
import { LoginContext } from '../../shared/LoginContext';
import { ActionsBlock } from './blocks/ActionsBlock';
import { HistoricalBlock } from './blocks/HistoricalBlock';
import { LiveBlock } from './blocks/LiveBlock';
import { StatsBlock } from './blocks/StatsBlock';
import { JourneyRef } from './DevJourneyApp';

type DevJourneyProps = {
  /**
   * The reference to the journey to debug
   */
  journeyRef: JourneyRef;
};

/**
 * Allows debugging the particular journey. Must be remounted if the journey ref changes
 */
export const DevJourney = ({ journeyRef }: DevJourneyProps): ReactElement => {
  const [isMobile, setIsMobile] = useState(false);
  const [running, setRunning] = useState(false);
  const [sessionUID, setSessionUID] = useState<string | null>(null);
  const [journeyTime, setJourneyTime] = useState<number>(-1);
  const loginContext = useContext(LoginContext);

  useEffect(() => {
    const mediaQuery = matchMedia('(max-width: 991px)');

    const listener = () => {
      setIsMobile(mediaQuery.matches);
    };
    listener();

    mediaQuery.addEventListener('change', listener);
    return () => {
      mediaQuery.removeEventListener('change', listener);
    };
  }, []);

  useEffect(() => {
    let active = true;
    startOrEndSession();
    return () => {
      active = false;
    };

    async function startOrEndSession() {
      if (sessionUID === null && !running) {
        return;
      }
      if (sessionUID !== null && running) {
        return;
      }

      if (!running) {
        apiFetch(
          '/api/1/journeys/events/leave',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              journey_uid: journeyRef.uid,
              journey_jwt: journeyRef.jwt,
              session_uid: sessionUID,
              journey_time: Math.max(Math.min(journeyTime, journeyRef.durationSeconds), 0),
              data: {},
            }),
          },
          loginContext
        );
        setSessionUID(null);
        return;
      }

      const response = await apiFetch(
        `/api/1/journeys/dev_start_session/${journeyRef.uid}`,
        {
          method: 'POST',
        },
        loginContext
      );
      if (!active) {
        return;
      }
      if (!response.ok) {
        const text = await response.text();
        if (!active) {
          return;
        }
        console.log('Failed to start journey session', response, text);
        setRunning(false);
        return;
      }
      const data = await response.json();
      if (!active) {
        return;
      }

      const newSessionUID: string = data.session_uid;

      const joinResponse = await apiFetch(
        '/api/1/journeys/events/join',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            journey_uid: journeyRef.uid,
            journey_jwt: journeyRef.jwt,
            session_uid: newSessionUID,
            journey_time: Math.max(Math.min(journeyTime, journeyRef.durationSeconds), 0),
            data: {},
          }),
        },
        loginContext
      );
      if (!active) {
        if (joinResponse.ok) {
          await apiFetch(
            '/api/1/journeys/events/leave',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                journey_uid: journeyRef.uid,
                journey_jwt: journeyRef.jwt,
                session_uid: newSessionUID,
                journey_time: Math.max(Math.min(journeyTime, journeyRef.durationSeconds), 0),
                data: {},
              }),
            },
            loginContext
          );
        }
        return;
      }
      if (!joinResponse.ok) {
        const text = await joinResponse.text();
        if (!active) {
          return;
        }
        console.log('Failed to join journey session', response, text);
        return;
      }
      setSessionUID(newSessionUID);
    }
  }, [running, journeyRef, sessionUID, loginContext, journeyTime]);

  useEffect(() => {
    let active = true;
    startTickingTime();
    return () => {
      active = false;
    };

    async function startTickingTime() {
      if (!running || sessionUID === null) {
        return;
      }

      let last: DOMHighResTimeStamp | null = null;
      const update = (now: DOMHighResTimeStamp) => {
        if (!active) {
          return;
        }
        if (last !== null) {
          const delta = now - last;
          setJourneyTime((time) => time + delta / 1000);
        }
        last = now;
        requestAnimationFrame(update);
      };

      requestAnimationFrame(update);
    }
  }, [running, sessionUID]);

  useEffect(() => {
    if (running && journeyTime > journeyRef.durationSeconds) {
      setRunning(false);
    }
  }, [running, journeyTime, journeyRef]);

  const styles = isMobile ? MOBILE_STYLES : DESKTOP_STYLES;

  return (
    <div
      style={{
        display: 'flex',
        flexFlow: 'row wrap',
      }}>
      <div
        style={{
          display: 'flex',
          flexFlow: 'row wrap',
          justifyContent: 'space-around',
          alignItems: 'center',
          width: '100%',
        }}>
        <div style={styles.infoItem}>
          duration:{' '}
          {journeyRef.durationSeconds.toLocaleString(undefined, { maximumFractionDigits: 2 })}s
        </div>
        <div style={styles.infoItem}>
          fenwick bin width:{' '}
          {journeyRef.fenwickBinWidth.toLocaleString(undefined, { maximumFractionDigits: 3 })}s
        </div>
        <div style={styles.infoItem}>
          prompt:{' '}
          <pre style={{ fontFamily: 'Roboto Mono', overflowX: 'auto' }}>
            {JSON.stringify(journeyRef.prompt, null, 2)}
          </pre>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexFlow: 'row wrap',
          justifyContent: 'space-around',
          alignItems: 'center',
          width: '100%',
          marginTop: '24px',
          gap: '1em',
          padding: '0 16px',
        }}>
        <div style={styles.infoSection}>
          <div>
            {(running && (
              <button style={{ padding: '2px 4px' }} onClick={() => setRunning(false)}>
                Stop
              </button>
            )) || (
              <button style={{ padding: '2px 4px' }} onClick={() => setRunning(true)}>
                Start
              </button>
            )}
          </div>
          <div>
            journey time:
            <input
              disabled={running}
              type="number"
              value={journeyTime.toLocaleString(undefined, {
                maximumFractionDigits: 2,
                useGrouping: false,
              })}
              style={{ marginLeft: '0.25em' }}
              onChange={(e) => setJourneyTime(e.target.valueAsNumber)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25em' }}>
            <div>session uid:</div>
            <input
              style={{
                fontFamily: 'Roboto Mono',
                display: 'inline-block',
                overflowX: 'auto',
                flexGrow: '1',
              }}
              disabled
              value={sessionUID || ''}
              placeholder="not set"
            />
          </div>
        </div>
        <div style={styles.infoSection}>
          <ActionsBlock
            journeyRef={journeyRef}
            sessionUID={sessionUID}
            running={running}
            journeyTime={journeyTime}
          />
        </div>
        <div style={styles.infoSection}>
          <HistoricalBlock
            journeyRef={journeyRef}
            sessionUID={sessionUID}
            running={running}
            journeyTime={journeyTime}
          />
        </div>
        <div style={styles.infoSection}>
          <LiveBlock
            journeyRef={journeyRef}
            sessionUID={sessionUID}
            running={running}
            journeyTime={journeyTime}
          />
        </div>
        <div style={styles.infoSection}>
          <StatsBlock
            journeyRef={journeyRef}
            sessionUID={sessionUID}
            running={running}
            journeyTime={journeyTime}
          />
        </div>
      </div>
    </div>
  );
};

const SHARED_STYLES: { [name: string]: CSSProperties } = {
  infoSection: {
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    border: '0.5px solid #ccc',
    boxShadow: '0 0 4px #ccc',
    gap: '16px',
    alignItems: 'stretch',
  },
};

const DESKTOP_STYLES: { [name: string]: CSSProperties } = {
  infoItem: {
    maxWidth: '48%',
  },
  ...SHARED_STYLES,
};

const MOBILE_STYLES: { [name: string]: CSSProperties } = {
  infoItem: {
    width: '100%',
  },
  ...SHARED_STYLES,
};
