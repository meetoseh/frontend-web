import { ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../shared/ApiConstants';
import { describeErrorFromResponse, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { LoginContext } from '../../shared/LoginContext';
import { convertUsingKeymap, CrudFetcherSort } from '../crud/CrudFetcher';
import { DailyEvent } from './DailyEvent';
import { DailyEventCalendar } from './DailyEventCalendar';
import { keyMap } from './DailyEvents';
import '../../assets/fonts.css';
import styles from './DailyEventCalendarLoader.module.css';
import { DailyEventCalendarItem } from './DailyEventCalendarItem';
import { ModalContext, addModalWithCallbackToRemove } from '../../shared/ModalContext';
import { ModalWrapper } from '../../shared/ModalWrapper';
import { DailyEventCalendarCreate } from './DailyEventCalendarCreate';

type DailyEventCalendarLoaderProps = {
  /**
   * The primary month; the only important fields are the local full year
   * and local month
   */
  primaryMonth: Date;
};

const placeholderDays = (
  startDate: Date, // local time
  numDays: number
): { date: Date; events: DailyEvent[]; element: ReactElement }[] => {
  return new Array(numDays).fill(0).map((_, index) => {
    const date = new Date(startDate.getTime() + 24 * 60 * 60 * 1000 * index);
    return {
      date,
      events: [],
      element: (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingText}>Loading</div>
        </div>
      ),
    };
  });
};

export const DailyEventCalendarLoader = ({
  primaryMonth,
}: DailyEventCalendarLoaderProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const [days, setDays] = useState<{ date: Date; events: DailyEvent[] }[]>([]);
  const [error, setError] = useState<ReactElement | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [suggestedAddDate, setSuggestedAddDate] = useState<Date | null>(null);

  // dates are midnight local time
  const [startDate, endDate, numDays] = useMemo(() => {
    const today = new Date(Date.UTC(primaryMonth.getFullYear(), primaryMonth.getMonth(), 1));

    let startDate = today;
    startDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000 * startDate.getUTCDay());

    let endDate = today;
    if (endDate.getUTCMonth() === 11) {
      endDate = new Date(Date.UTC(endDate.getUTCFullYear() + 1, 0, 1));
    } else {
      endDate = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, 1));
    }
    endDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

    const daysUntilSaturday = 6 - endDate.getUTCDay();
    endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000 * daysUntilSaturday);
    const numDays =
      Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;

    // convert utc to local
    return [
      new Date(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()),
      new Date(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()),
      numDays,
    ];
  }, [primaryMonth]);

  const onEventEdited = useCallback((changedEvent: DailyEvent) => {
    setDays((d) => {
      const indexOfDay = d.findIndex(
        (day) => day.date.toLocaleDateString() === changedEvent.availableAt!.toLocaleDateString()
      );

      if (indexOfDay === -1) {
        return d;
      }

      const indexWithinDay = d[indexOfDay].events.findIndex(
        (event) => event.uid === changedEvent.uid
      );

      if (indexWithinDay === -1) {
        return d;
      }

      const oldDay = d[indexOfDay];
      const newDayEvents = [...oldDay.events];
      newDayEvents[indexWithinDay] = changedEvent;
      newDayEvents.sort((a, b) => a.availableAt!.getTime() - b.availableAt!.getTime());

      const newDays = [...d];
      newDays[indexOfDay] = {
        date: oldDay.date,
        events: newDayEvents,
      };
      return newDays;
    });
  }, []);

  const onEventDeleted = useCallback((deletedEvent: DailyEvent) => {
    setDays((d) => {
      const indexOfDay = d.findIndex(
        (day) => day.date.toLocaleDateString() === deletedEvent.availableAt!.toLocaleDateString()
      );

      if (indexOfDay === -1) {
        return d;
      }

      const indexWithinDay = d[indexOfDay].events.findIndex(
        (event) => event.uid === deletedEvent.uid
      );

      if (indexWithinDay === -1) {
        return d;
      }

      const oldDay = d[indexOfDay];
      const newDayEvents = [...oldDay.events];
      newDayEvents.splice(indexWithinDay, 1);

      const newDays = [...d];
      newDays[indexOfDay] = {
        date: oldDay.date,
        events: newDayEvents,
      };
      return newDays;
    });
  }, []);

  const onWantAdd = useCallback((dateMidnightLocal: Date) => {
    // 15:00 utc is 7am pst (10am est)
    const startAllowedTime = new Date(
      Date.UTC(
        dateMidnightLocal.getFullYear(),
        dateMidnightLocal.getMonth(),
        dateMidnightLocal.getDate(),
        15,
        0,
        0,
        0
      )
    );

    // add 10 hours we get 5pm pst (8pm est)
    const endAllowedTime = new Date(startAllowedTime.getTime() + 1000 * 60 * 60 * 10);
    const suggestedTime = new Date(
      startAllowedTime.getTime() +
        Math.random() * (endAllowedTime.getTime() - startAllowedTime.getTime())
    );
    suggestedTime.setSeconds(0);
    suggestedTime.setMilliseconds(0);

    setSuggestedAddDate(suggestedTime);
    setShowAdd(true);
  }, []);

  const onDailyEventAdded = useCallback((dailyEvent: DailyEvent) => {
    setDays((d) => {
      const index = d.findIndex(
        (day) => day.date.toLocaleDateString() === dailyEvent.availableAt!.toLocaleDateString()
      );
      if (index === -1) {
        return d;
      }
      const newDays = [...d];
      const newEvents = [...newDays[index].events, dailyEvent].sort(
        (a, b) => a.availableAt!.getTime() - b.availableAt!.getTime()
      );
      newDays[index] = {
        date: newDays[index].date,
        events: newEvents,
      };
      return newDays;
    });
    setShowAdd(false);
  }, []);

  useEffect(() => {
    if (!showAdd) {
      return;
    }

    return addModalWithCallbackToRemove(
      modalContext.setModals,
      <ModalWrapper onClosed={() => setShowAdd(false)}>
        <DailyEventCalendarCreate suggestedDate={suggestedAddDate!} onAdded={onDailyEventAdded} />
      </ModalWrapper>
    );
  }, [modalContext.setModals, showAdd, suggestedAddDate, onDailyEventAdded]);

  useEffect(() => {
    let active = true;
    fetchDays();
    return () => {
      active = false;
    };

    async function fetchDays() {
      setDays(placeholderDays(startDate, numDays));
      setError(null);

      if (loginContext.state !== 'logged-in') {
        return;
      }

      try {
        const relevantEvents: DailyEvent[] = [];
        let sort: CrudFetcherSort = [
          { key: 'available_at', dir: 'asc', before: null, after: null },
        ];
        while (true) {
          const response = await apiFetch(
            '/api/1/daily_events/search',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                filters: {
                  available_at: {
                    operator: 'bte',
                    value: [startDate.getTime() / 1000, endDate.getTime() / 1000],
                  },
                },
                sort: sort,
                limit: 100,
              }),
            },
            loginContext
          );

          if (!active) {
            return;
          }

          if (!response.ok) {
            throw response;
          }

          const data = await response.json();

          if (!active) {
            return;
          }

          const newItems = data.items.map((i: any) => convertUsingKeymap(i, keyMap));
          const isMore = data.next_page_sort && data.next_page_sort.some((s: any) => !!s.after);

          relevantEvents.push(...newItems);
          if (!isMore) {
            break;
          }
          sort = data.next_page_sort;
        }

        const eventsByDate = new Map<string, DailyEvent[]>();
        for (const event of relevantEvents) {
          const key = event.availableAt!.toLocaleDateString();
          const events = eventsByDate.get(key);
          if (events === undefined) {
            eventsByDate.set(key, [event]);
          } else {
            events.push(event);
          }
        }

        const newDays = new Array(numDays).fill(0).map((_, index) => {
          const dateMidnightLocal = new Date(startDate.getTime() + 24 * 60 * 60 * 1000 * index);

          const events = eventsByDate.get(dateMidnightLocal.toLocaleDateString()) || [];
          return {
            date: dateMidnightLocal,
            events: events,
          };
        });

        if (!active) {
          return;
        }

        setDays(newDays);
      } catch (e) {
        if (!active) {
          return;
        }
        console.error('error fetching days', e);

        if (e instanceof TypeError) {
          setError(<>Unable to connect to server. Check your internet connection.</>);
        } else if (e instanceof Response) {
          const err = await describeErrorFromResponse(e);
          if (!active) {
            return;
          }
          setError(err);
        } else {
          setError(<>An unknown error occurred.</>);
        }
      }
    }
  }, [loginContext, primaryMonth, endDate, numDays, startDate, onWantAdd, onEventEdited]);

  const daysWithElements = useMemo(() => {
    return days.map((day) => {
      return {
        date: day.date,
        events: day.events,
        element: (
          <DailyEventCalendarItem
            date={day.date}
            events={day.events}
            onWantAdd={onWantAdd}
            onEdited={onEventEdited}
            onDeleted={onEventDeleted}
          />
        ),
      };
    });
  }, [days, onWantAdd, onEventEdited, onEventDeleted]);

  return (
    <div>
      {error && (
        <div className={styles.errorContainer}>
          <ErrorBlock>{error}</ErrorBlock>
        </div>
      )}
      <DailyEventCalendar primaryMonth={primaryMonth} days={daysWithElements} />
    </div>
  );
};
