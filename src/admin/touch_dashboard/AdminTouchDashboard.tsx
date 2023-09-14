import { ReactElement, useMemo } from 'react';
import styles from '../notifs_dashboard/AdminNotifsDashboard.module.css';
import { SectionDescription } from '../notifs_dashboard/AdminNotifsDashboard';
import { FlowChart, FlowChartProps } from '../../shared/components/FlowChart';
import { NetworkBlockStats } from '../lib/NetworkBlockStats';
import {
  formatNetworkDate,
  formatNetworkDuration,
  formatNetworkNumber,
  formatNetworkString,
} from '../../shared/lib/networkResponseUtils';
import { combineClasses } from '../../shared/lib/combineClasses';
import { TogglableSmoothExpandable } from '../../shared/components/TogglableSmoothExpandable';
import { NetworkChart } from '../lib/NetworkChart';

const flowChartSettings: FlowChartProps = {
  columnGap: { type: 'react-rerender', props: 48 },
  rowGap: { type: 'react-rerender', props: 48 },
  color: { type: 'react-rerender', props: [0, 0, 0, 0.5] },
  lineThickness: { type: 'react-rerender', props: 2 },
  arrowBlockGapPx: { type: 'react-rerender', props: { head: 4, tail: 4 } },
  arrowHeadLengthPx: { type: 'react-rerender', props: 8 },
  arrowHeadAngleDeg: { type: 'react-rerender', props: 30 },
};

/**
 * The admin touch dashboard, which is intended to help inspecting the current
 * health our touch point system (an abstraction layer above email/sms/push).
 *
 * This layer primarily handles selecting the appropriate contact address(es)
 * for a particular user and channel, then dispatching the message to the
 * appropriate subqueue, where the message is identified in a consistent way
 * across all the channels (rather than dealing with e.g., subject/message for
 * push vs just message for sms vs a subject and email template for email).
 */
