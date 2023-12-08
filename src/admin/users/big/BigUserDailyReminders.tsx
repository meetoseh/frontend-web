import { ReactElement, useCallback } from 'react';
import { User } from '../User';
import { DayOfWeek } from './daily_reminder_settings_log/DailyReminderSettingsLog';
import { CrudFetcherKeyMap, convertUsingKeymap } from '../../crud/CrudFetcher';
import { useNetworkResponse } from '../../../shared/hooks/useNetworkResponse';
import { apiFetch } from '../../../shared/ApiConstants';
import { CrudItemBlock } from '../../crud/CrudItemBlock';
import { IconButton } from '../../../shared/forms/IconButton';
import icons from '../UserBlock.module.css';
import styles from './BigUser.module.css';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { ErrorBlock } from '../../../shared/forms/ErrorBlock';
import { CrudFormElement } from '../../crud/CrudFormElement';
import {
  makeDaysOfWeekPretty,
  makeTimeRangePretty,
} from './daily_reminder_settings_log/DailyReminderSettingsLogBlock';

type Reminder = {
  /** The channel that gets a reminder */
  channel: 'email' | 'sms' | 'push';
  /** The days of the week the channel gets a reminder */
  daysOfWeek: DayOfWeek[];
  /** The earliest, in seconds from midnight, the notification gets sent */
  startTime: number;
  /** The latest, in seconds from midnight, the notification gets sent */
  endTime: number;
};

const reminderKeyMap: CrudFetcherKeyMap<Reminder> = {
  days_of_week: 'daysOfWeek',
  start_time: 'startTime',
  end_time: 'endTime',
};

type Reminders = {
  reminders: Reminder[];
};

const remindersKeyMap: CrudFetcherKeyMap<Reminders> = {
  reminders: (_, v) => ({
    key: 'reminders',
    value: (v as any[]).map((e) => convertUsingKeymap(e, reminderKeyMap)),
  }),
};

/**
 * Shows the daily reminders that given user receives right now
 */
export const BigUserDailyReminders = ({ user }: { user: User }): ReactElement => {
  const reminders = useNetworkResponse(
    useCallback(
      async (active, loginContext) => {
        const response = await apiFetch(
          '/api/1/users/daily_reminders?sub=' + encodeURIComponent(user.sub),
          {
            method: 'GET',
          },
          loginContext
        );
        if (!response.ok) {
          throw response;
        }
        const data = await response.json();
        return convertUsingKeymap(data, remindersKeyMap);
      },
      [user]
    )
  );

  return (
    <CrudItemBlock
      title="Daily Reminders"
      containsNested
      controls={
        <>
          <IconButton
            icon={icons.iconRefresh}
            onClick={(e) => {
              e.preventDefault();
              reminders.refresh();
            }}
            srOnlyName="Refresh"
          />
        </>
      }>
      <RenderGuardedComponent
        props={reminders.error}
        component={(error) => <>{error && <ErrorBlock>{error}</ErrorBlock>}</>}
      />
      <RenderGuardedComponent
        props={reminders.result}
        component={(reminders) => (
          <div className={styles.row}>
            {reminders === undefined && 'Not available'}
            {reminders === null && 'Loading...'}
            {reminders?.reminders?.length === 0 && 'None'}
            {reminders &&
              reminders.reminders.map((reminder, i) => (
                <CrudItemBlock title={reminder.channel} key={i} controls={null}>
                  <CrudFormElement title="Days of Week">
                    {makeDaysOfWeekPretty(reminder.daysOfWeek)}
                  </CrudFormElement>
                  <CrudFormElement title="Time Range">
                    {makeTimeRangePretty({
                      type: 'explicit',
                      start: reminder.startTime,
                      end: reminder.endTime,
                    })}
                  </CrudFormElement>
                </CrudItemBlock>
              ))}
          </div>
        )}
      />
    </CrudItemBlock>
  );
};
