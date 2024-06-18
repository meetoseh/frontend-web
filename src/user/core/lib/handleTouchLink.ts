import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Callbacks,
  ValueWithCallbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { ScreenContext } from '../hooks/useScreenContext';
import { createValueWithCallbacksEffect } from '../../../shared/hooks/createValueWithCallbacksEffect';
import { setVWC } from '../../../shared/lib/setVWC';
import {
  StoredTouchLinkCode,
  readStoredTouchLinkCode,
  writeStoredTouchLinkCode,
} from './TouchLinkStore';
import { createCancelablePromiseFromCallbacks } from '../../../shared/lib/createCancelablePromiseFromCallbacks';
import { LoginContextValueLoggedIn } from '../../../shared/contexts/LoginContext';
import { waitForValueWithCallbacksConditionCancelable } from '../../../shared/lib/waitForValueWithCallbacksCondition';
import { apiFetch } from '../../../shared/ApiConstants';

export type PendingTouchLink = { code: string; clickUid: string | undefined };
export type LoggedOutPage = {
  code: string;
  pageIdentifier: string;
  pageExtra: any;
};
export type HandleTouchLinkResult = {
  /**
   * If we want a touch link code to be applied to the users screen queue
   * as soon as they are logged in, the code and clickUid to apply. If we
   * are currently processing and need time to determine this value, undefined.
   * If we do not want a touch link code to be applied, null.
   */
  pendingTouchLink: ValueWithCallbacks<PendingTouchLink | null | undefined>;

  /**
   * If we have a page identifier to swap the login page to, information
   * about the logged out page
   */
  loggedOutPage: ValueWithCallbacks<LoggedOutPage | null | undefined>;

  /**
   * A callback that must be invoked when a pending touch link has been
   * applied to the logged in users screen queue, to avoid applying it again.
   */
  onPendingTouchLinkApplied: (link: PendingTouchLink, user: LoginContextValueLoggedIn) => void;
};

/**
 * Handles the touch link code in the URL or that we have recently seen,
 * returning the information required for `useScreenQueueState` to potentially
 * apply the touch link code to the users screen queue, plus a function to cleanup.
 */
