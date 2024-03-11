import { ReactElement, useCallback } from 'react';
import styles from '../notifs_dashboard/AdminNotifsDashboard.module.css';
import customStyles from './AdminSMSDashboard.module.css';
import {
  BlockStatisticTitleRow,
  SectionDescription,
} from '../notifs_dashboard/AdminNotifsDashboard';
import { FlowChart, FlowChartProps } from '../../shared/components/FlowChart';
import { TogglableSmoothExpandable } from '../../shared/components/TogglableSmoothExpandable';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { combineClasses } from '../../shared/lib/combineClasses';
import { Button } from '../../shared/forms/Button';
import { setVWC } from '../../shared/lib/setVWC';
import { NetworkResponse, useNetworkResponse } from '../../shared/hooks/useNetworkResponse';
import { apiFetch } from '../../shared/ApiConstants';
import {
  formatNetworkDate,
  formatNetworkDuration,
  formatNetworkNumber,
  formatNetworkValue,
} from '../../shared/lib/networkResponseUtils';
import { PartialStats, parsePartialStats } from '../lib/PartialStats';
import { NetworkChart, PartialStatsDisplay } from '../lib/NetworkChart';
import { IconButton } from '../../shared/forms/IconButton';
import { useMappedValuesWithCallbacks } from '../../shared/hooks/useMappedValuesWithCallbacks';

const flowChartSettings: FlowChartProps = {
  columnGap: { type: 'react-rerender', props: 24 },
  rowGap: { type: 'react-rerender', props: 48 },
  color: { type: 'react-rerender', props: [0, 0, 0, 0.5] },
  lineThickness: { type: 'react-rerender', props: 2 },
  arrowBlockGapPx: { type: 'react-rerender', props: { head: 4, tail: 4 } },
  arrowHeadLengthPx: { type: 'react-rerender', props: 8 },
  arrowHeadAngleDeg: { type: 'react-rerender', props: 30 },
};

/**
 * The admin sms dashboard, which is intended to inspecting the current health
 * our sms system.
 */
