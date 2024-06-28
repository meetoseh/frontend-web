import { ReactElement, useMemo } from 'react';
import styles from '../notifs_dashboard/AdminNotifsDashboard.module.css';
import { SectionDescription } from '../notifs_dashboard/AdminNotifsDashboard';
import { FlowChart, FlowChartProps } from '../../shared/components/FlowChart';
import { NetworkBlockStats } from '../lib/NetworkBlockStats';
import {
  formatNetworkDuration,
  formatNetworkNumber,
  formatNetworkString,
  formatNetworkUnixTimestamp,
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
              there is still some customization based on the type of event that is emitted. To
              improve the admin experience, touch points specify what event parameters they expect
              via an OpenAPI 3.0.3 schema object, which is double checked right before sending. If
              this validation fails, the touch is skipped without mutating the users state, and we
              call the touch "improper".
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
              points, and sufficiently handles logging the process. This allows the success/failure
              callbacks for touches to be simplified: the touch succeeds if any of the destinations
              succeeds, and fails if all of the destinations are abandoned or fail permanently.
            </p>
            <p>
              Generally, in order to send a touch some information has to be created and stored in
              the database; at minimum, link codes are usually required. Since success callbacks may
              be delayed, these link codes should be immediately available, but they should not be
              persisted to the database until the touch is successfully sent. Hence, they are
              buffered to redis and then persisted or deleted based on the success/failure of the
              touch. See the Trackable Links section on this page for more information.
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
                      { key: 'oldest_queued_at', format: formatNetworkUnixTimestamp },
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
                    Reachable touches which have either a success or failure callback have their uid
                    added to the redis sorted set we refer to as the Pending sorted set. The
                    callbacks are stored in a related key, and the remaining attempts (emails, sms
                    sends, push notifications) which have not yet failed permanently/abandoned are
                    added to another related key as a set. The success and failure callbacks
                    provided to the subsystem will call the touches success or failure callback such
                    that the touch success callback is invoked if any destination succeeds and the
                    touch failure callback is invoked only if all destinations are abandoned or fail
                    permanently.
                  </p>
                  <p>
                    Unreachable touches with failure callbacks have their failure callbacks queued
                    immediately.
                  </p>
                  <p>
                    The job continues until either there are no more messages to send, 50s have
                    passed, backpressure is applied, or the job is stopped. Backpressure occurs
                    when, before starting a batch, we detect any of the subqueues (email, sms, push)
                    have more than a threshold number of items in them.
                  </p>
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
                  path="/api/1/admin/touch/last_send_job"
                  items={useMemo(
                    () => [
                      { key: 'started_at', format: formatNetworkUnixTimestamp },
                      { key: 'finished_at', format: formatNetworkUnixTimestamp },
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
                        key: 'improper_sms',
                        name: 'Improper (SMS)',
                        description: (
                          <TogglableSmoothExpandable>
                            <div className={styles.blockStatisticInfo}>
                              Of those attempted for the SMS channel, how many were skipped because
                              the event parameters did not match the touch points event schema.
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
                        key: 'improper_push',
                        name: 'Improper (Push)',
                        description: (
                          <TogglableSmoothExpandable>
                            <div className={styles.blockStatisticInfo}>
                              Of those attempted for the push channel, how many were skipped because
                              the event parameters did not match the touch points event schema.
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
                        key: 'improper_email',
                        name: 'Improper (Email)',
                        description: (
                          <TogglableSmoothExpandable>
                            <div className={styles.blockStatisticInfo}>
                              Of those attempted for the email channel, how many were skipped
                              because the event parameters did not match the touch points event
                              schema.
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
                    batches.
                  </p>
                  <p>
                    The following information is included in each item in this queue as a json,
                    utf-8 encoded string:
                  </p>
                  <ul>
                    <li>table name</li>
                    <li>action (update or insert)</li>
                    <li>
                      consistency information that is used for best-effort alerting that the
                      database was mutated between the action queued and the action actually being
                      written, implying something else is writing to the tables managed by the log
                      job
                    </li>
                    <li>fields to insert/update using stable identifiers</li>
                    <li>timestamp</li>
                  </ul>
                </div>
                <NetworkBlockStats
                  path="/api/1/admin/touch/log_queue_info"
                  items={useMemo(
                    () => [
                      { key: 'length', format: formatNetworkNumber },
                      { key: 'oldest_queued_at', format: formatNetworkUnixTimestamp },
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
                    table and action, then batched and written to the database. Finally, the overall
                    batch is removed from purgatory, handled.
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
                  path="/api/1/admin/touch/last_log_job"
                  items={useMemo(
                    () => [
                      { key: 'started_at', format: formatNetworkUnixTimestamp },
                      { key: 'finished_at', format: formatNetworkUnixTimestamp },
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
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Stale Callbacks</div>
          <SectionDescription>
            <p>
              This section describes a process which is a no-op in normal circumstances. It becomes
              active if one of the subsystems has a bug that causes success/failure callbacks not to
              be called. This leads to entries stuck in the Pending sorted set, leading to a memory
              leak within redis. The Stale Detection Job is provided to handle alerting and
              recovering the memory in such a scenario.
            </p>
          </SectionDescription>
          <div className={styles.sectionContent}>
            <FlowChart {...flowChartSettings}>
              <div className={styles.block} style={{ maxWidth: '600px' }}>
                <div className={styles.blockTitle}>Stale Detection Job</div>
                <div className={styles.blockDescription}>
                  About once every 15 minutes, we check for old entries in the Pending sorted set.
                  If any are found, implying a bug in one of the subsystems, we alert and then clean
                  up the leaked entries, queuing the failure callback if there is one.
                </div>
                <NetworkBlockStats
                  path="/api/1/admin/touch/pending_sorted_set_info"
                  items={useMemo(
                    () => [
                      { key: 'length', format: formatNetworkNumber },
                      { key: 'oldest_score', format: formatNetworkUnixTimestamp },
                    ],
                    []
                  )}
                />
                <NetworkBlockStats
                  path="/api/1/admin/touch/last_stale_detection_job"
                  items={useMemo(
                    () => [
                      { key: 'started_at', format: formatNetworkUnixTimestamp },
                      { key: 'finished_at', format: formatNetworkUnixTimestamp },
                      { key: 'running_time', format: formatNetworkDuration },
                      { key: 'stale', format: formatNetworkNumber },
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
                          No stale detection job has been run yet.
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
            partialDataPath="/api/1/admin/touch/partial_touch_stale_stats"
            historicalDataPath="/api/1/admin/touch/daily_touch_stale"
          />
        </div>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Trackable Links</div>
          <SectionDescription>
            <p>
              One of the most common content items to include within a touch would be a shortcut to
              perform some action, like going to the home page or unsubscribing from a mailing list.
              It&rsquo;s helpful to know if users are clicking these links, as it provides a measure
              of how useful a particular notification is.
            </p>
            <p>
              Creating these trackable links is a bit more subtle than might be immediately obvious;
              for ease of analytics, we only want to store trackable links the user could actually
              see. For example, storing a trackable link for a notification we didn't send would
              make it much more difficult to interpret basic click rate metrics, since the
              denominator would be off.
            </p>
            <p>
              However, we can receive confirmation about a notification delivery after an arbitrary
              delay, which means that the user might try to use a link before we&rsquo;ve confirmed
              it delivered&mdash;thus, we either need to redundantly store the action and the
              tracking code in the link (increasing the size of the link, particularly undesirable
              for SMS), or we need to ensure the links action is available before we know if the
              notification is sent.
            </p>
            <p>
              Thus, it&rsquo;s natural for this system to store the links first in redis, where they
              are queryable, and then persist them to the database once the notification delivery is
              confirmed. This also gives the opportunity to batch the persistence to the database,
              which avoids creating links bottlenecking our ability to send notifications. Another
              benefit is that by delaying persistence, under the assumption that many clicks will be
              shortly after the notification is sent, many link clicks will be handled while they
              are still in redis, reducing query load on the database (less important than write
              load, but still helpful)
            </p>
          </SectionDescription>
          <div className={styles.sectionContent}>
            <FlowChart {...flowChartSettings}>
              <div className={styles.block} style={{ maxWidth: '600px' }}>
                <div className={styles.blockTitle}>Create Buffered Link</div>
                <div className={styles.blockDescription}>
                  <p>
                    When a trackable link is desired, the touch uid (which will usually not yet
                    correspond to a row in <span className={styles.mono}>user_touches</span>), page
                    identifier, page extra (aka action payload), preview identifier, and preview
                    extra (aka preview payload) must be provided. This classifies both where the
                    link should take the user and how the open-graph meta tags are constructed on
                    the page. A user touch link uid and code are generated, then:
                  </p>
                  <ul>
                    <li>
                      An entry is appended to the sorted set we refer to as the Buffered Link sorted
                      set, where the key is the code and the score is the timestamp we added the
                      entry (for stale detection)
                    </li>
                    <li>
                      A related key referred to as the related actions key is set to include the uid
                      and action that should occur, where the action is the combination of an enum
                      identifier known to oseh clients (the website and apps) and a payload that is
                      specific to that action as a json-encodable dictionary.
                    </li>
                  </ul>
                  <p>
                    The callee should eventually either persist or abandon the link, but if they do
                    neither than eventually the Leaked Link Detection Job will persist or abandon
                    the link for them, based on if there is a corresponding row in{' '}
                    <span className={styles.mono}>user_touches</span>.
                  </p>
                  <div className={combineClasses(styles.blockNote, styles.blockNoteRelated)}>
                    This increments the following daily counters:
                    <ul>
                      <li>created</li>
                    </ul>
                  </div>
                </div>
                <NetworkBlockStats
                  path="/api/1/admin/touch/buffered_link_sorted_set_info"
                  items={useMemo(
                    () => [
                      { key: 'length', format: formatNetworkNumber },
                      { key: 'oldest_score', format: formatNetworkUnixTimestamp },
                    ],
                    []
                  )}
                  specialStatusCodes={useMemo(
                    () => ({
                      404: () => (
                        <div className={combineClasses(styles.blockNote, styles.blockNoteWarning)}>
                          Buffered link sorted set info stats not implemented yet
                        </div>
                      ),
                    }),
                    []
                  )}
                />
              </div>
            </FlowChart>
            <FlowChart {...flowChartSettings}>
              <div className={styles.block} style={{ maxWidth: '600px' }}>
                <div className={styles.blockTitle}>Abandon Link</div>
                <div className={styles.blockDescription}>
                  <p>
                    If the original caller who created a buffered link confirms it is not actually
                    needed, they abandon the link by removing it from the buffered link set and
                    simultaneously removing the related action key and related clicks key (see the
                    Click Link flow). Typically, this would be done via the failure callback in the
                    touch system.
                  </p>

                  <div className={combineClasses(styles.blockNote, styles.blockNoteInfo)}>
                    The related clicks key will presumably be empty since we are abandoning the
                    link, but it should be deleted (with an alert if it existed) just in case there
                    was a false-positive abandon.
                  </div>
                  <div className={combineClasses(styles.blockNote, styles.blockNoteRelated)}>
                    This can increment the following daily counters:
                    <ul>
                      <li>abandons attempted</li>
                      <li>abandoned</li>
                      <li>abandon failed</li>
                    </ul>
                  </div>
                </div>
              </div>
            </FlowChart>
            <FlowChart {...flowChartSettings}>
              <div className={styles.block} style={{ maxWidth: '600px' }}>
                <div className={styles.blockTitle}>Persist Link</div>
                <div className={styles.blockDescription}>
                  <p>
                    If the original caller who created a buffered link confirms it is actually
                    needed, they should queue the link to be persisted by adding to the sorted set
                    we refer to as the Persistable Buffered Link sorted set. This sorted set has
                    values which are tracking codes and the score is the earliest timestamp when the
                    entry should be persisted. Generally the choice of a few minutes to an hour
                    delay is appropriate to balance the need to free the redis memory and the desire
                    to reduce database load when many links are sent out (and thus many clicks are
                    incoming).
                  </p>

                  <div className={combineClasses(styles.blockNote, styles.blockNoteInfo)}>
                    The code is used instead of the uid in the Persistable Buffered Link sorted set
                    so that the lookup matches the buffered link sorted set, which has to be codes
                    since its queried by code when a user clicks the link
                  </div>
                  <div className={combineClasses(styles.blockNote, styles.blockNoteWarning)}>
                    At least enough of a delay to ensure that the user touch has been persisted by
                    the Touch Log Job is required.
                  </div>
                  <div className={combineClasses(styles.blockNote, styles.blockNoteRelated)}>
                    This can increment the following daily counters:
                    <ul>
                      <li>persist queue attempts</li>
                      <li>persist queue failed</li>
                      <li>persists queued</li>
                    </ul>
                  </div>
                </div>
                <NetworkBlockStats
                  path="/api/1/admin/touch/persistable_buffered_link_sorted_set_info"
                  items={useMemo(
                    () => [
                      { key: 'length', format: formatNetworkNumber },
                      { key: 'overdue', format: formatNetworkNumber },
                      { key: 'oldest_score', format: formatNetworkUnixTimestamp },
                    ],
                    []
                  )}
                  specialStatusCodes={useMemo(
                    () => ({
                      404: () => (
                        <div className={combineClasses(styles.blockNote, styles.blockNoteWarning)}>
                          Persistable buffered link sorted set info stats not implemented yet
                        </div>
                      ),
                    }),
                    []
                  )}
                />
              </div>
              <div className={styles.block} style={{ maxWidth: '600px' }}>
                <div className={styles.blockTitle}>Persist Link Job</div>
                <div className={styles.blockDescription}>
                  <p>
                    About once per minute, we pull large batches off the left of the Persistable
                    Buffered Link sorted set, moving them to purgatory for processing. We augment
                    this with the related Buffered Link Clicks pseudo-set (see Click Link). The
                    batch is then subbatched into individual database writes, and each subbatch is
                    persisted to the database tables{' '}
                    <span className={styles.mono}>user_touch_links</span> and{' '}
                    <span className={styles.mono}>user_touch_link_clicks</span> in a single
                    transaction. Then the handled entries are removed from purgatory and related
                    keys are cleaned up (i.e., deleting the persisted links from the Buffered Links
                    sorted set and the Buffered Link Clicks pseudo-set)
                  </p>

                  <div className={combineClasses(styles.blockNote, styles.blockNoteInfo)}>
                    Since the persistable buffered link sorted set is a sorted set, so is the
                    purgatory used here. This means that it&rsquo;s reasonably efficient to zrem the
                    codes that we handled rather than just clearing purgatory at every iteration,
                    meaning that the purgatory is updated after each subbatch rather than waiting
                    for the whole batch.
                  </div>

                  <div className={combineClasses(styles.blockNote, styles.blockNoteRelated)}>
                    This can increment the following daily counters:
                    <ul>
                      <li>persisted</li>
                      <li>persisted in failed batch</li>
                      <li>persists failed</li>
                      <li>persisted clicks</li>
                      <li>persisted clicks in failed batch</li>
                      <li>persist click failed</li>
                    </ul>
                  </div>
                </div>
                <NetworkBlockStats
                  path="/api/1/admin/touch/last_persist_link_job"
                  items={useMemo(
                    () => [
                      { key: 'started_at', format: formatNetworkUnixTimestamp },
                      { key: 'finished_at', format: formatNetworkUnixTimestamp },
                      { key: 'running_time', format: formatNetworkDuration },
                      { key: 'attempted', format: formatNetworkNumber },
                      { key: 'lost', format: formatNetworkNumber },
                      { key: 'integrity_error', format: formatNetworkNumber },
                      { key: 'persisted', format: formatNetworkNumber },
                      { key: 'persisted_without_clicks', format: formatNetworkNumber },
                      { key: 'persisted_with_one_click', format: formatNetworkNumber },
                      { key: 'persisted_with_multiple_clicks', format: formatNetworkNumber },
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
                      { key: 'in_purgatory', format: formatNetworkNumber },
                    ],
                    []
                  )}
                  specialStatusCodes={useMemo(
                    () => ({
                      404: () => (
                        <div className={combineClasses(styles.blockNote, styles.blockNoteWarning)}>
                          No persist link job has been run yet.
                        </div>
                      ),
                    }),
                    []
                  )}
                />
              </div>
            </FlowChart>
            <FlowChart {...flowChartSettings}>
              <div className={styles.block} style={{ maxWidth: '600px' }}>
                <div className={styles.blockTitle}>Click Link</div>
                <div className={styles.blockDescription}>
                  <p>
                    When a link is clicked by the user, the frontend needs to exchange the code for
                    where to direct the user. Simultaneously, the backend may choose to track that
                    the link was clicked. Given the code, various metadata (visitor uid, user sub,
                    timestamps), and if the link should be tracked, the exchange endpoint proceeds
                    as follows: if...
                  </p>
                  <ol>
                    <li>
                      the link is in the <strong>buffered link sorted set</strong> and...
                      <ol>
                        <li>
                          <strong>is not</strong> in the purgatory for the Persist Link job
                          <p>
                            The link information can be fetched from the buffered link sorted set
                            and the click can be tracked by storing it in the Buffered Link Clicks
                            pseudo-set.
                          </p>
                        </li>
                        <li>
                          <strong>is</strong> in the purgatory for the Persist Link Job
                          <p>
                            The link information can be fetched from the buffered link sorted set,
                            but it&rsquo;s not safe to track the link in the buffered link clicks
                            pseudo-set as it may have already been read by the Persist Link job (and
                            it won&rsquo;t be rechecked before being deleted). Hence, the click
                            needs to be added to a new redis set we refer to as the Delayed Link
                            Clicks sorted set to be handled by the Delayed Click Persist Job. The
                            set is explained in the next block.
                          </p>
                        </li>
                      </ol>
                    </li>
                    <li>
                      the link is in the <strong>database</strong>
                      <p>
                        The link information can be fetched from the database. For tracking, we need
                        to check the delayed link clicks sorted set for the parent. This check is
                        done and handled in the same transaction that checked the buffered link
                        sorted set&mdash;if the parent click is in the delayed link clicks, then the
                        click will also be stored there. Otherwise, the click can be stored directly
                        in the database.
                      </p>
                    </li>
                    <li>
                      the link is <strong>nowhere</strong>
                      <p>There is no link info (client gets a 404) and the click is dropped</p>
                    </li>
                  </ol>
                  <div className={combineClasses(styles.blockNote, styles.blockNoteInfo)}>
                    It is <strong>not</strong> safe to persist a link as a result of a click,
                    despite that being logically reasonable, since we need the touch system to
                    persist the user touch first before we can persist the link into the database,
                    and it would not be worth the additional complexity to give a different
                    definition of success for touches than they already have.
                  </div>
                  <div className={combineClasses(styles.blockNote, styles.blockNoteInfo)}>
                    Only a limited number of clicks are stored for a given link within the buffer,
                    via a minimum time between clicks in order to be tracked. This is to avoid a bug
                    (or, much less likely, malicious user) from generating a large number of clicks
                    and exhausting our available memory. To keep ratelimiting simple and consistent,
                    ratelimiting is handled outside this module, i.e., we do <strong>not</strong>{' '}
                    use the last click created at timestamp to determine if a click is ratelimited,
                    and hence don't have to deal with fetching that (particularly challenging in
                    case 1-2 above)
                  </div>
                  <div className={combineClasses(styles.blockNote, styles.blockNoteInfo)}>
                    Clicks are tracked in two phases; upon click, and upon logging in (if the user
                    logs in without switching pages). The second phase is omitted if the user clicks
                    the link and lands on the page already logged in (i.e., they resumed a session).
                    This provides a decent baseline for how often our notification codes are being
                    shared between users (e.g., forwarding emails or copying sms links). The first
                    step is rate limited and the second step can only occur exactly once per
                    previous step.
                  </div>
                  <div className={combineClasses(styles.blockNote, styles.blockNoteRelated)}>
                    This can increment the following daily counters, but only if tracking is
                    requested (on ratelimited requests no daily counters are incremented):
                    <ul>
                      <li>click attempts</li>
                      <li>clicks buffered</li>
                      <li>clicks direct to db</li>
                      <li>clicks delayed</li>
                      <li>clicks failed</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className={styles.block} style={{ maxWidth: '600px' }}>
                <div className={styles.blockTitle}>Append to Delayed Link Clicks</div>
                <div className={styles.blockDescription}>
                  <p>
                    As explained in case 1-2 in Click Link, while a link is being persisted from the
                    Buffered Link sorted set by the Persist Link job, clicks cannot be stored in the
                    database (as the link is not necessarily there yet) and cannot be stored in the
                    Buffered Link Clicks pseudo-set (as the Persist Link job may have already read
                    from there and will not do so again before deleting).
                  </p>
                  <p>
                    In this case clicks go to a special store referred to as the Delayed Link Clicks
                    sorted set, which is comprised of the following keys always written to
                    atomically:
                  </p>
                  <ul>
                    <li>
                      a sorted set (with no key path parameters) where the scores are when we should
                      next try to persist the click and the values are click uids.
                    </li>
                    <li>
                      a hash whose key contains the click uid and whose value describes the click
                      analagously to how it would be stored in{' '}
                      <span className={styles.mono}>user_touch_link_clicks</span>
                    </li>
                    <li>
                      a string whose key contains the <em>parent</em> click uid and whose value is
                      the <em>child</em> click uid, stored when the child is created and used to
                      facilitate ensuring a parent only has one child.
                    </li>
                  </ul>
                  <p>
                    The delayed clicks job can handle clicks being inserted here at any time whereas
                    the persist link job cannot handle clicks being added to the Buffered Link
                    Clicks pseudo-set at any time. The reason is rather simple: in all cases a queue
                    consumer cannot handle the units in the batch being mutated while the consumer
                    is transforming them. For the delayed clicks job, the unit is clicks, so clicks
                    can&rsquo;t be mutated. For the persist link job the unit is links, so links
                    can&rsquo;t be mutated. Further, for the persist link job, adding a click{' '}
                    <em>is</em> mutating the link, hence the restriction.
                  </p>
                </div>
                <NetworkBlockStats
                  path="/api/1/admin/touch/delayed_link_clicks_sorted_set_info"
                  items={useMemo(
                    () => [
                      { key: 'length', format: formatNetworkNumber },
                      { key: 'overdue', format: formatNetworkNumber },
                      { key: 'oldest_score', format: formatNetworkUnixTimestamp },
                    ],
                    []
                  )}
                  specialStatusCodes={useMemo(
                    () => ({
                      404: () => (
                        <div className={combineClasses(styles.blockNote, styles.blockNoteWarning)}>
                          Delayed link clicks sorted set info not implemented yet
                        </div>
                      ),
                    }),
                    []
                  )}
                />
              </div>
              <div className={styles.block} style={{ maxWidth: '600px' }}>
                <div className={styles.blockTitle}>Delayed Click Persist Job</div>
                <div className={styles.blockDescription}>
                  <p>
                    About once per minute, we pull large batches off the Delayed Link Clicks sorted
                    set, moving them to purgatory for processing. Clicks in the batch whose
                    corresponding link is still in the persist purgatory are delayed by adding them
                    batch to the Delayed Link Clicks sorted set with a later score. The remainder of
                    the batch is divided into subbatches, and each subbatch is persisted to the
                    database and removed from purgatory.
                  </p>
                  <div className={combineClasses(styles.blockNote, styles.blockNoteInfo)}>
                    In order to distinguish lost delayed clicks from duplicate delayed clicks in our
                    failed breakdown, if a subbatch does not insert enough rows we do a bulk query
                    to count how many clicks are in the database with uids from the subbatch.
                  </div>
                  <div className={combineClasses(styles.blockNote, styles.blockNoteInfo)}>
                    Since the Delayed Link Clicks is a sorted set, so is the purgatory for this job.
                  </div>
                  <div className={combineClasses(styles.blockNote, styles.blockNoteRelated)}>
                    This can increment the following daily counters:
                    <ul>
                      <li>delayed clicks attempted</li>
                      <li>delayed clicks persisted</li>
                      <li>delayed clicks delayed</li>
                      <li>delayed clicks failed</li>
                    </ul>
                  </div>
                </div>
                <NetworkBlockStats
                  path="/api/1/admin/touch/last_delayed_click_persist_job"
                  items={useMemo(
                    () => [
                      { key: 'started_at', format: formatNetworkUnixTimestamp },
                      { key: 'finished_at', format: formatNetworkUnixTimestamp },
                      { key: 'running_time', format: formatNetworkDuration },
                      { key: 'attempted', format: formatNetworkNumber },
                      { key: 'persisted', format: formatNetworkNumber },
                      { key: 'delayed', format: formatNetworkNumber },
                      { key: 'lost', format: formatNetworkNumber },
                      { key: 'duplicate', format: formatNetworkNumber },
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
                          Delayed link clicks persist job not run yet
                        </div>
                      ),
                    }),
                    []
                  )}
                />
              </div>
            </FlowChart>
            <FlowChart {...flowChartSettings}>
              <div className={styles.block} style={{ maxWidth: '600px' }}>
                <div className={styles.blockTitle}>Leaked Link Detection Job</div>
                <div className={styles.blockDescription}>
                  About once every 15 minutes, we check for old entries in the Buffered Link sorted
                  set. If any are found, it implies something is creating links without eventually
                  persisting or abandoning them. They are abandoned and an alert is sent.
                  <div className={combineClasses(styles.blockNote, styles.blockNoteRelated)}>
                    This can increment the following daily counters:
                    <ul>
                      <li>leaked</li>
                    </ul>
                  </div>
                </div>
                <NetworkBlockStats
                  path="/api/1/admin/touch/last_leaked_link_detection_job"
                  items={useMemo(
                    () => [
                      { key: 'started_at', format: formatNetworkUnixTimestamp },
                      { key: 'finished_at', format: formatNetworkUnixTimestamp },
                      { key: 'running_time', format: formatNetworkDuration },
                      {
                        key: 'leaked',
                        format: formatNetworkNumber,
                        description: (
                          <TogglableSmoothExpandable>
                            <div className={styles.blockStatisticInfo}>
                              How many leaked links the job found in the Buffered Link sorted set,
                              i.e., how many links in the Buffered Link sorted set have been in
                              there so long that they should definitely have been abandoned or
                              persisted by now.
                            </div>
                          </TogglableSmoothExpandable>
                        ),
                      },
                      {
                        key: 'recovered',
                        format: formatNetworkNumber,
                        description: (
                          <TogglableSmoothExpandable>
                            <div className={styles.blockStatisticInfo}>
                              Of the leaked links, how many had their user touch uid correspond to a
                              user touch in the database, meaning we could (and did) persist the
                              link (and associated clicks) before deleting it.
                            </div>
                          </TogglableSmoothExpandable>
                        ),
                      },
                      {
                        key: 'abandoned',
                        format: formatNetworkNumber,
                        description: (
                          <TogglableSmoothExpandable>
                            <div className={styles.blockStatisticInfo}>
                              Of the leaked links, how many did not have their user touch uid
                              correspond to a user touch in the database, meaning all we could do
                              (and did do) was delete the link (and associated clicks). In the daily
                              counter we distinguish abandoned from duplicate, where duplicate is
                              the same outcome but we also detected that there was already a user
                              touch link with either the same uid or the same code as the one we
                              abandoned.
                            </div>
                          </TogglableSmoothExpandable>
                        ),
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
                          Leaked link detection job not run yet
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
            partialDataPath="/api/1/admin/touch/partial_touch_link_stats"
            historicalDataPath="/api/1/admin/touch/daily_touch_link_stats"
          />
        </div>
      </div>
    </div>
  );
};
