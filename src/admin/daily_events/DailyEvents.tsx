import { ReactElement, useCallback, useState } from 'react';
import { IconButton } from '../../shared/forms/IconButton';
import { CrudFetcherKeyMap } from '../crud/CrudFetcher';
import { DailyEvent } from './DailyEvent';
import { DailyEventCalendarLoader } from './DailyEventCalendarLoader';
import styles from './DailyEvents.module.css';

/**
 * The mapping required to convert an api daily event to our internal
 * representation
 */
export const keyMap: CrudFetcherKeyMap<DailyEvent> = {
  available_at: (_, val) => ({ key: 'availableAt', value: val ? new Date(val * 1000) : null }),
  created_at: (_, val) => ({ key: 'createdAt', value: new Date(val * 1000) }),
  number_of_journeys: 'numberOfJourneys',
};

export const DailyEvents = (): ReactElement => {
  const [primaryMonth, setPrimaryMonth] = useState(() => {
    const today = new Date();
    today.setDate(1);
    today.setHours(0, 0, 0, 0);
    return today;
  });

  const goBackOneMonth = useCallback(() => {
    setPrimaryMonth((p) => {
      const res = new Date(p);
      if (res.getMonth() === 0) {
        res.setFullYear(res.getFullYear() - 1);
        res.setMonth(11);
      } else {
        res.setMonth(res.getMonth() - 1);
      }
      return res;
    });
  }, []);

  const goForwardOneMonth = useCallback(() => {
    setPrimaryMonth((p) => {
      const res = new Date(p);
      if (res.getMonth() === 11) {
        res.setFullYear(res.getFullYear() + 1);
        res.setMonth(0);
      } else {
        res.setMonth(res.getMonth() + 1);
      }
      return res;
    });
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>
        <div className={styles.title}>
          {primaryMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </div>
        <div className={styles.controlsContainer}>
          <IconButton icon={styles.chevronBack} srOnlyName="Previous" onClick={goBackOneMonth} />
          <IconButton icon={styles.chevronForward} srOnlyName="Next" onClick={goForwardOneMonth} />
        </div>
      </div>
      <DailyEventCalendarLoader primaryMonth={primaryMonth} />
    </div>
  );
};
