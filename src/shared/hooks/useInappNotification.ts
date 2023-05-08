import { useContext, useEffect, useRef, useState } from 'react';
import { useSingletonEffect } from '../lib/useSingletonEffect';
import { LoginContext } from '../LoginContext';
import { apiFetch } from '../ApiConstants';

const MAX_EXPIRATION_TIME_SECONDS = 60 * 60 * 24 * 7;

export type InappNotification = {
  /**
   * The inapp notification uid of the in-app notification
   * this information is for
   */
  uid: string;

  /**
   * True if the notification should be shown now, false
   * if it shouldn't be shown now
   */
  showNow: boolean;

  /**
   * Regardless of if we're showing it now or not, what would be the earliest
   * time that it might be shown next? This is not authoritative; it's meant to
   * reduce the number of requests to the backend that will definitely not
   * result in showing the notification.
   */
  nextShowAt: number | null;

  /**
   * Can be called to set showNow to false. Note that it's also necessary
   * to use an inapp notification session (useInappNotificationSession) to
   * tell the backend we saw the prompt, which also has a complete() function
   * that should be shown when the inapp notification is dismissed.
   *
   * Returns the inapp notification after setting showNow to false.
   *
   * @param tentative If true, showNow is not actually modified, but the returned
   *   inapp notification will have showNow set to false. This is useful for
   *   situations where we want to call doAnticipateState with a real promise,
   *   rather than just a resolved one
   */
  onShown: (this: void, tentative?: boolean) => InappNotification;
};

/**
 * Fetches the in-app notification with the given uid. Returns null while
 * loading the notification, and will hallucinate a showNow value of false if an
 * error occurs or we know the backend would return false if we query it.
 * Otherwise, this will ask the if the given notification should be presented
 * to the user or not.
 *
 * Note that this exclusively uses the idea that users should not be constantly
 * shown the same notification after dismissing it. It doesn't consider any
 * context surrounding the notification--for example, we shouldn't prompt a user
 * for a phone number if we already have their phone number.
 *
 * @param uid The uid of the in-app notification to fetch
 * @param suppress If true, this will always return null, and won't query the
 *   backend. This always following the rules of hooks when an in-app notification
 *   is needed conditionally. Note that changing this from true to false to true
 *   may trigger two network requests.
 * @returns The in-app notification if we've either retrieved it from the backend
 *   or hallucinated that it should not be shown, null if either suppressed or we
 *   are still loading data
 */
export const useInappNotification = (uid: string, suppress: boolean): InappNotification | null => {
  const loginContext = useContext(LoginContext);
  const [notification, setNotification] = useState<InappNotification | null>(null);

  let cleanedUp = useRef<boolean>(false);
  useEffect(() => {
    if (cleanedUp.current || loginContext.state === 'loading') {
      return;
    }
    cleanedUp.current = true;
    removeOldKeys();
    pruneExpiredState(loginContext?.userAttributes?.sub ?? null);
  }, [loginContext]);

  useSingletonEffect(
    (onDone) => {
      if (suppress) {
        setNotification(null);
        onDone();
        return;
      }

      if (loginContext.state !== 'logged-in' || loginContext.userAttributes === null) {
        setNotification(null);
        onDone();
        return;
      }
      const userSub = loginContext.userAttributes.sub;

      const stored = fetchStoredUid(uid);
      if (stored !== null) {
        const now = Date.now() / 1000;
        if (stored.nextShowAt === null || stored.nextShowAt > now) {
          const newNotif = {
            uid,
            showNow: false,
            nextShowAt: stored.nextShowAt,
            onShown: () => newNotif,
          };
          setNotification(newNotif);
          onDone();
          return;
        }
      }

      let active = true;
      fetchFromNetwork();
      return () => {
        active = false;
      };

      async function fetchFromNetworkInner() {
        const response = await apiFetch(
          '/api/1/notifications/inapp/should_show',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              inapp_notification_uid: uid,
            }),
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }

        const data: { show_now: boolean; next_show_at: number | null } = await response.json();

        const now = Date.now() / 1000;
        const dataToStore: StoredInappNotification = {
          uid,
          userSub,
          checkedAt: now,
          expireAt: Math.min(
            now + MAX_EXPIRATION_TIME_SECONDS,
            data.next_show_at ?? now + MAX_EXPIRATION_TIME_SECONDS
          ),
          nextShowAt: data.next_show_at,
        };

        if (!data.show_now) {
          storeUid(uid, dataToStore);
        }

        const interpretedData: InappNotification = {
          uid,
          showNow: data.show_now,
          nextShowAt: data.next_show_at,
          onShown: (tentative) => {
            if (tentative === true) {
              return {
                ...interpretedData,
                showNow: false,
              };
            }

            setNotification((oldNotif) => {
              if (oldNotif === null) {
                return null;
              }

              if (!oldNotif.showNow) {
                return oldNotif;
              }

              storeUid(uid, dataToStore);

              const res = {
                ...oldNotif,
                showNow: false,
                onShown: () => res,
              };
              return res;
            });
            const newNotif = {
              uid,
              showNow: false,
              nextShowAt: data.next_show_at,
              onShown: () => newNotif,
            };
            return newNotif;
          },
        };
        setNotification(interpretedData);
      }

      async function fetchFromNetwork() {
        try {
          await fetchFromNetworkInner();
        } catch (e) {
          if (active) {
            console.error('Error while fetching in-app notification from network: ', e);
            const res = {
              uid,
              showNow: false,
              nextShowAt: null,
              onShown: () => res,
            };
            setNotification(res);
          }
        } finally {
          onDone();
        }
      }
    },
    [uid, suppress, loginContext]
  );

  return notification;
};

