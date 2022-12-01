import { ReactElement, useEffect, useRef, useState } from 'react';
import { HTTP_API_URL } from '../../../shared/ApiConstants';
import { heappop as unboundHeappop, heappush as unboundHeappush } from '../../../shared/lib/Heap';
import { BlockProps } from './BlockProps';
import { JourneyEvent } from './JourneyEvent';

type HistoricalBlockProps = BlockProps;

const heappop = unboundHeappop.bind(null, 'journey_time');
const heappush = unboundHeappush.bind(null, 'journey_time');

/**
 * Shows a block containing the actions that the user can take
 * in the journey. This is setup primarily for debugging purposes
 */
export const HistoricalBlock = ({
  journeyRef,
  sessionUID,
  running,
  journeyTime,
}: HistoricalBlockProps): ReactElement => {
  const [bandwidth, setBandwidth] = useState(100);
  const [previewMaxLen, setPreviewMaxLen] = useState(20);
  const [lookahead, setLookahead] = useState(3);

  // these are to ensure effects aren't unnecessarily canceled, which
  // would happen if we used journeyTime instead as a dependency
  const [nextBin, setNextBin] = useState(0);
  const [nextBinCanBeLoaded, setNextBinCanBeLoaded] = useState(true);

  const [eventCounter, setEventCounter] = useState(0);
  const eventHeap = useRef<JourneyEvent[]>([]);

  const previewEventsArr = useRef<JourneyEvent[]>([]);

  // ensure nextBin, nextBinCanBeLoaded are updated
  useEffect(() => {
    const currentBin = Math.max(0, Math.floor(journeyTime));
    const newNextBin = !running ? currentBin : nextBin;
    const newMaxBin = Math.min(currentBin + lookahead, Math.floor(journeyRef.durationSeconds));

    setNextBin(newNextBin);
    setNextBinCanBeLoaded(newNextBin <= newMaxBin);
    return () => {};
  }, [journeyRef, journeyTime, nextBin, nextBinCanBeLoaded, lookahead, running]);

  // clear heap and preview if not running
  useEffect(() => {
    if (!running && (eventHeap.current.length > 0 || previewEventsArr.current.length > 0)) {
      eventHeap.current.splice(0, eventHeap.current.length);
      previewEventsArr.current.splice(0, previewEventsArr.current.length);
      setEventCounter((c) => c + 1);
    }
    return () => {};
  }, [running]);

  // actually load the next bin if nextBinCanBeLoaded && running
  useEffect(() => {
    let active = true;
    fetchNextBin();
    return () => {
      active = false;
    };

    async function fetchNextBin() {
      if (!running || !nextBinCanBeLoaded) {
        return;
      }

      const response = await fetch(`${HTTP_API_URL}/api/1/journeys/events/search`, {
        method: 'POST',
        headers: {
          Authorization: `bearer ${journeyRef.jwt}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          filters: {
            journey_time: {
              operator: 'bte',
              value: [nextBin, nextBin + 1],
            },
            dropout_for_total: {
              operator: 'eq',
              value: bandwidth,
            },
          },
          sort: [
            {
              key: 'random',
              dir: 'asc',
            },
          ],
          limit: bandwidth,
        }),
      });
      if (!active) {
        return;
      }
      if (!response.ok) {
        const text = await response.text();
        if (!active) {
          return;
        }
        console.error('failed to fetch next bin', text);
        return;
      }
      const data = await response.json();
      if (!active) {
        return;
      }

      for (const item of data.items) {
        heappush(eventHeap.current, item);
      }
      setEventCounter((c) => c + 1);
      setNextBinCanBeLoaded(false);
      setNextBin(nextBin + 1);
    }
  }, [running, nextBin, bandwidth, journeyRef, nextBinCanBeLoaded]);

  // update previewEventsArr as journeyTime changes, when running
  useEffect(() => {
    updatePreviewEvents();
    return () => {};

    function updatePreviewEvents() {
      if (!running) {
        return;
      }

      let changed = false;
      while (eventHeap.current.length > 0 && eventHeap.current[0].journey_time <= journeyTime) {
        const event = heappop(eventHeap.current);
        previewEventsArr.current.push(event);
        changed = true;
      }

      if (previewEventsArr.current.length > previewMaxLen) {
        previewEventsArr.current.splice(0, previewEventsArr.current.length - previewMaxLen);
      }

      if (changed) {
        setEventCounter((c) => c + 1);
      }
    }
  }, [running, journeyTime, previewMaxLen, eventCounter]);

  return (
    <>
      <div style={{ fontWeight: 700, textAlign: 'center' }}>historical</div>
      <div style={{ display: 'flex', gap: '0.25em' }}>
        <div>bandwidth:</div>
        <input
          type="number"
          disabled={running}
          value={bandwidth}
          min={1}
          max={5000}
          style={{ flexGrow: '1' }}
          onChange={(e) => setBandwidth(parseInt(e.target.value))}
        />
      </div>
      <div style={{ display: 'flex', gap: '0.25em' }}>
        <div>lookahead:</div>
        <input
          type="number"
          disabled={running}
          value={lookahead}
          style={{ flexGrow: '1' }}
          min={1}
          max={10}
          onChange={(e) => setLookahead(parseInt(e.target.value))}
        />
      </div>
      <div style={{ display: 'flex', gap: '0.25em' }}>
        <div>preview max len:</div>
        <input
          type="number"
          disabled={running}
          value={previewMaxLen}
          style={{ flexGrow: '1' }}
          onChange={(e) => setPreviewMaxLen(parseInt(e.target.value))}
        />
      </div>
      <div style={{ display: 'flex' }}>next bin: {nextBin}</div>
      <div style={{ display: 'flex' }}>events in heap: {eventHeap.current.length}</div>
      <div style={{ display: 'flex' }}>events in preview: {previewEventsArr.current.length}</div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: '4px',
          border: '1px solid black',
          minHeight: '20px',
          maxHeight: '400px',
          maxWidth: '20em',
          overflow: 'scroll',
          resize: 'both',
        }}>
        {previewEventsArr.current.map((event) => (
          <pre key={event.uid}>{JSON.stringify(event)}</pre>
        ))}
      </div>
    </>
  );
};
