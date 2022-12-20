import { ReactElement, useCallback } from 'react';
import '../../assets/fonts.css';
import styles from './DailyEventCalendar.module.css';

type DailyEventCalendarProps = {
  /**
   * The primary month we are showing. Elements not in this month
   * are grayed out
   */
  primaryMonth: Date;

  /**
   * The days to show. This will automatically add the appropriate headers
   * for day of week and day of month, so they may vary in height.
   *
   * Each date should be specified as midnight local time.
   */
  days: { date: Date; element: ReactElement }[];
};

/**
 * Shows the monthly calendar view, where there are a multiple of 7 days
 * (typically 5 weeks / 35 days) and the first day is a sunday. Each day should
 * be a react element as if from DailyEventCalendarItem.
 *
 * This doesn't display which month it is, so that should be displayed
 * nearby.
 */
export const DailyEventCalendar = ({
  primaryMonth,
  days,
}: DailyEventCalendarProps): ReactElement => {
  const getItemClass = useCallback(
    (date: Date): string => {
      if (date.getMonth() === primaryMonth.getMonth()) {
        return styles.item;
      } else {
        return styles.itemGrayed;
      }
    },
    [primaryMonth]
  );

  return (
    <div>
      <div className={styles.container}>
        {/* first 7 days we add the day-of-week header */}
        {days.slice(0, 7).map((day, index) => {
          return (
            <div className={`${getItemClass(day.date)} ${styles.firstRowItem}`} key={index}>
              <div className={styles.firstRowHeader}>
                {day.date.toLocaleDateString(undefined, { weekday: 'short' })}
              </div>
              <div className={styles.header}>
                {day.date.toLocaleDateString(undefined, { day: 'numeric' })}
              </div>
              <div className={styles.content}>{day.element}</div>
            </div>
          );
        })}
        {days.slice(7).map((day, index) => {
          return (
            <div className={getItemClass(day.date)} key={index + 7}>
              <div className={styles.header}>
                {day.date.toLocaleDateString(undefined, { day: 'numeric' })}
              </div>
              {day.element}
            </div>
          );
        })}
      </div>
    </div>
  );
};
