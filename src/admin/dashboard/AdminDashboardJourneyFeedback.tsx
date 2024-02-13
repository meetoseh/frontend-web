import { ChangeEvent, ReactElement, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../../shared/ApiConstants';
import { describeError, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { dateToLocaleISODateString } from '../../shared/lib/dateToLocaleISODateString';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { convertUsingKeymap, CrudFetcherKeyMap } from '../crud/CrudFetcher';
import { CompactJourney } from '../journeys/CompactJourney';
import { Journey } from '../journeys/Journey';
import { keyMap as journeyKeyMap } from '../journeys/Journeys';
import styles from './AdminDashboardJourneyFeedback.module.css';
import { AdminDashboardLargeChartPlaceholder } from './AdminDashboardLargeChartPlaceholder';
import { DashboardTable, DashboardTableProps } from './subComponents/DashboardTable';
import { useOsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';

type FeedbackUser = {
  sub: string;
  givenName: string;
  familyName: string;
  createdAt: Date;
};

const feedbackUserKeyMap: CrudFetcherKeyMap<FeedbackUser> = {
  given_name: 'givenName',
  family_name: 'familyName',
  created_at: (_, v: number) => ({ key: 'createdAt', value: new Date(v * 1000) }),
};

type Feedback = {
  user: FeedbackUser;
  liked: boolean;
  strength: number;
  createdAt: Date;
};

const feedbackKeyMap: CrudFetcherKeyMap<Feedback> = {
  user: (_, v: any) => ({ key: 'user', value: convertUsingKeymap(v, feedbackUserKeyMap) }),
  created_at: (_, v: number) => ({ key: 'createdAt', value: new Date(v * 1000) }),
};

type ResponseItem = {
  journey: Journey;
  feedback: Feedback[];
};

const responseItemKeyMap: CrudFetcherKeyMap<ResponseItem> = {
  journey: (_, v: any) => ({ key: 'journey', value: convertUsingKeymap(v, journeyKeyMap) }),
  feedback: (_, v: any[]) => ({
    key: 'feedback',
    value: v.map((f) => convertUsingKeymap(f, feedbackKeyMap)),
  }),
};

type Response = {
  items: ResponseItem[];
  retrievedFor: Date;
  retrievedAt: Date;
};

const responseKeyMap: CrudFetcherKeyMap<Response> = {
  items: (_, v: any[]) => ({
    key: 'items',
    value: v.map((i) => convertUsingKeymap(i, responseItemKeyMap)),
  }),
  retrieved_for: (_, v: string) => ({ key: 'retrievedFor', value: new Date(v) }),
  retrieved_at: (_, v: number) => ({ key: 'retrievedAt', value: new Date(v * 1000) }),
};

/**
 * Shows feedback that users have given about journeys.
 */
export const AdminDashboardJourneyFeedback = (): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const [showingPlaceholder, setShowingPlaceholder] = useState(true);
  const [error, setError] = useState<ReactElement | null>(null);
  const [date, setDate] = useState(
    () => new Date(dateToLocaleISODateString(new Date(Date.now() - 86400000)))
  );
  const [data, setData] = useState<Response | null>(null);
  const [tableProps, setTableProps] = useState<{ journey: Journey; table: DashboardTableProps }[]>(
    []
  );
  const imageHandler = useOsehImageStateRequestHandler({
    playlistCacheSize: 512,
    imageCacheSize: 128,
    cropCacheSize: 128,
  });

  const onPlaceholderVisible = useCallback(() => {
    setShowingPlaceholder(false);
  }, []);

  const onDateChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.valueAsDate) {
      setDate(e.target.valueAsDate);
    }
  }, []);

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        // req date is in local time, but retrievedFor is in naive time
        const reqDateIso = date.toISOString().split('T')[0];
        const curDateIso = data === null ? null : data.retrievedFor.toISOString().split('T')[0];

        if (reqDateIso === curDateIso) {
          return;
        }

        if (loginContextUnch.state !== 'logged-in') {
          return;
        }
        const loginContext = loginContextUnch;

        let active = true;
        fetchData();
        return () => {
          active = false;
        };

        async function fetchDataInner() {
          const response = await apiFetch(
            '/api/1/admin/journey_feedback?' + new URLSearchParams({ date: reqDateIso }),
            {
              method: 'GET',
            },
            loginContext
          );

          if (!response.ok) {
            throw response;
          }

          const dataRaw = await response.json();
          const parsed = convertUsingKeymap(dataRaw, responseKeyMap);
          if (active) {
            setData(parsed);
          }
        }

        async function fetchData() {
          setError(null);
          try {
            await fetchDataInner();
          } catch (e) {
            console.error(e);
            const err = await describeError(e);
            if (active) {
              setError(err);
            }
          }
        }
      },
      [data, date]
    )
  );

  useEffect(() => {
    if (data === null) {
      return;
    }

    setTableProps(
      data.items.map((item) => ({
        journey: item.journey,
        table: {
          columnHeaders: ['Name', 'Liked'],
          rows: item.feedback.map((f) => [
            {
              csv: `${f.user.givenName} ${f.user.familyName}`.trim(),
              display: (
                <a href={`/admin/user?sub=${encodeURIComponent(f.user.sub)}`}>
                  {f.user.givenName} {f.user.familyName}
                </a>
              ),
            },
            `${f.liked ? 'Yes' : 'No'} (${f.strength})`,
          ]),
        },
      }))
    );
  }, [data]);

  if (showingPlaceholder) {
    return <AdminDashboardLargeChartPlaceholder onVisible={onPlaceholderVisible} />;
  }

  return (
    <div className={styles.container}>
      {error && <ErrorBlock>{error}</ErrorBlock>}
      <div className={styles.header}>
        <div className={styles.title}>Journey Feedback</div>
        <div className={styles.datePicker}>
          <input
            className={styles.dateInput}
            type="date"
            value={date.toISOString().split('T')[0]}
            onChange={onDateChange}
          />
        </div>
      </div>

      <div className={styles.tablesContainer}>
        {tableProps.map((props) => (
          <div className={styles.tableContainer} key={props.journey.uid}>
            <div className={styles.tableHeader}>
              <CompactJourney journey={props.journey} imageHandler={imageHandler} />
            </div>
            <DashboardTable {...props.table} minWidth={342} />
          </div>
        ))}
      </div>
    </div>
  );
};
