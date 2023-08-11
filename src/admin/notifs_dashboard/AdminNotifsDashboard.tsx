import { PropsWithChildren, ReactElement, useCallback, useContext, useMemo } from 'react';
import styles from './AdminNotifsDashboard.module.css';
import { useWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { setVWC } from '../../shared/lib/setVWC';
import { SmoothExpandable } from '../../shared/components/SmoothExpandable';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';
import { Button } from '../../shared/forms/Button';
import { FlowChart, FlowChartProps } from '../../shared/components/FlowChart';
import { combineClasses } from '../../shared/lib/combineClasses';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { NetworkResponse, useNetworkResponse } from '../../shared/hooks/useNetworkResponse';
import { apiFetch } from '../../shared/ApiConstants';
import { AdminDashboardLargeChartProps } from '../dashboard/AdminDashboardLargeChart';
import { IconButtonWithAutoDisable } from '../../shared/forms/IconButtonWithAutoDisable';
import { CrudFetcherKeyMap, convertUsingKeymap } from '../crud/CrudFetcher';
import {
  formatNetworkDashboard,
  formatNetworkDate,
  formatNetworkDuration,
  formatNetworkError,
  formatNetworkNumber,
} from '../../shared/lib/networkResponseUtils';

const flowChartSettings: FlowChartProps = {
  columnGap: { type: 'react-rerender', props: 24 },
  rowGap: { type: 'react-rerender', props: 48 },
  color: { type: 'react-rerender', props: [0, 0, 0, 0.5] },
  lineThickness: { type: 'react-rerender', props: 2 },
  arrowBlockGapPx: { type: 'react-rerender', props: { head: 4, tail: 4 } },
  arrowHeadLengthPx: { type: 'react-rerender', props: 8 },
  arrowHeadAngleDeg: { type: 'react-rerender', props: 30 },
};

type PartialPushTicketStatsItem = {
  queued: number;
  succeeded: number;
  abandoned: number;
  failedDueToDeviceNotRegistered: number;
  failedDueToClientErrorOther: number;
  failedDueToInternalError: number;
  retried: number;
  failedDueToClientError429: number;
  failedDueToServerError: number;
  failedDueToNetworkError: number;
};

const partialPushTicketStatsItemKeyMap: CrudFetcherKeyMap<PartialPushTicketStatsItem> = {
  failed_due_to_device_not_registered: 'failedDueToDeviceNotRegistered',
  failed_due_to_client_error_other: 'failedDueToClientErrorOther',
  failed_due_to_internal_error: 'failedDueToInternalError',
  failed_due_to_client_error_429: 'failedDueToClientError429',
  failed_due_to_server_error: 'failedDueToServerError',
  failed_due_to_network_error: 'failedDueToNetworkError',
};

type PartialPushTicketStats = {
  yesterday: PartialPushTicketStatsItem;
  today: PartialPushTicketStatsItem;
  checkedAt: Date;
};

const parsePartialPushTicketStats = (raw: any): PartialPushTicketStats => ({
  yesterday: convertUsingKeymap(raw.yesterday, partialPushTicketStatsItemKeyMap),
  today: convertUsingKeymap(raw.today, partialPushTicketStatsItemKeyMap),
  checkedAt: new Date(raw.checked_at * 1000),
});

type PartialPushReceiptStatsItem = {
  succeeded: number;
  abandoned: number;
  failedDueToDeviceNotRegistered: number;
  failedDueToMessageTooBig: number;
  failedDueToMessageRateExceeded: number;
  failedDueToMismatchedSenderId: number;
  failedDueToInvalidCredentials: number;
  failedDueToClientErrorOther: number;
  failedDueToInternalError: number;
  retried: number;
  failedDueToNotReadyYet: number;
  failedDueToServerError: number;
  failedDueToClientError429: number;
  failedDueToNetworkError: number;
};

const partialPushReceiptStatsItemKeyMap: CrudFetcherKeyMap<PartialPushReceiptStatsItem> = {
  failed_due_to_device_not_registered: 'failedDueToDeviceNotRegistered',
  failed_due_to_message_too_big: 'failedDueToMessageTooBig',
  failed_due_to_message_rate_exceeded: 'failedDueToMessageRateExceeded',
  failed_due_to_mismatched_sender_id: 'failedDueToMismatchedSenderId',
  failed_due_to_invalid_credentials: 'failedDueToInvalidCredentials',
  failed_due_to_client_error_other: 'failedDueToClientErrorOther',
  failed_due_to_internal_error: 'failedDueToInternalError',
  failed_due_to_not_ready_yet: 'failedDueToNotReadyYet',
  failed_due_to_client_error_429: 'failedDueToClientError429',
  failed_due_to_server_error: 'failedDueToServerError',
  failed_due_to_network_error: 'failedDueToNetworkError',
};

type PartialPushReceiptStats = {
  yesterday: PartialPushReceiptStatsItem;
  today: PartialPushReceiptStatsItem;
  checkedAt: Date;
};

const parsePartialPushReceiptStats = (raw: any): PartialPushReceiptStats => ({
  yesterday: convertUsingKeymap(raw.yesterday, partialPushReceiptStatsItemKeyMap),
  today: convertUsingKeymap(raw.today, partialPushReceiptStatsItemKeyMap),
  checkedAt: new Date(raw.checked_at * 1000),
});

/**
 * The admin notifications dashboard, which is intended to inspecting the
 * current health our push notifications system.
 */
export const AdminNotifsDashboard = (): ReactElement => {
  const loginContext = useContext(LoginContext);

  const activePushTokens = useNetworkResponse<{ num: number }>(
    useCallback(async () => {
      if (loginContext.state !== 'logged-in') {
        return null;
      }

      const response = await apiFetch(
        '/api/1/admin/notifs/total_push_tokens',
        { method: 'GET' },
        loginContext
      );
      if (!response.ok) {
        throw response;
      }
      const json = await response.json();
      return { num: json.total_push_tokens };
    }, [loginContext])
  );

  const pushTokenStatsLoadPrevented = useWritableValueWithCallbacks(() => true);
  const pushTokenStats = useNetworkResponse<AdminDashboardLargeChartProps>(
    useCallback(async () => {
      console.log('loading push token stats');
      if (loginContext.state !== 'logged-in') {
        return null;
      }

      const response = await apiFetch(
        '/api/1/admin/notifs/daily_push_tokens',
        { method: 'GET' },
        loginContext
      );
      if (!response.ok) {
        throw response;
      }

      const data: {
        labels: string[];
        created: number[];
        reassigned: number[];
        refreshed: number[];
        deleted_due_to_user_deletion: number[];
        deleted_due_to_unrecognized_ticket: number[];
        deleted_due_to_unrecognized_receipt: number[];
        deleted_due_to_token_limit: number[];
        total: number[];
      } = await response.json();

      return {
        dailyCharts: [
          {
            identifier: 'created',
            name: 'Created',
            labels: data.labels,
            values: data.created,
          },
          {
            identifier: 'reassigned',
            name: 'Reassigned',
            labels: data.labels,
            values: data.reassigned,
          },
          {
            identifier: 'refreshed',
            name: 'Refreshed',
            labels: data.labels,
            values: data.refreshed,
          },
          {
            identifier: 'deleted_due_to_user_deletion',
            name: 'Deleted due to user deletion',
            labels: data.labels,
            values: data.deleted_due_to_user_deletion,
          },
          {
            identifier: 'deleted_due_to_unrecognized_ticket',
            name: 'Deleted due to unrecognized ticket',
            labels: data.labels,
            values: data.deleted_due_to_unrecognized_ticket,
          },
          {
            identifier: 'deleted_due_to_unrecognized_receipt',
            name: 'Deleted due to unrecognized receipt',
            labels: data.labels,
            values: data.deleted_due_to_unrecognized_receipt,
          },
          {
            identifier: 'deleted_due_to_token_limit',
            name: 'Deleted due to token limit',
            labels: data.labels,
            values: data.deleted_due_to_token_limit,
          },
          {
            identifier: 'deleted',
            name: 'Deleted',
            labels: data.labels,
            values: data.deleted_due_to_user_deletion.map((_, i) => {
              return (
                data.deleted_due_to_user_deletion[i] +
                data.deleted_due_to_unrecognized_ticket[i] +
                data.deleted_due_to_unrecognized_receipt[i] +
                data.deleted_due_to_token_limit[i]
              );
            }),
          },
          {
            identifier: 'total',
            name: 'Total EOD (may be slightly off)',
            labels: data.labels,
            values: data.total,
          },
        ],
        monthlyCharts: [],
      };
    }, [loginContext]),
    {
      loadPrevented: pushTokenStatsLoadPrevented,
    }
  );

  const pushTokenTodaysStats = useNetworkResponse<{
    created: number;
    reassigned: number;
    refreshed: number;
    deleted_due_to_user_deletion: number;
    deleted_due_to_unrecognized_ticket: number;
    deleted_due_to_unrecognized_receipt: number;
    deleted_due_to_token_limit: number;
  }>(
    useCallback(async () => {
      if (loginContext.state !== 'logged-in') {
        return null;
      }

      const response = await apiFetch(
        '/api/1/admin/notifs/todays_push_token_stats',
        { method: 'GET' },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      return await response.json();
    }, [loginContext]),
    {
      loadPrevented: pushTokenStatsLoadPrevented,
    }
  );

  const sendQueueInfo = useNetworkResponse<{
    length: number;
    oldestLastQueuedAt: Date | null;
  }>(
    useCallback(async () => {
      if (loginContext.state !== 'logged-in') {
        return null;
      }

      const response = await apiFetch(
        '/api/1/admin/notifs/send_queue_info',
        { method: 'GET' },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      const data: {
        length: number;
        oldest_last_queued_at: number | null;
      } = await response.json();
      return {
        length: data.length,
        oldestLastQueuedAt:
          data.oldest_last_queued_at !== null ? new Date(data.oldest_last_queued_at * 1000) : null,
      };
    }, [loginContext])
  );

  const lastSendJob = useNetworkResponse<
    | {
        startedAt: Date;
        finishedAt: Date;
        runningTime: number;
        numMessagesAttempted: number;
        numSucceeded: number;
        numFailedPermanently: number;
        numFailedTransiently: number;
        numInPurgatory: number;
      }
    | false
  >(
    useCallback(async () => {
      if (loginContext.state !== 'logged-in') {
        return null;
      }

      const response = await apiFetch(
        '/api/1/admin/notifs/last_send_job',
        { method: 'GET' },
        loginContext
      );

      if (!response.ok) {
        if (response.status === 404) {
          return false;
        }
        throw response;
      }

      const data: {
        started_at: number;
        finished_at: number;
        running_time: number;
        num_messages_attempted: number;
        num_succeeded: number;
        num_failed_permanently: number;
        num_failed_transiently: number;
        num_in_purgatory: number;
      } = await response.json();
      return {
        startedAt: new Date(data.started_at * 1000),
        finishedAt: new Date(data.finished_at * 1000),
        runningTime: data.running_time,
        numMessagesAttempted: data.num_messages_attempted,
        numSucceeded: data.num_succeeded,
        numFailedPermanently: data.num_failed_permanently,
        numFailedTransiently: data.num_failed_transiently,
        numInPurgatory: data.num_in_purgatory,
      };
    }, [loginContext])
  );

  const receiptColdSetInfo = useNetworkResponse<{
    length: number;
    numOverdue: number;
    oldestLastQueuedAt: Date | null;
  }>(
    useCallback(async () => {
      if (loginContext.state !== 'logged-in') {
        return null;
      }

      const response = await apiFetch(
        '/api/1/admin/notifs/receipt_cold_set_info',
        { method: 'GET' },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      const data: {
        length: number;
        num_overdue: number;
        oldest_last_queued_at: number | null;
      } = await response.json();
      return {
        length: data.length,
        numOverdue: data.num_overdue,
        oldestLastQueuedAt:
          data.oldest_last_queued_at !== null ? new Date(data.oldest_last_queued_at * 1000) : null,
      };
    }, [loginContext])
  );

  const pushTicketStatsLoadPrevented = useWritableValueWithCallbacks<boolean>(() => true);
  const pushTicketStats = useNetworkResponse<AdminDashboardLargeChartProps>(
    useCallback(async () => {
      if (loginContext.state !== 'logged-in') {
        return null;
      }

      const response = await apiFetch(
        '/api/1/admin/notifs/daily_push_tickets',
        { method: 'GET' },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      const data: {
        labels: string[];
        queued: number[];
        succeeded: number[];
        abandoned: number[];
        failed_due_to_device_not_registered: number[];
        failed_due_to_client_error_other: number[];
        failed_due_to_internal_error: number[];
        retried: number[];
        failed_due_client_error_429: number[];
        failed_due_to_server_error: number[];
        failed_due_to_network_error: number[];
      } = await response.json();

      return {
        dailyCharts: [
          {
            identifier: 'queued',
            name: 'Queued',
            labels: data.labels,
            values: data.queued,
          },
          {
            identifier: 'succeeded',
            name: 'Succeeded',
            labels: data.labels,
            values: data.succeeded,
          },
          {
            identifier: 'abandoned',
            name: 'Abandoned',
            labels: data.labels,
            values: data.abandoned,
          },
          {
            identifier: 'failed_due_to_device_not_registered',
            name: 'Failed due to device not registered',
            labels: data.labels,
            values: data.failed_due_to_device_not_registered,
          },
          {
            identifier: 'failed_due_to_client_error_other',
            name: 'Failed due to client error (other)',
            labels: data.labels,
            values: data.failed_due_to_client_error_other,
          },
          {
            identifier: 'failed_due_to_internal_error',
            name: 'Failed due to internal error',
            labels: data.labels,
            values: data.failed_due_to_internal_error,
          },
          {
            identifier: 'retried',
            name: 'Retried',
            labels: data.labels,
            values: data.retried,
          },
          {
            identifier: 'failed_due_to_client_error_429',
            name: 'Failed due to client error (429)',
            labels: data.labels,
            values: data.failed_due_client_error_429,
          },
          {
            identifier: 'failed_due_to_server_error',
            name: 'Failed due to server error',
            labels: data.labels,
            values: data.failed_due_to_server_error,
          },
          {
            identifier: 'failed_due_to_network_error',
            name: 'Failed due to network error',
            labels: data.labels,
            values: data.failed_due_to_network_error,
          },
        ],
        monthlyCharts: [],
      };
    }, [loginContext]),
    {
      loadPrevented: pushTicketStatsLoadPrevented,
    }
  );
  const partialPushTicketStats = useNetworkResponse<PartialPushTicketStats>(
    useCallback(async () => {
      if (loginContext.state !== 'logged-in') {
        return null;
      }

      const response = await apiFetch(
        '/api/1/admin/notifs/partial_push_ticket_stats',
        { method: 'GET' },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      return parsePartialPushTicketStats(await response.json());
    }, [loginContext]),
    {
      loadPrevented: pushTicketStatsLoadPrevented,
    }
  );

  const lastColdToHotJobInfo = useNetworkResponse<
    | {
        startedAt: Date;
        finishedAt: Date;
        runningTime: number;
        numMoved: number;
      }
    | false
  >(
    useCallback(async () => {
      if (loginContext.state !== 'logged-in') {
        return null;
      }

      const response = await apiFetch(
        '/api/1/admin/notifs/last_cold_to_hot_job',
        { method: 'GET' },
        loginContext
      );

      if (!response.ok) {
        if (response.status === 404) {
          return false;
        }
        throw response;
      }

      const data: {
        started_at: number;
        finished_at: number;
        running_time: number;
        num_moved: number;
      } = await response.json();

      return {
        startedAt: new Date(data.started_at * 1000),
        finishedAt: new Date(data.finished_at * 1000),
        runningTime: data.running_time,
        numMoved: data.num_moved,
      };
    }, [loginContext])
  );

  const lastCheckJobInfo = useNetworkResponse<
    | {
        startedAt: Date;
        finishedAt: Date;
        runningTime: number;
        numChecked: number;
        numSucceeded: number;
        numFailedPermanently: number;
        numFailedTransiently: number;
        numInPurgatory: number;
      }
    | false
  >(
    useCallback(async () => {
      if (loginContext.state !== 'logged-in') {
        return null;
      }

      const response = await apiFetch(
        '/api/1/admin/notifs/last_check_job',
        { method: 'GET' },
        loginContext
      );
      if (!response.ok) {
        if (response.status === 404) {
          return false;
        }
        throw response;
      }

      const data: {
        started_at: number;
        finished_at: number;
        running_time: number;
        num_checked: number;
        num_succeeded: number;
        num_failed_permanently: number;
        num_failed_transiently: number;
        num_in_purgatory: number;
      } = await response.json();
      return {
        startedAt: new Date(data.started_at * 1000),
        finishedAt: new Date(data.finished_at * 1000),
        runningTime: data.running_time,
        numChecked: data.num_checked,
        numSucceeded: data.num_succeeded,
        numFailedPermanently: data.num_failed_permanently,
        numFailedTransiently: data.num_failed_transiently,
        numInPurgatory: data.num_in_purgatory,
      };
    }, [loginContext])
  );

  const pushReceiptHotSetInfo = useNetworkResponse<{
    length: number;
    oldestLastQueuedAt: Date | null;
  }>(
    useCallback(async () => {
      if (loginContext.state !== 'logged-in') {
        return null;
      }

      const response = await apiFetch(
        '/api/1/admin/notifs/receipt_hot_set_info',
        { method: 'GET' },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      const data: {
        length: number;
        oldest_last_queued_at: number | null;
      } = await response.json();
      return {
        length: data.length,
        oldestLastQueuedAt:
          data.oldest_last_queued_at === null ? null : new Date(data.oldest_last_queued_at * 1000),
      };
    }, [loginContext])
  );

  const pushReceiptStatsLoadPrevented = useWritableValueWithCallbacks(() => true);
  const pushReceiptStats = useNetworkResponse<AdminDashboardLargeChartProps>(
    useCallback(async () => {
      console.log('loading push token stats');
      if (loginContext.state !== 'logged-in') {
        return null;
      }

      const response = await apiFetch(
        '/api/1/admin/notifs/daily_push_receipts',
        { method: 'GET' },
        loginContext
      );
      if (!response.ok) {
        throw response;
      }

      const data: {
        labels: string[];
        succeeded: number[];
        abandoned: number[];
        failed_due_to_device_not_registered: number[];
        failed_due_to_message_too_big: number[];
        failed_due_to_message_rate_exceeded: number[];
        failed_due_to_mismatched_sender_id: number[];
        failed_due_to_invalid_credentials: number[];
        failed_due_to_client_error_other: number[];
        failed_due_to_internal_error: number[];
        retried: number[];
        failed_due_to_not_ready_yet: number[];
        failed_due_to_server_error: number[];
        failed_due_to_client_error_429: number[];
        failed_due_to_network_error: number[];
      } = await response.json();

      return {
        dailyCharts: [
          {
            identifier: 'succeeded',
            name: 'Succeeded',
            labels: data.labels,
            values: data.succeeded,
          },
          {
            identifier: 'abandoned',
            name: 'Abandoned',
            labels: data.labels,
            values: data.abandoned,
          },
          {
            identifier: 'failed_due_to_device_not_registered',
            name: 'Failed due to device not registered',
            labels: data.labels,
            values: data.failed_due_to_device_not_registered,
          },
          {
            identifier: 'failed_due_to_message_too_big',
            name: 'Failed due to message too big',
            labels: data.labels,
            values: data.failed_due_to_message_too_big,
          },
          {
            identifier: 'failed_due_to_message_rate_exceeded',
            name: 'Failed due to message rate exceeded',
            labels: data.labels,
            values: data.failed_due_to_message_rate_exceeded,
          },
          {
            identifier: 'failed_due_to_mismatched_sender_id',
            name: 'Failed due to mismatched sender ID',
            labels: data.labels,
            values: data.failed_due_to_mismatched_sender_id,
          },
          {
            identifier: 'failed_due_to_invalid_credentials',
            name: 'Failed due to invalid credentials',
            labels: data.labels,
            values: data.failed_due_to_invalid_credentials,
          },
          {
            identifier: 'failed_due_to_client_error_other',
            name: 'Failed due to client error (other)',
            labels: data.labels,
            values: data.failed_due_to_client_error_other,
          },
          {
            identifier: 'failed_due_to_internal_error',
            name: 'Failed due to internal error',
            labels: data.labels,
            values: data.failed_due_to_internal_error,
          },
          {
            identifier: 'retried',
            name: 'Retried',
            labels: data.labels,
            values: data.retried,
          },
          {
            identifier: 'failed_due_to_not_ready_yet',
            name: 'Failed due to not ready yet',
            labels: data.labels,
            values: data.failed_due_to_not_ready_yet,
          },
          {
            identifier: 'failed_due_to_server_error',
            name: 'Failed due to server error',
            labels: data.labels,
            values: data.failed_due_to_server_error,
          },
          {
            identifier: 'failed_due_to_client_error_429',
            name: 'Failed due to client error (429)',
            labels: data.labels,
            values: data.failed_due_to_client_error_429,
          },
          {
            identifier: 'failed_due_to_network_error',
            name: 'Failed due to network error',
            labels: data.labels,
            values: data.failed_due_to_network_error,
          },
        ],
        monthlyCharts: [],
      };
    }, [loginContext]),
    {
      loadPrevented: pushReceiptStatsLoadPrevented,
    }
  );
  const partialPushReceiptStats = useNetworkResponse<PartialPushReceiptStats>(
    useCallback(async () => {
      if (loginContext.state !== 'logged-in') {
        return null;
      }

      const response = await apiFetch(
        '/api/1/admin/notifs/partial_push_receipt_stats',
        { method: 'GET' },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      return parsePartialPushReceiptStats(await response.json());
    }, [loginContext]),
    {
      loadPrevented: pushReceiptStatsLoadPrevented,
    }
  );

  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>Oseh Push Notifications Dashboard</div>
      <div className={styles.sections}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Push Tokens</div>
          <SectionDescription>
            In order to send push notifications to a device, the user has to grant permission. When
            they have done so successfully, the client is able to generate an ExponentPushToken. The
            client then sends us that token, and when we want to send a notification to that device,
            we provide that token to the Expo Push API.{' '}
            <a
              href="https://docs.expo.dev/push-notifications/overview/"
              target="_blank"
              rel="noreferrer">
              Learn More
            </a>
          </SectionDescription>
          <div className={styles.sectionContent}>
            <FlowChart {...flowChartSettings}>
              <div className={combineClasses(styles.block, styles.blockClient)}>
                <div className={styles.blockTag}>Client</div>
                <div className={styles.blockTitle}>Initialize</div>
                <div className={styles.blockDescription}>
                  Whenever a user is logged into Oseh on their device and has the app open, and we
                  haven't already, we attempt to initialize native notifications. For iOS, no
                  initailization is required. For Android, we initialize the{' '}
                  <a href="https://developer.android.com/develop/ui/views/notifications/channels">
                    channels
                  </a>{' '}
                  that we will want to use.
                </div>
              </div>
              <div className={combineClasses(styles.block, styles.blockClient)}>
                <div className={styles.blockTag}>Client</div>
                <div className={styles.blockTitle}>Check Permissions</div>
                <div className={styles.blockDescription}>
                  If notification initialization succeeds we check if we are already granted
                  permission to send push notifications. Further, if we don't have permission, we
                  check if we are able to display the native prompt (if we used it before and the
                  user denied it, we can't display it again).
                </div>
              </div>
              <div className={combineClasses(styles.block, styles.blockClient)}>
                <div className={styles.blockTag}>Client</div>
                <div className={styles.blockTitle}>Request Permissions</div>
                <div className={styles.blockDescription}>
                  If we don't have permission, and we can ask again, and we haven't requested it
                  recently on that device via our non-native prompt, then we display the non-native
                  prompt. If the user selects yes we display the native prompt. If the user selects
                  skip to the non-native prompt, we are done for now but will ask again later. If
                  the user says no to the native prompt, we are done forever on that device (unless
                  they go to settings).
                </div>
              </div>
              <div className={combineClasses(styles.block, styles.blockClient)}>
                <div className={styles.blockTag}>Client</div>
                <div className={styles.blockTitle}>Get Expo Token</div>
                <div className={styles.blockDescription}>
                  If we have permission to send push notifications to the device, we use the Expo
                  Push Notification Service to request a unique identifier for the device, known as
                  the Expo Push Token. This token may, very rarely, change for the same device.
                </div>
              </div>
              <div className={combineClasses(styles.block, styles.blockClientServer)}>
                <div className={styles.blockTag}>Client/Server</div>
                <div className={styles.blockTitle}>Send Expo Token</div>
                <div className={styles.blockDescription}>
                  If we successfully created the expo token, and we haven't sent this particular
                  token as this particular user to the Oseh servers recently, we send it an
                  authorized and encrypted request to the Oseh servers.
                </div>
              </div>
              <div className={combineClasses(styles.block, styles.blockServer)}>
                <div className={styles.blockTag}>Server (web)</div>
                <div className={styles.blockTitle}>Attach Expo Token</div>
                <div className={styles.blockDescription}>
                  The server stores the token and attaches it to the users account (removing it from
                  the previous user if necessary). Note that at this point, the server isn&rsquo;t
                  sure if the token is valid or not&mdash;we won&rsquo;t know until we try to send a
                  notification to it.
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># Tokens</>}
                    value={activePushTokens}
                    valueComponent={(t) => formatNetworkNumber(t?.num)}
                  />
                  <div className={styles.blockStatisticInfo}>
                    How many Expo Push Tokens we have stored.
                  </div>
                </div>
              </div>
            </FlowChart>
          </div>
          <div className={styles.sectionGraphsAndTodaysStats}>
            <SectionGraphs>
              <RenderGuardedComponent props={pushTokenStats.error} component={formatNetworkError} />
              <RenderGuardedComponent
                props={pushTokenStats.result}
                component={(v) =>
                  formatNetworkDashboard(v ?? undefined, {
                    onVisible: () => setVWC(pushTokenStatsLoadPrevented, false),
                  })
                }
              />
            </SectionGraphs>
            <SectionStatsToday refresh={pushTokenTodaysStats.refresh}>
              <SectionStatsTodayItem
                title={<>Created</>}
                value={pushTokenTodaysStats}
                valueComponent={(s) => formatNetworkNumber(s?.created)}
              />
              <SectionStatsTodayItem
                title={<>Reassigned</>}
                value={pushTokenTodaysStats}
                valueComponent={(s) => formatNetworkNumber(s?.reassigned)}
              />
              <SectionStatsTodayItem
                title={<>Refreshed</>}
                value={pushTokenTodaysStats}
                valueComponent={(s) => formatNetworkNumber(s?.refreshed)}
              />
              <SectionStatsTodayItem
                title={
                  <>
                    Deleted <small>due to User Deletion</small>
                  </>
                }
                value={pushTokenTodaysStats}
                valueComponent={(s) => formatNetworkNumber(s?.deleted_due_to_user_deletion)}
              />
              <SectionStatsTodayItem
                title={
                  <>
                    Deleted <small>due to Unrecognized Ticket</small>
                  </>
                }
                value={pushTokenTodaysStats}
                valueComponent={(s) => formatNetworkNumber(s?.deleted_due_to_unrecognized_ticket)}
              />
              <SectionStatsTodayItem
                title={
                  <>
                    Deleted <small>due to Unrecognized Receipt</small>
                  </>
                }
                value={pushTokenTodaysStats}
                valueComponent={(s) => formatNetworkNumber(s?.deleted_due_to_unrecognized_receipt)}
              />
              <SectionStatsTodayItem
                title={
                  <>
                    Deleted <small>due to Token Limit</small>
                  </>
                }
                value={pushTokenTodaysStats}
                valueComponent={(s) => formatNetworkNumber(s?.deleted_due_to_token_limit)}
              />
            </SectionStatsToday>
          </div>
        </div>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Push Tickets</div>
          <SectionDescription>
            Sending a push notification to a user is the process of creating a push ticket for that
            user by sending the contents of the notification and the destination expo push token in
            an authorized, encrypted request to the Expo Push API. This describes what happens once
            we've decided to initiate that process within one of the Oseh servers.
          </SectionDescription>
          <div className={styles.sectionContent}>
            <FlowChart {...flowChartSettings}>
              <div className={combineClasses(styles.block, styles.blockServer)}>
                <div className={styles.blockTag}>Server (web, jobs)</div>
                <div className={styles.blockTitle}>Start Send Notification</div>
                <div className={styles.blockDescription}>
                  This flow is triggered when we want to send a push notification to a user. At this
                  point, we have:
                  <ul>
                    <li>The Expo Push Token (potentially unverified)</li>
                    <li>The contents of the notification</li>
                  </ul>
                  We will refer to this as a message attempt before it gets converted to a push
                  ticket.
                </div>
              </div>
              <div className={combineClasses(styles.block, styles.blockServer)}>
                <div className={styles.blockTag}>Server (web, jobs)</div>
                <div className={styles.blockTitle}>Append to the To Send queue</div>
                <div className={styles.blockDescription}>
                  We augment the message attempt with some auxilary data (uid, timestamp, number of
                  retries, information about the source, etc.) and push it to a redis list which
                  we&rsquo;ll refer to as the To Send queue. This list has two purposes:
                  <ul>
                    <li>Distribute the task of sending push notifications</li>
                    <li>Facilitate batching push notifications</li>
                  </ul>
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># In Queue</>}
                    value={sendQueueInfo}
                    valueComponent={(i) => formatNetworkNumber(i?.length)}
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<>Oldest Item</>}
                    value={sendQueueInfo}
                    valueComponent={(i) => formatNetworkDate(i?.oldestLastQueuedAt)}
                  />
                  <div className={styles.blockStatisticInfo}>
                    For the oldest item in the queue (left-most), how long it has been in the queue
                    (last queued at).
                  </div>
                </div>
              </div>
              <div
                className={combineClasses(styles.block, styles.blockServer)}
                style={{ maxWidth: '750px' }}>
                <div className={styles.blockTag}>Server (jobs)</div>
                <div className={styles.blockTitle}>Send Job</div>
                <div className={styles.blockDescription}>
                  About once per minute, a recurring job (Send Job) will pull batches off the To
                  Send queue, move them to a Purgatory set (in case the instance crashes during the
                  job, we can recover the messages using the purgatory set), and sends them via an
                  authorized, encrypted request to the Expo Push API. Transient failures are sent
                  back to the To Send queue, and permanent failures (such as push tokens
                  unrecognized by the Expo Push API, or message attempts which have failed too many
                  times) are cleaned up, then the messages are removed from purgatory. Successes are
                  removed from purgatory and continue along the flow.
                </div>
                <div className={combineClasses(styles.blockNote, styles.blockNoteWarning)}>
                  A successful response from the Expo Push API just means that the Expo Push API
                  received, understood, and accepted the message. It does not mean that the message
                  was delivered to the notification service (FCMs, APNs, etc), nor does it mean that
                  the message was delivered to the device.
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># In Purgatory</>}
                    value={lastSendJob}
                    valueComponent={(j) =>
                      formatNetworkNumber(j === false ? null : j?.numInPurgatory)
                    }
                  />
                  <div className={styles.blockStatisticInfo}>
                    Should be empty while no Send Job is running. If the Send Job crashes, the next
                    run will send these messages.
                  </div>
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<>Started At</>}
                    value={lastSendJob}
                    valueComponent={(j) => formatNetworkDate(j === false ? null : j?.startedAt)}
                  />
                  <div className={styles.blockStatisticInfo}>
                    The last time the Send Job started.
                  </div>
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<>Finished At</>}
                    value={lastSendJob}
                    valueComponent={(j) => formatNetworkDate(j === false ? null : j?.finishedAt)}
                  />
                  <div className={styles.blockStatisticInfo}>
                    The last time the Send Job finished normally.
                  </div>
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<>Running Time</>}
                    value={lastSendJob}
                    valueComponent={(j) =>
                      formatNetworkDuration(j === false ? null : j?.runningTime)
                    }
                  />
                  <div className={styles.blockStatisticInfo}>
                    How long the Send Job took the last time it finished normally.
                  </div>
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># Attempted</>}
                    value={lastSendJob}
                    valueComponent={(j) =>
                      formatNetworkNumber(j === false ? null : j?.numMessagesAttempted)
                    }
                  />
                  <div className={styles.blockStatisticInfo}>
                    How many messages the Send Job tried to send last time it finished normally.
                  </div>
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># Succeeded</>}
                    value={lastSendJob}
                    valueComponent={(j) =>
                      formatNetworkNumber(j === false ? null : j?.numSucceeded)
                    }
                  />
                  <div className={styles.blockStatisticInfo}>
                    How many messages were accepted by the Expo Push API the last time the Send Job
                    finished normally.
                  </div>
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># Failed Permanently</>}
                    value={lastSendJob}
                    valueComponent={(j) =>
                      formatNetworkNumber(j === false ? null : j?.numFailedPermanently)
                    }
                  />
                  <div className={styles.blockStatisticInfo}>
                    How many messages were rejected by the Expo Push API the last time the Send Job
                    finished normally.
                  </div>
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># Failed Transiently</>}
                    value={lastSendJob}
                    valueComponent={(j) =>
                      formatNetworkNumber(j === false ? null : j?.numFailedTransiently)
                    }
                  />
                  <div className={styles.blockStatisticInfo}>
                    How many messages encountered a transient failure (429, network error, server
                    error, etc) when being sent to the Expo Push API the last time the Send Job
                    finished normally. Note that the Send Job can send multiple batches to the Expo
                    Push API each time it is run, and transient failures apply to a full batch at a
                    time, so this number will typically correspond to a multiple of the network
                    batch size (potentially plus the last batch, which may be smaller than the
                    network batch size).
                  </div>
                </div>
              </div>
              <div
                className={combineClasses(styles.block, styles.blockServer)}
                style={{ maxWidth: '475px' }}>
                <div className={styles.blockTag}>Server (jobs)</div>
                <div className={styles.blockTitle}>Add to Push Receipt Cold Set</div>
                <div className={styles.blockDescription}>
                  The Expo push notification service responds with{' '}
                  <a
                    href="https://docs.expo.dev/push-notifications/sending-notifications/#push-tickets"
                    target="_blank"
                    rel="noreferrer">
                    push tickets
                  </a>{' '}
                  upon successfully receiving message attempts. We want to wait about 15 minutes and
                  then query the Expo Push API for the receipt corresponding to the ticket. To
                  facilitate this, after receiving a push ticket, we add it to a redis sorted set we
                  call the Push Receipt Cold Set.
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># In Cold Set</>}
                    value={receiptColdSetInfo}
                    valueComponent={(i) => formatNetworkNumber(i?.length)}
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<>Oldest Queued At</>}
                    value={receiptColdSetInfo}
                    valueComponent={(i) => formatNetworkDate(i?.oldestLastQueuedAt)}
                  />
                  <div className={styles.blockStatisticInfo}>
                    The earliest time at which we want to query the Expo Push API for the receipt
                    for any push ticket in the cold set.
                  </div>
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># Overdue</>}
                    value={receiptColdSetInfo}
                    valueComponent={(i) => formatNetworkNumber(i?.numOverdue)}
                  />
                  <div className={styles.blockStatisticInfo}>
                    How many entries in the cold set are ready to be moved to the hot set; note that
                    it is not unusual to be non-zero as we only occasionally move entries from the
                    cold set to the hot set.
                  </div>
                </div>
              </div>
            </FlowChart>
          </div>
          <div className={styles.sectionGraphsAndTodaysStats}>
            <SectionGraphs>
              <RenderGuardedComponent
                props={pushTicketStats.error}
                component={formatNetworkError}
              />
              <RenderGuardedComponent
                props={pushTicketStats.result}
                component={(v) =>
                  formatNetworkDashboard(v ?? undefined, {
                    onVisible: () => setVWC(pushTicketStatsLoadPrevented, false),
                  })
                }
              />
            </SectionGraphs>
            <SectionStatsMultiday
              refresh={partialPushTicketStats.refresh}
              days={useMemo(
                () => [
                  {
                    name: 'Yesterday',
                    content: (
                      <PartialPushTicketsStatsDisplay
                        value={partialPushTicketStats}
                        keyName="yesterday"
                      />
                    ),
                  },
                  {
                    name: 'Today',
                    content: (
                      <PartialPushTicketsStatsDisplay
                        value={partialPushTicketStats}
                        keyName="today"
                      />
                    ),
                  },
                ],
                [partialPushTicketStats]
              )}
            />
          </div>
        </div>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Push Receipts</div>
          <SectionDescription>
            <p>
              There may be a delay between the Expo push notification service receiving a message
              attempt (and returning a push ticket) and the actual attempt to deliver the
              notification to the notification provider (FCM, APNs, ect). In order to learn of any
              failures when delivering the notification to the notification provider, we must query
              the Expo push notification service for the receipt corresponding to the push ticket.
              The most important error we are looking for is{' '}
              <span className={styles.mono}>DeviceNotRegistered</span>, typically indicating that
              the app was uninstalled from the device, and always indicating we should stop sending
              notifications to that push token until we see it again from the client.
            </p>
            <p>
              A <span className={styles.mono}>DeviceNotRegistered</span> response can also be
              returned when we first send a message attempt to the Expo push notification service.
              This will generally only happen if the client completely fabricated the push token, as
              we cannot verify them without sending them to the Expo push notification service. That
              case is handled in the same way as it is in this section.
            </p>
          </SectionDescription>
          <div className={styles.sectionContent}>
            <FlowChart {...flowChartSettings}>
              <div className={combineClasses(styles.block, styles.blockServer)}>
                <div className={styles.blockTag}>Server (jobs)</div>
                <div className={styles.blockTitle}>Push Receipt Cold to Hot Job</div>
                <div className={styles.blockDescription}>
                  About once every 5 minutes, the Push Receipt Cold to Hot Job will move any overdue
                  push tickets from the Push Receipt Cold Set to the Push Receipt Hot Set. A
                  two-queue system is used to allow for more performant batching, improved
                  transparency into the state of the system, and most importantly to facilitate
                  moving the cold set into a different data store as it may grow fairly large if
                  there are many notifications going out. The hot set can have bounded size by
                  restricting the outflow of the cold set, which will work well if push
                  notifications are bursty (a common case).
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<>Started At</>}
                    value={lastColdToHotJobInfo}
                    valueComponent={(i) => formatNetworkDate(i === false ? null : i?.startedAt)}
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<>Finished At</>}
                    value={lastColdToHotJobInfo}
                    valueComponent={(i) => formatNetworkDate(i === false ? null : i?.finishedAt)}
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<>Running Time</>}
                    value={lastColdToHotJobInfo}
                    valueComponent={(i) =>
                      formatNetworkDuration(i === false ? null : i?.runningTime)
                    }
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># Moved</>}
                    value={lastColdToHotJobInfo}
                    valueComponent={(i) => formatNetworkNumber(i === false ? null : i?.numMoved)}
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># In Hot Set</>}
                    value={pushReceiptHotSetInfo}
                    valueComponent={(i) => formatNetworkNumber(i?.length)}
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<>Oldest in Hot Set</>}
                    value={pushReceiptHotSetInfo}
                    valueComponent={(i) => formatNetworkDate(i?.oldestLastQueuedAt)}
                  />
                </div>
              </div>
              <div
                className={combineClasses(styles.block, styles.blockServer)}
                style={{ maxWidth: '750px' }}>
                <div className={styles.blockTag}>Server (jobs)</div>
                <div className={styles.blockTitle}>Push Receipt Check Job</div>
                <div className={styles.blockDescription}>
                  <p>
                    About once per minute, the Push Receipt Check Job will pull batches from the
                    Push Receipt Hot Set, move them to the Push Receipt Purgatory, and query the
                    Expo Push API for the receipts corresponding to the push tickets. Those in a
                    final state (error, ok, or excessive number of retries) are catalogued and
                    removed. The remaining are sent back to the Push Receipt Cold Set with another
                    15 minute delay. In all cases, once processing finishes the batch is removed
                    from the Push Receipt Purgatory.
                  </p>
                  <p>
                    The most relevant error is{' '}
                    <span className={styles.mono}>DeviceNotRegistered</span>, which indicates that
                    we cannot send any more push notifications to that push token (until
                    re-enabled). This usually means the app was uninstalled, but it could also be
                    that the user revoked notification permissions or their push token changed and
                    we haven't seen the new one yet. In this case, the push token is deleted and
                    detached from its associated user, if any. Note that the history of what
                    notifications we sent to that push token&mdash;and who it used to belong
                    to&mdash;is preserved.
                  </p>
                </div>
                <div className={combineClasses(styles.blockNote, styles.blockNoteWarning)}>
                  A successful receipt just means that the terminal notification service (FCMs,
                  APNs, etc) received, understood, and accepted the notification. It does not mean
                  that the notification was delivered to the device.
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<>Started At</>}
                    value={lastCheckJobInfo}
                    valueComponent={(i) => formatNetworkDate(i === false ? null : i?.startedAt)}
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<>Finished At</>}
                    value={lastCheckJobInfo}
                    valueComponent={(i) => formatNetworkDate(i === false ? null : i?.finishedAt)}
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<>Running Time</>}
                    value={lastCheckJobInfo}
                    valueComponent={(i) =>
                      formatNetworkDuration(i === false ? null : i?.runningTime)
                    }
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># Checked</>}
                    value={lastCheckJobInfo}
                    valueComponent={(i) => formatNetworkNumber(i === false ? null : i?.numChecked)}
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># Succeeded</>}
                    value={lastCheckJobInfo}
                    valueComponent={(i) =>
                      formatNetworkNumber(i === false ? null : i?.numSucceeded)
                    }
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># Failed Permanently</>}
                    value={lastCheckJobInfo}
                    valueComponent={(i) =>
                      formatNetworkNumber(i === false ? null : i?.numFailedPermanently)
                    }
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># Failed Transiently</>}
                    value={lastCheckJobInfo}
                    valueComponent={(i) =>
                      formatNetworkNumber(i === false ? null : i?.numFailedTransiently)
                    }
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># In Purgatory</>}
                    value={lastCheckJobInfo}
                    valueComponent={(i) =>
                      formatNetworkNumber(i === false ? null : i?.numInPurgatory)
                    }
                  />
                </div>
              </div>
            </FlowChart>
          </div>
          <div className={styles.sectionGraphsAndTodaysStats}>
            <SectionGraphs>
              <RenderGuardedComponent
                props={pushReceiptStats.error}
                component={formatNetworkError}
              />
              <RenderGuardedComponent
                props={pushReceiptStats.result}
                component={(v) =>
                  formatNetworkDashboard(v ?? undefined, {
                    onVisible: () => setVWC(pushReceiptStatsLoadPrevented, false),
                  })
                }
              />
            </SectionGraphs>
            <SectionStatsMultiday
              refresh={partialPushReceiptStats.refresh}
              days={useMemo(
                () => [
                  {
                    name: 'Yesterday',
                    content: (
                      <PartialPushReceiptsStatsDisplay
                        value={partialPushReceiptStats}
                        keyName="yesterday"
                      />
                    ),
                  },
                  {
                    name: 'Today',
                    content: (
                      <PartialPushReceiptsStatsDisplay
                        value={partialPushReceiptStats}
                        keyName="today"
                      />
                    ),
                  },
                ],
                [partialPushReceiptStats]
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * The description for a section, in a collapsable component.
 */
export const SectionDescription = ({ children }: PropsWithChildren<object>): ReactElement => {
  const expanded = useWritableValueWithCallbacks(() => false);
  return (
    <div className={styles.sectionDescription}>
      <SmoothExpandable expanded={adaptValueWithCallbacksAsVariableStrategyProps(expanded)}>
        <div className={styles.sectionDescriptionText}>{children}</div>
      </SmoothExpandable>
      <Button
        type="button"
        variant="link-small"
        onClick={(e) => {
          e.preventDefault();
          setVWC(expanded, !expanded.get());
        }}>
        <RenderGuardedComponent
          props={expanded}
          component={(expanded) => {
            if (expanded) {
              return <>Hide Summary</>;
            } else {
              return <>Show Summary</>;
            }
          }}
        />
      </Button>
    </div>
  );
};

/**
 * Used within a block statistic to display a title and value, with a refresh button.
 */
export function BlockStatisticTitleRow<T>({
  title,
  value,
  valueComponent,
}: {
  title: ReactElement;
  value: NetworkResponse<T>;
  valueComponent: (value: T | null) => ReactElement;
}): ReactElement {
  return (
    <>
      <div className={styles.blockStatisticTitleRow}>
        <div className={styles.blockStatisticTitleAndValue}>
          <div className={styles.blockStatisticTitle}>{title}</div>
          <div className={styles.blockStatisticValue}>
            <RenderGuardedComponent props={value.result} component={valueComponent} />
          </div>
        </div>
        <div className={styles.blockStatisticControls}>
          <IconButtonWithAutoDisable
            icon={styles.iconRefresh}
            srOnlyName="refresh"
            onClick={value.refresh}
            spinWhileDisabled
          />
        </div>
      </div>
      <RenderGuardedComponent props={value.error} component={formatNetworkError} />
    </>
  );
}

/**
 * Same as BlockStatisticTitleRow visually, but always shows "N/I" for the value.
 */
export function NotImplementedBlockStatisticTitleRow({ title }: { title: ReactElement }) {
  return (
    <BlockStatisticTitleRow
      title={title}
      value={useNetworkResponse<boolean>(async () => true)}
      valueComponent={(v) => (v === null ? <>?</> : <>N/I</>)}
    />
  );
}

/**
 * Container for section graphs in case we want to make them collapsible later
 */
export const SectionGraphs = ({ children }: PropsWithChildren<object>): ReactElement => {
  return <div className={styles.sectionGraphs}>{children}</div>;
};

/**
 * A section next to the section graphs for displaying partial stats
 */
export const SectionStatsToday = ({
  refresh,
  children,
}: PropsWithChildren<{ refresh: () => Promise<void> }>): ReactElement => {
  return (
    <div className={styles.sectionStatsToday}>
      <div className={styles.sectionStatsTodayTitleAndControls}>
        <div className={styles.sectionStatsTodayTitle}>Today So Far</div>
        <div className={styles.sectionStatsTodayRefresh}>
          <IconButtonWithAutoDisable
            icon={styles.iconRefresh}
            srOnlyName="Refresh"
            onClick={refresh}
            spinWhileDisabled
          />
        </div>
      </div>
      {children}
    </div>
  );
};

/**
 * A section next to the section graphs for displaying a tabbed partial stats
 * pane, for data that takes multiple days to accumulate.
 */
export const SectionStatsMultiday = ({
  refresh,
  days,
}: {
  refresh: () => Promise<void>;
  days: {
    name: string;
    content: ReactElement;
  }[];
}) => {
  const activeDay = useWritableValueWithCallbacks<string>(() => days[days.length - 1].name);
  const onClickDay = useCallback(
    (day: string, e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setVWC(activeDay, day);
    },
    [activeDay]
  );
  return (
    <div className={styles.sectionStatsMultiday}>
      <div className={styles.sectionStatsMultidayTabsAndControls}>
        <div className={styles.sectionStatsMultidayTabs}>
          <RenderGuardedComponent
            props={activeDay}
            component={(activeDay) => (
              <>
                {days.map((day) => (
                  <div
                    className={combineClasses(
                      styles.sectionStatsMultidayTab,
                      activeDay === day.name ? styles.sectionStatsMultidayTabActive : undefined
                    )}
                    key={day.name}>
                    <Button
                      type="button"
                      variant="link-small"
                      onClick={onClickDay.bind(undefined, day.name)}>
                      {day.name}
                    </Button>
                  </div>
                ))}
              </>
            )}
          />
        </div>
        <div className={styles.sectionStatsMultidayRefresh}>
          <IconButtonWithAutoDisable
            icon={styles.iconRefresh}
            srOnlyName="Refresh"
            onClick={refresh}
            spinWhileDisabled
          />
        </div>
      </div>
      <div className={styles.sectionStatsMultidayContent}>
        <RenderGuardedComponent
          props={activeDay}
          component={(dayName) => {
            const day = days.find((day) => day.name === dayName);
            if (day === undefined) {
              if (days.length > 0) {
                setVWC(activeDay, days[days.length - 1].name);
              }
              return <></>;
            }
            return day.content;
          }}
        />
      </div>
    </div>
  );
};

/**
 * An item within the SectionStatsToday section
 */
export function SectionStatsTodayItem<T>({
  title,
  value,
  valueComponent,
}: {
  title: ReactElement;
  value: NetworkResponse<T>;
  valueComponent: (value: T | null) => ReactElement;
}): ReactElement {
  return (
    <div className={styles.sectionStatsTodayItem}>
      <div className={styles.sectionStatsTodayItemTitle}>{title}</div>
      <div className={styles.sectionStatsTodayItemValue}>
        <RenderGuardedComponent props={value.result} component={valueComponent} />
      </div>
      <RenderGuardedComponent props={value.error} component={formatNetworkError} />
    </div>
  );
}

const PartialPushTicketsStatsDisplay = ({
  value,
  keyName,
}: {
  value: NetworkResponse<PartialPushTicketStats>;
  keyName: 'yesterday' | 'today';
}): ReactElement => {
  return (
    <>
      <SectionStatsTodayItem
        title={<>Queued</>}
        value={value}
        valueComponent={(s) => formatNetworkNumber(s === null ? undefined : s[keyName].queued)}
      />
      <SectionStatsTodayItem
        title={<>Succeeded</>}
        value={value}
        valueComponent={(s) => formatNetworkNumber(s === null ? undefined : s[keyName].succeeded)}
      />
      <SectionStatsTodayItem
        title={<>Abandoned</>}
        value={value}
        valueComponent={(s) => formatNetworkNumber(s === null ? undefined : s[keyName].abandoned)}
      />
      <SectionStatsTodayItem
        title={
          <>
            Failed <small>due to DeviceNotRegistered</small>
          </>
        }
        value={value}
        valueComponent={(s) =>
          formatNetworkNumber(s === null ? undefined : s[keyName].failedDueToDeviceNotRegistered)
        }
      />
      <SectionStatsTodayItem
        title={
          <>
            Failed <small>due to ClientErrorOther</small>
          </>
        }
        value={value}
        valueComponent={(s) =>
          formatNetworkNumber(s === null ? undefined : s[keyName].failedDueToClientErrorOther)
        }
      />
      <SectionStatsTodayItem
        title={
          <>
            Failed <small>due to InternalError</small>
          </>
        }
        value={value}
        valueComponent={(s) =>
          formatNetworkNumber(s === null ? undefined : s[keyName].failedDueToInternalError)
        }
      />
      <SectionStatsTodayItem
        title={<>Retried</>}
        value={value}
        valueComponent={(s) => formatNetworkNumber(s === null ? undefined : s[keyName].retried)}
      />
      <SectionStatsTodayItem
        title={
          <>
            Failed* <small>due to ClientError429</small>
          </>
        }
        value={value}
        valueComponent={(s) =>
          formatNetworkNumber(s === null ? undefined : s[keyName].failedDueToClientError429)
        }
      />
      <SectionStatsTodayItem
        title={
          <>
            Failed* <small>due to ServerError</small>
          </>
        }
        value={value}
        valueComponent={(s) =>
          formatNetworkNumber(s === null ? undefined : s[keyName].failedDueToServerError)
        }
      />
      <SectionStatsTodayItem
        title={
          <>
            Failed* <small>due to NetworkError</small>
          </>
        }
        value={value}
        valueComponent={(s) =>
          formatNetworkNumber(s === null ? undefined : s[keyName].failedDueToNetworkError)
        }
      />
      <div className={styles.sectionStatsTodayNote}>
        These failures are automatically retried a few times, and are typically resolved that way.
        If too many retries fail, the ticket is abandoned.
      </div>
    </>
  );
};

const PartialPushReceiptsStatsDisplay = ({
  value,
  keyName,
}: {
  value: NetworkResponse<PartialPushReceiptStats>;
  keyName: 'yesterday' | 'today';
}): ReactElement => {
  return (
    <>
      <SectionStatsTodayItem
        title={<>Succeeded</>}
        value={value}
        valueComponent={(s) => formatNetworkNumber(s === null ? undefined : s[keyName].succeeded)}
      />
      <SectionStatsTodayItem
        title={<>Abandoned</>}
        value={value}
        valueComponent={(s) => formatNetworkNumber(s === null ? undefined : s[keyName].abandoned)}
      />
      <SectionStatsTodayItem
        title={
          <>
            Failed <small>due to DeviceNotRegistered</small>
          </>
        }
        value={value}
        valueComponent={(s) =>
          formatNetworkNumber(s === null ? undefined : s[keyName].failedDueToDeviceNotRegistered)
        }
      />
      <SectionStatsTodayItem
        title={
          <>
            Failed <small>due to MessageTooBig</small>
          </>
        }
        value={value}
        valueComponent={(s) =>
          formatNetworkNumber(s === null ? undefined : s[keyName].failedDueToMessageTooBig)
        }
      />
      <SectionStatsTodayItem
        title={
          <>
            Failed <small>due to MessageRateExceeded</small>
          </>
        }
        value={value}
        valueComponent={(s) =>
          formatNetworkNumber(s === null ? undefined : s[keyName].failedDueToMessageRateExceeded)
        }
      />
      <SectionStatsTodayItem
        title={
          <>
            Failed <small>due to MismatchSenderId</small>
          </>
        }
        value={value}
        valueComponent={(s) =>
          formatNetworkNumber(s === null ? undefined : s[keyName].failedDueToMismatchedSenderId)
        }
      />
      <SectionStatsTodayItem
        title={
          <>
            Failed <small>due to InvalidCredentials</small>
          </>
        }
        value={value}
        valueComponent={(s) =>
          formatNetworkNumber(s === null ? undefined : s[keyName].failedDueToInvalidCredentials)
        }
      />
      <SectionStatsTodayItem
        title={
          <>
            Failed <small>due to ClientErrorOther</small>
          </>
        }
        value={value}
        valueComponent={(s) =>
          formatNetworkNumber(s === null ? undefined : s[keyName].failedDueToClientErrorOther)
        }
      />
      <SectionStatsTodayItem
        title={
          <>
            Failed <small>due to InternalError</small>
          </>
        }
        value={value}
        valueComponent={(s) =>
          formatNetworkNumber(s === null ? undefined : s[keyName].failedDueToInternalError)
        }
      />
      <SectionStatsTodayItem
        title={<>Retried</>}
        value={value}
        valueComponent={(s) => formatNetworkNumber(s === null ? undefined : s[keyName].retried)}
      />
      <SectionStatsTodayItem
        title={
          <>
            Failed* <small>due to NotReadyYet</small>
          </>
        }
        value={value}
        valueComponent={(s) =>
          formatNetworkNumber(s === null ? undefined : s[keyName].failedDueToNotReadyYet)
        }
      />
      <SectionStatsTodayItem
        title={
          <>
            Failed* <small>due to ServerError</small>
          </>
        }
        value={value}
        valueComponent={(s) =>
          formatNetworkNumber(s === null ? undefined : s[keyName].failedDueToServerError)
        }
      />
      <SectionStatsTodayItem
        title={
          <>
            Failed* <small>due to ClientError429</small>
          </>
        }
        value={value}
        valueComponent={(s) =>
          formatNetworkNumber(s === null ? undefined : s[keyName].failedDueToClientError429)
        }
      />
      <SectionStatsTodayItem
        title={
          <>
            Failed* <small>due to NetworkError</small>
          </>
        }
        value={value}
        valueComponent={(s) =>
          formatNetworkNumber(s === null ? undefined : s[keyName].failedDueToNetworkError)
        }
      />
      <div className={styles.sectionStatsTodayNote}>
        These failures are automatically retried a few times, and are typically resolved that way.
        If too many retries fail, the ticket is abandoned.
      </div>
    </>
  );
};
