import { DayOfWeek } from '../../../../shared/models/DayOfWeek';
import { CrudFetcherKeyMap } from '../../../crud/CrudFetcher';

export type DailyReminderTimeRange =
  | {
      type: 'preset';
      preset: 'unspecified' | 'morning' | 'afternoon' | 'evening';
    }
  | {
      type: 'explicit';
      /** Seconds after midnight */
      start: number;
      /** Seconds after midnight */
      end: number;
    };

export type DailyReminderSettingsLog = {
  /** Row identifier */
  uid: string;
  /** Which channel settings changed */
  channel: 'email' | 'phone' | 'push';
  /** The days of the week they now receive notifications */
  daysOfWeek: DayOfWeek[];
  /** The time range they receive notifications on the given days */
  timeRange: DailyReminderTimeRange;
  /** The arbitrary reason dictionary for debugging */
  reason: any;
  /** When this log entry was stored */
  createdAt: Date;
};

/**
 * The key map that can be used to parse a contact method log from the backend
 */
export const dailyReminderSettingsLogKeyMap:
  | CrudFetcherKeyMap<DailyReminderSettingsLog>
  | ((raw: any) => DailyReminderSettingsLog) = {
  days_of_week: 'daysOfWeek',
  time_range: (_, v) => ({
    key: 'timeRange',
    value: {
      ...v,
      type: v.preset !== undefined && v.preset !== null ? 'preset' : 'explicit',
    },
  }),
  created_at: (_, v) => ({ key: 'createdAt', value: new Date(v * 1000) }),
};
