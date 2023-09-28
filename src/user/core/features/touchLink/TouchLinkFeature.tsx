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

/**
 * Detects if the user came from a user touch link and, if so, loads
 * the link information so it can be used by other features.
 */
export const TouchLinkFeature: Feature<TouchLinkState, TouchLinkResources> = {
  identifier: 'touchLink',
  useWorldState: () => {
    const codeInUrl = useWritableValueWithCallbacks<string | null>(() => {
      const path = window.location.pathname;
      if (!path.startsWith('/l/')) {
        return null;
      }

      return path.substring(3);
    });

    const activeLinkCode = useWritableValueWithCallbacks<StoredTouchLinkCode | null | undefined>(
      () => undefined
    );

    const loginContext = useContext(LoginContext);
    const interests = useContext(InterestsContext);

    useValueWithCallbacksEffect(
      codeInUrl,
      useCallback(
        (code) => {
          let running = true;
          readStoredTouchLinkCode().promise.then((c) => {
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
            writeStoredTouchLinkCode(newActiveLinkCode);
            setVWC(activeLinkCode, newActiveLinkCode);
            setVWC(codeInUrl, null);
          });

          return () => {
            running = false;
          };
        },
        [codeInUrl, activeLinkCode]
      )
    );

    useValueWithCallbacksEffect(
      activeLinkCode,
      useCallback(
        (activeLink) => {
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
              loginContext.state === 'loading' ||
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
              loginContext
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
                setUser: loginContext.state === 'logged-in',
              },
            };
            writeStoredTouchLinkCode(newActiveLinkCode);
            setVWC(activeLinkCode, newActiveLinkCode);
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
        },
        [activeLinkCode, loginContext, interests]
      )
    );

    useValueWithCallbacksEffect(
      activeLinkCode,
      useCallback(() => {
        let running = true;
        handlePostLogin();
        return () => {
          running = false;
        };

        async function handlePostLoginInner() {
          const link = activeLinkCode.get();
          if (
            loginContext.state !== 'logged-in' ||
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
          writeStoredTouchLinkCode(newActiveLinkCode);
          setVWC(activeLinkCode, newActiveLinkCode);
          apiFetch(
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
            loginContext
          );
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
      }, [activeLinkCode, loginContext, interests])
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
          if (window.location.pathname.startsWith('/l/')) {
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
