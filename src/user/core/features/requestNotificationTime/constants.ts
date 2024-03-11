import { DayOfWeek } from '../../../../shared/models/DayOfWeek';

/**
 * The time range we use if we couldn't get a users existing settings from the server
 */
export const DEFAULT_TIME_RANGE = { start: 8 * 3600, end: 10 * 3600 };

/**
 * The days we use if we couldn't get a users existing settings from the server
 */
export const DEFAULT_DAYS: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
