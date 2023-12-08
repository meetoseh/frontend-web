import { useCallback, useContext } from 'react';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { Feature } from '../../models/Feature';
import { TouchLinkResources } from './TouchLinkResources';
import { TouchLinkState } from './TouchLinkState';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { apiFetch } from '../../../../shared/ApiConstants';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { InterestsContext } from '../../../../shared/contexts/InterestsContext';
import { TouchLink } from './TouchLink';
import {
  StoredTouchLinkCode,
  readStoredTouchLinkCode,
  writeStoredTouchLinkCode,
} from './TouchLinkStore';
import { useValuesWithCallbacksEffect } from '../../../../shared/hooks/useValuesWithCallbacksEffect';

/**
 * Detects if the user came from a user touch link and, if so, loads
 * the link information so it can be used by other features.
 */
export const TouchLinkFeature: Feature<TouchLinkState, TouchLinkResources> = {
  identifier: 'touchLink',
  useWorldState: () => {
    const codeInUrl = useWritableValueWithCallbacks<string | null>(() => {
      const path = window.location.pathname;
      if (!path.startsWith('/l/') && !path.startsWith('/a/')) {
        return null;
      }

      return path.substring(3);
    });

    const activeLinkCode = useWritableValueWithCallbacks<StoredTouchLinkCode | null | undefined>(
      () => undefined
    );

    const loginContextRaw = useContext(LoginContext);
    const interests = useContext(InterestsContext);

    useValueWithCallbacksEffect(
      codeInUrl,
      useCallback(
        (code) => {
          let running = true;
          readStoredTouchLinkCode().promise.then(async (c) => {
            if (!running) {
              return;
            }

            if (c !== null && Date.now() - c.codeSeenAt.getTime() > 1000 * 60 * 60) {
              c = null;
              writeStoredTouchLinkCode(null);
            }

            if (code === null || (c !== null && c.code === code)) {
              setVWC(activeLinkCode, c);
              return;
            }

            const newActiveLinkCode = {
              code,
              link: null,
              codeSeenAt: new Date(),
            };
            try {
              await writeStoredTouchLinkCode(newActiveLinkCode).promise;
            } finally {
              if (!running) {
                return;
              }

              setVWC(activeLinkCode, newActiveLinkCode);
              setVWC(codeInUrl, null);
            }
          });

          return () => {
            running = false;
          };
        },
        [codeInUrl, activeLinkCode]
      )
    );

    useValuesWithCallbacksEffect(
      [activeLinkCode, loginContextRaw.value],
      useCallback(() => {
        const activeLink = activeLinkCode.get();
        const loginContextUnch = loginContextRaw.value.get();

        let running = true;
        getLinkInfo();
        return () => {
          running = false;
        };

        async function getLinkInfoInner() {
          if (
            !running ||
            activeLink === null ||
            activeLink === undefined ||
            activeLink.link !== null
          ) {
            return;
          }

          if (
            loginContextUnch.state === 'loading' ||
            interests.state === 'loading' ||
            interests.visitor.loading
          ) {
            return;
          }

          const response = await apiFetch(
            '/api/1/notifications/complete',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
                ...(interests.visitor.uid !== null
                  ? {
                      Visitor: interests.visitor.uid,
                    }
                  : {}),
              },
              body: JSON.stringify({
                code: activeLink.code,
              }),
            },
            loginContextUnch.state === 'logged-in' ? loginContextUnch : null
          );

          if (!response.ok) {
            if (response.status === 404) {
              if (running) {
                setVWC(activeLinkCode, null);
              }
              return;
            }

            throw response;
          }

          const data: {
            page_identifier: string;
            page_extra: Record<string, any>;
            click_uid: string;
          } = await response.json();

          if (!running) {
            return;
          }

          const newActiveLinkCode: StoredTouchLinkCode = {
            ...activeLink,
            link: {
              link: {
                pageIdentifier: data.page_identifier,
                pageExtra: data.page_extra,
              },
              onClickUid: data.click_uid,
              setUser: loginContextUnch.state === 'logged-in',
            },
          };
          try {
            await writeStoredTouchLinkCode(newActiveLinkCode).promise;
          } finally {
            if (running) {
              setVWC(activeLinkCode, newActiveLinkCode);
            }
          }
        }

        async function getLinkInfo() {
          try {
            await getLinkInfoInner();
          } catch (e) {
            if (!running) {
              return;
            }

            console.log('Failed to get link destination:', e);
            setVWC(activeLinkCode, null);
          }
        }
      }, [activeLinkCode, loginContextRaw, interests])
    );

    useValuesWithCallbacksEffect(
      [activeLinkCode, loginContextRaw.value],
      useCallback(() => {
        let running = true;
        handlePostLogin();
        return () => {
          running = false;
        };

        async function handlePostLoginInner() {
          const link = activeLinkCode.get();
          const loginContextUnch = loginContextRaw.value.get();
          if (
            loginContextUnch.state !== 'logged-in' ||
            interests.state === 'loading' ||
            interests.visitor.loading ||
            link === null ||
            link === undefined ||
            link.link === null ||
            link.link.setUser ||
            !running
          ) {
            return;
          }

          const newActiveLinkCode = {
            ...link,
            link: {
              ...link.link,
              setUser: true,
            },
          };
          try {
            await writeStoredTouchLinkCode(newActiveLinkCode).promise;
          } catch (e) {}

          try {
            await apiFetch(
              '/api/1/notifications/post_login',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json; charset=utf-8',
                  ...(interests.visitor.uid !== null ? { Visitor: interests.visitor.uid } : {}),
                },
                body: JSON.stringify({
                  code: link.code,
                  uid: link.link.onClickUid,
                }),
                keepalive: true,
              },
              loginContextUnch
            );
          } finally {
            if (running) {
              setVWC(activeLinkCode, newActiveLinkCode);
            }
          }
        }

        async function handlePostLogin() {
          try {
            await handlePostLoginInner();
          } catch (e) {
            if (!running) {
              return;
            }

            console.log('Failed to handle post login:', e);
          }
        }
      }, [activeLinkCode, loginContextRaw, interests])
    );

    useValuesWithCallbacksEffect(
      [activeLinkCode, loginContextRaw.value],
      useCallback(() => {
        // The goal of this callback is that if the link points to the home
        // screen then we hard redirect to the homescreen to ensure the user
        // is prompted to open the app if they have the app installed, which
        // they wouldn't be for /l/* urls given that they sometimes point to
        // functionality not available in the app

        // We also have /a/* shortlinks which are always supported in the app
        // and hence automatically redirect there without us needed to reload
        const link = activeLinkCode.get();
        if (
          link === null ||
          link === undefined ||
          link.link === null ||
          link.link.link.pageIdentifier !== 'home'
        ) {
          return;
        }

        const loginContextUnch = loginContextRaw.value.get();

        if (loginContextUnch.state === 'loading') {
          return;
        }

        if (loginContextUnch.state === 'logged-in' && !link.link.setUser) {
          // wait for the user to be set
          return;
        }

        const currentPath = window.location.pathname;
        if (!currentPath.startsWith('/l/')) {
          return;
        }

        const url = new URL(window.location.href);
        url.pathname = '';
        window.location.assign(url.toString());
        return undefined;
      }, [loginContextRaw, activeLinkCode])
    );

    return useMappedValuesWithCallbacks([activeLinkCode, codeInUrl], (): TouchLinkState => {
      const link = activeLinkCode.get();

      return {
        code: link === null ? null : link === undefined ? codeInUrl.get() : link.code,
        linkInfo:
          link === null
            ? null
            : link === undefined
            ? undefined
            : link.link === null
            ? undefined
            : link.link.link,
        handledLink: () => {
          if (
            window.location.pathname.startsWith('/l/') ||
            window.location.pathname.startsWith('/a/')
          ) {
            const url = new URL(window.location.href);
            url.pathname = '';
            window.history.pushState({}, '', url.toString());
          }
          writeStoredTouchLinkCode(null);
          setVWC(codeInUrl, null);
          setVWC(activeLinkCode, null);
        },
      };
    });
  },
  useResources: () => {
    return useWritableValueWithCallbacks<TouchLinkResources>(() => ({ loading: true }));
  },
  isRequired: (worldState) => {
    if (worldState.code !== null && worldState.linkInfo === undefined) {
      return undefined;
    }
    return false;
  },
  component: () => <TouchLink />,
};
