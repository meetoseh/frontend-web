import { ReactElement, useCallback, useContext, useMemo } from 'react';
import styles from '../notifs_dashboard/AdminNotifsDashboard.module.css';
import {
  BlockStatisticTitleRow,
  SectionDescription,
} from '../notifs_dashboard/AdminNotifsDashboard';
import { FlowChart, FlowChartProps } from '../../shared/components/FlowChart';
import { NetworkBlockStats } from '../lib/NetworkBlockStats';
import {
  formatNetworkDuration,
  formatNetworkNumber,
  formatNetworkString,
  formatNetworkUnixDate,
  formatNetworkUnixTimestamp,
} from '../../shared/lib/networkResponseUtils';
import { NetworkChart } from '../lib/NetworkChart';
import { combineClasses } from '../../shared/lib/combineClasses';
import { useNetworkResponse } from '../../shared/hooks/useNetworkResponse';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { apiFetch } from '../../shared/ApiConstants';
import { TogglableSmoothExpandable } from '../../shared/components/TogglableSmoothExpandable';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';

const flowChartSettings: FlowChartProps = {
  columnGap: { type: 'react-rerender', props: 48 },
  rowGap: { type: 'react-rerender', props: 48 },
  color: { type: 'react-rerender', props: [0, 0, 0, 0.5] },
  lineThickness: { type: 'react-rerender', props: 2 },
  arrowBlockGapPx: { type: 'react-rerender', props: { head: 4, tail: 4 } },
  arrowHeadLengthPx: { type: 'react-rerender', props: 8 },
  arrowHeadAngleDeg: { type: 'react-rerender', props: 30 },
};

type ProgressInfoItem = {
  /** The start_time of the last row we assigned a time, in seconds from midnight */
  startTime: number;
  /* The uid of the last row we assigned a time */
  uid: string;
  /*
   * True if we have assigned a time to every row in the table, false if there are
   * potentially more rows
   */
  finished: boolean;
};

type ProgressInfo = {
  /** The earliest unix date we are still iterating over */
  earliestUnixDate: number;
  /**
   * A mapping from unix date to a mapping from timezone to progress info, with nulls
   * representing items we haven't started yet
   */
  progressByDateAndTimezone: Record<string, Record<string, ProgressInfoItem | null>>;
};

/**
 * The admin daily reminders dashboard
 */
