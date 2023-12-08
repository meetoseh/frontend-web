import { ReactElement, useCallback, useContext } from 'react';
import { apiFetch } from '../../shared/ApiConstants';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { AdminDashboardTopBlock } from './AdminDashboardTopBlock';
import icons from './icons.module.css';
import { useWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { useMappedValuesWithCallbacks } from '../../shared/hooks/useMappedValuesWithCallbacks';
import { setVWC } from '../../shared/lib/setVWC';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';

/**
 * Loads the information that's used in the daily reminders (formerly user
 * notification settings) blocks, and then renders the blocks as a fragment
 * containing 4 blocks.
 *
 * This shows:
 * - How many users have daily reminders of any kind enabled
 * - How many users have SMS daily reminders enabled
 * - How many users have email daily reminders enabled
 * - How many users have push daily reminders enabled
 */
export const AdminDashboardNotificationSettingsBlocksLoader = (): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const smsEnabled = useWritableValueWithCallbacks(() => 0);
  const emailEnabled = useWritableValueWithCallbacks(() => 0);
  const pushEnabled = useWritableValueWithCallbacks(() => 0);

  const totalEnabled = useMappedValuesWithCallbacks(
    [smsEnabled, emailEnabled, pushEnabled],
    () => smsEnabled.get() + emailEnabled.get() + pushEnabled.get()
  );

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        if (loginContextUnch.state !== 'logged-in') {
          return;
        }
        const loginContext = loginContextUnch;

        let active = true;
        fetchCounts();
        return () => {
          active = false;
        };

        async function fetchCounts() {
          const response = await apiFetch('/api/1/admin/daily_reminders/counts', {}, loginContext);
          if (!response.ok) {
            throw response;
          }

          const body: {
            sms: number;
            email: number;
            push: number;
          } = await response.json();
          if (!active) {
            return;
          }

          setVWC(smsEnabled, body.sms);
          setVWC(emailEnabled, body.email);
          setVWC(pushEnabled, body.push);
        }
      },
      [smsEnabled, emailEnabled, pushEnabled]
    )
  );

  return (
    <>
      <RenderGuardedComponent
        props={totalEnabled}
        component={(totalCount) => (
          <AdminDashboardTopBlock
            iconClassName={icons.anyNotificationIcon}
            value={totalCount}
            label="Reminders Sent Daily"
          />
        )}
      />
      <RenderGuardedComponent
        props={pushEnabled}
        component={(pushCount) => (
          <AdminDashboardTopBlock
            iconClassName={icons.pushNotificationIcon}
            value={pushCount}
            label="Push"
          />
        )}
      />
      <RenderGuardedComponent
        props={smsEnabled}
        component={(smsCount) => (
          <AdminDashboardTopBlock
            iconClassName={icons.smsNotificationIcon}
            value={smsCount}
            label="SMS"
          />
        )}
      />
      <RenderGuardedComponent
        props={emailEnabled}
        component={(emailCount) => (
          <AdminDashboardTopBlock
            iconClassName={icons.emailNotificationIcon}
            value={emailCount}
            label="Email"
          />
        )}
      />
    </>
  );
};
