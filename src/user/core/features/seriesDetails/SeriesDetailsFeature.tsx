import { useCallback, useContext } from 'react';
import { Callbacks, useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { Feature } from '../../models/Feature';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { ExternalCourse, externalCourseKeyMap } from '../../../series/lib/ExternalCourse';
import { defaultEqualityFn } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { apiFetch } from '../../../../shared/ApiConstants';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { useValuesWithCallbacksEffect } from '../../../../shared/hooks/useValuesWithCallbacksEffect';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { useRefreshedExternalCourse } from '../../../series/hooks/useRefreshedExternalCourse';
import { SeriesDetailsResources } from './SeriesDetailsResources';
import { SeriesDetailsState } from './SeriesDetailsState';
import { SeriesDetails } from './SeriesDetails';
import {
  MinimalCourseJourney,
  minimalCourseJourneyKeyMap,
} from '../../../favorites/lib/MinimalCourseJourney';
import { useCourseLikeState } from '../../../favorites/hooks/useCourseLikeState';
import { ModalContext } from '../../../../shared/contexts/ModalContext';

export const SeriesDetailsFeature: Feature<SeriesDetailsState, SeriesDetailsResources> = {
  identifier: 'seriesDetails',
  useWorldState() {
    const loginContextRaw = useContext(LoginContext);
    const tryingSeriesSlugVWC = useWritableValueWithCallbacks((): string | null => {
      const url = new URL(window.location.href);
      const path = url.pathname;
      if (!path.startsWith('/series/details/')) {
        return null;
      }
      const slug = path.substring('/series/details/'.length);
      if (slug.length === 0 || slug.includes('/')) {
        return null;
      }
      return slug;
    });
    const showVWC = useWritableValueWithCallbacks<ExternalCourse | null | undefined>(() =>
      tryingSeriesSlugVWC.get() === null ? null : undefined
    );

    const setShow = useCallback(
      (series: ExternalCourse | null, updateWindowHistory: boolean) => {
        if (defaultEqualityFn(series, showVWC.get())) {
          return;
        }

        if (showVWC.get() === undefined) {
          throw new Error('Cannot set show when loading');
        }

        if (series !== null) {
          setVWC(showVWC, series);
          if (updateWindowHistory) {
            window.history.pushState({}, '', `/series/details/${series.slug}`);
          }
        } else {
          setVWC(showVWC, null);
          if (updateWindowHistory) {
            window.history.pushState({}, '', `/`);
          }
        }
      },
      [showVWC]
    );

    useRefreshedExternalCourse(
      showVWC,
      useCallback(
        (newItm) => {
          setShow(newItm, newItm === null);
        },
        [setShow]
      ),
      'list'
    );

    useValuesWithCallbacksEffect([tryingSeriesSlugVWC, loginContextRaw.value], () => {
      const slugRaw = tryingSeriesSlugVWC.get();
      if (slugRaw === null) {
        if (showVWC.get() === undefined) {
          setVWC(showVWC, null);
        }
        return;
      }
      const slug = slugRaw;

      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state === 'loading') {
        return;
      } else if (loginContextUnch.state !== 'logged-in') {
        if (showVWC.get() === undefined) {
          setVWC(showVWC, null);
        }
        return;
      }
      const loginContext = loginContextUnch;

      let active = true;
      const cancelers = new Callbacks<undefined>();
      fetchSeriesBySlug();
      return () => {
        active = false;
        cancelers.call(undefined);
      };

      async function fetchSeriesBySlugInner(signal: AbortSignal | undefined) {
        const response = await apiFetch(
          '/api/1/courses/search_public?category=list',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              filters: {
                slug: {
                  operator: 'eq',
                  value: slug,
                },
              },
              limit: 1,
            }),
            signal,
          },
          loginContext
        );
        if (!active) {
          return;
        }
        if (!response.ok) {
          throw response;
        }

        const raw: { items: any[] } = await response.json();
        if (!active) {
          return;
        }
        if (raw.items.length === 0) {
          window.history.pushState({}, '', `/`);
          setVWC(showVWC, null);
          return;
        }

        const course = convertUsingMapper(raw.items[0], externalCourseKeyMap);
        if (course === null) {
          window.history.pushState({}, '', `/`);
          setVWC(showVWC, null);
          return;
        }

        setVWC(showVWC, course);
      }

      async function fetchSeriesBySlug() {
        const controller = window.AbortController ? new AbortController() : undefined;
        const signal = controller?.signal;
        const doAbort = () => controller?.abort();
        cancelers.add(doAbort);
        if (!active) {
          cancelers.remove(doAbort);
          return;
        }

        try {
          await fetchSeriesBySlugInner(signal);
        } catch (e) {
          if (active) {
            console.log(e);
            setVWC(showVWC, null);
            setVWC(tryingSeriesSlugVWC, null);
          }
        } finally {
          cancelers.remove(doAbort);
        }
      }
    });

    return useMappedValuesWithCallbacks(
      [showVWC],
      useCallback(
        () => ({
          show: showVWC.get(),
          setShow,
        }),
        [showVWC, setShow]
      )
    );
  },
  isRequired(state) {
    if (state.show === undefined) {
      return undefined;
    }
    return state.show !== null;
  },
  useResources(state, required, allStates) {
    const loginContextRaw = useContext(LoginContext);
    const modalContext = useContext(ModalContext);
    const imageHandler = useOsehImageStateRequestHandler({});
    const journeysVWC = useWritableValueWithCallbacks<MinimalCourseJourney[] | null | undefined>(
      () => undefined
    );

    const courseVWC = useMappedValuesWithCallbacks([state, required], () => {
      const req = required.get();
      if (!req) {
        return undefined;
      }

      const series = state.get().show;
      return series ?? undefined;
    });
    const courseLikeState = useCourseLikeState({
      course: courseVWC,
      modals: modalContext.modals,
      initiallyLiked: () => {
        const course = courseVWC.get();
        if (course === undefined) {
          return undefined;
        }
        return course.likedAt;
      },
    });

    useValuesWithCallbacksEffect([courseVWC, loginContextRaw.value], () => {
      const courseUnch = courseVWC.get();
      if (courseUnch === undefined) {
        return undefined;
      }
      const course = courseUnch;

      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        return undefined;
      }
      const loginContext = loginContextUnch;

      let active = true;
      const cancelers = new Callbacks<undefined>();
      fetchJourneys();
      return () => {
        active = false;
        cancelers.call(undefined);
      };

      async function fetchJourneysInner(signal: AbortSignal | undefined) {
        signal?.throwIfAborted();
        const response = await apiFetch(
          '/api/1/users/me/search_course_journeys?course_jwt=' + course.jwt,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              sort: [{ key: 'priority', dir: 'asc' }],
              limit: 150,
            }),
            signal,
          },
          loginContext
        );
        if (!response.ok) {
          throw response;
        }
        signal?.throwIfAborted();
        const data: { items: any[] } = await response.json();
        if (!active) {
          return;
        }
        signal?.throwIfAborted();

        const journeys = data.items.map((itm) =>
          convertUsingMapper(itm, minimalCourseJourneyKeyMap)
        );
        setVWC(journeysVWC, journeys);
      }

      async function fetchJourneys() {
        if (!active) {
          return;
        }

        const controller = window.AbortController ? new AbortController() : undefined;
        const signal = controller?.signal;
        const doAbort = () => controller?.abort();
        cancelers.add(doAbort);
        if (!active) {
          cancelers.remove(doAbort);
          return;
        }
        try {
          await fetchJourneysInner(signal);
        } catch (e) {
          if (!active) {
            return;
          }
          setVWC(journeysVWC, null);
        } finally {
          cancelers.remove(doAbort);
        }
      }
    });

    return useMappedValuesWithCallbacks([journeysVWC], (): SeriesDetailsResources => {
      const journeys = journeysVWC.get();
      return {
        loading: journeys === undefined,
        imageHandler,
        journeys,
        courseLikeState,
        gotoJourney(journey, course) {
          console.log('going to journey', journey);
          allStates.get().singleJourney.setShow({ type: 'generic', ref: journey });
          state.get().setShow(null, true);
        },
        gotoUpgrade() {
          const course = courseVWC.get();
          allStates
            .get()
            .upgrade.setContext(
              course !== undefined ? { type: 'series', course } : { type: 'generic' },
              true
            );
          state.get().setShow(null, false);
        },
      };
    });
  },
  component: (state, resources) => <SeriesDetails state={state} resources={resources} />,
};
