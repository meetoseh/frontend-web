import { ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { User } from '../User';
import { CrudItemBlock } from '../../crud/CrudItemBlock';
import styles from './BigUserInappNotifications.module.css';
import { CrudFetcherKeyMap, convertUsingKeymap } from '../../crud/CrudFetcher';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { apiFetch } from '../../../shared/ApiConstants';
import { AdminDashboardLargeChartPlaceholder } from '../../dashboard/AdminDashboardLargeChartPlaceholder';
import { ModalContext, addModalWithCallbackToRemove } from '../../../shared/contexts/ModalContext';
import { ModalWrapper } from '../../../shared/ModalWrapper';
import { CrudFormElement } from '../../crud/CrudFormElement';
import buttonStyles from '../../../shared/buttons.module.css';
import { useValueWithCallbacksEffect } from '../../../shared/hooks/useValueWithCallbacksEffect';
import { BoxError, chooseErrorFromStatus, DisplayableError } from '../../../shared/lib/errors';

type Session = {
  uid: string;
  inappNotification: {
    uid: string;
    name: string;
  };
  platform: string;
  createdAt: Date;
};

const sessionKeyMap: CrudFetcherKeyMap<Session> = {
  inapp_notification: 'inappNotification',
  created_at: (_, v) => ({ key: 'createdAt', value: new Date(v * 1000) }),
};

type Action = {
  uid: string;
  inappNotificationUserUID: string;
  inappNotificationAction: {
    uid: string;
    slug: string;
  };
  extra: object | null;
  createdAt: Date;
};

const actionKeyMap: CrudFetcherKeyMap<Action> = {
  inapp_notification_user_uid: 'inappNotificationUserUID',
  inapp_notification_action: 'inappNotificationAction',
  created_at: (_, v) => ({ key: 'createdAt', value: new Date(v * 1000) }),
};

type SessionWithActions = {
  session: Session;
  actions: Action[] | undefined;
};

/**
 * Shows what in-app notifications the given user has seen in order of
 * recentness
 */
export const BigUserInappNotifications = ({ user }: { user: User }): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const [sessions, setSessions] = useState<
    { sub: string; actions: SessionWithActions[] } | undefined
  >(undefined);
  const [activeSession, setActiveSession] = useState<SessionWithActions | null>(null);
  const [error, setError] = useState<DisplayableError | null>(null);

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        if (sessions !== undefined && sessions.sub === user.sub) {
          return;
        }

        if (loginContextUnch.state !== 'logged-in') {
          return;
        }

        const loginContext = loginContextUnch;

        let active = true;
        fetchSessions();
        return () => {
          active = false;
        };

        async function fetchSessionsInner() {
          let response;
          try {
            response = await apiFetch(
              '/api/1/notifications/inapp/search_sessions',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json; charset=utf-8',
                },
                body: JSON.stringify({
                  filters: {
                    user_sub: {
                      operator: 'eq',
                      value: user.sub,
                    },
                  },
                  sort: [
                    {
                      key: 'created_at',
                      dir: 'desc',
                      before: null,
                      after: null,
                    },
                  ],
                  limit: 15,
                }),
              },
              loginContext
            );
          } catch {
            throw new DisplayableError('connectivity', 'fetch sessions');
          }

          if (!response.ok) {
            throw chooseErrorFromStatus(response.status, 'fetch sessions');
          }

          const data: { items: any[] } = await response.json();
          if (!active) {
            return;
          }
          setSessions({
            sub: user.sub,
            actions: data.items.map((item) => ({
              session: convertUsingKeymap(item, sessionKeyMap),
              actions: undefined,
            })),
          });
        }

        async function fetchSessions() {
          setError(null);
          try {
            await fetchSessionsInner();
          } catch (e) {
            const err =
              e instanceof DisplayableError
                ? e
                : new DisplayableError('client', 'fetch sessions', `${e}`);
            if (active) {
              setError(err);
            }
          }
        }
      },
      [user, sessions]
    )
  );

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        if (activeSession === null) {
          return;
        }

        if (activeSession.actions !== undefined) {
          return;
        }

        if (loginContextUnch.state !== 'logged-in') {
          return;
        }
        const loginContext = loginContextUnch;

        let active = true;
        fetchActions();
        return () => {
          active = false;
        };

        async function fetchActionsInner() {
          if (activeSession === null) {
            return;
          }

          let response;
          try {
            response = await apiFetch(
              '/api/1/notifications/inapp/search_actions',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json; charset=utf-8',
                },
                body: JSON.stringify({
                  filters: {
                    inapp_notification_user_uid: {
                      operator: 'eq',
                      value: activeSession.session.uid,
                    },
                  },
                  sort: [
                    {
                      key: 'created_at',
                      dir: 'asc',
                      before: null,
                      after: null,
                    },
                  ],
                  limit: 25,
                }),
              },
              loginContext
            );
          } catch {
            throw new DisplayableError('connectivity', 'fetch actions');
          }

          if (!response.ok) {
            throw chooseErrorFromStatus(response.status, 'fetch actions');
          }

          const data: { items: any[] } = await response.json();
          if (!active) {
            return;
          }

          const actions = data.items.map((item) => convertUsingKeymap(item, actionKeyMap));
          setSessions((sessions) => {
            if (sessions === undefined) {
              return sessions;
            }
            return {
              ...sessions,
              actions: sessions.actions.map((session) => {
                if (session.session.uid === activeSession.session.uid) {
                  return {
                    ...session,
                    actions,
                  };
                }
                return session;
              }),
            };
          });
        }

        async function fetchActions() {
          try {
            await fetchActionsInner();
          } catch (e) {
            const err =
              e instanceof DisplayableError
                ? e
                : new DisplayableError('client', 'fetch actions', `${e}`);
            if (active) {
              setError(err);
              setActiveSession(null);
            }
          }
        }
      },
      [activeSession]
    )
  );

  useEffect(() => {
    if (activeSession === null || sessions === undefined) {
      return;
    }

    const session = sessions.actions.find(
      (session) => session.session.uid === activeSession.session.uid
    );
    if (session === undefined) {
      setActiveSession(null);
      return;
    }

    if (session !== activeSession) {
      setActiveSession(session);
    }
  }, [sessions, activeSession]);

  useEffect(() => {
    if (activeSession === null) {
      return;
    }

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <ModalWrapper onClosed={() => setActiveSession(null)}>
        <div className={styles.modalTitle}>{activeSession.session.inappNotification.name}</div>
        {activeSession.actions === undefined ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <CrudFormElement title="Actions" noTopMargin>
            <div className={styles.actions}>
              {activeSession.actions.map((action) => (
                <div key={action.uid} className={styles.action}>
                  <div className={styles.actionSlug}>{action.inappNotificationAction.slug}</div>
                  <div className={styles.actionTimestamp}>{action.createdAt.toLocaleString()}</div>
                  {action.extra && (
                    <div className={styles.actionExtra}>
                      <pre>{JSON.stringify(action.extra, null, 2)}</pre>
                    </div>
                  )}
                </div>
              ))}
              {activeSession.actions.length === 0 && (
                <div className={styles.noActions}>No actions found</div>
              )}
            </div>
          </CrudFormElement>
        )}
      </ModalWrapper>
    );
  }, [activeSession, modalContext.modals]);

  const onViewSession = useMemo<((e: React.MouseEvent<HTMLButtonElement>) => void)[]>(() => {
    if (sessions === undefined) {
      return [];
    }

    return sessions.actions.map((session) => (e) => {
      e.preventDefault();
      setActiveSession(session);
    });
  }, [sessions]);

  if (sessions === undefined) {
    return <AdminDashboardLargeChartPlaceholder />;
  }

  return (
    <CrudItemBlock title="In-App Notifications" controls={null}>
      {error && <BoxError error={error} />}

      {sessions && sessions.actions.length === 0 && (
        <div className={styles.noSessions}>No sessions found</div>
      )}
      {sessions && sessions.actions.length > 0 && (
        <div className={styles.sessions}>
          {sessions.actions.map((session, i) => (
            <button
              className={buttonStyles.unstyled}
              key={session.session.uid}
              type="button"
              onClick={onViewSession[i]}>
              <CrudFormElement title={session.session.inappNotification.name}>
                <div className={styles.sessionTimestamp}>
                  {session.session.createdAt.toLocaleString()}
                </div>
              </CrudFormElement>
            </button>
          ))}
        </div>
      )}
    </CrudItemBlock>
  );
};
