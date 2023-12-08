import { ReactElement, useCallback, useContext, useMemo, useRef } from 'react';
import { JourneyRef, journeyRefKeyMap } from '../../journey/models/JourneyRef';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { OsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { InfiniteListing, NetworkedInfiniteListing } from '../../../shared/lib/InfiniteListing';
import { apiFetch } from '../../../shared/ApiConstants';
import { convertUsingKeymap } from '../../../admin/crud/CrudFetcher';
import styles from './shared.module.css';
import { InfiniteList } from '../../../shared/components/InfiniteList';
import { MinimalCourseJourney, minimalCourseJourneyKeyMap } from '../lib/MinimalCourseJourney';
import { CourseJourneyItem } from './CourseJourneyItem';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { ValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { useMappedValuesWithCallbacks } from '../../../shared/hooks/useMappedValuesWithCallbacks';

export type CourseJourneysListProps = {
  /**
   * A function which can be called to take the user to the given journey
   * then return when they are done.
   *
   * @param journey The journey to show.
   */
  showJourney: (journey: JourneyRef) => void;

  /**
   * The height of the list in logical pixels
   */
  listHeight: ValueWithCallbacks<number>;

  /**
   * The handler to use to fetch images.
   */
  imageHandler: OsehImageStateRequestHandler;
};

/**
 * Displays an infinite list of the given height, where the contents are journeys
 * within courses that the user owns.
 */
export const CourseJourneysList = ({
  showJourney,
  listHeight,
  imageHandler,
}: CourseJourneysListProps): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const infiniteListing = useMemo<InfiniteListing<MinimalCourseJourney>>(() => {
    const numVisible = Math.ceil(listHeight.get() / 85) * 25;
    const result = new NetworkedInfiniteListing<MinimalCourseJourney>(
      '/api/1/users/me/search_course_journeys',
      Math.min(numVisible * 2 + 10, 150),
      numVisible,
      10,
      {},
      [
        {
          key: 'joined_course_at',
          dir: 'desc',
          before: null,
          after: null,
        },
        {
          key: 'course_uid',
          dir: 'asc',
          before: null,
          after: null,
        },
        {
          key: 'priority',
          dir: 'asc',
          before: null,
          after: null,
        },
        {
          key: 'association_uid',
          dir: 'asc',
          before: null,
          after: null,
        },
      ],
      (item, dir) => {
        return [
          {
            key: 'joined_course_at',
            dir: dir === 'before' ? 'asc' : 'desc',
            before: null,
            after: item.joinedCourseAt.toLocaleString(),
          },
          {
            key: 'course_uid',
            dir: dir === 'before' ? 'desc' : 'asc',
            before: null,
            after: item.course.uid,
          },
          {
            key: 'priority',
            dir: dir === 'before' ? 'desc' : 'asc',
            before: null,
            after: item.priority,
          },
          {
            key: 'association_uid',
            dir: dir === 'before' ? 'desc' : 'asc',
            before: null,
            after: item.associationUid,
          },
        ];
      },
      minimalCourseJourneyKeyMap,
      loginContextRaw
    );
    result.reset();
    return result;
  }, [listHeight, loginContextRaw]);

  const loading = useRef<boolean>(false);
  const gotoJourneyInCourse = useCallback(
    async (journeyUid: string, courseUid: string) => {
      if (loading.current) {
        return;
      }
      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        return;
      }
      const loginContext = loginContextUnch;

      loading.current = true;
      try {
        const response = await apiFetch(
          '/api/1/courses/start_journey',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              journey_uid: journeyUid,
              course_uid: courseUid,
            }),
          },
          loginContext
        );
        if (!response.ok) {
          console.log(
            'failed to start journey from course:',
            response.status,
            await response.text()
          );
          return;
        }
        const raw = await response.json();
        const journey = convertUsingKeymap(raw, journeyRefKeyMap);
        showJourney(journey);
      } finally {
        loading.current = false;
      }
    },
    [loginContextRaw, showJourney]
  );

  const boundComponent = useMemo<
    (
      item: ValueWithCallbacks<MinimalCourseJourney>,
      setItem: (newItem: MinimalCourseJourney) => void,
      previous: ValueWithCallbacks<MinimalCourseJourney | null>
    ) => ReactElement
  >(() => {
    return (item, setItem, previous) => (
      <CourseJourneyItemComponent
        gotoJourneyInCourse={gotoJourneyInCourse}
        item={item}
        setItem={setItem}
        replaceItem={infiniteListing.replaceItem.bind(infiniteListing)}
        previous={previous}
        instructorImages={imageHandler}
      />
    );
  }, [gotoJourneyInCourse, imageHandler, infiniteListing]);

  return (
    <RenderGuardedComponent
      props={listHeight}
      component={(listHeight) => (
        <InfiniteList
          listing={infiniteListing}
          component={boundComponent}
          itemComparer={compareHistoryItems}
          height={listHeight}
          gap={10}
          initialComponentHeight={75}
          emptyElement={
            <div className={styles.empty}>You haven&rsquo;t purchased any classes yet.</div>
          }
        />
      )}
    />
  );
};

const compareHistoryItems = (a: MinimalCourseJourney, b: MinimalCourseJourney): boolean =>
  a.associationUid === b.associationUid;

const CourseJourneyItemComponent = ({
  gotoJourneyInCourse,
  item: itemVWC,
  setItem,
  replaceItem,
  previous: previousVWC,
  instructorImages,
}: {
  gotoJourneyInCourse: (journeyUid: string, courseUid: string) => Promise<void>;
  item: ValueWithCallbacks<MinimalCourseJourney>;
  setItem: (item: MinimalCourseJourney) => void;
  replaceItem: (
    isItem: (i: MinimalCourseJourney) => boolean,
    newItem: (oldItem: MinimalCourseJourney) => MinimalCourseJourney
  ) => void;
  previous: ValueWithCallbacks<MinimalCourseJourney | null>;
  instructorImages: OsehImageStateRequestHandler;
}): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const gotoJourney = useCallback(async () => {
    const item = itemVWC.get();
    await gotoJourneyInCourse(item.journey.uid, item.course.uid);

    if (item.isNext) {
      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state === 'logged-in') {
        apiFetch(
          '/api/1/courses/advance',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              course_uid: item.course.uid,
              journey_uid: item.journey.uid,
            }),
          },
          loginContextUnch
        );
      }
    }
  }, [gotoJourneyInCourse, loginContextRaw, itemVWC]);
  const mapItems = useCallback(
    (fn: (item: MinimalCourseJourney) => MinimalCourseJourney) => {
      replaceItem(() => true, fn);
    },
    [replaceItem]
  );

  const separatorVWC = useMappedValuesWithCallbacks([itemVWC, previousVWC], () => {
    const previous = previousVWC.get();
    const item = itemVWC.get();

    return previous === null || previous.course.uid !== item.course.uid;
  });

  return (
    <CourseJourneyItem
      item={itemVWC}
      setItem={setItem}
      mapItems={mapItems}
      separator={separatorVWC}
      onClick={gotoJourney}
      instructorImages={instructorImages}
    />
  );
};
