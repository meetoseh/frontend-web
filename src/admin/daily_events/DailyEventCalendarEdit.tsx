import { ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import '../../assets/fonts.css';
import { apiFetch } from '../../shared/ApiConstants';
import { Button } from '../../shared/forms/Button';
import { describeErrorFromResponse, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { LoginContext } from '../../shared/LoginContext';
import { OsehImage } from '../../shared/OsehImage';
import { convertUsingKeymap } from '../crud/CrudFetcher';
import { CrudFormElement } from '../crud/CrudFormElement';
import { Journey } from '../journeys/Journey';
import { JourneyPicker } from '../journeys/JourneyPicker';
import { keyMap } from '../journeys/Journeys';
import { DailyEvent } from './DailyEvent';
import styles from './DailyEventCalendarEdit.module.css';

type DailyEventCalendarEditProps = {
  /**
   * The daily event the user is editing
   */
  event: DailyEvent;

  /**
   * Called after the daily event is successfully edited
   * @param event The edited event
   */
  onEdit: (this: void, event: DailyEvent) => void;

  /**
   * Called after the daily event is successfully deleted
   * @param event The deleted event
   */
  onDelete: (this: void, event: DailyEvent) => void;
};

export const DailyEventCalendarEdit = ({
  event,
  onEdit,
  onDelete,
}: DailyEventCalendarEditProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [date, setDate] = useState<Date | null>(null);
  const [originalJourneys, setOriginalJourneys] = useState<Journey[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<ReactElement | null>(null);
  const [savingOrLoading, setSavingOrLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmDeleteDisabled, setConfirmDeleteDisabled] = useState(true);

  useEffect(() => {
    setDate(event.availableAt);
  }, [event.availableAt]);

  useEffect(() => {
    let active = true;
    fetchData();
    return () => {
      active = false;
    };

    async function fetchData() {
      setSavingOrLoading(true);
      setError(null);

      try {
        const response = await apiFetch(
          '/api/1/journeys/search',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              filters: {
                daily_event_uid: {
                  operator: 'eq',
                  value: event.uid,
                },
              },
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
        const journeys = data.items.map((i: any) => convertUsingKeymap(i, keyMap));
        setOriginalJourneys(journeys);
      } catch (e) {
        if (!active) {
          return;
        }
        console.error('error fetching daily event', e);
        if (e instanceof TypeError) {
          setError(<>Failed to connect to server. Check your internet connection.</>);
        } else if (e instanceof Response) {
          const err = await describeErrorFromResponse(e);
          if (!active) {
            return;
          }
          setError(err);
        } else {
          setError(<>An unknown error occurred. Contact support.</>);
        }
      } finally {
        if (active) {
          setSavingOrLoading(false);
        }
      }
    }
  }, [event.uid, loginContext]);

  useEffect(() => {
    setJourneys(originalJourneys);
  }, [originalJourneys]);

  useEffect(() => {
    if (!showDeleteConfirm) {
      setConfirmDeleteDisabled(true);
      return;
    }

    const timeout = setTimeout(() => {
      setConfirmDeleteDisabled(false);
    }, 5000);
    return () => {
      clearTimeout(timeout);
    };
  }, [showDeleteConfirm]);

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
      journeys.length > 0 &&
      new Set(journeys.map((j) => j.uid)).size === journeys.length
    );
  }, [date, journeys]);

  const save = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSavingOrLoading(true);
      setError(null);

      try {
        let response = await apiFetch(
          `/api/1/daily_events/${event.uid}/premiere`,
          {
            method: 'DELETE',
          },
          loginContext
        );
        if (!response.ok && response.status !== 409) {
          throw response;
        }

        for (const oldJourney of originalJourneys) {
          if (!journeys.some((j) => j.uid === oldJourney.uid)) {
            const response = await apiFetch(
              `/api/1/daily_events/${event.uid}/journeys/${oldJourney.uid}`,
              {
                method: 'DELETE',
              },
              loginContext
            );
            if (!response.ok && response.status !== 404) {
              throw response;
            }
          }
        }

        for (const newJourney of journeys) {
          if (!originalJourneys.some((j) => j.uid === newJourney.uid)) {
            const response = await apiFetch(
              `/api/1/daily_events/journeys/`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify({
                  daily_event_uid: event.uid,
                  journey_uid: newJourney.uid,
                }),
              },
              loginContext
            );
            if (!response.ok) {
              throw response;
            }
          }
        }

        response = await apiFetch(
          '/api/1/daily_events/premiere',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              uid: event.uid,
              available_at: date!.getTime() / 1000,
            }),
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }

        const data = await response.json();
        const realAvailableAt = new Date(data.available_at * 1000);

        onEdit({
          uid: event.uid,
          availableAt: realAvailableAt,
          createdAt: event.createdAt,
          numberOfJourneys: journeys.length,
        });
      } catch (e) {
        console.error('error saving daily event', e);
        if (e instanceof TypeError) {
          setError(<>Failed to connect to server. Check your internet connection.</>);
        } else if (e instanceof Response) {
          setError(await describeErrorFromResponse(e));
        } else {
          setError(<>An unknown error occurred. Contact support.</>);
        }
      } finally {
        setSavingOrLoading(false);
      }
    },
    [journeys, date, loginContext, onEdit, event.createdAt, event.uid, originalJourneys]
  );

  const doDelete = useCallback(async () => {
    setSavingOrLoading(true);
    setError(null);
    try {
      let response = await apiFetch(
        `/api/1/daily_events/${event.uid}/premiere`,
        {
          method: 'DELETE',
        },
        loginContext
      );

      if (!response.ok && response.status !== 404) {
        throw response;
      }

      response = await apiFetch(
        `/api/1/daily_events/${event.uid}`,
        {
          method: 'DELETE',
        },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      onDelete(event);
    } catch (e) {
      console.error('error deleting daily event', e);
      if (e instanceof TypeError) {
        setError(<>Failed to connect to server. Check your internet connection.</>);
      } else if (e instanceof Response) {
        setError(await describeErrorFromResponse(e));
      } else {
        setError(<>An unknown error occurred. Contact support.</>);
      }
    } finally {
      setSavingOrLoading(false);
    }
  }, [loginContext, event, onDelete]);

  return (
    <div className={`${styles.container} ${showDeleteConfirm ? styles.deleteContainer : ''}`}>
      <div className={styles.title}>Edit Event</div>
      <form className={styles.form} onSubmit={save}>
        <CrudFormElement title="Premiere">
          <input
            className={styles.dateInput}
            type="datetime-local"
            value={localDate}
            onChange={onDateChange}
            disabled={savingOrLoading}
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
                        <div className={styles.journeyTitle}>{journey.title}</div>
                        <div className={styles.journeyBy}>by</div>
                        <div className={styles.journeyInstructor}>
                          {journey.instructor.picture && (
                            <div className={styles.journeyInstructorPictureContainer}>
                              <OsehImage
                                jwt={journey.instructor.picture.jwt}
                                uid={journey.instructor.picture.uid}
                                displayWidth={60}
                                displayHeight={60}
                                alt="profile"
                              />
                            </div>
                          )}
                          <div className={styles.journeyInstructorName}>
                            {journey.instructor.name}
                          </div>
                        </div>
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
                          disabled={savingOrLoading}>
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
                disabled={savingOrLoading}
                filterInEvent={true}
              />
            </div>
          </div>
        </CrudFormElement>
        {error && <ErrorBlock>{error}</ErrorBlock>}
        <div className={styles.buttonsContainer}>
          {(!showDeleteConfirm && (
            <>
              <div className={styles.buttonContainer}>
                <Button type="submit" variant="filled" disabled={!isValid || savingOrLoading}>
                  Save
                </Button>
              </div>
              <div className={styles.buttonContainer}>
                <Button
                  type="button"
                  variant="link"
                  disabled={savingOrLoading}
                  onClick={(e) => {
                    e.preventDefault();
                    setShowDeleteConfirm(true);
                  }}>
                  Delete
                </Button>
              </div>
            </>
          )) || (
            <>
              <div className={styles.buttonContainer}>
                <Button
                  type="button"
                  variant="outlined"
                  disabled={savingOrLoading || confirmDeleteDisabled}
                  onClick={(e) => {
                    e.preventDefault();
                    doDelete();
                  }}>
                  Confirm
                </Button>
              </div>
              <div className={styles.buttonContainer}>
                <Button
                  type="button"
                  variant="filled"
                  disabled={savingOrLoading}
                  onClick={(e) => {
                    e.preventDefault();
                    setShowDeleteConfirm(false);
                  }}>
                  Cancel Delete
                </Button>
              </div>
            </>
          )}
        </div>
      </form>
    </div>
  );
};
