import { ReactElement, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../../shared/ApiConstants';
import { LoginContext } from '../../shared/LoginContext';
import { AdminDashboardTopBlock } from './AdminDashboardTopBlock';
import icons from './icons.module.css';

/**
 * Loads the information that's used in the user notification settings blocks,
 * and then renders the blocks as a fragment containing 4 blocks.
 *
 * This shows:
 * - How many users have sms notifications of any kind enabled
 * - How many users have specifically selected morning
 * - How many users have specifically selected afternoon
 * - How many users have specifically selected evening
 */
export const AdminDashboardNotificationSettingsBlocksLoader = (): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [anyCount, setAnyCount] = useState(0);
  const [morningCount, setMorningCount] = useState(0);
  const [afternoonCount, setAfternoonCount] = useState(0);
  const [eveningCount, setEveningCount] = useState(0);

  const totalCount = anyCount + morningCount + afternoonCount + eveningCount;

  useEffect(() => {
    if (loginContext.state !== 'logged-in') {
      return;
    }

    let active = true;
    fetchCounts();
    return () => {
      active = false;
    };

    async function fetchCounts() {
      const response = await apiFetch(
        '/api/1/admin/total_user_notification_settings',
        {},
        loginContext
      );
      if (!response.ok) {
        throw response;
      }

      const body: { value: { [key: string]: number } } = await response.json();
      if (!active) {
        return;
      }

      setAnyCount(body.value['text-any'] ?? 0);
      setMorningCount(body.value['text-morning'] ?? 0);
      setAfternoonCount(body.value['text-afternoon'] ?? 0);
      setEveningCount(body.value['text-evening'] ?? 0);
    }
  }, [loginContext]);

  return (
    <>
      <AdminDashboardTopBlock
        iconClassName={icons.anyNotificationIcon}
        value={totalCount}
        label={'Notifications Enabled'}
      />
      <AdminDashboardTopBlock
        iconClassName={icons.morningNotificationIcon}
        value={morningCount + anyCount}
        label={'Morning'}
      />
      <AdminDashboardTopBlock
        iconClassName={icons.afternoonNotificationIcon}
        value={afternoonCount}
        label={'Afternoon'}
      />
      <AdminDashboardTopBlock
        iconClassName={icons.eveningNotificationIcon}
        value={eveningCount}
        label={'Evening'}
      />
    </>
  );
};
