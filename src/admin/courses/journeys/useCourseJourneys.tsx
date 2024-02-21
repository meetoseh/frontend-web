import { ReactElement, useCallback, useContext, useMemo } from 'react';
import {
  Callbacks,
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { CourseJourney, courseJourneyKeyMap } from './CourseJourney';
import { setVWC } from '../../../shared/lib/setVWC';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { describeError } from '../../../shared/forms/ErrorBlock';
import { useValuesWithCallbacksEffect } from '../../../shared/hooks/useValuesWithCallbacksEffect';
import { apiFetch } from '../../../shared/ApiConstants';
import { convertUsingMapper } from '../../crud/CrudFetcher';

export type UseCourseJourneysProps = {
  /**
   * The uid of the course to get the journeys for
   */
  courseUid: string;
};

export type UseCourseJourneysResult = {
  /** The journeys associated with the course, in ascending priority */
  items: ValueWithCallbacks<CourseJourney[]>;
  /** The latest error, if there is one */
  error: WritableValueWithCallbacks<ReactElement | null>;
  /** If the items are currently being fetched */
  loading: ValueWithCallbacks<boolean>;

  /** Can be called to add the given course journey to items in the appropriate spot */
  onAdd: (cj: CourseJourney) => void;
  /** Can be called to mutate the course journey with the matching uid in items, if there is one */
  onChange: (cj: CourseJourney) => void;
  /** Can be called to remove the course journey with the matching uid in items, if there is one */
  onDelete: (cj: CourseJourney) => void;
  /** Can be called to cause an attempt to refresh the items */
  refresh: () => void;
};

/**
 * Fetches the journeys associated with the given course, and the metadata
 * about the relationship
 */
export const useCourseJourneys = ({
  courseUid,
}: UseCourseJourneysProps): UseCourseJourneysResult => {
  const loginContextRaw = useContext(LoginContext);
  const items = useWritableValueWithCallbacks<CourseJourney[]>(() => []);
  const error = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const loading = useWritableValueWithCallbacks<boolean>(() => false);
  const refreshCounter = useWritableValueWithCallbacks(() => 0);

  const onAdd = useCallback(
    (item: CourseJourney) => {
      if (loading.get()) {
        throw new Error('cannot add while loading');
      }

      const raw = items.get();

      const insertIdx = raw.findIndex((i) => i.priority > item.priority);
      if (insertIdx === -1) {
        raw.push(item);
      } else {
        raw.splice(insertIdx, 0, item);
      }

      items.callbacks.call(undefined);
    },
    [items, loading]
  );

  const onDelete = useCallback(
    (item: CourseJourney) => {
      if (loading.get()) {
        throw new Error('cannot delete while loading');
      }

      const raw = items.get();
      const index = raw.findIndex((i) => i.associationUid === item.associationUid);
      if (index === -1) {
        throw new Error('cannot delete non-existent item');
      }

      raw.splice(index, 1);

      items.callbacks.call(undefined);
    },
    [items, loading]
  );

  const onChange = useCallback(
    (item: CourseJourney) => {
      if (loading.get()) {
        throw new Error('cannot change while loading');
      }

      const raw = items.get();
      const index = raw.findIndex((i) => i.associationUid === item.associationUid);
      if (index === -1) {
        throw new Error('cannot change non-existent item');
      }
      raw.splice(index, 1);
      onAdd(item);
    },
    [items, loading, onAdd]
  );

  const refresh = useCallback(() => {
    setVWC(refreshCounter, refreshCounter.get() + 1);
  }, [refreshCounter]);

  useValuesWithCallbacksEffect(
    [refreshCounter, loginContextRaw.value],
    useCallback(() => {
      // this check is mostly just to convince static analyzer we need
      // refresh counter
      if (refreshCounter.get() < 0) {
        throw new Error('refreshCounter cannot be negative');
      }

      setVWC(loading, true);
      let active = true;
      const cancelers = new Callbacks<undefined>();

      handleRefresh().finally(() => {
        if (active) {
          setVWC(loading, false);
        }
      });

      return () => {
        if (active) {
          setVWC(loading, false);
        }

        active = false;
        cancelers.call(undefined);
      };

      async function handleRefreshInner() {
        const loginContextUnch = loginContextRaw.value.get();
        if (loginContextUnch.state !== 'logged-in') {
          if (active) {
            setVWC(items, []);
          }
          return;
        }
        const loginContext = loginContextUnch;

        const controller = window.AbortController ? new window.AbortController() : null;
        const signal = controller?.signal;
        const doAbort = () => controller?.abort();
        cancelers.add(doAbort);
        if (!active) {
          cancelers.remove(doAbort);
          return;
        }

        const response = await apiFetch(
          '/api/1/courses/journeys/search',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              filters: {
                course_uid: {
                  operator: 'eq',
                  value: courseUid,
                },
              },
              sort: [{ key: 'priority', dir: 'asc' }],
              limit: 250,
              signal,
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

        if (data.next_page_sort !== null && data.next_page_sort !== undefined) {
          throw new Error('TODO: pagination for this many journeys');
        }

        const parsed = data.items.map((i: any) => convertUsingMapper(i, courseJourneyKeyMap));
        if (active) {
          setVWC(items, parsed);
        }
      }

      async function handleRefresh() {
        if (!active) {
          return;
        }

        setVWC(error, null, Object.is);
        try {
          await handleRefreshInner();
        } catch (e) {
          const desc = await describeError(e);
          if (active) {
            setVWC(error, desc);
          }
        }
      }
    }, [refreshCounter, loginContextRaw, courseUid, items, error, loading])
  );

  return useMemo(
    () => ({
      items,
      error,
      loading,
      onAdd,
      onChange,
      onDelete,
      refresh,
    }),
    [items, error, loading, onAdd, onChange, onDelete, refresh]
  );
};