type StoredInappNotification = {
  /**
   * The uid of the inapp notification this contains information on
   */
  uid: string;
  /**
   * The sub of the user that saw the notification; disregard for different
   * users
   */
  userSub: string;
  /**
   * When we checked on this notification, in seconds since the epoch
   */
  checkedAt: number;
  /**
   * The latest that this key should be deleted, in seconds since the epoch
   */
  expireAt: number;
  /**
   * The earliest time that this notification might be shown again, in seconds
   * since the epoch, or null if it'll never be shown again
   */
  nextShowAt: number | null;
};

const fetchStoredUids = (): string[] => {
  const raw = localStorage.getItem('inapp-notifications');
  if (raw === null) {
    return [];
  }

  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
};

const storeUids = (uids: string[]) => {
  localStorage.setItem('inapp-notifications', JSON.stringify(uids));
};

const fetchStoredUid = (uid: string): StoredInappNotification | null => {
  const raw = localStorage.getItem(`inapp-notification-${uid}`);
  if (raw === null) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
};

const storeUid = (uid: string, data: StoredInappNotification) => {
  const uids = fetchStoredUids();
  if (!uids.includes(uid)) {
    uids.push(uid);
  }
  localStorage.setItem(`inapp-notification-${uid}`, JSON.stringify(data));
  storeUids(uids);
};

const pruneExpiredState = (userSub: string | null) => {
  const uids = fetchStoredUids();
  const newUids: string[] = [];
  const removedUids: string[] = [];
  const now = Date.now() / 1000;

  for (const uid of uids) {
    const stored = fetchStoredUid(uid);
    if (stored === null) {
      removedUids.push(uid);
      continue;
    }

    if (stored.expireAt < now) {
      removedUids.push(uid);
      continue;
    }

    if (stored.checkedAt + MAX_EXPIRATION_TIME_SECONDS < now) {
      removedUids.push(uid);
      continue;
    }

    if (stored.userSub !== userSub) {
      removedUids.push(uid);
      continue;
    }

    newUids.push(uid);
  }

  for (const uid of removedUids) {
    localStorage.removeItem(`inapp-notification-${uid}`);
  }
  storeUids(newUids);
};

/** Keys in local storage that were replaced with this hook */
const oldKeys = [
  'your-journey',
  'daily-goal-prompt',
  'introspection-prompt',
  'notification-time-prompt',
  'handled-request-notification-time',
  'skip-request-phone-first',
  'skip-request-phone-second',
  'signup-reward',
  'onboarding-class',
];

const removeOldKeys = () => {
  for (const k of oldKeys) {
    localStorage.removeItem(k);
  }
};