export const handleTouchLink = ({
  ctx,
}: {
  ctx: ScreenContext;
}): [HandleTouchLinkResult, () => void] => {
  const active = createWritableValueWithCallbacks(true);
  const pendingTouchLink = createWritableValueWithCallbacks<PendingTouchLink | null | undefined>(
    undefined
  );
  const loggedOutPage = createWritableValueWithCallbacks<LoggedOutPage | null | undefined>(
    undefined
  );
  const linkApplied = new Callbacks<[PendingTouchLink, LoginContextValueLoggedIn]>();

  handle();

  return [
    {
      pendingTouchLink,
      loggedOutPage,
      onPendingTouchLinkApplied: (link, user) => {
        if (Object.is(pendingTouchLink.get(), link)) {
          setVWC(pendingTouchLink, null);
        }
        linkApplied.call([link, user]);
      },
    },
    () => {
      setVWC(active, false);
    },
  ];

  async function handle() {
    if (!active.get()) {
      return;
    }

    const currentPath = window.location.pathname;
    const originalCode =
      !currentPath.startsWith('/l/') && !currentPath.startsWith('/a/')
        ? null
        : currentPath.substring(3);
    let code = originalCode;

    const storedLinkCancelable = readStoredTouchLinkCode();
    active.callbacks.add(storedLinkCancelable.cancel);
    if (!active.get()) {
      storedLinkCancelable.cancel();
    }
    let storedLink: Awaited<typeof storedLinkCancelable.promise>;
    try {
      storedLink = await storedLinkCancelable.promise;
    } catch (e) {
      if (!active.get()) {
        return;
      }
      throw e;
    } finally {
      active.callbacks.remove(storedLinkCancelable.cancel);
    }

    if (!active.get()) {
      return;
    }

    if (
      storedLink !== null &&
      code !== storedLink.link.code &&
      Date.now() - storedLink.seenAt.getTime() > 1000 * 60 * 60 * 2
    ) {
      console.log(
        `Stored touch link code ${storedLink.link.code} is stale and does not match current page code ${code} - ignoring stored code`
      );
      storedLink = null;
    }

    if (code !== null && storedLink !== null && storedLink.link.code !== code) {
      console.log(
        `URL touch link code ${code} does not match stored touch link code ${storedLink.link.code} - ignoring stored code`
      );
      storedLink = null;
    }

    if (code === null && storedLink !== null) {
      console.log(
        `Recovering touch link code ${storedLink.link.code} from stored as it has not been consumed yet`
      );
      code = storedLink.link.code;
    }

    if (code === null && storedLink === null) {
      console.log('No touch link code present or stored');
      setVWC(pendingTouchLink, null);
      setVWC(loggedOutPage, null);
      return;
    }

    let pendingLink: PendingTouchLink;
    if (code !== null) {
      const nonLoadingUserState = waitForValueWithCallbacksConditionCancelable(
        ctx.login.value,
        (v) => v.state !== 'loading'
      );
      active.callbacks.add(nonLoadingUserState.cancel);
      if (!active.get()) {
        nonLoadingUserState.cancel();
      }
      let user: Awaited<typeof nonLoadingUserState.promise>;
      try {
        user = await nonLoadingUserState.promise;
      } catch (e) {
        if (!active.get()) {
          return;
        }
        throw e;
      } finally {
        active.callbacks.remove(nonLoadingUserState.cancel);
      }
      if (!active.get()) {
        return;
      }

      pendingLink = {
        code,
        clickUid: storedLink?.link?.clickUid,
      };

      if (storedLink !== null) {
        console.log(
          `Logged out and have stored link information for code ${storedLink.link.code}, reusing`
        );
        setVWC(
          loggedOutPage,
          originalCode === code
            ? {
                code: storedLink.link.code,
                pageIdentifier: storedLink.link.pageIdentifier,
                pageExtra: storedLink.link.pageExtra,
              }
            : null
        );
      } else if (user.state !== 'logged-in') {
        console.log(
          `Found touch link code ${code} and not logged in, forced to follow to get page information`
        );
        // track the click sooner rather than waiting for a login which might
        // not happen
        const visitorNotLoading = waitForValueWithCallbacksConditionCancelable(
          ctx.interests.visitor.value,
          (v) => !v.loading
        );
        active.callbacks.add(visitorNotLoading.cancel);
        if (!active.get()) {
          visitorNotLoading.cancel();
        }
        let visitor: Awaited<typeof visitorNotLoading.promise>;
        try {
          visitor = await visitorNotLoading.promise;
        } catch (e) {
          if (!active.get()) {
            return;
          }
          throw e;
        } finally {
          active.callbacks.remove(visitorNotLoading.cancel);
        }

        if (!active.get()) {
          return;
        }

        if (visitor.loading) {
          throw new Error('impossible');
        }

        const controller = new AbortController();
        const signal = controller.signal;
        const doAbort = () => controller.abort();
        active.callbacks.add(doAbort);
        if (!active.get()) {
          doAbort();
        }
        try {
          const response = await apiFetch(
            '/api/1/notifications/complete',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
                ...(visitor.uid === null
                  ? {}
                  : {
                      Visitor: visitor.uid,
                    }),
              },
              body: JSON.stringify({
                code: pendingLink.code,
              }),
              signal,
            },
            null
          );
          if (!response.ok) {
            throw response;
          }
          const info: { page_identifier: string; page_extra: any; click_uid: string } =
            await response.json();
          console.log(`Determined logged out page for ${code} - ${info.page_identifier}`);
          setVWC(loggedOutPage, {
            code: pendingLink.code,
            pageIdentifier: info.page_identifier,
            pageExtra: info.page_extra,
          });

          const newStoredLink: StoredTouchLinkCode = {
            link: {
              code: pendingLink.code,
              userSub: null,
              pageIdentifier: info.page_identifier,
              pageExtra: info.page_extra,
              clickUid: info.click_uid,
              visitorUid: visitor.uid,
            },
            seenAt: new Date(),
          };

          const storeCancelable = writeStoredTouchLinkCode(newStoredLink);
          active.callbacks.add(storeCancelable.cancel);
          if (!active.get()) {
            storeCancelable.cancel();
          }
          try {
            await storeCancelable.promise;
          } catch (e) {
            if (!active.get()) {
              return;
            }
            throw e;
          } finally {
            active.callbacks.remove(storeCancelable.cancel);
          }

          if (!active.get()) {
            return;
          }

          storedLink = newStoredLink;
          pendingLink.clickUid = info.click_uid;
          setVWC(
            loggedOutPage,
            originalCode === code
              ? {
                  code: pendingLink.code,
                  pageIdentifier: storedLink.link.pageIdentifier,
                  pageExtra: storedLink.link.pageExtra,
                }
              : null
          );
        } catch (e) {
          if (!active.get()) {
            return;
          }
          console.warn('Ignoring touch link (failed to navigate when logged out)', e);
          setVWC(loggedOutPage, null);
          setVWC(pendingTouchLink, null);
          return;
        }
      } else {
        console.log(
          'No stored link code information, but since we are already logged in letting screen queue take care of it'
        );
      }
    } else {
      if (storedLink === null) {
        throw new Error('impossible');
      }
      pendingLink = storedLink.link;
    }

    const appliedCancelable = createCancelablePromiseFromCallbacks(linkApplied);
    appliedCancelable.promise.catch(() => {});
    active.callbacks.add(appliedCancelable.cancel);
    if (!active.get()) {
      appliedCancelable.cancel();
    }
    console.log(
      `Requesting screen queue applies pending touch link: ${JSON.stringify(pendingLink)}`
    );
    setVWC(pendingTouchLink, pendingLink);
    let applied: Awaited<typeof appliedCancelable.promise>;
    try {
      applied = await appliedCancelable.promise;
    } catch (e) {
      if (!active.get()) {
        return;
      }
      throw e;
    } finally {
      active.callbacks.remove(appliedCancelable.cancel);
    }

    if (!active.get()) {
      return;
    }

    const [appliedLink, _appliedUser] = applied;

    if (!Object.is(appliedLink, pendingLink)) {
      throw new Error('The applied touch link code does not match the one we marked pending');
    }

    console.log(
      `Erasing stored link as it was successfully applied to screen queue: ${JSON.stringify(
        appliedLink
      )}`
    );
    const storeCancelable = writeStoredTouchLinkCode(null);
    active.callbacks.add(storeCancelable.cancel);
    if (!active.get()) {
      storeCancelable.cancel();
    }
    try {
      await storeCancelable.promise;
    } catch (e) {
      if (!active.get()) {
        return;
      }
      throw e;
    } finally {
      active.callbacks.remove(storeCancelable.cancel);
    }
  }
};

