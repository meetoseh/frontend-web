import { ReactElement, useEffect, useMemo, useState } from 'react';
import { HTTP_API_URL } from '../../shared/ApiConstants';
import '../../assets/fonts.css';
import styles from './ConnectivityScreen.module.css';

type PingStats = {
  /**
   * The number of seconds between batches of requests
   */
  frequency: number;

  /**
   * The number of requests per batch
   */
  batchSize: number;

  /**
   * How many batches have been sent
   */
  numBatches: number;

  /**
   * The number of batches which had no failures
   */
  batchSuccesses: number;
};

/**
 * A debugging screen which attempts to ping the backend occassionally
 * to understand how stable the connection is.
 */
export const ConnectivityScreen = (): ReactElement => {
  const openedAt = useMemo(() => Date.now(), []);
  const [now, setNow] = useState(openedAt);

  const frontend = usePingStats({
    frequency: 180,
    batchSize: 5,
    url: '/',
  });

  const backend = usePingStats({
    frequency: 180,
    batchSize: 5,
    url: `${HTTP_API_URL}/api/1`,
  });

  useEffect(() => {
    let active = true;
    let timeout: NodeJS.Timeout | null = null;

    timeout = setTimeout(updateNow, 1000);

    return () => {
      if (!active) {
        return;
      }
      active = false;
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
    };

    function updateNow() {
      if (!active) {
        return;
      }
      setNow(Date.now());
      timeout = setTimeout(updateNow, 1000);
    }
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>Connectivity Test</div>
      <div className={styles.description}>
        While you have this page open, it will occassionally ping Oseh servers, in order to
        understand how stable your connection is. Please screenshot the below section and send it to
        us if you are experiencing issues.
      </div>
      <ul className={styles.debugInfo}>
        <li>
          Opened at: {new Date(openedAt).toLocaleString()} ({openedAt})
        </li>
        <li>
          Now: {new Date(now).toLocaleString()} ({now})
        </li>
        <li>
          Frontend: <StatsInfo stats={frontend} />
        </li>
        <li>
          Backend: <StatsInfo stats={backend} />
        </li>
      </ul>
    </div>
  );
};

const StatsInfo = ({ stats }: { stats: PingStats }) => {
  const { frequency, batchSize, numBatches, batchSuccesses } = stats;

  const successRate = numBatches === 0 ? 0 : batchSuccesses / numBatches;
  const successRateStr = `${(successRate * 100).toFixed(2)}%`;

  return (
    <span>
      {frequency}s, {batchSize} per batch, {numBatches} batches, {successRateStr} success rate (
      {batchSuccesses} successes)
    </span>
  );
};

/**
 * Fetches statistics using the given ping configuration and url
 */
const usePingStats = ({
  frequency,
  batchSize,
  url,
}: {
  frequency: number;
  batchSize: number;
  url: string;
}): PingStats => {
  const [numBatches, setNumBatches] = useState(0);
  const [batchSuccesses, setBatchSuccesses] = useState(0);

  useEffect(() => {
    let active = true;
    let timeout: NodeJS.Timeout | null = null;

    setNumBatches(0);
    setBatchSuccesses(0);
    sendBatch();

    return () => {
      if (!active) {
        return;
      }

      active = false;
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
    };

    async function sendBatch() {
      timeout = null;
      const responses = await Promise.allSettled(
        Array(batchSize)
          .fill(0)
          .map(async () => {
            const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
            if (!response.ok) {
              throw response;
            }
            return response.text();
          })
      );
      if (!active) {
        return;
      }

      const numSuccesses = responses.filter((r) => r.status === 'fulfilled').length;
      setNumBatches((b) => b + 1);
      if (numSuccesses === batchSize) {
        setBatchSuccesses((s) => s + 1);
      }
      timeout = setTimeout(sendBatch, frequency * 1000);
    }
  }, [frequency, batchSize, url]);

  return useMemo(
    () => ({
      frequency,
      batchSize,
      numBatches,
      batchSuccesses,
    }),
    [frequency, batchSize, numBatches, batchSuccesses]
  );
};
