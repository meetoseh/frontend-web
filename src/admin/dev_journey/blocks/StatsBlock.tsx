import { ReactElement, useEffect, useState } from 'react';
import { HTTP_API_URL } from '../../../shared/ApiConstants';
import { BlockProps } from './BlockProps';

type StatsBlockProps = BlockProps;

/**
 * Stats at a moment in time, from the server
 */
type Stats = {
  journey_time: number;
  bin_width: number;
  users: number;
  likes: number;
  numeric_active: {
    [key: string]: number;
  } | null;
  press_active: number | null;
  press: number | null;
  color_active: number[] | null;
  word_active: number[] | null;
};

export const StatsBlock = ({
  journeyRef,
  sessionUID,
  running,
  journeyTime,
}: StatsBlockProps): ReactElement => {
  const [lookahead, setLookahead] = useState(1);

  const [availableStats, setAvailableStats] = useState<Map<number, Stats>>(new Map());
  const [easeFromBin, setEaseFromBin] = useState<number | null>(null);
  const [easeToBin, setEaseToBin] = useState<number | null>(null);
  const [easeProgress, setEaseProgress] = useState<number>(0);
  const [easedStats, setEasedStats] = useState<Stats | null>(null);

  const [nextBinToFetch, setNextBinToFetch] = useState<number>(0);
  const [canFetchNextBin, setCanFetchNextBin] = useState(false);

  // computes nextBinToFetch, canFetchNextBin, easeFromBin, easeToBin, easeProgress
  useEffect(() => {
    const currentBin = Math.max(0, Math.floor(journeyTime / journeyRef.fenwickBinWidth));
    const currentBinStartsAt = currentBin * journeyRef.fenwickBinWidth;
    const timeIntoCurrentBin = Math.max(journeyTime, 0) - currentBinStartsAt;
    const progressIntoCurrentBin = timeIntoCurrentBin / journeyRef.fenwickBinWidth;

    // durationSeconds will be a multiple of fenwickBinWidth, hence the rounding
    // before subtracting 1 rather than flooring
    const endBin = Math.round(journeyRef.durationSeconds / journeyRef.fenwickBinWidth) - 1;

    const nextBin = !running ? Math.max(0, currentBin - 1) : nextBinToFetch;
    const maxBin = Math.min(currentBin + lookahead, endBin);

    if (!running) {
      // If we don't guard this, it will sometimes overwrite the nextBinToFetch
      // value from the fetchStats effect. This doesn't entirely make sense
      // to me, but to reproduce it just spin the cpu ~1 second after receiving a
      // response in fetchStats. it usually happens in the first 1 or 2 journeys.
      // it might be superstition, but i think it happens more often if a low
      // bandwidth is set on historical
      setNextBinToFetch(nextBin);
    }
    setCanFetchNextBin(running && nextBin <= maxBin);

    if (availableStats.has(currentBin - 1) && availableStats.has(currentBin)) {
      setEaseFromBin(currentBin - 1);
      setEaseToBin(currentBin);
      setEaseProgress(progressIntoCurrentBin);
    } else if (availableStats.has(currentBin - 1) && !availableStats.has(currentBin)) {
      setEaseFromBin(currentBin - 1);
      setEaseToBin(null);
      setEaseProgress(0);
    } else if (availableStats.has(currentBin) && !availableStats.has(currentBin - 1)) {
      setEaseFromBin(null);
      setEaseToBin(currentBin);
      setEaseProgress(progressIntoCurrentBin);
    } else if (availableStats.size > 0) {
      let lastBin = -1;

      const iter = availableStats.keys();
      let bin = iter.next();
      while (!bin.done) {
        if (bin.value > lastBin) {
          lastBin = bin.value;
        }
        bin = iter.next();
      }

      setEaseFromBin(lastBin);
      setEaseToBin(null);
      setEaseProgress(0);
    } else {
      setEaseFromBin(null);
      setEaseToBin(null);
      setEaseProgress(0);
    }

    return () => {};
  }, [running, journeyTime, availableStats, journeyRef, lookahead, nextBinToFetch]);

  // computes easedStats
  useEffect(() => {
    (() => {
      if (easeFromBin === null && easeToBin === null) {
        setEasedStats(null);
        return;
      }

      const fromStats =
        easeFromBin !== null
          ? availableStats.get(easeFromBin)
          : {
              journey_time: 0,
              bin_width: journeyRef.fenwickBinWidth,
              users: 0,
              likes: 0,
              numeric_active: null,
              press_active: null,
              press: null,
              color_active: null,
              word_active: null,
            };
      if (fromStats === undefined) {
        setEasedStats(null);
        return;
      }

      const toStats = easeToBin === null ? null : availableStats.get(easeToBin);
      if (toStats === undefined) {
        setEasedStats(null);
        return;
      }

      const easedStats = Object.assign({}, fromStats);
      if (easeProgress > 0 && toStats !== null) {
        for (const key of Object.keys(easedStats)) {
          const fromVal: number | { [key: string]: number } | number[] | null = (fromStats as any)[
            key
          ];
          const toVal: number | { [key: string]: number } | number[] | null = (toStats as any)[key];

          if (typeof fromVal === 'number' && typeof toVal === 'number') {
            const unrounded = fromVal + (toVal - fromVal) * easeProgress;
            if (key === 'journey_time') {
              (easedStats as any)[key] =
                unrounded +
                (easeFromBin === null ? fromStats.bin_width * easeProgress : fromStats.bin_width);
            } else {
              (easedStats as any)[key] = Math.round(unrounded);
            }
          } else if (Array.isArray(fromVal) && Array.isArray(toVal)) {
            (easedStats as any)[key] = fromVal.map((val, i) =>
              Math.round(val + (toVal[i] - val) * easeProgress)
            );
          } else if (
            fromVal !== null &&
            toVal !== null &&
            typeof fromVal === 'object' &&
            typeof toVal === 'object'
          ) {
            const from = fromVal as { [key: string]: number };
            const to = toVal as { [key: string]: number };
            const easedLookup: { [key: string]: number } = {};
            const allKeys = new Set([...Object.keys(from), ...Object.keys(to)]);
            allKeys.forEach((key) => {
              easedLookup[key] = Math.round(
                (from[key] ?? 0) + ((to[key] ?? 0) - (from[key] ?? 0)) * easeProgress
              );
            });
            (easedStats as any)[key] = easedLookup;
          }
        }
      }

      setEasedStats(easedStats);
    })();
    return () => {};
  }, [availableStats, easeFromBin, easeToBin, easeProgress, journeyRef]);

  // clears stats when not running
  useEffect(() => {
    (() => {
      if (running) {
        return;
      }

      if (availableStats.size === 0) {
        return;
      }

      setAvailableStats(new Map());
    })();
    return () => {};
  }, [running, availableStats]);

  // fetches stats
  useEffect(() => {
    let active = true;
    fetchStats();
    return () => {
      active = false;
    };

    async function fetchStats() {
      if (!canFetchNextBin) {
        return;
      }

      const response = await fetch(
        `${HTTP_API_URL}/api/1/journeys/events/stats?${new URLSearchParams({
          bin: nextBinToFetch.toString(),
          uid: journeyRef.uid,
        })}`,
        {
          method: 'GET',
          headers: {
            Authorization: `bearer ${journeyRef.jwt}`,
          },
        }
      );
      if (!active) {
        return;
      }

      if (!response.ok) {
        const text = await response.text();
        if (!active) {
          return;
        }
        console.error('Failed to fetch stats', text);
        return;
      }

      const stats: Stats = await response.json();
      if (!active) {
        return;
      }
      setAvailableStats((prev) => {
        const newMap = new Map(prev);
        newMap.set(nextBinToFetch, stats);
        return newMap;
      });

      console.log('from stats, setNextBinToFetch(', nextBinToFetch + 1, ')');
      setNextBinToFetch(nextBinToFetch + 1);
    }
  }, [nextBinToFetch, canFetchNextBin, journeyRef]);

  // clears old stats while running
  useEffect(() => {
    if (!running || easeFromBin === null) {
      return;
    }

    const keys = availableStats.keys();
    const keysToRemove: number[] = [];
    let key = keys.next();
    while (!key.done) {
      if (key.value < easeFromBin) {
        keysToRemove.push(key.value);
      }
      key = keys.next();
    }

    if (keysToRemove.length > 0) {
      setAvailableStats((prev) => {
        const newMap = new Map(prev);
        for (const key of keysToRemove) {
          newMap.delete(key);
        }
        return newMap;
      });
    }
  }, [running, availableStats, easeFromBin]);

  return (
    <>
      <div style={{ fontWeight: 700, textAlign: 'center' }}>stats</div>
      <div style={{ display: 'flex', gap: '0.25em' }}>
        <div>lookahead:</div>
        <input
          type="number"
          disabled={running}
          value={lookahead}
          min={1}
          max={10}
          style={{ flexGrow: '1' }}
          onChange={(e) => setLookahead(parseInt(e.target.value))}
        />
      </div>
      <div style={{ display: 'flex' }}>number of available stats: {availableStats.size}</div>
      {easedStats === null || (easeFromBin !== null && !availableStats.has(easeFromBin)) ? (
        'no stats'
      ) : (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '20px',
            marginTop: '1em',
            alignItems: 'center',
          }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25em',
              border: '1px solid #ccc',
              padding: '8px',
            }}>
            <div style={{ fontWeight: 500, textAlign: 'center' }}>from</div>
            {easeFromBin === null || !availableStats.has(easeFromBin) ? (
              'none'
            ) : (
              <StatsView stats={availableStats.get(easeFromBin)!} isEased={false} />
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25em' }}>
            progress: {easeProgress.toFixed(3)}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25em',
              border: '1px solid #ccc',
              padding: '8px',
            }}>
            <div style={{ fontWeight: 500, textAlign: 'center' }}>to</div>
            {easeToBin === null || !availableStats.has(easeToBin) ? (
              'none'
            ) : (
              <StatsView stats={availableStats.get(easeToBin)!} isEased={false} />
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25em' }}>-&gt;</div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25em',
              border: '1px solid #ccc',
              padding: '8px',
            }}>
            <div style={{ fontWeight: 500, textAlign: 'center' }}>eased</div>
            <StatsView stats={easedStats} isEased={true} />
          </div>
        </div>
      )}
    </>
  );
};

type StatsViewProps = {
  stats: Stats;
  isEased: boolean;
};

const StatsView = ({ stats, isEased }: StatsViewProps): ReactElement => {
  return (
    <>
      <div>
        journey time:{' '}
        {stats.journey_time.toLocaleString(undefined, {
          minimumFractionDigits: 3,
          maximumFractionDigits: 3,
        })}
        {!isEased && (
          <>
            -
            {(stats.journey_time + stats.bin_width).toLocaleString(undefined, {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            })}
          </>
        )}
      </div>
      <div>users: {stats.users.toLocaleString()}</div>
      <div>likes: {stats.likes.toLocaleString()}</div>
      {stats.numeric_active && (
        <div>
          numeric active:{' '}
          <pre style={{ maxWidth: '15em', overflowX: 'auto' }}>
            {JSON.stringify(stats.numeric_active)}
          </pre>
        </div>
      )}
      {stats.press_active && <div>press active: {stats.press_active.toLocaleString()}</div>}
      {stats.press && <div>press: {stats.press.toLocaleString()}</div>}
      {stats.color_active && <div>color active: {JSON.stringify(stats.color_active)}</div>}
      {stats.word_active && <div>word active: {JSON.stringify(stats.word_active)}</div>}
    </>
  );
};
