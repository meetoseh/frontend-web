import { Feature } from '../../models/Feature';
import { CourseClassesState } from './CourseClassesState';
import { CourseClassesResources } from './CourseClassesResources';
import { useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Course, courseKeyMap } from '../../../courses/models/Course';
import { LoginContext } from '../../../../shared/LoginContext';
import { JourneyRef, journeyRefKeyMap } from '../../../journey/models/JourneyRef';
import { apiFetch } from '../../../../shared/ApiConstants';
import { useSingletonEffect } from '../../../../shared/lib/useSingletonEffect';
import { convertUsingKeymap } from '../../../../admin/crud/CrudFetcher';
import { useJourneyShared } from '../../../journey/hooks/useJourneyShared';
import { useWindowSize } from '../../../../shared/hooks/useWindowSize';
import { CourseClasses } from './CourseClasses';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { useOsehImageState } from '../../../../shared/images/useOsehImageState';

/**
 * Determines when the user last decided to suppress taking the next
 * class in sequence for the given course.
 */
const getSuppressedAt = (sub: string, courseUid: string): Date | null => {
  const storedValue = localStorage.getItem(`course-${courseUid}-suppressed`);
  if (
    storedValue === undefined ||
    storedValue === null ||
    storedValue === '' ||
    storedValue[0] !== '{'
  ) {
    return null;
  }

  try {
    const parsed: { sub?: string; lastSuppressedAt?: number } = JSON.parse(storedValue);
    if (parsed.sub !== sub || parsed.lastSuppressedAt === undefined) {
      return null;
    }
    return new Date(parsed.lastSuppressedAt);
  } catch (e) {
    return null;
  }
};

/**
 * Stores that the given user suppressed taking the next class in sequence
 * for the given course.
 *
 * This also keeps track of which courses have a suppressed value, so that
 * keys can be cleaned up later.
 *
 * @param sub The sub of the user
 * @param courseUid The uid of the course
 * @param lastSuppressedAt The time the user suppressed the class, or null to
 *   remove the suppression
 */
const storeSuppressedAt = (sub: string, courseUid: string, lastSuppressedAt: Date | null) => {
  const oldCoursesRaw = localStorage.getItem('courses-suppressed');
  let oldCourses: string[] = [];
  try {
    if (
      oldCoursesRaw !== null &&
      oldCoursesRaw !== undefined &&
      oldCoursesRaw !== '' &&
      oldCoursesRaw[0] === '['
    ) {
      oldCourses = JSON.parse(oldCoursesRaw);
    }
  } catch (e) {
    // Ignore
  }

  if (lastSuppressedAt === null) {
    const index = oldCourses.indexOf(courseUid);
    if (index >= 0) {
      oldCourses.splice(index, 1);

      if (oldCourses.length === 0) {
        localStorage.removeItem('courses-suppressed');
      } else {
        localStorage.setItem('courses-suppressed', JSON.stringify(oldCourses));
      }
    }

    localStorage.removeItem(`course-${courseUid}-suppressed`);
    return;
  }

  if (!oldCourses.includes(courseUid)) {
    oldCourses.push(courseUid);
    localStorage.setItem('courses-suppressed', JSON.stringify(oldCourses));
  }

  localStorage.setItem(
    `course-${courseUid}-suppressed`,
    JSON.stringify({
      sub,
      lastSuppressedAt: lastSuppressedAt.getTime(),
    })
  );
};

const startBackgroundUid = 'oseh_if_0ykGW_WatP5-mh-0HRsrNw';

