import { PropsWithChildren, ReactElement } from 'react';
import styles from './AdminNotifsDashboard.module.css';
import { useWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { setVWC } from '../../shared/lib/setVWC';
import { SmoothExpandable } from '../../shared/components/SmoothExpandable';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';
import { Button } from '../../shared/forms/Button';
import { FlowChart, FlowChartProps } from '../../shared/components/FlowChart';
import { combineClasses } from '../../shared/lib/combineClasses';
import { AdminDashboardLargeChartPlaceholder } from '../dashboard/AdminDashboardLargeChartPlaceholder';

const flowChartSettings: FlowChartProps = {
  columnGap: { type: 'react-rerender', props: 24 },
  rowGap: { type: 'react-rerender', props: 48 },
  color: { type: 'react-rerender', props: [0, 0, 0, 0.5] },
  lineThickness: { type: 'react-rerender', props: 2 },
  arrowBlockGapPx: { type: 'react-rerender', props: { head: 4, tail: 4 } },
  arrowHeadLengthPx: { type: 'react-rerender', props: 8 },
  arrowHeadAngleDeg: { type: 'react-rerender', props: 30 },
};

const formatNumber = (num: number): ReactElement => <>{num.toLocaleString()}</>;
const formatDateOrNull = (date: Date | null, placeholder?: ReactElement): ReactElement => (
  <>{date ? date.toLocaleString() : placeholder ?? 'Loading...'}</>
);
const formatDuration = (seconds: number, placeholder?: ReactElement): ReactElement => {
  if (seconds < 2) {
    const ms = Math.round(seconds * 1000);
    return <>{ms}ms</>;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 2) {
    return <>{Math.round(seconds)}s</>;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 2) {
    const extraSeconds = Math.round(seconds - minutes * 60);
    return (
      <>
        {minutes}m {extraSeconds}s
      </>
    );
  }
  return (
    <>
      {hours}h {Math.round(minutes - hours * 60)}m
    </>
  );
};

/**
 * The admin notifications dashboard, which is intended to inspecting the
 * current health our push notifications system.
 */
export const AdminNotifsDashboard = (): ReactElement => {
  const activePushTokensVWC = useWritableValueWithCallbacks<number>(() => 0);
  const toSendQueueSizeVWC = useWritableValueWithCallbacks<number>(() => 0);
  const toSendOldestItemVWC = useWritableValueWithCallbacks<Date | null>(() => null);
  const purgatorySetSizeVWC = useWritableValueWithCallbacks<number>(() => 0);
  const sendJobLastRanAtVWC = useWritableValueWithCallbacks<Date | null>(() => null);
  const runningTimeLastSendJobSecondsVWC = useWritableValueWithCallbacks<number>(() => 0);
  const pushReceiptColdSetSizeVWC = useWritableValueWithCallbacks<number>(() => 0);
  const pushReceiptColdSetOldestDueAtVWC = useWritableValueWithCallbacks<Date | null>(() => null);
  const pushReceiptColdToHotLastRanAtVWC = useWritableValueWithCallbacks<Date | null>(() => null);
  const pushReceiptColdToHotLastRuntimeVWC = useWritableValueWithCallbacks<number>(() => 0);
  const pushReceiptColdToHotLastNumMovedVWC = useWritableValueWithCallbacks<number>(() => 0);
  const pushReceiptHotSetSizeVWC = useWritableValueWithCallbacks<number>(() => 0);
  const pushReceiptHotSetOldestDueAtVWC = useWritableValueWithCallbacks<Date | null>(() => null);
  const pushReceiptPurgatorySizeVWC = useWritableValueWithCallbacks<number>(() => 0);
  const pushReceiptCheckJobLastRanAtVWC = useWritableValueWithCallbacks<Date | null>(() => null);
  const pushReceiptCheckJobLastRuntimeVWC = useWritableValueWithCallbacks<number>(() => 0);
  const pushReceiptCheckJobLastNumCheckedVWC = useWritableValueWithCallbacks<number>(() => 0);

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
                  <div className={styles.blockStatisticTitle}># Tokens</div>
                  <div className={styles.blockStatisticValue}>
                    <RenderGuardedComponent props={activePushTokensVWC} component={formatNumber} />
                  </div>
                  <div className={styles.blockStatisticInfo}>
                    How many Expo Push Tokens we have stored.
                  </div>
                </div>
              </div>
            </FlowChart>
          </div>
          <SectionGraphs>
            <AdminDashboardLargeChartPlaceholder placeholderText="New, reassigned, refreshed, deleted, and total push tokens by day" />
          </SectionGraphs>
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
                  <div className={styles.blockStatisticTitle}># In Queue</div>
                  <div className={styles.blockStatisticValue}>
                    <RenderGuardedComponent props={toSendQueueSizeVWC} component={formatNumber} />
                  </div>
                </div>
                <div className={styles.blockStatistic}>
                  <div className={styles.blockStatisticTitle}>Oldest Item</div>
                  <div className={styles.blockStatisticValue}>
                    <RenderGuardedComponent
                      props={toSendOldestItemVWC}
                      component={(item) => formatDateOrNull(item, <>N/A</>)}
                    />
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
                  <div className={styles.blockStatisticTitle}># In Purgatory</div>
                  <div className={styles.blockStatisticValue}>
                    <RenderGuardedComponent props={purgatorySetSizeVWC} component={formatNumber} />
                  </div>
                  <div className={styles.blockStatisticInfo}>
                    Should be empty while no Send Job is running. Requires manual intervention to
                    recover from.
                  </div>
                </div>
                <div className={styles.blockStatistic}>
                  <div className={styles.blockStatisticTitle}>Send Job Last Ran At</div>
                  <div className={styles.blockStatisticValue}>
                    <RenderGuardedComponent
                      props={sendJobLastRanAtVWC}
                      component={(date) => formatDateOrNull(date, <>Never</>)}
                    />
                  </div>
                  <div className={styles.blockStatisticInfo}>
                    The last time the Send Job started.
                  </div>
                </div>
                <div className={styles.blockStatistic}>
                  <div className={styles.blockStatisticTitle}>Send Job last running time</div>
                  <div className={styles.blockStatisticValue}>
                    <RenderGuardedComponent
                      props={runningTimeLastSendJobSecondsVWC}
                      component={(time) => formatDuration(time, <>N/A</>)}
                    />
                  </div>
                  <div className={styles.blockStatisticInfo}>
                    How long the Send Job took the last time it finished normally.
                  </div>
                </div>
              </div>
              <div className={combineClasses(styles.block, styles.blockServer)}>
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
                  facilitate this, after receiving a push ticket, we add it to a redis list we call
                  the Push Receipt Cold Set.
                </div>
                <div className={styles.blockStatistic}>
                  <div className={styles.blockStatisticTitle}># In Cold Set</div>
                  <div className={styles.blockStatisticValue}>
                    <RenderGuardedComponent
                      props={pushReceiptColdSetSizeVWC}
                      component={formatNumber}
                    />
                  </div>
                </div>
                <div className={styles.blockStatistic}>
                  <div className={styles.blockStatisticTitle}>Oldest Due At</div>
                  <div className={styles.blockStatisticValue}>
                    <RenderGuardedComponent
                      props={pushReceiptColdSetOldestDueAtVWC}
                      component={(date) => formatDateOrNull(date, <>N/A</>)}
                    />
                  </div>
                  <div className={styles.blockStatisticInfo}>
                    The earliest time at which we want to query the Expo Push API for the receipt
                    for any push ticket in the cold set.
                  </div>
                </div>
              </div>
            </FlowChart>
          </div>
          <SectionGraphs>
            <AdminDashboardLargeChartPlaceholder placeholderText="Message attempts (initial, retries, successes, failures, abandoned) by day" />
          </SectionGraphs>
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
                  <div className={styles.blockStatisticTitle}>Last Run At</div>
                  <div className={styles.blockStatisticValue}>
                    <RenderGuardedComponent
                      props={pushReceiptColdToHotLastRanAtVWC}
                      component={(date) => formatDateOrNull(date, <>Never</>)}
                    />
                  </div>
                </div>
                <div className={styles.blockStatistic}>
                  <div className={styles.blockStatisticTitle}>Last Runtime</div>
                  <div className={styles.blockStatisticValue}>
                    <RenderGuardedComponent
                      props={pushReceiptColdToHotLastRuntimeVWC}
                      component={formatDuration}
                    />
                  </div>
                </div>
                <div className={styles.blockStatistic}>
                  <div className={styles.blockStatisticTitle}>Last # Moved</div>
                  <div className={styles.blockStatisticValue}>
                    <RenderGuardedComponent
                      props={pushReceiptColdToHotLastNumMovedVWC}
                      component={formatNumber}
                    />
                  </div>
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
                  <div className={styles.blockStatisticTitle}>Last Run At</div>
                  <div className={styles.blockStatisticValue}>
                    <RenderGuardedComponent
                      props={pushReceiptCheckJobLastRanAtVWC}
                      component={(date) => formatDateOrNull(date, <>Never</>)}
                    />
                  </div>
                </div>
                <div className={styles.blockStatistic}>
                  <div className={styles.blockStatisticTitle}>Last Runtime</div>
                  <div className={styles.blockStatisticValue}>
                    <RenderGuardedComponent
                      props={pushReceiptCheckJobLastRuntimeVWC}
                      component={formatDuration}
                    />
                  </div>
                </div>
                <div className={styles.blockStatistic}>
                  <div className={styles.blockStatisticTitle}>Last # Checked</div>
                  <div className={styles.blockStatisticValue}>
                    <RenderGuardedComponent
                      props={pushReceiptCheckJobLastNumCheckedVWC}
                      component={formatNumber}
                    />
                  </div>
                </div>
                <div className={styles.blockStatistic}>
                  <div className={styles.blockStatisticTitle}># in Hot Set</div>
                  <div className={styles.blockStatisticValue}>
                    <RenderGuardedComponent
                      props={pushReceiptHotSetSizeVWC}
                      component={formatNumber}
                    />
                  </div>
                </div>
                <div className={styles.blockStatistic}>
                  <div className={styles.blockStatisticTitle}>Oldest Due In Hot Set</div>
                  <div className={styles.blockStatisticValue}>
                    <RenderGuardedComponent
                      props={pushReceiptHotSetOldestDueAtVWC}
                      component={(date) => formatDateOrNull(date, <>Never</>)}
                    />
                  </div>
                </div>
                <div className={styles.blockStatistic}>
                  <div className={styles.blockStatisticTitle}># in Push Receipt Purgatory</div>
                  <div className={styles.blockStatisticValue}>
                    <RenderGuardedComponent
                      props={pushReceiptPurgatorySizeVWC}
                      component={formatNumber}
                    />
                  </div>
                </div>
              </div>
            </FlowChart>
          </div>
          <SectionGraphs>
            <AdminDashboardLargeChartPlaceholder placeholderText="Push receipts (requested, by result type, requeued, abandoned) by day" />
          </SectionGraphs>
        </div>
      </div>
    </div>
  );
};

const SectionDescription = ({ children }: PropsWithChildren<object>): ReactElement => {
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

const SectionGraphs = ({ children }: PropsWithChildren<object>): ReactElement => {
  return <div className={styles.sectionGraphs}>{children}</div>;
};