export const AdminDailyRemindersDashboard = (): ReactElement => {
  const loginContext = useContext(LoginContext);
  const progressInfo = useNetworkResponse<ProgressInfo>(
    useCallback(async () => {
      if (loginContext.state !== 'logged-in') {
        return null;
      }

      const response = await apiFetch(
        '/api/1/admin/daily_reminders/progress_info',
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
      const earliestUnixDate = data.earliest_unix_date;
      const progressByDateAndTimezone: Record<string, Record<string, ProgressInfoItem | null>> = {};

      for (const [unixDate, progressByTimezoneRaw] of Object.entries(
        data.progress_by_date_and_timezone
      )) {
        const progressByTimezone: Record<string, ProgressInfoItem | null> = {};

        for (const [timezone, progressInfoRaw] of Object.entries(progressByTimezoneRaw as any)) {
          if (progressInfoRaw === null) {
            progressByTimezone[timezone] = null;
            continue;
          }

          const piRaw = progressInfoRaw as any;
          const progressInfo =
            progressInfoRaw === null
              ? null
              : {
                  startTime: piRaw.start_time,
                  uid: piRaw.uid,
                  finished: piRaw.finished,
                };

          progressByTimezone[timezone] = progressInfo;
        }

        progressByDateAndTimezone[unixDate] = progressByTimezone;
      }

      return {
        earliestUnixDate,
        progressByDateAndTimezone,
      };
    }, [loginContext])
  );

  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>Oseh Daily Reminders Dashboard</div>
      <div className={styles.sections}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Registrations</div>
          <SectionDescription>
            <p>
              Users can be registered to receive reminders on a channel within a range of times,
              where times are specified as the number of seconds since midnight. For example, a user
              can be registered to receive a push notification daily reminder between 28,800 seconds
              and 36,000 seconds after midnight in their timezone, which will typically correspond
              to 8am and 10am (unless time shifts that day). Each one of these registrations is
              called a user daily reminder.
            </p>
          </SectionDescription>
          <div className={styles.sectionContent}>
            <FlowChart {...flowChartSettings}>
              <div className={styles.block}>
                <div className={styles.blockTitle}>TODO</div>
                <div className={styles.blockDescription}></div>
              </div>
            </FlowChart>
          </div>
        </div>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Reminders</div>
          <SectionDescription>
            <p>
              The daily reminder system is responsible for assigning each user daily reminder a send
              time, and then for creating a touch at the assigned time. The user daily reminders
              table can be thought of as a set, and we will iterate through the set over the course
              of the day, leaving the standard implication that we are guarranteed to encounter
              every row that is in the table for the entire day, and we will arbitrarily encounter
              rows that are added to or removed from the table during the day.
            </p>
            <p>
              To efficiently iterate, we need a deterministic sort order. However, the{' '}
              <span className={styles.mono}>start_time</span> and{' '}
              <span className={styles.mono}>end_time</span> fields require incorporating the
              user&rsquo;s timezone for comparisons. Hence, rather than a single "cursor" (where a
              cursor in this context is just referring to the state required to get the next page in
              a listing), we have multiple cursors, one for each timezone, each getting the listing
              of daily reminders <em>just in that timezone</em>. This has the undesirable
              consequence that a user changing timezones could receive multiple notifications in the
              same day, though mitigations for that scenario are possible (e.g., maintaining a set
              of users which changed timezones)
            </p>
          </SectionDescription>
          <div className={styles.sectionContent}>
            <FlowChart {...flowChartSettings}>
              <div className={styles.block}>
                <div className={styles.blockTitle}>Assign Time Job</div>
                <div className={styles.blockDescription}>
                  <p>
                    About once every 15 minutes, the Assign Time Job progresses the cursor
                    corresponding to each timezone we have a user receiving notifications in,
                    assigning times to any upcoming reminders.
                  </p>
                </div>
                <TogglableSmoothExpandable
                  expandCTA="Show Progress Info"
                  collapseCTA="Hide Progress Info">
                  <div className={styles.blockStatistic}>
                    <BlockStatisticTitleRow
                      title={<>Earliest Unix Date</>}
                      value={progressInfo}
                      valueComponent={(i) => formatNetworkUnixDate(i && i.earliestUnixDate)}
                    />
                  </div>
                  <RenderGuardedComponent
                    props={progressInfo.result}
                    component={(info) => {
                      return (
                        <>
                          {Object.keys(info?.progressByDateAndTimezone ?? {})
                            .sort()
                            .map((unixDate) =>
                              Object.keys(info?.progressByDateAndTimezone[unixDate] ?? {})
                                .sort()
                                .map((timezone) => (
                                  <div
                                    className={styles.blockStatistic}
                                    key={`${unixDate}-${timezone}`}>
                                    <div className={styles.blockStatisticTitleRow}>
                                      <div className={styles.blockStatisticTitleAndValue}>
                                        <div className={styles.blockStatisticTitle}>
                                          {formatNetworkUnixDate(parseInt(unixDate))} - {timezone}:
                                        </div>
                                        <div className={styles.blockStatisticValue}>
                                          {((data) => {
                                            if (data === undefined) {
                                              return <>Loading...</>;
                                            }
                                            if (data === null) {
                                              return <>Not Started</>;
                                            }

                                            return (
                                              <span className={styles.mono}>
                                                {JSON.stringify(data, null, 1)}
                                              </span>
                                            );
                                          })(info?.progressByDateAndTimezone[unixDate][timezone])}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))
                            )}
                        </>
                      );
                    }}
                  />
                </TogglableSmoothExpandable>
                <TogglableSmoothExpandable expandCTA="Show Job Info" collapseCTA="Hide Job Info">
                  <NetworkBlockStats
                    path="/api/1/admin/daily_reminders/last_assign_time_job"
                    items={useMemo(
                      () => [
                        { key: 'started_at', format: formatNetworkUnixTimestamp },
                        { key: 'finished_at', format: formatNetworkUnixTimestamp },
                        { key: 'running_time', format: formatNetworkDuration },
                        { key: 'stop_reason', format: formatNetworkString },
                        {
                          key: 'start_unix_date',
                          name: 'Start Date',
                          format: formatNetworkUnixDate,
                        },
                        { key: 'end_unix_date', name: 'End Date', format: formatNetworkUnixDate },
                        { key: 'unique_timezones', format: formatNetworkNumber },
                        { key: 'pairs', format: formatNetworkNumber },
                        { key: 'queries', format: formatNetworkNumber },
                        { key: 'attempted', format: formatNetworkNumber },
                        { key: 'overdue', format: formatNetworkNumber },
                        { key: 'stale', format: formatNetworkNumber },
                        { key: 'sms_queued', name: 'SMS Queued', format: formatNetworkNumber },
                        { key: 'push_queued', format: formatNetworkNumber },
                        { key: 'email_queued', format: formatNetworkNumber },
                      ],
                      []
                    )}
                    specialStatusCodes={useMemo(
                      () => ({
                        404: () => (
                          <div
                            className={combineClasses(styles.blockNote, styles.blockNoteWarning)}>
                            No assign time job has been run yet.
                          </div>
                        ),
                      }),
                      []
                    )}
                  />
                </TogglableSmoothExpandable>
              </div>
              <div className={styles.block}>
                <div className={styles.blockTitle}>Append to Queue</div>
                <div className={styles.blockDescription}>
                  In order to assign a time to a user daily reminder the uid (and unix date, to
                  avoid incidental conflicts for large reminder time ranges) is added to the queued
                  sorted set.
                </div>
                <NetworkBlockStats
                  path="/api/1/admin/daily_reminders/queued_info"
                  items={useMemo(
                    () => [
                      { key: 'length', format: formatNetworkNumber },
                      { key: 'oldest', format: formatNetworkUnixTimestamp },
                      { key: 'overdue', format: formatNetworkNumber },
                    ],
                    []
                  )}
                />
              </div>
              <div className={styles.block}>
                <div className={styles.blockTitle}>Send Job</div>
                <div className={styles.blockDescription}>
                  About four times per minute, the Send Job pulls batches off the queued sorted set
                  and moves them to purgatory. For each assigned time in the batch the corresponding
                  user daily reminder row is fetched. Then appropriate touches are created and
                  finally the items are removed from purgatory.
                </div>
                <TogglableSmoothExpandable expandCTA="Show Job Info" collapseCTA="Hide Job Info">
                  <NetworkBlockStats
                    path="/api/1/admin/daily_reminders/last_send_job"
                    items={useMemo(
                      () => [
                        { key: 'started_at', format: formatNetworkUnixTimestamp },
                        { key: 'finished_at', format: formatNetworkUnixTimestamp },
                        { key: 'running_time', format: formatNetworkDuration },
                        { key: 'stop_reason', format: formatNetworkString },
                        { key: 'attempted', format: formatNetworkNumber },
                        { key: 'lost', format: formatNetworkNumber },
                        { key: 'stale', format: formatNetworkNumber },
                        { key: 'links', format: formatNetworkNumber },
                        { key: 'sms', name: 'SMS', format: formatNetworkNumber },
                        { key: 'push', format: formatNetworkNumber },
                        { key: 'email', format: formatNetworkNumber },
                        { key: 'purgatory_size', format: formatNetworkNumber },
                      ],
                      []
                    )}
                    specialStatusCodes={useMemo(
                      () => ({
                        404: () => (
                          <div
                            className={combineClasses(styles.blockNote, styles.blockNoteWarning)}>
                            No send job has been run yet.
                          </div>
                        ),
                      }),
                      []
                    )}
                  />
                </TogglableSmoothExpandable>
              </div>
            </FlowChart>
          </div>
          <NetworkChart
            partialDataPath="/api/1/admin/daily_reminders/partial_daily_reminder_stats"
            historicalDataPath="/api/1/admin/daily_reminders/daily_reminders"
          />
        </div>
      </div>
    </div>
  );
};