export const CourseClassesFeature: Feature<CourseClassesState, CourseClassesResources> = {
  identifier: 'courseClasses',
  useWorldState() {
    const loginContext = useContext(LoginContext);
    const thisMorning = useMemo(() => {
      const res = new Date();
      res.setHours(0, 0, 0, 0);
      return res;
    }, []);

    // The courses we still need to show, null if we're still loading them. These
    // are unsuppressed and haven't had a class too recently.
    const [courses, setCourses] = useState<Course[] | null>(null);
    const coursesLoadedFor = useRef<string | null>(null);
    const [tookCourse, setTookCourse] = useState(false);

    useSingletonEffect(
      (onDone) => {
        if (loginContext.state !== 'logged-in' || loginContext.userAttributes?.sub === undefined) {
          onDone();
          return;
        }

        const sub = loginContext.userAttributes.sub;
        if (coursesLoadedFor.current === sub) {
          onDone();
          return;
        }

        let active = true;
        loadCourses();
        return () => {
          active = false;
        };

        async function loadCoursesInner() {
          const response = await apiFetch(
            '/api/1/courses/mine',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                last_taken_at_after: thisMorning.getTime() / 1000,
              }),
            },
            loginContext
          );

          if (!response.ok) {
            throw response;
          }

          const data: { courses: any[] } = await response.json();
          const courses = data.courses.map((c) => convertUsingKeymap(c, courseKeyMap));

          const unsuppressedCourses = courses.filter((c) => {
            const suppressedAt = getSuppressedAt(sub, c.uid);
            if (suppressedAt === null) {
              return true;
            }

            if (suppressedAt.getTime() < thisMorning.getTime()) {
              return true;
            }

            return false;
          });

          if (active) {
            setCourses(unsuppressedCourses);
            setTookCourse(unsuppressedCourses.length > 0);
            coursesLoadedFor.current = sub;
          }
        }

        async function loadCourses() {
          try {
            await loadCoursesInner();
          } catch (e) {
            console.warn('Failed to load courses:', e);
            if (active) {
              setCourses([]);
            }
          } finally {
            onDone();
          }
        }
      },
      [loginContext, thisMorning]
    );

    const onDone = useCallback(
      (course: Course, journey: JourneyRef) => {
        if (courses === null) {
          console.warn('CourseClassesStep onDone without courses');
          return;
        }

        if (loginContext.state !== 'logged-in') {
          console.warn('CourseClassesStep onDone without logged-in user');
          return;
        }

        const courseIndex = courses.findIndex((c) => c.uid === course.uid);
        if (courseIndex < 0) {
          console.warn('CourseClassesStep onDone with unknown course');
          return;
        }

        advance();

        const newCourses = [...courses];
        newCourses.splice(courseIndex, 1);
        setCourses(newCourses);
        return;

        async function advanceInner() {
          const response = await apiFetch(
            '/api/1/courses/advance',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({ course_uid: course.uid, journey_uid: journey.uid }),
            },
            loginContext
          );
          if (!response.ok) {
            throw response;
          }
        }

        async function advance() {
          try {
            await advanceInner();
          } catch (e) {
            console.log(
              `Failed to advance progress in course ${course.uid} after taking journey ${journey.uid}: ${e}`
            );
          }
        }
      },
      [courses, loginContext]
    );

    const onSkip = useCallback(
      (course: Course) => {
        if (courses === null) {
          console.warn('CourseClassesStep onSkip without courses');
          return;
        }

        if (loginContext.state !== 'logged-in' || loginContext.userAttributes?.sub === undefined) {
          console.warn('CourseClassesStep onSkip without logged-in user');
          return;
        }

        const courseIndex = courses.findIndex((c) => c.uid === course.uid);
        if (courseIndex < 0) {
          console.warn('CourseClassesStep onSkip with unknown course');
          return;
        }

        storeSuppressedAt(loginContext.userAttributes.sub, course.uid, new Date());

        const newCourses = [...courses];
        newCourses.splice(courseIndex, 1);
        setCourses(newCourses);
      },
      [courses, loginContext.state, loginContext.userAttributes?.sub]
    );

    return useMemo<CourseClassesState>(
      () => ({
        course: courses === null ? undefined : courses.length === 0 ? null : courses[0],
        tookCourse,
        onDone,
        onSkip,
      }),
      [courses, onDone, onSkip, tookCourse]
    );
  },
  useResources(state, required) {
    const loginContext = useContext(LoginContext);
    const [journey, setJourney] = useState<JourneyRef | null>(null);
    const journeyShared = useJourneyShared(journey);

    const imageHandler = useOsehImageStateRequestHandler({});
    const windowSize = useWindowSize();
    const startBackground = useOsehImageState(
      {
        uid: required ? startBackgroundUid : null,
        jwt: null,
        displayWidth: windowSize.width,
        displayHeight: windowSize.height,
        alt: '',
        isPublic: true,
      },
      imageHandler
    );
    const courseCircle = useOsehImageState(
      {
        uid:
          required && state.course?.circleImage?.uid !== undefined
            ? state.course.circleImage.uid
            : null,
        jwt:
          required && state.course?.circleImage?.uid !== undefined
            ? state.course.circleImage.jwt
            : null,
        displayWidth: 189,
        displayHeight: 189,
        alt: '',
      },
      imageHandler
    );

    const journeyLoadedFor = useRef<{ sub: string; courseUid: string } | null>(null);
    useSingletonEffect(
      (onDone) => {
        if (
          !required ||
          state.course === null ||
          state.course === undefined ||
          loginContext.state !== 'logged-in' ||
          loginContext.userAttributes?.sub === undefined
        ) {
          setJourney(null);
          journeyLoadedFor.current = null;
          onDone();
          return;
        }

        const sub = loginContext.userAttributes.sub;
        const courseUid = state.course.uid;
        if (
          journeyLoadedFor.current?.sub === sub &&
          journeyLoadedFor.current?.courseUid === courseUid
        ) {
          onDone();
          return;
        }

        let active = true;
        let timeout: NodeJS.Timeout | null = null;
        let retryCount = 0;
        loadJourney();
        return () => {
          active = false;
          if (timeout !== null) {
            clearTimeout(timeout);
            timeout = null;
          }
        };

        async function loadJourneyInner() {
          const response = await apiFetch(
            '/api/1/courses/start_next',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                course_uid: courseUid,
              }),
            },
            loginContext
          );

          if (!response.ok) {
            throw response;
          }

          const journeyRaw = await response.json();
          const journey = convertUsingKeymap(journeyRaw, journeyRefKeyMap);
          if (active) {
            setJourney(journey);
            journeyLoadedFor.current = { sub, courseUid };
          }
        }

        async function loadJourney() {
          timeout = null;
          if (!active) {
            return;
          }

          try {
            await loadJourneyInner();
          } catch (e) {
            console.warn('Failed to load course journey:', e);
            if (active) {
              setJourney(null);

              if (retryCount < 4) {
                retryCount += 1;
                timeout = setTimeout(loadJourney, 1000 * Math.pow(retryCount, 2));
              } else {
                window.location.reload();
              }
            }
          } finally {
            onDone();
          }
        }
      },
      [required, state.course, loginContext]
    );

    return useMemo<CourseClassesResources>(
      () => ({
        journey,
        journeyShared,
        startBackground,
        courseCircle: courseCircle,
        loading:
          !required ||
          journey === null ||
          journeyShared.darkenedImage.loading ||
          journeyShared.audio === null ||
          !journeyShared.audio.loaded ||
          startBackground.loading ||
          courseCircle.loading,
      }),
      [journey, journeyShared, startBackground, courseCircle, required]
    );
  },
  isRequired(state) {
    if (state.course === undefined) {
      return undefined;
    }

    return state.course !== null;
  },
  component(state, resources, doAnticipateState) {
    return (
      <CourseClasses state={state} resources={resources} doAnticipateState={doAnticipateState} />
    );
  },
};
