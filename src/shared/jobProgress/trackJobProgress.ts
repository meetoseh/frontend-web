import { HTTP_WEBSOCKET_URL } from '../ApiConstants';
import {
  Callbacks,
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../lib/Callbacks';
import { CancelablePromise } from '../lib/CancelablePromise';
import { constructCancelablePromise } from '../lib/CancelablePromiseConstructor';
import { OrderedDictionary } from '../lib/OrderedDictionary';
import { createCancelablePromiseFromCallbacks } from '../lib/createCancelablePromiseFromCallbacks';
import { JobRef } from './JobRef';

type IndicatorSpinner = { type: 'spinner' };
type IndicatorBar = { type: 'bar'; at: number; of: number };
type Indicator = IndicatorSpinner | IndicatorBar;

export type Progress = {
  message: string;
  indicator: Indicator | null;
};

export type Job = {
  uid: string;
  name: string;
  progress: Progress;
  /* milliseconds since epoch */
  startedAt: number;
  /** true for succeeded, false for failed, null for still running */
  result: boolean | null;
};

/**
 * Describes what is currently happening in a system, initialized via one
 * or more job progress uids. Each of these job progress uids can, in turn,
 * spawn additional jobs.
 */
export type JobProgress = OrderedDictionary<Job, 'uid', 'startedAt'>;

/**
 * Connects to the websocket server to track just the given job, calling the
 * onEvent callback occassionally with the latest event, and the onSpawn
 * callback when a new job is spawned.
 *
 * This sends connecting/reconnecting messages as events even though they don't
 * come from the server.
 */
const trackIndividualJob = (
  job: JobRef,
  onEvent: (progress: Progress) => void,
  onSpawn: (name: string, job: JobRef) => void,
  onFinal: (success: boolean) => void
): CancelablePromise<void> => {
  return constructCancelablePromise({
    body: async (state, resolve, reject) => {
      console.log('trackIndividualJob(', JSON.stringify(job), ')');
      let lastFailedAt: Date | null = null;
      let recentFailures = 0;

      if (state.finishing) {
        state.done = true;
        reject(new Error('canceled'));
        return;
      }

      const manageSocket = async () => {
        const socket = new WebSocket(`${HTTP_WEBSOCKET_URL}/api/2/jobs/live`);

        const abortHandler = () => {
          socket.close();
          state.cancelers.remove(abortHandler);
        };
        state.cancelers.add(abortHandler);
        if (state.finishing) {
          abortHandler();
          throw new Error('aborted');
        }

        try {
          await manageSocketInner(socket);
        } catch (e) {
          if (state.finishing) {
            state.done = true;
            reject(new Error('canceled'));
            return;
          }
          throw e;
        } finally {
          socket.close();
          state.cancelers.remove(abortHandler);
        }
      };

      const manageSocketInner = async (socket: WebSocket) => {
        let packetQueue: string[] = [];
        const onReceivedPacket = new Callbacks<undefined>();
        socket.addEventListener('message', (e) => {
          const data = e.data;
          if (typeof data !== 'string') {
            throw new Error(`WebSocket message was not a string: ${data}`);
          }
          packetQueue.push(data);
          onReceivedPacket.call(undefined);
        });

        const erroredOrClosed = new Promise<void>((resolve) => {
          const doResolve = () => {
            resolve();
            socket.removeEventListener('error', doResolve);
            socket.removeEventListener('close', doResolve);
          };

          socket.addEventListener('error', doResolve);
          socket.addEventListener('close', doResolve);
        });

        const readPacketOrClose = async (): Promise<string | undefined> => {
          const result = packetQueue.shift();
          if (result !== undefined) {
            return result;
          }
          const readPromise = createCancelablePromiseFromCallbacks(onReceivedPacket);
          readPromise.promise.catch(() => {});
          await Promise.race([readPromise.promise, erroredOrClosed]);
          readPromise.cancel();

          return packetQueue.shift();
        };

        await new Promise<void>((resolve, reject) => {
          const doResolve = () => {
            resolve();
            socket.removeEventListener('open', doResolve);
            socket.removeEventListener('error', doReject);
            socket.removeEventListener('close', doReject);
          };
          const doReject = (e: Event) => {
            reject(new Error(`WebSocket error: ${e}`));
            socket.removeEventListener('open', doResolve);
            socket.removeEventListener('error', doReject);
            socket.removeEventListener('close', doReject);
          };

          socket.addEventListener('open', doResolve);
          socket.addEventListener('error', doReject);
          socket.addEventListener('close', doReject);
        });

        socket.send(
          JSON.stringify({
            type: 'authorize',
            data: {
              job_uid: job.uid,
              jwt: job.jwt,
            },
          })
        );

        const authResponseRaw = await readPacketOrClose();
        if (authResponseRaw === undefined) {
          throw new Error('WebSocket closed before auth response');
        }

        const authResponse = JSON.parse(authResponseRaw);
        if (authResponse.type !== 'auth_response' || authResponse.success !== true) {
          throw new Error(`WebSocket auth failed: ${authResponseRaw}`);
        }

        const finalEventTypes = new Set(['failed', 'succeeded']);

        while (true) {
          const packetRaw = await readPacketOrClose();
          if (packetRaw === undefined) {
            throw new Error('connection closed');
          }

          const packet = JSON.parse(packetRaw);
          if (packet.type !== 'event_batch') {
            throw new Error(`Unexpected packet type: ${packet.type}`);
          }

          if (packet.success !== true) {
            throw new Error(`Event batch failed: ${packetRaw}`);
          }

          const events: {
            type: string;
            message: string;
            indicator: Indicator | { type: 'final' } | null;
            spawned: { uid: string; jwt: string; name: string } | null | undefined;
          }[] = packet.data.events;

          for (const event of events) {
            if (event.type === 'spawned' && event.spawned !== null && event.spawned !== undefined) {
              onSpawn(event.spawned.name, { uid: event.spawned.uid, jwt: event.spawned.jwt });
            }
          }

          let seenFinal = false;
          for (const event of events) {
            if (
              finalEventTypes.has(event.type) ||
              (event.indicator !== null && event.indicator.type === 'final')
            ) {
              seenFinal = true;
              onFinal(event.type === 'succeeded');
              break;
            }
          }

          if (events.length > 0) {
            const lastEvent = events[events.length - 1];
            onEvent({
              message: lastEvent.message,
              indicator:
                lastEvent.indicator === null || lastEvent.indicator.type === 'final'
                  ? null
                  : lastEvent.indicator,
            });
          }

          if (seenFinal) {
            socket.close();
            return;
          }
        }
      };

      onEvent({ message: 'connecting', indicator: { type: 'spinner' } });
      while (true) {
        if (state.finishing) {
          state.done = true;
          reject(new Error('canceled'));
          return;
        }

        try {
          await manageSocket();
          state.finishing = true;
          state.done = true;
          resolve();
        } catch (e) {
          if (state.finishing) {
            state.done = true;
            reject(new Error('canceled'));
            return;
          }

          console.error('websocket error:', e);
          const now = new Date();
          const timeSinceLastMS =
            lastFailedAt === null ? null : now.getTime() - lastFailedAt.getTime();
          lastFailedAt = now;

          if (timeSinceLastMS !== null && timeSinceLastMS > 15000) {
            recentFailures = 0;
          } else {
            recentFailures++;
          }

          if (recentFailures > 5 || (timeSinceLastMS !== null && timeSinceLastMS < 1000)) {
            state.finishing = true;
            state.done = true;
            reject(new Error('too many websocket failures'));
          }

          onEvent({
            message: 'reconnecting',
            indicator: { type: 'spinner' },
          });
        }
      }
    },
  });
};

/**
 * Keeps track of the progress of an initial list of jobs and all the jobs
 * that they spawn, until all jobs have finished. Reports progress into
 * the mutable output, invoking its callbacks after each mutation.
 *
 * Rejects with an error if the websocket connection fails too many times on
 * any of the jobs.
 *
 * The returned promise can be canceled to close all connections.
 */
export const trackJobProgress = (
  initial: { name: string; job: JobRef }[],
  output: WritableValueWithCallbacks<JobProgress>
): CancelablePromise<void> => {
  return constructCancelablePromise({
    body: async (state, resolve, reject) => {
      const onJobEvent = (name: string, job: JobRef, progress: Progress) => {
        if (state.finishing) {
          return;
        }

        const map = output.get();
        const current = map.get(job.uid);
        if (current === undefined) {
          map.push({
            uid: job.uid,
            name: name,
            progress: progress,
            startedAt: Date.now(),
            result: null,
          });
        } else {
          current.progress = progress;
        }
        output.callbacks.call(undefined);
      };

      const handlers = createWritableValueWithCallbacks(
        new Map<string, { job: JobRef; name: string; handler: CancelablePromise<void> }>()
      );

      const onJobSpawned = (name: string, job: JobRef) => {
        if (state.finishing) {
          return;
        }

        const handler = trackIndividualJob(
          job,
          (progress) => {
            console.log('job event', JSON.stringify(progress));
            onJobEvent(name, job, progress);
          },
          (name, job) => {
            console.log('spawned job', name);
            onJobSpawned(name, job);
          },
          (success) => {
            console.log('job finished; success=', success);
            handlers.get().delete(job.uid);
            handlers.callbacks.call(undefined);

            const out = output.get();
            const current = out.get(job.uid);
            if (current !== undefined && current.result !== success) {
              console.log('mutated success');
              current.result = success;
              output.callbacks.call(undefined);
            }
          }
        );
        handlers.get().set(job.uid, { job: job, name: name, handler: handler });
        handlers.callbacks.call(undefined);
      };

      const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
      canceled.promise.catch(() => {});

      if (state.finishing) {
        canceled.cancel();
        state.done = true;
        reject(new Error('canceled'));
        return;
      }

      for (const { name, job } of initial) {
        onJobSpawned(name, job);
      }

      while (handlers.get().size > 0) {
        if (state.finishing) {
          canceled.cancel();

          {
            const iter = handlers.get().values();
            let next = iter.next();
            while (!next.done) {
              next.value.handler.promise.catch(() => {});
              next.value.handler.cancel();
              next = iter.next();
            }
          }

          if (!state.done) {
            state.done = true;
            reject(new Error('canceled'));
          }
          return;
        }

        {
          const iter = handlers.get().values();
          let next = iter.next();
          while (!next.done) {
            const { handler } = next.value;
            if (handler.done()) {
              try {
                await handler.promise;
              } catch (e) {
                state.finishing = true;
                state.done = true;
                reject(e);
                continue;
              }
              handlers.get().delete(next.value.job.uid);
              handlers.callbacks.call(undefined);
            }
            next = iter.next();
          }
        }

        const relevantPromises: Promise<any>[] = [];
        const handlersChanged = createCancelablePromiseFromCallbacks(handlers.callbacks);
        handlersChanged.promise.catch(() => {});

        relevantPromises.push(canceled.promise);
        relevantPromises.push(handlersChanged.promise);
        {
          const iter = handlers.get().values();
          let next = iter.next();
          while (!next.done) {
            relevantPromises.push(next.value.handler.promise);
            next = iter.next();
          }
        }

        try {
          await Promise.race(relevantPromises);
        } catch (e) {
          // ...
        }

        handlersChanged.cancel();
      }

      state.finishing = true;
      state.done = true;
      resolve();
    },
  });
};
