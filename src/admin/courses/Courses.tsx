import { ReactElement, useCallback, useContext, useMemo } from 'react';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { CrudFetcher, CrudFetcherFilter, CrudFetcherSort } from '../crud/CrudFetcher';
import { Crud } from '../crud/Crud';
import { CrudListing } from '../crud/CrudListing';
import { useOsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { useWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { Course, courseKeyMap } from './Course';
import { CourseFilterAndSortBlock, defaultFilter, defaultSort } from './CourseFilterAndSortBlock';
import { adaptValueWithCallbacksAsSetState } from '../../shared/lib/adaptValueWithCallbacksAsSetState';
import { useValuesWithCallbacksEffect } from '../../shared/hooks/useValuesWithCallbacksEffect';
import { setVWC } from '../../shared/lib/setVWC';
import { CourseBlock } from './CourseBlock';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { useMappedValuesWithCallbacks } from '../../shared/hooks/useMappedValuesWithCallbacks';
import { CreateCourse } from './CreateCourse';

const limit = 8;
const path = '/api/1/courses/search';

/**
 * Shows the crud components for courses
 */
export const Courses = (): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const itemsVWC = useWritableValueWithCallbacks<Course[]>(() => []);
  const filtersVWC = useWritableValueWithCallbacks<CrudFetcherFilter>(() => defaultFilter);
  const sortVWC = useWritableValueWithCallbacks<CrudFetcherSort>(() => defaultSort);
  const loadingVWC = useWritableValueWithCallbacks<boolean>(() => true);
  const haveMoreVWC = useWritableValueWithCallbacks<boolean>(() => false);
  const imageHandler = useOsehImageStateRequestHandler({});

  const fetcher = useMemo(
    () =>
      new CrudFetcher(
        path,
        courseKeyMap,
        adaptValueWithCallbacksAsSetState(itemsVWC),
        adaptValueWithCallbacksAsSetState(loadingVWC),
        adaptValueWithCallbacksAsSetState(haveMoreVWC)
      ),
    [itemsVWC, loadingVWC, haveMoreVWC]
  );

  useValuesWithCallbacksEffect(
    [loginContextRaw.value, filtersVWC, sortVWC],
    useCallback(() => {
      const loginContext = loginContextRaw.value.get();
      if (loginContext.state !== 'logged-in') {
        return;
      }
      return fetcher.resetAndLoadWithCancelCallback(
        filtersVWC.get(),
        sortVWC.get(),
        limit,
        loginContext,
        console.error
      );
    }, [fetcher, loginContextRaw.value, filtersVWC, sortVWC])
  );

  const onMore = useCallback(() => {
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      return;
    }
    const loginContext = loginContextUnch;
    fetcher.loadMore(filtersVWC.get(), limit, loginContext);
  }, [fetcher, filtersVWC, loginContextRaw]);

  const onItemCreated = useCallback(
    (item: Course) => {
      const existing = itemsVWC.get();
      setVWC(itemsVWC, [...existing, item], () => false);
    },
    [itemsVWC]
  );

  const listingInfoVWC = useMappedValuesWithCallbacks(
    [itemsVWC, loadingVWC, haveMoreVWC],
    useCallback(
      () => ({
        items: itemsVWC.get(),
        loading: loadingVWC.get(),
        haveMore: haveMoreVWC.get(),
      }),
      [itemsVWC, loadingVWC, haveMoreVWC]
    )
  );

  return (
    <Crud
      title="Series"
      listing={
        <RenderGuardedComponent
          props={listingInfoVWC}
          component={({ items, loading, haveMore }) => (
            <CrudListing
              items={items}
              component={(i) => (
                <CourseBlock
                  key={i.uid}
                  course={i}
                  setCourse={(i) => {
                    const items = itemsVWC.get();
                    const index = items.findIndex((item) => item.uid === i.uid);
                    if (index === -1) {
                      return;
                    }
                    const newItems = [...items];
                    newItems[index] = i;
                    setVWC(itemsVWC, newItems, () => false);
                  }}
                  imageHandler={imageHandler}
                />
              )}
              loading={loading}
              haveMore={haveMore}
              onMore={onMore}
              smallItems
            />
          )}
        />
      }
      create={<CreateCourse onCreated={onItemCreated} />}
      filters={<CourseFilterAndSortBlock sort={sortVWC} filter={filtersVWC} />}
    />
  );
};