export const AdminTouchDashboard = (): ReactElement => {
  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>Oseh Touch Dashboard</div>
      <div className={styles.sections}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Messages</div>
          <SectionDescription>
            <p>
              Touch points and the corresponding touches are an abstraction layer over the
              underlying channels (email, sms, and push). A touch point describes the messages that
              should be sent in response to an event, and sending a touch is another way of saying
              emitting a touch point event. Touch points may require different event information, so
              there is still some customization based on the type of event that is emitted.
            </p>
            <p>
              Our touch system accepts user identifiers rather than contact information like phone
              numbers, and thus is responsible for converting from a user identifier to the
              appropriate contact address(es). A touch which is emitted but for which there is no
              corresponding contact address is called <em>unreachable</em>. On the other hand, if at
              least one could be found, the touch is <em>reachable</em>.
            </p>
            <p>
              Our touch system also uses a consistent retry strategy across all specific touch
              points, and sufficiently handles logging, such that callers can treat it as
              fire-and-forget (i.e., no need for custom success/failure callbacks for each touch
              point). The retry logic is handled by underlying subqueues, hence there is no need to
              support retrying back to the touch to send queue, which further simplifies the
              interface.
            </p>
          </SectionDescription>
          <div className={styles.sectionContent}>
            <FlowChart {...flowChartSettings}>
              <div className={styles.block}>
                <div className={styles.blockTitle}>Start Send Touch</div>
                <div className={styles.blockDescription}>
                  This flow is triggered when we want to reach out to a particular user on a
                  particular channel. At this point, we have:
                  <ul>
                    <li>the user sub</li>
                    <li>the touch point event slug</li>
                    <li>the channel we want to reach out on</li>
                    <li>the event parameters (varies by event but not by channel)</li>
                  </ul>
                </div>
              </div>
              <div className={styles.block}>
                <div className={styles.blockTitle}>Append to To Send Queue</div>
                <div className={styles.blockDescription}>
                  We augment the message data with some basic metadata (uid, timestamp, etc.) and
                  push it to the right of the redis list we refer to as the "To Send" Queue as a
                  json, utf-8 encoded string. As a basic form of backpressure, the append is dropped
                  and a warning emitted if the queue is too long.
                </div>
                <NetworkBlockStats
                  path="/api/1/admin/touch/send_queue_info"
                  items={useMemo(
                    () => [
                      { key: 'length', format: formatNetworkNumber },
                      { key: 'oldest_queued_at', format: formatNetworkDate },
                    ],
                    []
                  )}
                />
              </div>
              <div className={styles.block} style={{ maxWidth: '600px' }}>
                <div className={styles.blockTitle}>Send Job</div>
                <div className={styles.blockDescription}>
                  <p>
                    About 4 times per minute we pull messages in batches off the left of the To Send
                    queue, moving them to purgatory for processing. The messages are split by
                    channel, then a single query is made per channel within the batch to get the
                    contact addresses (emails, phone numbers, and push tokens for the email/sms/push
                    channels, respectively) for each user within the batch, and another query for
                    each of the touch points used not seen yet this run. Each contact address is
                    then contacted via the appropriate subqueue (e.g., see Start Send SMS within the
                    SMS area). Finally, the batch is removed from purgatory, handled.
                  </p>
                  <p>
                    The job continues until either there are no more messages to send, 50s have
                    passed, backpressure is applied, or the job is stopped. Backpressure occurs in
                    one of two ways:
                  </p>
                  <ul>
                    <li>
                      When we start the job we will check the sizes of each of the subqueues, and if
                      any of them are larger than a threshold the job does not pull any batches.
                    </li>
                    <li>
                      If, after appending to one of the subqueues, the size of the subqueue becomes
                      larger than a threshold, the batch is finished but the job does not pull any
                      more batches.
                    </li>
                  </ul>
                  <div className={combineClasses(styles.blockNote, styles.blockNoteInfo)}>
                    The send job does not write to the database, instead deferring updates (log
                    entries and user touch point state) to the log job
                  </div>
                  <div className={combineClasses(styles.blockNote, styles.blockNoteInfo)}>
                    If the send job is due while a previous run is still in progress, it will be
                    skipped.
                  </div>
                </div>
                <NetworkBlockStats
                  path="/api/1//admin/touch/last_send_job"
                  items={useMemo(
                    () => [
                      { key: 'started_at', format: formatNetworkDate },
                      { key: 'finished_at', format: formatNetworkDate },
                      { key: 'running_time', format: formatNetworkDuration },
                      { key: 'attempted', format: formatNetworkNumber },
                      {
                        key: 'attempted_sms',
                        name: 'Attempted (SMS)',
                        format: formatNetworkNumber,
                      },
                      {
                        key: 'reachable_sms',
                        name: 'Reachable (SMS)',
                        description: (
                          <TogglableSmoothExpandable>
                            <div className={styles.blockStatisticInfo}>
                              Of those attempted for the SMS channel, how many we found at least one
                              phone number to send to. We only consider verified phone numbers.
                            </div>
                          </TogglableSmoothExpandable>
                        ),
                        format: formatNetworkNumber,
                      },
                      {
                        key: 'unreachable_sms',
                        name: 'Unreachable (SMS)',
                        description: (
                          <TogglableSmoothExpandable>
                            <div className={styles.blockStatisticInfo}>
                              Of those attempted for the SMS channel, how many we could not find any
                              phone numbers to send to. We only consider verified phone numbers.
                            </div>
                          </TogglableSmoothExpandable>
                        ),
                        format: formatNetworkNumber,
                      },
                      {
                        key: 'attempted_push',
                        name: 'Attempted (Push)',
                        format: formatNetworkNumber,
                      },
                      {
                        key: 'reachable_push',
                        name: 'Reachable (Push)',
                        description: (
                          <TogglableSmoothExpandable>
                            <div className={styles.blockStatisticInfo}>
                              Of those attempted for the Push channel, how many we found at least
                              one expo push token to send to. In other words, an installed app which
                              granted permission to receive push notifications.
                            </div>
                          </TogglableSmoothExpandable>
                        ),
                        format: formatNetworkNumber,
                      },
                      {
                        key: 'unreachable_push',
                        name: 'Unreachable (Push)',
                        description: (
                          <TogglableSmoothExpandable>
                            <div className={styles.blockStatisticInfo}>
                              Of those attempted for the Push channel, how many we could not find
                              any expo push tokens to send to. In other words, an installed app
                              which granted permission to receive push notifications.
                            </div>
                          </TogglableSmoothExpandable>
                        ),
                        format: formatNetworkNumber,
                      },
                      {
                        key: 'attempted_email',
                        name: 'Attempted (Email)',
                        format: formatNetworkNumber,
                      },
                      {
                        key: 'reachable_email',
                        name: 'Reachable (Email)',
                        description: (
                          <TogglableSmoothExpandable>
                            <div className={styles.blockStatisticInfo}>
                              Of those attempted for the Email channel, how many we found at least
                              one email address to send to. We only consider verified email
                              addresses.
                            </div>
                          </TogglableSmoothExpandable>
                        ),
                        format: formatNetworkNumber,
                      },
                      {
                        key: 'unreachable_email',
                        name: 'Unreachable (Email)',
                        description: (
                          <TogglableSmoothExpandable>
                            <div className={styles.blockStatisticInfo}>
                              Of those attempted for the Email channel, how many we could not find
                              any email addresses to send to. We only consider verified email
                              addresses.
                            </div>
                          </TogglableSmoothExpandable>
                        ),
                        format: formatNetworkNumber,
                      },
                      {
                        key: 'stale',
                        description: (
                          <TogglableSmoothExpandable>
                            <div className={styles.blockStatisticInfo}>
                              As part of our backpressure support, if a message has been in the To
                              Send queue for a long time we drop it instead of forwarding it the
                              subqueues. This avoids very old messages being sent out as a
                              subchannel is brought back online.
                            </div>
                          </TogglableSmoothExpandable>
                        ),
                        format: formatNetworkNumber,
                      },
                      {
                        key: 'stop_reason',
                        description: (
                          <TogglableSmoothExpandable>
                            <div className={styles.blockStatisticInfo}>
                              One of:
                              <ul>
                                <li>
                                  <span className={styles.mono}>list_exhausted</span>
                                </li>
                                <li>
                                  <span className={styles.mono}>time_exhausted</span>
                                </li>
                                <li>
                                  <span className={styles.mono}>backpressure</span>
                                </li>
                                <li>
                                  <span className={styles.mono}>signal</span>
                                </li>
                              </ul>
                            </div>
                          </TogglableSmoothExpandable>
                        ),
                        format: formatNetworkString,
                      },
                    ],
                    []
                  )}
                  specialStatusCodes={useMemo(
                    () => ({
                      404: () => (
                        <div className={combineClasses(styles.blockNote, styles.blockNoteWarning)}>
                          No send job has been run yet.
                        </div>
                      ),
                    }),
                    []
                  )}
                />
              </div>
              <div className={styles.block} style={{ maxWidth: '600px' }}>
                <div className={styles.blockTitle}>Append to To Log Queue</div>
                <div className={styles.blockDescription}>
                  <p>
                    There may be many touches going out at around the same time, and each touch will
                    ultimately appear as up to one entry within the{' '}
                    <span className={styles.mono}>user_touches</span> table and at least two entries
                    within the <span className={styles.mono}>user_touch_debug_log</span>. Writing
                    this synchronously to the database would slow down emitting touches and result
                    in a lot of database load. Instead, the database writes are appended to the
                    right of a redis list we call the "To Log" queue so that they can be written in
                    batches (with only one transaction per batch).
                  </p>
                  <p>
                    The following information is included in each item in this queue as a json,
                    utf-8 encoded string:
                  </p>
                  <ul>
                    <li>
                      table name (<span className={styles.mono}>user_touch_point_states</span>,{' '}
                      <span className={styles.mono}>user_touches</span>, or{' '}
                      <span className={styles.mono}>user_touch_debug_log</span>
                    </li>
                    <li>action (update or insert)</li>
                    <li>
                      consistency information (for updates to{' '}
                      <span className={styles.mono}>user_touch_point_states</span>)
                    </li>
                    <li>fields to insert/update</li>
                    <li>timestamp</li>
                  </ul>
                </div>
                <NetworkBlockStats
                  path="/api/1/admin/touch/log_queue_info"
                  items={useMemo(
                    () => [
                      { key: 'length', format: formatNetworkNumber },
                      { key: 'oldest_queued_at', format: formatNetworkDate },
                    ],
                    []
                  )}
                />
              </div>
              <div className={styles.block} style={{ maxWidth: '600px' }}>
                <div className={styles.blockTitle}>Log Job</div>
                <div className={styles.blockDescription}>
                  <p>
                    About once per minute, we pull messages in large batches off the left of the To
                    Log queue, moving them to purgatory for processing. The messages are grouped by
                    table and action, then individually batched and written to the database.
                    Finally, the batch is removed from purgatory, handled.
                  </p>
                  <TogglableSmoothExpandable expandCTA="Show example">
                    <p>
                      For example, this could pull 1,000 items off the To Log queue, group them into
                      600 inserts to <span className={styles.mono}>user_touch_debug_log</span>, 200
                      inserts to <span className={styles.mono}>user_touches</span>, 170 updates
                      updates to <span className={styles.mono}>user_touch_point_states</span>, and
                      30 inserts to <span className={styles.mono}>user_touch_point_states</span>. It
                      might then send 6 batches of 100 inserts to{' '}
                      <span className={styles.mono}>user_touch_debug_log</span>, 2 batches of 100
                      inserts to <span className={styles.mono}>user_touches</span>, 2 batches of
                      100/70 updates to <span className={styles.mono}>user_touch_point_states</span>
                      , and 1 batch of 30 inserts to{' '}
                      <span className={styles.mono}>user_touch_point_states</span>.
                    </p>
                  </TogglableSmoothExpandable>
                  <div className={combineClasses(styles.blockNote, styles.blockNoteInfo)}>
                    If the log job is due while a previous run is still in progress, it will be
                    skipped.
                  </div>
                </div>
                <NetworkBlockStats
                  path="/api/1//admin/touch/last_log_job"
                  items={useMemo(
                    () => [
                      { key: 'started_at', format: formatNetworkDate },
                      { key: 'finished_at', format: formatNetworkDate },
                      { key: 'running_time', format: formatNetworkDuration },
                      { key: 'inserts', format: formatNetworkNumber },
                      { key: 'updates', format: formatNetworkNumber },
                      { key: 'full_batch_inserts', format: formatNetworkNumber },
                      { key: 'full_batch_updates', format: formatNetworkNumber },
                      { key: 'partial_batch_inserts', format: formatNetworkNumber },
                      { key: 'partial_batch_updates', format: formatNetworkNumber },
                      { key: 'accepted_inserts', format: formatNetworkNumber },
                      { key: 'accepted_updates', format: formatNetworkNumber },
                      { key: 'failed_inserts', format: formatNetworkNumber },
                      { key: 'failed_updates', format: formatNetworkNumber },
                      {
                        key: 'stop_reason',
                        description: (
                          <TogglableSmoothExpandable>
                            <div className={styles.blockStatisticInfo}>
                              One of:
                              <ul>
                                <li>
                                  <span className={styles.mono}>list_exhausted</span>
                                </li>
                                <li>
                                  <span className={styles.mono}>time_exhausted</span>
                                </li>
                                <li>
                                  <span className={styles.mono}>signal</span>
                                </li>
                              </ul>
                            </div>
                          </TogglableSmoothExpandable>
                        ),
                        format: formatNetworkString,
                      },
                    ],
                    []
                  )}
                  specialStatusCodes={useMemo(
                    () => ({
                      404: () => (
                        <div className={combineClasses(styles.blockNote, styles.blockNoteWarning)}>
                          No log job has been run yet.
                        </div>
                      ),
                    }),
                    []
                  )}
                />
              </div>
            </FlowChart>
          </div>
          <NetworkChart
            partialDataPath="/api/1/admin/touch/partial_touch_send_stats"
            historicalDataPath="/api/1/admin/touch/daily_touch_send"
          />
        </div>
      </div>
    </div>
  );
};
