import { useCallback, useContext, useRef } from 'react';
import { LoginContext } from '../contexts/LoginContext';
import { apiFetch } from '../ApiConstants';
import {
  VariableStrategyProps,
  useVariableStrategyPropsAsValueWithCallbacks,
} from '../anim/VariableStrategyProps';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';
import { useMappedValuesWithCallbacks } from './useMappedValuesWithCallbacks';
import { useUnwrappedValueWithCallbacks } from './useUnwrappedValueWithCallbacks';
import { useValueWithCallbacksEffect } from './useValueWithCallbacksEffect';

/**
 * Describes a session for an in-app notification. A session is a reusable
 * object, but it can only refer to one session at a time.
 */
export type InappNotificationSession = {
  /**
   * The in-app notification that this session is for.
   */
  inappNotificationUid: string;

  /**
   * If this session is started, the uid of the session. This is the uid of the
   * relationship record between the in-app notification and the user.
   */
  inappNotificationUserUid: string | null;

  /**
   * If the session is already started, this returns a rejected promise. If we're
   * in the middle of starting a session, this returns a promise that resolves or
   * rejects to the same value as the promise returned by the first call to start.
   * Otherwise, this starts the session and returns a promise that resolves to the
   * uid of the session, or rejects on network error.
   */
  start: () => Promise<string>;

  /**
   * If we have not started a session, this rejects. If we're in the middle
   * of starting a session, this queues the given action to be stored after the
   * session is started. If the session is started, this stores the given action
   * on the backend and returns a promise that resolves when the action is stored,
   * or rejects on network error.
   *
   * @param slug The slug of the action. The acceptable slugs depend on the notification
   *   and are documented in the backend database documentation.
   * @param extra JSON-serializable data to store with the action. The acceptable
   *   data depends on the notification/slug combination and are documented in the backend
   *   database documentation.
   */
  storeAction: (slug: string, extra: object | null) => Promise<void>;

  /**
   * If the session is started, it's forgotten. This does not involve any
   * network requests.
   */
  reset: () => void;
};

type Session = { inappNotificationUid: string; userSub: string; sessionUid: string };

/**
 * Creates an object that can be used for starting and tracking a single in-app
 * notification session at a time. Note that the returned objects functions
 * may return rejected promises, which can usually be discarded with
 * `.catch(e => {})` if no special handling is desired.
 *
 * This requires react rerenders, which is usually undesirable. Instead, prefer
 * the value with callbacks variant which does not require react rerenders.
 */
export const useInappNotificationSession = (
  uid: string | null
): InappNotificationSession | null => {
  return useUnwrappedValueWithCallbacks(
    useInappNotificationSessionValueWithCallbacks({ type: 'react-rerender', props: { uid } })
  );
};

export const useInappNotificationSessionValueWithCallbacks = (
  propsVariableStrategy: VariableStrategyProps<{ uid: string | null }>
): ValueWithCallbacks<InappNotificationSession | null> => {
  const loginContextRaw = useContext(LoginContext);
  const propsVWC = useVariableStrategyPropsAsValueWithCallbacks(propsVariableStrategy);
  const sessionVWC = useWritableValueWithCallbacks<Session | null>(() => null);
  const sessionPromiseRef = useRef<Promise<Session> | null>(null);

  return useMappedValuesWithCallbacks(
    [propsVWC, sessionVWC, loginContextRaw.value],
    (): InappNotificationSession | null => {
      const props = propsVWC.get();
      if (props.uid === null) {
        return null;
      }

      const session = sessionVWC.get();
      const loginContext = loginContextRaw.value.get();

      return {
        inappNotificationUid: props.uid,
        inappNotificationUserUid: session?.inappNotificationUid ?? null,
        start: async () => {
          if (loginContext.state !== 'logged-in') {
            throw new Error('Not logged in');
          }
          const userSub = loginContext.userAttributes.sub;

          if (session !== null) {
            throw new Error('Session already started');
          }

          if (sessionPromiseRef.current === null) {
            sessionPromiseRef.current = (async () => {
              const response = await apiFetch(
                '/api/1/notifications/inapp/start',
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json; charset=utf-8' },
                  body: JSON.stringify({
                    inapp_notification_uid: props.uid,
                    platform: 'web',
                  }),
                },
                loginContext
              );
              if (!response.ok) {
                throw response;
              }
              const data: { inapp_notification_user_uid: string } = await response.json();
              const sessionUid = data.inapp_notification_user_uid;
              const session: Session = { inappNotificationUid: props.uid!, userSub, sessionUid };
              sessionVWC.set(session);
              sessionVWC.callbacks.call(undefined);
              return session;
            })();
          }

          return sessionPromiseRef.current.then((s) => {
            if (s.userSub !== userSub) {
              throw new Error('Session started for different user');
            }
            if (s.inappNotificationUid !== props.uid) {
              throw new Error('Session started for different notification');
            }
            return s.sessionUid;
          });
        },
        storeAction: async (slug, extra) => {
          const mySession = await (sessionPromiseRef.current ?? session);
          if (mySession === null) {
            throw new Error('Session not started');
          }

          if (props.uid !== mySession.inappNotificationUid) {
            throw new Error('Session started for different notification');
          }

          if (loginContext.state !== 'logged-in' || loginContext.userAttributes === null) {
            throw new Error('Not logged in');
          }

          if (loginContext.userAttributes.sub !== mySession.userSub) {
            throw new Error('Session started for different user');
          }

          const response = await apiFetch(
            '/api/1/notifications/inapp/store_action',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                inapp_notification_user_uid: mySession.sessionUid,
                action_slug: slug,
                extra,
              }),
            },
            loginContext
          );

          if (!response.ok) {
            throw response;
          }
        },
        reset: () => {
          sessionPromiseRef.current = null;
          sessionVWC.set(null);
          sessionVWC.callbacks.call(undefined);
        },
      };
    }
  );
};

/**
 * Ensures the given session is started, if it's not already started. This
 * is a convenience hook-like function.
 */
export const useStartSession = (
  sessionVariableStrategy: VariableStrategyProps<InappNotificationSession | null>,
  opts?: {
    /**
     * Called when the session is started. Changes to this value will not
     * cause the session to be restarted or this to be called again.
     */
    onStart?: () => void;
  }
): void => {
  const loginContextRaw = useContext(LoginContext);
  const started = useRef(false);
  const sessionVWC = useVariableStrategyPropsAsValueWithCallbacks(sessionVariableStrategy);
  const onStartRef = useRef(opts?.onStart);
  onStartRef.current = opts?.onStart;

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        if (loginContextUnch.state !== 'logged-in' || started.current) {
          return;
        }

        sessionVWC.callbacks.add(handleSessionChanged);
        handleSessionChanged();
        return () => {
          sessionVWC.callbacks.remove(handleSessionChanged);
        };

        function handleSessionChanged() {
          const session = sessionVWC.get();
          if (started.current || session === null) {
            return;
          }

          started.current = true;
          session.start();
          sessionVWC.callbacks.remove(handleSessionChanged);
          if (onStartRef.current) {
            onStartRef.current();
          }
        }
      },
      [sessionVWC]
    )
  );
};