/**
 * A hook-like function adapter for handleTouchLink
 */
export const useHandleTouchLink = ({ ctx }: { ctx: ScreenContext }): HandleTouchLinkResult => {
  const pendingTouchLinkVWC = useWritableValueWithCallbacks<PendingTouchLink | null | undefined>(
    () => undefined
  );
  const loggedOutPageVWC = useWritableValueWithCallbacks<LoggedOutPage | null | undefined>(
    () => undefined
  );
  const appliedStack = useRef<[PendingTouchLink, LoginContextValueLoggedIn][]>([]);
  const defaultOnPendingTouchLinkApplied = useCallback(
    (link: PendingTouchLink, user: LoginContextValueLoggedIn) => {
      appliedStack.current.push([link, user]);
    },
    []
  );
  const onPendingTouchLinkAppliedVWC = useWritableValueWithCallbacks<
    (link: PendingTouchLink, user: LoginContextValueLoggedIn) => void
  >(() => defaultOnPendingTouchLinkApplied);

  useEffect(() => {
    const [result, cleanup] = handleTouchLink({ ctx });

    const cleanupPendingTouchLinkAttacher = createValueWithCallbacksEffect(
      result.pendingTouchLink,
      (v) => {
        setVWC(pendingTouchLinkVWC, v);
        return undefined;
      }
    );
    const cleanupLoggedOutPageAttacher = createValueWithCallbacksEffect(
      result.loggedOutPage,
      (v) => {
        setVWC(loggedOutPageVWC, v);
        return undefined;
      }
    );
    setVWC(onPendingTouchLinkAppliedVWC, result.onPendingTouchLinkApplied);

    for (const [link, user] of appliedStack.current) {
      result.onPendingTouchLinkApplied(link, user);
    }
    appliedStack.current.splice(0, appliedStack.current.length);

    return () => {
      cleanupPendingTouchLinkAttacher();
      cleanupLoggedOutPageAttacher();
      cleanup();
      setVWC(onPendingTouchLinkAppliedVWC, defaultOnPendingTouchLinkApplied);
    };
  }, [ctx]);

  return useMemo(
    () => ({
      pendingTouchLink: pendingTouchLinkVWC,
      loggedOutPage: loggedOutPageVWC,
      onPendingTouchLinkApplied: (link, user) => onPendingTouchLinkAppliedVWC.get()(link, user),
    }),
    [pendingTouchLinkVWC, loggedOutPageVWC, onPendingTouchLinkAppliedVWC]
  );
};
