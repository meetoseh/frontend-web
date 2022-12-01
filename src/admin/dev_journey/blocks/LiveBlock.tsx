import { useEffect, useRef, useState } from 'react';
import { HTTP_WEBSOCKET_URL } from '../../../shared/ApiConstants';
import { heappop as unboundHeappop, heappush as unboundHeappush } from '../../../shared/lib/Heap';
import { BlockProps } from './BlockProps';
import { JourneyEvent } from './JourneyEvent';

type LiveBlockProps = BlockProps;

const heappop = unboundHeappop.bind(null, 'journey_time');
const heappush = unboundHeappush.bind(null, 'journey_time');

type JourneyMessage = {
  success: boolean;
  type: string;
  data: any;
};

/**
 * A small wrapper around websockets that ensures we don't miss messages
 * and handles parsing. it's not clear from this type, but the wrapped
 * websocket also clears the ref websocket when it closes, which means
 * the useEffect will naturally handle reconnection
 */
type WrappedWebSocket = {
  ws: WebSocket;
  messageQueue: JourneyMessage[];
  /**
   * invoked in order whenever a message is received, after its
   * been pushed to the end of messageQueue
   */
  messageQueueListeners: (() => void)[];
};

export const LiveBlock = ({ journeyRef, sessionUID, running, journeyTime }: LiveBlockProps) => {
  const [bandwidth, setBandwidth] = useState(100);
  const [lookahead, setLookahead] = useState(3);
  const [lookback, setLookback] = useState(3);
  const [maxSyncOffset, setMaxSyncOffset] = useState(0.25);
  const [previewMaxLen, setPreviewMaxLen] = useState(20);

  const websocket = useRef<WrappedWebSocket | null>(null);
  const [websocketCounter, setWebsocketCounter] = useState(0);

  const [eventCounter, setEventCounter] = useState(0);
  const eventHeap = useRef<JourneyEvent[]>([]);

  const previewEventsArr = useRef<JourneyEvent[]>([]);

  const [lastLatencyDetectionPacketAt, setLastLatencyDetectionPacketAt] = useState<number | null>(
    null
  );
  const [lastSyncOffset, setLastSyncOffset] = useState<number | null>(null);

  const mutableJourneyTime = useRef(journeyTime);

  // keep mutableJourneyTime up to date
  useEffect(() => {
    mutableJourneyTime.current = journeyTime;
    return () => {};
  }, [journeyTime]);

  // connect when running & unconnected
  useEffect(() => {
    let active = true;
    connectAndAuthWebsocket();
    return () => {
      active = false;
    };

    async function connectAndAuthWebsocket() {
      if (!running || websocket.current !== null) {
        return;
      }

      console.log('opening websocket');
      const ws = new WebSocket(`${HTTP_WEBSOCKET_URL}/api/2/journeys/live`);
      ws.binaryType = 'blob';

      try {
        await new Promise<void>((resolve, reject) => {
          let cleanup: (() => void) | null = null;
          const openListener = () => {
            cleanup!();
            resolve();
          };
          const errorListener = (e: Event) => {
            cleanup!();
            reject(e);
          };

          cleanup = () => {
            ws.removeEventListener('open', openListener);
            ws.removeEventListener('error', errorListener);
          };

          ws.addEventListener('open', openListener);
          ws.addEventListener('error', errorListener);
        });
      } catch (e) {
        console.error('failed to connect to websocket', e);
        return;
      }

      if (!active) {
        ws.close();
        return;
      }

      const getMessage = () => {
        return new Promise<any>((resolve, reject) => {
          let cleanup: (() => void) | null = null;

          const messageListener = (e: MessageEvent) => {
            cleanup!();
            const data = e.data;
            if (data instanceof Blob) {
              const reader = new FileReader();
              reader.addEventListener('loadend', () => {
                if (reader.result === null) {
                  reject(new Error('failed to read blob'));
                  return;
                }
                resolve(JSON.parse(reader.result as string));
              });
              reader.readAsText(data, 'utf-8');
            } else {
              resolve(JSON.parse(data));
            }
          };
          const errorListener = (e: Event) => {
            cleanup!();
            reject(e);
          };
          const closeListener = () => {
            cleanup!();
            reject('close');
          };

          cleanup = () => {
            ws.removeEventListener('message', messageListener);
            ws.removeEventListener('error', errorListener);
            ws.removeEventListener('close', closeListener);
          };

          ws.addEventListener('message', messageListener);
          ws.addEventListener('error', errorListener);
          ws.addEventListener('close', closeListener);
        });
      };

      ws.send(
        JSON.stringify({
          type: 'authorize',
          data: {
            journey_uid: journeyRef.uid,
            jwt: journeyRef.jwt,
            bandwidth: bandwidth,
            lookback: lookback,
            lookahead: lookahead,
          },
        })
      );

      let resp: any;
      try {
        resp = await getMessage();
      } catch (e) {
        console.error('failed to authorize websocket; expected SyncRequest, got:', e);
        ws.close();
        return;
      }

      if (!active) {
        ws.close();
        return;
      }

      if (resp.type !== 'sync_request') {
        console.error('failed to authorize websocket; expected SyncRequest, got:', resp);
        ws.close();
        return;
      }

      ws.send(
        JSON.stringify({
          type: 'sync_response',
          data: {
            receive_timestamp: mutableJourneyTime.current,
            transmit_timestamp: mutableJourneyTime.current,
          },
        })
      );

      try {
        resp = await getMessage();
      } catch (e) {
        console.error('failed to authorize websocket; expected AuthResponse, got:', e);
        ws.close();
        return;
      }

      if (!active) {
        ws.close();
        return;
      }

      if (resp.type !== 'auth_response') {
        console.error('failed to authorize websocket; expected AuthResponse, got:', resp);
        ws.close();
        return;
      }

      const wrapped: WrappedWebSocket = {
        ws: ws,
        messageQueue: [],
        messageQueueListeners: [],
      };

      ws.addEventListener('message', (e) => {
        let parsed: any;
        const data = e.data;
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.addEventListener('loadend', () => {
            if (reader.result === null) {
              console.error('failed to read blob');
              return;
            }
            parsed = JSON.parse(reader.result as string);
          });
          reader.readAsText(data, 'utf-8');
        } else {
          parsed = JSON.parse(data);
        }

        wrapped.messageQueue.push(parsed);
        for (const listener of wrapped.messageQueueListeners) {
          listener();
        }
      });

      ws.addEventListener('close', () => {
        if (websocket.current === wrapped) {
          console.log('server disconnected websocket');
          websocket.current = null;
          setWebsocketCounter((c) => c + 1);
        }
      });

      websocket.current = wrapped;
      setWebsocketCounter((c) => c + 1);
    }
  }, [running, websocketCounter, journeyRef, bandwidth, lookback, lookahead]);

  // when connected, parse packets
  useEffect(() => {
    let active = true;
    let deactivatedListeners: (() => void)[] = [];
    parsePackets();
    return () => {
      active = false;
      for (const listener of deactivatedListeners) {
        listener();
      }
    };

    function parsePackets() {
      const wrapped = websocket.current;
      if (wrapped === null) {
        return;
      }

      const handleMessage = (message: JourneyMessage) => {
        if (!active) {
          return;
        }

        if (message.type === 'latency_detection') {
          const currJourneyTime = mutableJourneyTime.current;
          const expectedReceiveJourneyTime: number = message.data.expected_receive_journey_time;

          const syncOffset = currJourneyTime - expectedReceiveJourneyTime;

          setLastLatencyDetectionPacketAt(currJourneyTime);
          setLastSyncOffset(syncOffset);

          if (Math.abs(syncOffset) > maxSyncOffset) {
            console.log('sync offset too large, reconnecting', syncOffset);
            wrapped.ws.close();
            return;
          }
        } else if (message.type === 'event_batch') {
          const events: JourneyEvent[] = message.data.events;
          for (const event of events) {
            heappush(eventHeap.current, event);
          }
          setEventCounter((c) => c + 1);
        } else {
          console.log('unhandled message type', message);
        }
      };

      const handleMessages = () => {
        while (wrapped.messageQueue.length > 0) {
          const message = wrapped.messageQueue.shift()!;
          handleMessage(message);
        }
      };

      wrapped.messageQueueListeners.push(handleMessages);
      deactivatedListeners.push(() => {
        const index = wrapped.messageQueueListeners.indexOf(handleMessages);
        wrapped.messageQueueListeners.splice(index, 1);
      });
      handleMessages();
    }
  }, [websocketCounter, maxSyncOffset]);

  // disconnect when not running && connected
  useEffect(() => {
    disconnectWebsocket();
    return () => {};

    function disconnectWebsocket() {
      if (running || websocket.current === null) {
        return;
      }

      websocket.current.ws.close();
      websocket.current = null;
      setWebsocketCounter((c) => c + 1);
    }
  }, [running, websocketCounter]);

  // clear heap, preview, latency pakcet at, and sync offset if not running
  useEffect(() => {
    if (
      !running &&
      (eventHeap.current.length > 0 ||
        previewEventsArr.current.length > 0 ||
        lastLatencyDetectionPacketAt !== null ||
        lastSyncOffset !== null)
    ) {
      eventHeap.current.splice(0, eventHeap.current.length);
      previewEventsArr.current.splice(0, previewEventsArr.current.length);
      setLastLatencyDetectionPacketAt(null);
      setLastSyncOffset(null);
      setEventCounter((c) => c + 1);
    }
    return () => {};
  }, [running, lastLatencyDetectionPacketAt, lastSyncOffset]);

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
      <div style={{ fontWeight: 700, textAlign: 'center' }}>live</div>
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
          min={1}
          max={10}
          style={{ flexGrow: '1' }}
          onChange={(e) => setLookahead(parseInt(e.target.value))}
        />
      </div>
      <div style={{ display: 'flex', gap: '0.25em' }}>
        <div>lookback:</div>
        <input
          type="number"
          disabled={running}
          value={lookback}
          min={1}
          max={10}
          style={{ flexGrow: '1' }}
          onChange={(e) => setLookback(parseInt(e.target.value))}
        />
      </div>
      <div style={{ display: 'flex', gap: '0.25em' }}>
        <div>max sync offset:</div>
        <input
          type="number"
          disabled={running}
          value={maxSyncOffset}
          min={0}
          max={10}
          step={0.01}
          style={{ flexGrow: '1' }}
          onChange={(e) => setMaxSyncOffset(e.target.valueAsNumber)}
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
      <div style={{ display: 'flex' }}>
        connected:{' '}
        {websocket.current !== null && websocket.current.ws.readyState === WebSocket.OPEN
          ? 'yes'
          : 'no'}
      </div>
      <div style={{ display: 'flex' }}>
        last lat. packet at:{' '}
        {(lastLatencyDetectionPacketAt &&
          lastLatencyDetectionPacketAt.toLocaleString(undefined, { maximumFractionDigits: 3 })) ||
          'never'}
      </div>
      <div style={{ display: 'flex' }}>
        last sync offset:{' '}
        {lastSyncOffset !== null
          ? `${lastSyncOffset.toLocaleString(undefined, { maximumFractionDigits: 6 })}s`
          : 'n/a'}
      </div>
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
