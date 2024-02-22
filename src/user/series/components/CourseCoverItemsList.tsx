import { ReactElement, useCallback, useContext, useMemo } from 'react';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { OsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import styles from './shared.module.css';
import { InfiniteList } from '../../../shared/components/InfiniteList';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { ValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { useMappedValuesWithCallbacks } from '../../../shared/hooks/useMappedValuesWithCallbacks';
import { ExternalCourse } from '../lib/ExternalCourse';
import { useSeriesTabList } from '../hooks/useSeriesTabList';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';
import { CourseCoverItem } from './CourseCoverItem';
import { useWindowSizeValueWithCallbacks } from '../../../shared/hooks/useWindowSize';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';

export type CourseCoverItemsListProps = {
  /**
   * A function which can be called to take the user to the given course
   * then return when they are done.
   *
   * @param course The course to show.
   */
  showCourse: (course: ExternalCourse) => void;

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
 * Displays an infinite list of the given height, where the contents are courses
 * on the series tab.
 */
export const CourseCoverItemsList = ({
  showCourse,
  listHeight,
  imageHandler,
}: CourseCoverItemsListProps): ReactElement => {
  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  const loginContextRaw = useContext(LoginContext);
  const infiniteListing = useSeriesTabList(
    loginContextRaw,
    adaptValueWithCallbacksAsVariableStrategyProps(listHeight)
  );

  const boundComponent = useMemo<
    (
      item: ValueWithCallbacks<ExternalCourse>,
      setItem: (newItem: ExternalCourse) => void
    ) => ReactElement
  >(() => {
    return (item, setItem) => (
      <CourseCoverItemComponent
        gotoCourse={showCourse}
        item={item}
        setItem={setItem}
        replaceItem={infiniteListing.replaceItem.bind(infiniteListing)}
        imageHandler={imageHandler}
      />
    );
  }, [showCourse, imageHandler, infiniteListing]);

  const initialComponentHeightVWC = useMappedValueWithCallbacks(windowSizeVWC, (windowSize) => {
    const width = Math.min(342, windowSize.width - 48);
    return Math.floor(width * (427 / 342) * devicePixelRatio) / devicePixelRatio;
  });

  return (
    <RenderGuardedComponent
      props={useMappedValuesWithCallbacks(
        [listHeight, initialComponentHeightVWC],
        () => ({
          listHeight: listHeight.get(),
          initialComponentHeight: initialComponentHeightVWC.get(),
        }),
        {
          outputEqualityFn: (a, b) =>
            a.listHeight === b.listHeight && a.initialComponentHeight === b.initialComponentHeight,
        }
      )}
      component={({ listHeight, initialComponentHeight }) => (
        <InfiniteList
          listing={infiniteListing}
          component={boundComponent}
          itemComparer={compareCourses}
          height={listHeight}
          gap={10}
          initialComponentHeight={initialComponentHeight}
          emptyElement={
            <div className={styles.empty}>There are no series available right now.</div>
          }
        />
      )}
    />
  );
};

const compareCourses = (a: ExternalCourse, b: ExternalCourse): boolean => a.uid === b.uid;

const CourseCoverItemComponent = ({
  gotoCourse: gotoCourseOuter,
  item: itemVWC,
  setItem,
  replaceItem,
  imageHandler,
}: {
  gotoCourse: (course: ExternalCourse) => void;
  item: ValueWithCallbacks<ExternalCourse>;
  setItem: (item: ExternalCourse) => void;
  replaceItem: (
    isItem: (i: ExternalCourse) => boolean,
    newItem: (oldItem: ExternalCourse) => ExternalCourse
  ) => void;
  imageHandler: OsehImageStateRequestHandler;
}): ReactElement => {
  const gotoCourse = useCallback(() => {
    gotoCourseOuter(itemVWC.get());
  }, [gotoCourseOuter, itemVWC]);

  const mapItems = useCallback(
    (fn: (item: ExternalCourse) => ExternalCourse) => {
      replaceItem(() => true, fn);
    },
    [replaceItem]
  );

  return (
    <CourseCoverItem
      item={itemVWC}
      setItem={setItem}
      mapItems={mapItems}
      onClick={gotoCourse}
      imageHandler={imageHandler}
    />
  );
};
