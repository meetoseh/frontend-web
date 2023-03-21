import { ReactElement, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../ApiConstants';
import { LoginContext } from '../LoginContext';

type AssociatedUser = {
  sub: string;
  time: number;
};

type StoredVisitor = {
  uid: string;
  user: AssociatedUser | null;
};

type UTM = {
  source: string;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
};

const getUTMFromURL = (): UTM | null => {
  const params = new URLSearchParams(window.location.search);
  const source = params.get('utm_source');
  if (source === null) {
    return null;
  }

  return {
    source,
    medium: params.get('utm_medium'),
    campaign: params.get('utm_campaign'),
    content: params.get('utm_content'),
    term: params.get('utm_term'),
  };
};

const areUTMsEqual = (a: UTM, b: UTM): boolean =>
  a.source === b.source &&
  a.medium === b.medium &&
  a.campaign === b.campaign &&
  a.content === b.content &&
  a.term === b.term;

type VisitorLoading = { loading: true };
type VisitorLoaded = { loading: false };

/**
 * Manages creating a visitor via the backend and associating it to the
 * current user. Must be used within a login context, and is intended to
 * only be included once per page.
 */
export const useVisitor = (): VisitorLoading | VisitorLoaded => {
  const loginContext = useContext(LoginContext);
  const [loading, setLoading] = useState(true);
  const guard = useRef<Promise<void> | null>(null);
  const handledUTM = useRef<{ utm: UTM; visitorUID: string | null } | null>(null);

  useEffect(() => {
    if (loginContext.state === 'loading') {
      return;
    }

    let active = true;
    takeLockAndHandleVisitor();
    return () => {
      active = false;
    };

    async function handleVisitor() {
      const storedVisitorRaw = localStorage.getItem('visitor');
      const storedVisitor =
        storedVisitorRaw === null ? null : (JSON.parse(storedVisitorRaw) as StoredVisitor);

      const currentUserSub = loginContext.userAttributes?.sub ?? null;
      const utm = (() => {
        const res = getUTMFromURL();
        if (
          res !== null &&
          handledUTM.current !== null &&
          areUTMsEqual(handledUTM.current.utm, res) &&
          handledUTM.current.visitorUID === storedVisitor?.uid
        ) {
          return null;
        }
        return res;
      })();

      const minTime = Date.now() - 1000 * 60 * 60 * 24;

      let newVisitor: StoredVisitor | null = null;

      if (storedVisitor === null && currentUserSub === null && utm === null) {
        const response = await apiFetch(
          '/api/1/visitors/?source=browser',
          { method: 'POST' },
          null
        );
        if (!response.ok) {
          throw response;
        }

        const data = await response.json();
        newVisitor = { uid: data.uid, user: null };
      } else if (
        currentUserSub !== null &&
        utm === null &&
        (storedVisitor?.user?.sub !== currentUserSub || (storedVisitor?.user?.time ?? 0) < minTime)
      ) {
        const response = await apiFetch(
          '/api/1/visitors/users?source=browser',
          {
            method: 'POST',
            headers: storedVisitor === null ? {} : { Visitor: storedVisitor.uid },
          },
          loginContext
        );
        if (!response.ok) {
          throw response;
        }

        const data = await response.json();
        newVisitor = { uid: data.uid, user: { sub: currentUserSub, time: Date.now() } };
      } else if (utm !== null) {
        const response = await apiFetch(
          '/api/1/visitors/utms?source=browser',
          {
            method: 'POST',
            headers: Object.assign(
              (storedVisitor === null ? {} : { Visitor: storedVisitor.uid }) as {
                [key: string]: string;
              },
              {
                'Content-Type': 'application/json; charset=utf-8',
              } as { [key: string]: string }
            ),
            body: JSON.stringify({
              utm_source: utm.source,
              utm_medium: utm.medium,
              utm_campaign: utm.campaign,
              utm_content: utm.content,
              utm_term: utm.term,
            }),
          },
          loginContext
        );
        if (!response.ok) {
          throw response;
        }

        const data = await response.json();
        newVisitor = {
          uid: data.uid,
          user: currentUserSub === null ? null : { sub: currentUserSub, time: Date.now() },
        };
        handledUTM.current = { utm, visitorUID: newVisitor.uid };
      }

      if (newVisitor !== null) {
        localStorage.setItem('visitor', JSON.stringify(newVisitor));
      }
    }

    async function takeLockAndHandleVisitor() {
      setLoading(true);
      while (guard.current !== null) {
        try {
          await guard.current;
        } catch (e) {
          console.error('handling visitor error (1): ', e);
        }
      }

      guard.current = Promise.resolve();
      (async () => {
        guard.current = handleVisitor();
        try {
          await guard.current;
        } catch (e) {
          console.error('handling visitor error (2): ', e);
        }
        guard.current = null;
        if (active) {
          setLoading(false);
        }
      })();
    }
  }, [loginContext]);

  return useMemo(
    () => ({
      loading,
    }),
    [loading]
  );
};

/**
 * A empty fragment which, as a side effect, calls useVisitor.
 */
export const VisitorHandler = (): ReactElement => {
  useVisitor();
  return <></>;
};