export const AdminSMSDashboard = (): ReactElement => {
  const sendQueueInfo = useNetworkResponse<{
    length: number;
    oldestLastQueuedAt: Date | null;
  }>(
    useCallback(async (active, loginContext) => {
      const response = await apiFetch(
        '/api/1/admin/sms/send_queue_info',
        { method: 'GET' },
        loginContext
      );
      if (!response.ok) {
        throw response;
      }
      const data = await response.json();
      return {
        length: data.length,
        oldestLastQueuedAt:
          data.oldest_last_queued_at === null ? null : new Date(data.oldest_last_queued_at * 1000),
      };
    }, [])
  );

  const sendJobInfo = useNetworkResponse<{
    startedAt: Date;
    finishedAt: Date;
    runningTime: number;
    numAttempted: number;
    numSucceeded: number;
    numPending: number;
    numFailedPermanently: number;
    numFailedTransiently: number;
    stopReason: 'list_exhausted' | 'time_exhausted' | 'signal';
    numInPurgatory: number;
  }>(
    useCallback(async (active, loginContext) => {
      const response = await apiFetch(
        '/api/1/admin/sms/last_send_job',
        { method: 'GET' },
        loginContext
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw response;
      }

      const data = await response.json();
      return {
        startedAt: new Date(data.started_at * 1000),
        finishedAt: new Date(data.finished_at * 1000),
        runningTime: data.running_time,
        numAttempted: data.num_attempted,
        numSucceeded: data.num_succeeded,
        numPending: data.num_pending,
        numFailedPermanently: data.num_failed_permanently,
        numFailedTransiently: data.num_failed_transiently,
        stopReason: data.stop_reason,
        numInPurgatory: data.num_in_purgatory,
      };
    }, [])
  );

  const pendingSetInfo = useNetworkResponse<{
    length: number;
    oldestDueAt: Date | null;
    numOverdue: number;
  }>(
    useCallback(async (active, loginContext) => {
      const response = await apiFetch(
        '/api/1/admin/sms/pending_set_info',
        { method: 'GET' },
        loginContext
      );
      if (!response.ok) {
        throw response;
      }
      const data = await response.json();
      return {
        length: data.length,
        oldestDueAt: data.oldest_due_at === null ? null : new Date(data.oldest_due_at * 1000),
        numOverdue: data.num_overdue,
      };
    }, [])
  );

  const webhookStats = useNetworkResponse<PartialStats>(
    useCallback(async (active, loginContext) => {
      const response = await apiFetch(
        '/api/1/admin/sms/partial_sms_webhook_stats',
        { method: 'GET' },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      const data = await response.json();
      return parsePartialStats(data);
    }, [])
  );

  const eventQueueInfo = useNetworkResponse<{
    length: number;
    oldestInformationReceivedAt: Date | null;
    oldestItemDelay: number | null;
    newestInformationReceivedAt: Date | null;
    newestItemDelay: number | null;
  }>(
    useCallback(async (active, loginContext) => {
      const response = await apiFetch(
        '/api/1/admin/sms/event_queue_info',
        { method: 'GET' },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      const data = await response.json();

      return {
        length: data.length,
        oldestInformationReceivedAt:
          data.oldest_information_received_at === null
            ? null
            : new Date(data.oldest_information_received_at * 1000),
        oldestItemDelay: data.oldest_item_delay,
        newestInformationReceivedAt:
          data.newest_information_received_at === null
            ? null
            : new Date(data.newest_information_received_at * 1000),
        newestItemDelay: data.newest_item_delay,
      };
    }, [])
  );

  const receiptReconciliationJobInfo = useNetworkResponse<{
    startedAt: Date;
    finishedAt: Date;
    runningTime: number;
    stopReason: 'list_exhausted' | 'time_exhausted' | 'signal';
    attempted: number;
    pending: number;
    succeeded: number;
    failed: number;
    found: number;
    updated: number;
    duplicate: number;
    outOfOrder: number;
    removed: number;
    purgatorySize: number;
  }>(
    useCallback(async (active, loginContext) => {
      const response = await apiFetch(
        '/api/1/admin/sms/last_receipt_reconciliation_job',
        { method: 'GET' },
        loginContext
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw response;
      }

      const data = await response.json();
      return {
        startedAt: new Date(data.started_at * 1000),
        finishedAt: new Date(data.finished_at * 1000),
        runningTime: data.running_time,
        stopReason: data.stop_reason,
        attempted: data.attempted,
        pending: data.pending,
        succeeded: data.succeeded,
        failed: data.failed,
        found: data.found,
        updated: data.updated,
        duplicate: data.duplicate,
        outOfOrder: data.out_of_order,
        removed: data.removed,
        purgatorySize: data.purgatory_size,
      };
    }, [])
  );

  const receiptStaleDetectionJobInfo = useNetworkResponse<{
    startedAt: Date;
    finishedAt: Date;
    runningTime: number;
    callbacksQueued: number;
    stopReason: 'list_exhausted' | 'time_exhausted' | 'signal';
    recoveryQueueSize: number;
  }>(
    useCallback(async (active, loginContext) => {
      const response = await apiFetch(
        '/api/1/admin/sms/last_receipt_stale_job',
        { method: 'GET' },
        loginContext
      );
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw response;
      }
      const data = await response.json();
      return {
        startedAt: new Date(data.started_at * 1000),
        finishedAt: new Date(data.finished_at * 1000),
        runningTime: data.running_time,
        callbacksQueued: data.callbacks_queued,
        stopReason: data.stop_reason,
        recoveryQueueSize: data.recovery_queue_size,
      };
    }, [])
  );

  const receiptRecoveryJobInfo = useNetworkResponse<{
    startedAt: Date;
    finishedAt: Date;
    runningTime: number;
    attempted: number;
    pending: number;
    succeeded: number;
    failed: number;
    lost: number;
    permanentError: number;
    transientError: number;
    stopReason: 'list_exhausted' | 'time_exhausted' | 'signal';
    purgatorySize: number;
  }>(
    useCallback(async (active, loginContext) => {
      const response = await apiFetch(
        '/api/1/admin/sms/last_receipt_recovery_job',
        { method: 'GET' },
        loginContext
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw response;
      }

      const data = await response.json();
      return {
        startedAt: new Date(data.started_at * 1000),
        finishedAt: new Date(data.finished_at * 1000),
        runningTime: data.running_time,
        attempted: data.attempted,
        pending: data.pending,
        succeeded: data.succeeded,
        failed: data.failed,
        lost: data.lost,
        permanentError: data.permanent_error,
        transientError: data.transient_error,
        stopReason: data.stop_reason,
        purgatorySize: data.purgatory_size,
      };
    }, [])
  );

  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>Oseh SMS Dashboard</div>

      <div className={styles.sections}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Messages</div>
          <SectionDescription>
            <p>
              We use Twilio as our SMS provider. The Twilio API does not support batching; instead,
              we are to make individual requests for each message. Twilio will queue the requests on
              its end&mdash;up to 4 hours of messages. That means the number of messages that can be
              queued on Twilio depends on the sending rate allocated, which can be assumed to be at
              least 1 message/second. This means at least 14,400 can be queued at once.
            </p>
            <p>
              Beyond not exceeding the queue size, we are restricted by Twilio's Rest API
              concurrency limit, which is very small (often 1). This means we essentially send a
              stream of messages over a single connection, each wrapped in its own request. This is
              very inefficient: this means our ideal SMS queue speed is 700x slower than our push
              queue.
            </p>
          </SectionDescription>

          <div className={styles.sectionContent}>
            <FlowChart {...flowChartSettings}>
              <div className={styles.block}>
                <div className={styles.blockTitle}>Start Send SMS</div>
                <div className={styles.blockDescription}>
                  This flow is triggered when we want to send an SMS message to a user. At this
                  point, we have:
                  <ul>
                    <li>The recipient's phone number in E.164 format</li>
                    <li>The message body: up to 160 GSM-7 characters (or 70 UCS-2 characters)</li>
                  </ul>
                  We will refer to this as the message attempt, not to be confused with the message
                  resource (the resource created on Twilio).
                </div>
              </div>
              <div className={styles.block}>
                <div className={styles.blockTitle}>Append to Send Queue</div>
                <div className={styles.blockDescription}>
                  <p>
                    We augment the message attempt with some basic metadata (uid, timestamp,
                    retries, success job, failure job, etc) and push it to the right of the redis
                    list we refer to as the "To Send" queue as a json, utf-8 encoded string.
                  </p>
                  <p>
                    This list may get very large as it&rsquo;s relatively slow to transfer messages
                    to Twilio.
                  </p>
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># In To Send</>}
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
                </div>
              </div>
              <div className={styles.block} style={{ maxWidth: '600px' }}>
                <div className={styles.blockTitle}>Send Job</div>
                <div className={styles.blockDescription}>
                  <p>
                    About four times per minute we pull messages one at a time off the To Send
                    queue, moving them to the Send Purgatory, then to Twilio in an encrypted and
                    authorized request, then (if successful) to the receipt pending set (see next
                    block), then removing them from Send Purgatory until we've either exhausted the
                    To Send queue or 50s have passed. The Twilio lock is held only while each
                    message is sent to allow weaving other requests (such as the receipt recovery
                    job) while this job is run.
                  </p>
                  <p>
                    This will try to reuse the same connection to avoid excessive TLS handshakes,
                    though it may not be possible when weaving requests.
                  </p>
                  <div className={combineClasses(styles.blockNote, styles.blockNoteInfo)}>
                    If the send job is due while a previous run is still in progress, it will be
                    skipped.
                  </div>
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># In Purgatory</>}
                    value={sendJobInfo}
                    valueComponent={(i) =>
                      formatNetworkNumber(i === null ? null : i?.numInPurgatory)
                    }
                  />
                  <TogglableSmoothExpandable>
                    <div className={styles.blockStatisticInfo}>
                      Should be 0 or 1, depending on if we're currently trying to send a message
                      (which includes waiting for the Twilio lock)
                    </div>
                  </TogglableSmoothExpandable>
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<>Started At</>}
                    value={sendJobInfo}
                    valueComponent={(i) => formatNetworkDate(i === null ? null : i?.startedAt)}
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<>Finished At</>}
                    value={sendJobInfo}
                    valueComponent={(i) => formatNetworkDate(i === null ? null : i?.finishedAt)}
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<>Running Time</>}
                    value={sendJobInfo}
                    valueComponent={(i) =>
                      formatNetworkDuration(i === null ? null : i?.runningTime)
                    }
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># Attempted</>}
                    value={sendJobInfo}
                    valueComponent={(i) => formatNetworkNumber(i === null ? null : i?.numAttempted)}
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># Pending</>}
                    value={sendJobInfo}
                    valueComponent={(i) => formatNetworkNumber(i === null ? null : i?.numPending)}
                  />
                  <TogglableSmoothExpandable>
                    <div className={styles.blockStatisticInfo}>
                      How many message attempts turned into message resources on Twilio's end the
                      last time the job completed normally, and had a non-terminal state - this does
                      not mean that Twilio has sent it to the carrier nor does it mean the recipient
                      has received it.
                    </div>
                  </TogglableSmoothExpandable>
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># Immediate Success</>}
                    value={sendJobInfo}
                    valueComponent={(i) => formatNetworkNumber(i === null ? null : i?.numSucceeded)}
                  />
                  <TogglableSmoothExpandable>
                    <div className={styles.blockStatisticInfo}>
                      How many message attempts turned into message resources on Twilio's end the
                      last time the job completed normally, and for which twilio has already
                      verified that the message was sent to the carrier. This shouldn&rsquo;t happen
                      often, but the API does not disallow it.
                    </div>
                  </TogglableSmoothExpandable>
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># Failed Permanently</>}
                    value={sendJobInfo}
                    valueComponent={(i) =>
                      formatNetworkNumber(i === null ? null : i?.numFailedPermanently)
                    }
                  />
                  <TogglableSmoothExpandable>
                    <div className={styles.blockStatisticInfo}>
                      How many message attempts were rejected by Twilio's API the last time the job
                      completed normally - this either means we got a 4XX response besides 429, the
                      error code or the error message was not null, we encountered an error forming
                      the request or processing the response, or the status was `canceled`,
                      `failed`, or `undelivered` immediately. Twilio has an obnoxiously long list of
                      error codes which could be emitted by any endpoint, and do not indicate the
                      subset which could apply to a particular endpoint. We consider the following
                      error codes as transient and the rest as permanent:
                      <ul>
                        <li>14107 (send rate limit exceeded)</li>
                        <li>30022 (us a2p 10dlc - rate limits exceeded)</li>
                        <li>31206 (rate exceeded authorized limit)</li>
                        <li>45010 (rate limit exceeded)</li>
                        <li>51002 (request rate limit exceeded)</li>
                        <li>54009 (rate limit exceeded)</li>
                        <li>63017 (programmable sms rate limit exceeded)</li>
                      </ul>
                      Further note that we only treat these as transient if Twilio returns them in
                      the initial request, and they will be treated as permanent later.
                    </div>
                  </TogglableSmoothExpandable>
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># Failed Transiently</>}
                    value={sendJobInfo}
                    valueComponent={(i) =>
                      formatNetworkNumber(i === null ? null : i?.numFailedTransiently)
                    }
                  />
                  <TogglableSmoothExpandable>
                    <div className={styles.blockStatisticInfo}>
                      How many message attempts could not be turned into message resources on
                      Twilio, but for which the error is likely to resolve itself if we try again.
                      For example, 5XX responses, 429 responses, and network errors.
                    </div>
                  </TogglableSmoothExpandable>
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<>Stop Reason</>}
                    value={sendJobInfo}
                    valueComponent={(i) =>
                      formatNetworkValue(i === null ? null : i?.stopReason, (v) => <>{v}</>)
                    }
                  />
                  <div className={styles.blockStatisticInfo}>
                    <span className={styles.mono}>list_exhausted</span>,{' '}
                    <span className={styles.mono}>time_exhausted</span>, or{' '}
                    <span className={styles.mono}>signal</span>
                  </div>
                </div>
              </div>
              <div className={styles.block} style={{ maxWidth: '600px' }}>
                <div className={styles.blockTitle}>Add to Receipt Pending Set</div>
                <div className={styles.blockDescription}>
                  <p>
                    Assuming that we were able to create the message resource for a particular
                    message attempt, it&rsquo;s very likely not in a terminal state. Twilio should
                    send us a webhook as its status changes, but if the webhook is not received in a
                    timely manner, or we&rsquo;re in a development environment where webhooks are
                    disabled, we will need to eventually poll for the status of the message.
                  </p>
                  <p>
                    To accomplish this the message is appended to the redis sorted set we call the
                    Receipt Pending Set. The value is the <span className={styles.mono}>sid</span>{' '}
                    that Twilio assigned to the message resource we created for the message attempt.
                    The data on that message attempt is stored atomically in a separate redis hash
                    key. The score is the next time we should either poll for the status of the
                    message or abandon the message.
                  </p>
                  <p>
                    This set can get somewhat large since Twilio is limited on how fast it can send
                    SMS messages to carriers.
                  </p>
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># In Receipt Pending Set</>}
                    value={pendingSetInfo}
                    valueComponent={(i) => formatNetworkNumber(i?.length)}
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<>Oldest Due At</>}
                    value={pendingSetInfo}
                    valueComponent={(i) => formatNetworkDate(i?.oldestDueAt)}
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># Overdue</>}
                    value={pendingSetInfo}
                    valueComponent={(i) => formatNetworkNumber(i?.numOverdue)}
                  />
                </div>
              </div>
            </FlowChart>
          </div>
          <NetworkChart
            partialDataPath="/api/1/admin/sms/partial_sms_send_stats"
            historicalDataPath="/api/1/admin/sms/daily_sms_sends"
          />
        </div>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Receipts (Webhook Flow)</div>
          <SectionDescription>
            <p>
              In order to determine if Twilio was able to deliver the message to the final carrier,
              we need to listen for delivery receipts, which are sent to us via
              webhooks&mdash;specifically, the StatusCallback we indicate when{' '}
              <a href="https://www.twilio.com/docs/sms/api/message-resource#create-a-message-resource">
                creating the message
              </a>
              .
            </p>
            <p>
              The outbound message status properties are described{' '}
              <a href="https://www.twilio.com/docs/sms/api/message-resource#message-status-values">
                here
              </a>
              . We do use messaging services, so all of these statuses are possible. The most
              important ones are the terminal states: delivered, undelivered, and failed.
            </p>
            <p>
              This is the preferred way to receive updates about messages, since there is no
              completely wasted bandwidth. However, it is not reliable, since webhooks rely on there
              being minimal connectivity or processing issues.
            </p>
          </SectionDescription>

          <div className={styles.sectionContent}>
            <FlowChart {...flowChartSettings}>
              <div className={styles.block} style={{ maxWidth: '600px' }}>
                <div className={styles.blockTitle}>Receive Webhook</div>
                <div className={styles.blockDescription}>
                  <p>
                    When the status on a message resource changes, Twilio sends us an encrypted and
                    signed http request containing the new status. We decrypt the message, verify
                    the signature, then forward a simplified version of the event to the redis list
                    we call the Event Queue.
                  </p>
                  <p>
                    We track how many webhook requests we received today and yesterday to help
                    identify if someone is sending us a lot of fake webhooks, but then the data is
                    discarded as the successes will map to the event queue{' '}
                    <span className={styles.mono}>received_via_webhook</span> event, which has its
                    full history.
                  </p>
                </div>
                <ReceiveWebhookBlockStatistics webhookStats={webhookStats} />
              </div>
              <div className={styles.block} style={{ maxWidth: '600px' }}>
                <div className={styles.blockTitle}>Append to Event Queue</div>
                <div className={styles.blockDescription}>
                  <p>
                    When we receive verifiable information about a message resource from Twilio,
                    it&rsquo;s appended to the redis list we call the event queue prior to any
                    further processing (such as checking if that resource is in the receipt pending
                    set). This reduces time spent processing on the web workers and allows us to
                    spread the load out in the event many receipts are received at once.
                  </p>
                  <p>The main information in each event is:</p>
                  <ul>
                    <li>
                      The <span className={styles.mono}>sid</span>: a unique, Twilio-provided string
                      that identifies the message resource
                    </li>
                    <li>
                      The <span className={styles.mono}>status</span>: the (possibly changed) status
                      for the message
                    </li>
                    <li>
                      The <span className={styles.mono}>error_code</span> and{' '}
                      <span className={styles.mono}>error_message</span>, if any
                    </li>
                    <li>
                      The <span className={styles.mono}>date_updated</span> which is important for
                      handling events received out of order
                    </li>
                    <li>
                      The <span className={styles.mono}>information_received_at</span> which is
                      added by us for debugging purposes, which is when we got the information from
                      Twilio, and is what the event queue is sorted by (though it is not guarranteed
                      to be perfectly in order as instances can disagree on the time)
                    </li>
                  </ul>

                  <div className={combineClasses(styles.blockNote, styles.blockNoteWarning)}>
                    An additional status code is possible in the event queue compared to the
                    available status codes on twilio:{' '}
                    <span className={styles.mono}>
                      <strong>lost</strong>
                    </span>
                    . This refers to a message resource which no longer exists on Twilio, as
                    evidenced by a 404 response.
                  </div>
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># In Event Queue</>}
                    value={eventQueueInfo}
                    valueComponent={(i) => formatNetworkNumber(i === null ? null : i?.length)}
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<>Oldest Item</>}
                    value={eventQueueInfo}
                    valueComponent={(i) =>
                      formatNetworkDate(i === null ? null : i?.oldestInformationReceivedAt)
                    }
                  />
                  <div className={styles.blockStatisticInfo}>
                    The <span className={styles.mono}>information_received_at</span> value of the
                    left-most item
                  </div>
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<>Oldest Item Delay</>}
                    value={eventQueueInfo}
                    valueComponent={(i) =>
                      formatNetworkDuration(i === null ? null : i?.oldestItemDelay)
                    }
                  />
                  <TogglableSmoothExpandable>
                    <div className={styles.blockStatisticInfo}>
                      The difference between the{' '}
                      <span className={styles.mono}>information_received_at</span> and{' '}
                      <span className={styles.mono}>date_updated</span> values of the left-most
                      item. This is useful for identifying if Twilio's webhooks are delayed: a high
                      value either means Twilio was forced to retry requests because we were down,
                      or Twilio is experiencing a service degradation.
                    </div>
                  </TogglableSmoothExpandable>
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<>Newest Item</>}
                    value={eventQueueInfo}
                    valueComponent={(i) =>
                      formatNetworkDate(i === null ? null : i?.newestInformationReceivedAt)
                    }
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<>Newest Item Delay</>}
                    value={eventQueueInfo}
                    valueComponent={(i) =>
                      formatNetworkDuration(i === null ? null : i?.newestItemDelay)
                    }
                  />
                </div>
              </div>
              <div className={styles.block} style={{ maxWidth: '700px' }}>
                <div className={styles.blockTitle}>Receipt Reconciliation Job</div>
                <div className={styles.blockDescription}>
                  <p>
                    About once per minute, a recurring job (the Receipt Reconciliation Job) pulls
                    items one at a time from the event queue until the event queue is empty or 50s
                    has passed. It checks if the message resource is in the receipt pending set, and
                    if so, checks if this corresponds to a real status update (i.e., the{' '}
                    <span className={styles.mono}>date_updated</span> value of the event is at least
                    the existing value). If so, go to the next step. If not, discard the event.
                  </p>
                  <p>
                    This uses a purgatory list for the currently processing event, though it should
                    only have 0 or 1 items in it at a time as we do not currently parallelize this
                    job.
                  </p>
                </div>
                <div className={styles.twoColumnBlockStatistics}>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<># In Purgatory</>}
                      value={receiptReconciliationJobInfo}
                      valueComponent={(i) =>
                        formatNetworkNumber(i === null ? null : i?.purgatorySize)
                      }
                    />
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<>Started At</>}
                      value={receiptReconciliationJobInfo}
                      valueComponent={(i) => formatNetworkDate(i === null ? null : i?.startedAt)}
                    />
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<>Finished At</>}
                      value={receiptReconciliationJobInfo}
                      valueComponent={(i) => formatNetworkDate(i === null ? null : i?.finishedAt)}
                    />
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<># Running Time</>}
                      value={receiptReconciliationJobInfo}
                      valueComponent={(i) =>
                        formatNetworkDuration(i === null ? null : i?.runningTime)
                      }
                    />
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<># Attempted</>}
                      value={receiptReconciliationJobInfo}
                      valueComponent={(i) => formatNetworkNumber(i === null ? null : i?.attempted)}
                    />
                    <TogglableSmoothExpandable>
                      <div className={styles.blockStatisticInfo}>
                        How many message resource updates we tried to reconcile
                      </div>
                    </TogglableSmoothExpandable>
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<># Still Pending</>}
                      value={receiptReconciliationJobInfo}
                      valueComponent={(i) => formatNetworkNumber(i === null ? null : i?.pending)}
                    />
                    <TogglableSmoothExpandable>
                      <div className={styles.blockStatisticInfo}>
                        How many message resources were still in a pending state. This is of all
                        those attempted, and thus does not necessarily mean the message resource was
                        still in the pending set, nor does it mean there was necessarily an update
                        to it.
                      </div>
                    </TogglableSmoothExpandable>
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<># Succeeded</>}
                      value={receiptReconciliationJobInfo}
                      valueComponent={(i) => formatNetworkNumber(i === null ? null : i?.succeeded)}
                    />
                    <TogglableSmoothExpandable>
                      <div className={styles.blockStatisticInfo}>
                        How many message resources were now in a successful state (
                        <span className={styles.mono}>sent</span> or{' '}
                        <span className={styles.mono}>delivered</span>
                        ). This is of those attempted, and thus does not necessarily mean the
                        message resource was still in the pending set.
                      </div>
                    </TogglableSmoothExpandable>
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<># Failed</>}
                      value={receiptReconciliationJobInfo}
                      valueComponent={(i) => formatNetworkNumber(i === null ? null : i?.failed)}
                    />
                    <TogglableSmoothExpandable>
                      <div className={styles.blockStatisticInfo}>
                        How many message resources were now in a failure state (
                        <span className={styles.mono}>canceled</span>,{' '}
                        <span className={styles.mono}>undelivered</span>, or{' '}
                        <span className={styles.mono}>failed</span>
                        ). This is of those attempted, and thus does not necessarily mean the
                        message resource was still in the pending set.
                      </div>
                    </TogglableSmoothExpandable>
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<># Found</>}
                      value={receiptReconciliationJobInfo}
                      valueComponent={(i) => formatNetworkNumber(i === null ? null : i?.found)}
                    />
                    <TogglableSmoothExpandable>
                      <div className={styles.blockStatisticInfo}>
                        How many message resources were found in the receipt pending set, though not
                        necessarily with a different state than what we just got.
                      </div>
                    </TogglableSmoothExpandable>
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<># Updated</>}
                      value={receiptReconciliationJobInfo}
                      valueComponent={(i) => formatNetworkNumber(i === null ? null : i?.updated)}
                    />
                    <TogglableSmoothExpandable>
                      <div className={styles.blockStatisticInfo}>
                        How many message resources were found in the receipt pending set, and had a
                        different status, and we chose to update (meaning the new state was also
                        non-terminal, e.g., <span className={styles.mono}>sending</span>).
                      </div>
                    </TogglableSmoothExpandable>
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<># Duplicate</>}
                      value={receiptReconciliationJobInfo}
                      valueComponent={(i) => formatNetworkNumber(i === null ? null : i?.duplicate)}
                    />
                    <TogglableSmoothExpandable>
                      <div className={styles.blockStatisticInfo}>
                        How many message resources were found in the receipt pending set with the
                        same status as the event we just received, meaning we did not update it.
                      </div>
                    </TogglableSmoothExpandable>
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<># Out Of Order</>}
                      value={receiptReconciliationJobInfo}
                      valueComponent={(i) => formatNetworkNumber(i === null ? null : i?.outOfOrder)}
                    />
                    <TogglableSmoothExpandable>
                      <div className={styles.blockStatisticInfo}>
                        How many message resources were found in the receipt pending set with newer
                        information than the event, meaning we did not update it.
                      </div>
                    </TogglableSmoothExpandable>
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<># Removed</>}
                      value={receiptReconciliationJobInfo}
                      valueComponent={(i) => formatNetworkNumber(i === null ? null : i?.removed)}
                    />
                    <TogglableSmoothExpandable>
                      <div className={styles.blockStatisticInfo}>
                        How many message resources were found in the receipt pending set and removed
                        because they now had a terminal state. Whenever we remove from the pending
                        set we either invoke the success callback or the failure callback as
                        appropriate. The failure callback cannot retry at this point.
                      </div>
                    </TogglableSmoothExpandable>
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<>Stop Reason</>}
                      value={receiptReconciliationJobInfo}
                      valueComponent={(i) =>
                        formatNetworkValue(i === null ? null : i?.stopReason, (v) => <>{v}</>)
                      }
                    />
                    <div className={styles.blockStatisticInfo}>
                      <span className={styles.mono}>list_exhausted</span>,{' '}
                      <span className={styles.mono}>time_exhausted</span>, or{' '}
                      <span className={styles.mono}>signal</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.block} style={{ maxWidth: '475px' }}>
                <div className={styles.blockTitle}>Remove from Receipt Pending Set</div>
                <div className={styles.blockDescription}>
                  If the message resource is still in a non-terminal state, it&rsquo;s updated and
                  has its score updated in the Receipt Pending Set, but no further action is taken
                  as we are still waiting for a new status update. On the other hand, if it has
                  reached a terminal state, it is removed from the pending set (and its associated
                  data is removed) and the success or failure callback is queued as appropriate.
                </div>
              </div>
            </FlowChart>
          </div>
          <NetworkChart
            partialDataPath="/api/1/admin/sms/partial_sms_event_stats"
            historicalDataPath="/api/1/admin/sms/daily_sms_events"
          />
        </div>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Receipts (Poll Flow)</div>
          <SectionDescription>
            <p>
              If Twilio cannot reach our webhook endpoint for any reason, such as our service being
              down, our network being unreachable (such as when running in development), or an issue
              with Twilio's outbound network, Twilio will retry the webhook at least once. If we
              encounter an error while processing the webhook, Twilio will not retry it (since it
              will often require manual intervention).
            </p>
            <p>
              Thus, if a message is in a non-terminal state for a long time, we need to reach out to
              Twilio to check if its status has changed without us receiving/successfully processing
              the webhook.
            </p>
            <p>
              One challenge with handling this is our polling will count towards the concurrency
              limit on Twilio, so have to trade off our one connection with the send queue. In other
              words, whenever we fall back to polling, our ability to send messages to Twilio is
              also reduced.
            </p>
          </SectionDescription>

          <div className={styles.sectionContent}>
            <FlowChart {...flowChartSettings}>
              <div className={styles.block}>
                <div className={styles.blockTitle}>Receipt Stale Detection Job</div>
                <div className={styles.blockDescription}>
                  <p>
                    About once per minute, a recurring job (the Receipt Stale Detection Job) checks
                    for items whose score in the Receipt Pending Set, interpreted as seconds since
                    the unix epoch, is before now. For each such item, its score is increased and
                    the failure callback is queued, which is responsible for either abandoning the
                    message (if it does not want to poll any longer, such as because the result no
                    longer matters or because polling has failed too many times already), or pushing
                    the sid to the Recovery Queue.
                  </p>
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<>Started At</>}
                    value={receiptStaleDetectionJobInfo}
                    valueComponent={(i) => formatNetworkDate(i === null ? null : i?.startedAt)}
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<>Finished At</>}
                    value={receiptStaleDetectionJobInfo}
                    valueComponent={(i) => formatNetworkDate(i === null ? null : i?.finishedAt)}
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<>Running Time</>}
                    value={receiptStaleDetectionJobInfo}
                    valueComponent={(i) =>
                      formatNetworkDuration(i === null ? null : i?.runningTime)
                    }
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># Callbacks Queued</>}
                    value={receiptStaleDetectionJobInfo}
                    valueComponent={(i) =>
                      formatNetworkNumber(i === null ? null : i?.callbacksQueued)
                    }
                  />
                </div>
                <div className={styles.blockStatistic}>
                  <BlockStatisticTitleRow
                    title={<># In Recovery Queue</>}
                    value={receiptStaleDetectionJobInfo}
                    valueComponent={(i) =>
                      formatNetworkNumber(i === null ? null : i?.recoveryQueueSize)
                    }
                  />
                </div>
              </div>
              <div className={styles.block} style={{ maxWidth: '700px' }}>
                <div className={styles.blockTitle}>Receipt Recovery Job</div>
                <div className={styles.blockDescription}>
                  <p>
                    About once every minute, a recurring job (the Receipt Recovery Job) pulls items
                    from the Recovery Queue one at a time and fetches the current status of the
                    message from Twilio. For all statuses returned they are sent to the right side
                    of the Event Queue, including <span className={styles.mono}>lost</span>, if
                    Twilio indicated the message resource no longer exists.
                  </p>
                  <p>
                    This has to weave requests with the Send Job via the Twilio Lock due to the low
                    concurrency limits on Twilio.
                  </p>
                  <p>
                    This uses a standard purgatory list which should have 0 or 1 items in it at any
                    given time.
                  </p>
                </div>
                <div className={styles.twoColumnBlockStatistics}>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<># In Purgatory</>}
                      value={receiptRecoveryJobInfo}
                      valueComponent={(i) =>
                        formatNetworkNumber(i === null ? null : i?.purgatorySize)
                      }
                    />
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<>Started At</>}
                      value={receiptRecoveryJobInfo}
                      valueComponent={(i) => formatNetworkDate(i === null ? null : i?.startedAt)}
                    />
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<>Finished At</>}
                      value={receiptRecoveryJobInfo}
                      valueComponent={(i) => formatNetworkDate(i === null ? null : i?.finishedAt)}
                    />
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<>Running Time</>}
                      value={receiptRecoveryJobInfo}
                      valueComponent={(i) =>
                        formatNetworkDuration(i === null ? null : i?.runningTime)
                      }
                    />
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<># Attempted</>}
                      value={receiptRecoveryJobInfo}
                      valueComponent={(i) => formatNetworkNumber(i === null ? null : i?.attempted)}
                    />
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<># Still Pending</>}
                      value={receiptRecoveryJobInfo}
                      valueComponent={(i) => formatNetworkNumber(i === null ? null : i?.pending)}
                    />
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<># Succeeded</>}
                      value={receiptRecoveryJobInfo}
                      valueComponent={(i) => formatNetworkNumber(i === null ? null : i?.succeeded)}
                    />
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<># Failed</>}
                      value={receiptRecoveryJobInfo}
                      valueComponent={(i) => formatNetworkNumber(i === null ? null : i?.failed)}
                    />
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<># Lost</>}
                      value={receiptRecoveryJobInfo}
                      valueComponent={(i) => formatNetworkNumber(i === null ? null : i?.lost)}
                    />
                    <div className={styles.blockStatisticInfo}>
                      Message resources that don't exist on Twilio anymore
                    </div>
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<># Permanent Error</>}
                      value={receiptRecoveryJobInfo}
                      valueComponent={(i) =>
                        formatNetworkNumber(i === null ? null : i?.permanentError)
                      }
                    />
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<># Transient Error</>}
                      value={receiptRecoveryJobInfo}
                      valueComponent={(i) =>
                        formatNetworkNumber(i === null ? null : i?.transientError)
                      }
                    />
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<># Transient Error</>}
                      value={receiptRecoveryJobInfo}
                      valueComponent={(i) =>
                        formatNetworkNumber(i === null ? null : i?.transientError)
                      }
                    />
                  </div>
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<>Stop Reason</>}
                      value={receiptRecoveryJobInfo}
                      valueComponent={(i) =>
                        formatNetworkValue(i === null ? null : i?.stopReason, (v) => <>{v}</>)
                      }
                    />
                    <div className={styles.blockStatisticInfo}>
                      <span className={styles.mono}>list_exhausted</span>,{' '}
                      <span className={styles.mono}>time_exhausted</span>, or{' '}
                      <span className={styles.mono}>signal</span>
                    </div>
                  </div>
                </div>
              </div>
            </FlowChart>
          </div>
          <NetworkChart
            partialDataPath="/api/1/admin/sms/partial_sms_polling_stats"
            historicalDataPath="/api/1/admin/sms/daily_sms_polling"
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Displays block statistics for a webhook endpoint, for which the backend
 * stores statistics for today and yesterday. The exact keys stored are not
 * important for this component as they are pulled dynamically.
 */
