import { ReactElement, useCallback, useContext, useMemo, useState } from 'react';
import styles from './BigUser.module.css';
import { BigUserBasicInfo } from './BigUserBasicInfo';
import { User, userKeyMap } from '../User';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { apiFetch } from '../../../shared/ApiConstants';
import { convertUsingKeymap } from '../../crud/CrudFetcher';
import { BigUserAttribution } from './BigUserAttribution';
import { BigUserInappNotifications } from './BigUserInappNotifications';
import { BigUserSuggestionFlow } from './BigUserSuggestionFlow';
import { useOsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { BigUserContactMethodLog } from './contact_method_log/BigUserContactMethodLog';
import { BigUserDailyReminderSettingsLog } from './daily_reminder_settings_log/BigUserDailyReminderSettingsLog';
import { BigUserDailyReminders } from './BigUserDailyReminders';
import { useValueWithCallbacksEffect } from '../../../shared/hooks/useValueWithCallbacksEffect';
import { BigUserClientScreens } from './client_screens/BigUserClientScreens';

/**
 * Acts as a dashboard for a specific user, aka a traditional user show page,
 * aka a "Big User" display, since you get there by "expanding" a user from
 * the listing page.
 */
export const BigUser = (): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const sub = useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('sub');
  }, []);
  const imageHandler = useOsehImageStateRequestHandler({});

  if (sub === null) {
    window.location.href = '/admin/users';
    throw new Error('Redirecting to /admin/users');
  }

  const [user, setUser] = useState<User | null | undefined>(undefined);

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        if (loginContextUnch.state !== 'logged-in') {
          return;
        }
        const loginContext = loginContextUnch;

        if (user !== undefined) {
          return;
        }

        let active = true;
        fetchUser();
        return () => {
          active = false;
        };

        async function fetchUserInner() {
          const response = await apiFetch(
            '/api/1/users/search',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                filters: {
                  sub: {
                    operator: 'eq',
                    value: sub,
                  },
                },
                limit: 1,
              }),
            },
            loginContext
          );
          if (!response.ok) {
            throw response;
          }

          const data: { items: any[] } = await response.json();
          if (!active) {
            return;
          }

          if (data.items.length === 0) {
            console.log('No matching user found');
            setUser(null);
            return;
          }

          if (typeof userKeyMap === 'function') {
            setUser(userKeyMap(data.items[0]));
          } else {
            setUser(convertUsingKeymap(data.items[0], userKeyMap));
          }
        }

        async function fetchUser() {
          try {
            await fetchUserInner();
          } catch (e) {
            if (active) {
              console.log('Error fetching user', e);
              setUser(null);
            }
          }
        }
      },
      [sub, user]
    )
  );

  if (user === undefined) {
    return <>Loading...</>;
  }

  if (user === null) {
    return <>No matching user found</>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.title}>User</div>
      <div className={styles.row}>
        <div className={styles.narrow}>
          <BigUserBasicInfo user={user} imageHandler={imageHandler} />
        </div>
        <div className={styles.wide}>
          <BigUserAttribution user={user} imageHandler={imageHandler} />
        </div>
        <div className={styles.narrow}>
          <BigUserDailyReminders user={user} />
        </div>
        <div className={styles.wide}>
          <BigUserClientScreens user={user} />
        </div>
        <div className={styles.wide}>
          <BigUserInappNotifications user={user} />
        </div>
        <div className={styles.wide}>
          <BigUserContactMethodLog user={user} />
        </div>
        <div className={styles.wide}>
          <BigUserDailyReminderSettingsLog user={user} />
        </div>
        <div className={styles.wide}>
          <BigUserSuggestionFlow user={user} />
        </div>
      </div>
    </div>
  );
};
