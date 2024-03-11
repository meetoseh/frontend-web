import { CrudFetcherMapper } from '../../../admin/crud/CrudFetcher';
import { DayOfWeek } from '../../../shared/models/DayOfWeek';

/**
 * Describes the users current streak.
 */
export type StreakInfo = {
  /**
   * The number of consecutive days the user has taken a class
   */
  streak: number;
  /**
   * The days of the week the user has taken a class
   */
  daysOfWeek: DayOfWeek[];
  /**
   * The number of days per week the user has taken a class
   */
  goalDaysPerWeek: number | null;
};

export const streakInfoKeyMap: CrudFetcherMapper<StreakInfo> = {
  days_of_week: 'daysOfWeek',
  goal_days_per_week: 'goalDaysPerWeek',
};