export const ReceiveWebhookBlockStatistics = ({
  webhookStats,
}: {
  webhookStats: ValueWithCallbacks<NetworkResponse<PartialStats>>;
}): ReactElement => {
  const day = useWritableValueWithCallbacks<'today' | 'yesterday'>(() => 'today');

  return (
    <div className={customStyles.tabbedBlockStatistics}>
      <div className={customStyles.tabbedBlockStatisticsTabsAndControls}>
        <div className={customStyles.tabbedBlockStatisticsTabs}>
          <RenderGuardedComponent
            props={day}
            component={(activeDay) => (
              <>
                <div
                  className={combineClasses(
                    customStyles.tabbedBlockStatisticsTab,
                    activeDay === 'yesterday'
                      ? customStyles.tabbedBlockStatisticsTabActive
                      : undefined
                  )}>
                  <Button
                    type="button"
                    variant="link-small"
                    onClick={(e) => {
                      e.preventDefault();
                      setVWC(day, 'yesterday');
                    }}>
                    Yesterday
                  </Button>
                </div>
                <div
                  className={combineClasses(
                    customStyles.tabbedBlockStatisticsTab,
                    activeDay === 'today' ? customStyles.tabbedBlockStatisticsTabActive : undefined
                  )}>
                  <Button
                    type="button"
                    variant="link-small"
                    onClick={(e) => {
                      e.preventDefault();
                      setVWC(day, 'today');
                    }}>
                    Today
                  </Button>
                </div>
              </>
            )}
          />
        </div>
        <div className={styles.tabbedBlockStatisticsRefresh}>
          <IconButton
            icon={styles.iconRefresh}
            srOnlyName="Refresh"
            onClick={(e) => {
              e.preventDefault();
              webhookStats.get().refresh?.();
            }}
          />
        </div>
      </div>
      <div className={customStyles.tabbedBlockStatisticsContent}>
        <RenderGuardedComponent
          props={useMappedValuesWithCallbacks([day, webhookStats], () => ({
            day: day.get(),
            stats: webhookStats.get(),
          }))}
          component={({ day, stats }) => <PartialStatsDisplay value={stats} keyName={day} />}
        />
      </div>
    </div>
  );
};
