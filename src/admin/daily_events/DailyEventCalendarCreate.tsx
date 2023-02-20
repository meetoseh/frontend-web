import { ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DailyEvent } from './DailyEvent';
import '../../assets/fonts.css';
import styles from './DailyEventCalendarCreate.module.css';
import { CrudFormElement } from '../crud/CrudFormElement';
import { Journey } from '../journeys/Journey';
import { JourneyPicker } from '../journeys/JourneyPicker';
import { Button } from '../../shared/forms/Button';
import { describeError, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { apiFetch } from '../../shared/ApiConstants';
import { LoginContext } from '../../shared/LoginContext';
import { CompactJourney } from '../journeys/CompactJourney';

type DailyEventCalendarCreateProps = {
  /**
   * The date to suggest for the new daily event. They will be allowed
   * to edit the time the event is actually for. Should be specified
   * in local time (i.e., the getTime() is the true desired unix time)
   */
  suggestedDate: Date;

  /**
   * Called when the daily event has been successfully created
   * @param dailyEvent The newly created daily event
   */
  onAdded: (this: void, dailyEvent: DailyEvent) => void;
};

export const DailyEventCalendarCreate = ({
  suggestedDate,
  onAdded,
}: DailyEventCalendarCreateProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [date, setDate] = useState<Date | null>(suggestedDate);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<ReactElement | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDate(suggestedDate);
  }, [suggestedDate]);

  const onJourneySelected = useCallback((journey: Journey) => {
    setJourneys((j) => [...j, journey]);
    setQuery('');
  }, []);

  const onDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const localDate = new Date(e.target.value + 'Z');
    if (isNaN(localDate.getTime())) {
      setDate(null);
      return;
    }
    const utcDate = new Date(localDate.getTime() + localDate.getTimezoneOffset() * 60 * 1000);
    setDate(utcDate);
  }, []);

  // The date formatted as an iso string with no timezone specifier, in the
  // local timezone
  const localDate = useMemo(() => {
    return date
      ? new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000).toISOString().slice(0, -1)
      : '';
  }, [date]);

  const isValid = useMemo(() => {
    return (
      date !== null &&
      date > new Date() &&
      journeys.length > 0 &&
      new Set(journeys.map((j) => j.uid)).size === journeys.length
    );
  }, [date, journeys]);

  const save = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSaving(true);
      setError(null);

      try {
        let response = await apiFetch(
          '/api/1/daily_events/',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: '{}',
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }

        let data = await response.json();
        const dailyEventUID: string = data.uid;
        const dailyEventCreatedAt: Date = new Date(data.created_at * 1000);

        for (const journey of journeys) {
          const response = await apiFetch(
            '/api/1/daily_events/journeys/',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                daily_event_uid: dailyEventUID,
                journey_uid: journey.uid,
              }),
            },
            loginContext
          );

          if (!response.ok) {
            throw response;
          }
        }

        response = await apiFetch(
          '/api/1/daily_events/premiere',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              uid: dailyEventUID,
              available_at: date!.getTime() / 1000,
            }),
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }

        data = await response.json();
        const realAvailableAt = new Date(data.available_at * 1000);

        onAdded({
          uid: dailyEventUID,
          createdAt: dailyEventCreatedAt,
          availableAt: realAvailableAt,
          numberOfJourneys: journeys.length,
        });
      } catch (e) {
        console.error('error saving daily event', e);
        setError(await describeError(e));
      } finally {
        setSaving(false);
      }
    },
    [journeys, date, loginContext, onAdded]
  );

  return (
    <div className={styles.container}>
      <div className={styles.title}>Create Event</div>
      <form className={styles.form} onSubmit={save}>
        <CrudFormElement title="Premiere">
          <input
            className={styles.dateInput}
            type="datetime-local"
            value={localDate}
            onChange={onDateChange}
          />
        </CrudFormElement>

        <CrudFormElement title="Journeys">
          <div className={styles.journeysOuterContainer}>
            {journeys.length > 0 && (
              <div className={styles.journeysContainer}>
                {journeys.map((journey) => {
                  return (
                    <div className={styles.journeyContainer} key={journey.uid}>
                      <div className={styles.journey}>
                        <CompactJourney journey={journey} />
                      </div>
                      <div className={styles.journeyRemoveButtonContainer}>
                        <Button
                          type="button"
                          variant="link"
                          onClick={(e) => {
                            e.preventDefault();
                            setJourneys((oldJourneys) =>
                              oldJourneys.filter((j) => j.uid !== journey.uid)
                            );
                          }}
                          disabled={saving}>
                          Clear
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className={styles.journeyAddContainer}>
              <JourneyPicker
                query={query}
                setQuery={setQuery}
                setSelected={onJourneySelected}
                filterInEvent={true}
                filterHasSessions={true}
              />
            </div>
          </div>
        </CrudFormElement>
        {error && <ErrorBlock>{error}</ErrorBlock>}
        <div className={styles.buttonContainer}>
          <Button type="submit" variant="filled" disabled={!isValid || saving}>
            Create
          </Button>
        </div>
      </form>
    </div>
  );
};
