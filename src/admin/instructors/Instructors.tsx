import { ReactElement, useCallback, useContext, useMemo, useState } from 'react';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { Crud } from '../crud/Crud';
import {
  CrudFetcher,
  CrudFetcherFilter,
  CrudFetcherKeyMap,
  CrudFetcherSort,
} from '../crud/CrudFetcher';
import { CrudListing } from '../crud/CrudListing';
import { CreateInstructor } from './CreateInstructor';
import { Instructor } from './Instructor';
import { InstructorBlock } from './InstructorBlock';
import {
  defaultFilter,
  defaultSort,
  InstructorFilterAndSortBlock,
} from './InstructorFilterAndSortBlock';
import { useOsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';

const limit = 6;
const path = '/api/1/instructors/search';

export const keyMap: CrudFetcherKeyMap<Instructor> = {
  created_at: (_, val) => ({ key: 'createdAt', value: new Date(val * 1000) }),
};

/**
 * Shows the crud components for instructors
 */
export const Instructors = (): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const [items, setItems] = useState<Instructor[]>([]);
  const [filters, setFilters] = useState<CrudFetcherFilter>(defaultFilter);
  const [sort, setSort] = useState<CrudFetcherSort>(defaultSort);
  const [loading, setLoading] = useState(true);
  const [haveMore, setHaveMore] = useState(false);
  const imageHandler = useOsehImageStateRequestHandler({});

  const fetcher = useMemo(
    () => new CrudFetcher(path, keyMap, setItems, setLoading, setHaveMore),
    []
  );

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContext) => {
        if (loginContext.state !== 'logged-in') {
          return;
        }
        return fetcher.resetAndLoadWithCancelCallback(
          filters,
          sort,
          limit,
          loginContext,
          console.error
        );
      },
      [fetcher, filters, sort]
    )
  );

  const onMore = useCallback(() => {
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      return;
    }
    const loginContext = loginContextUnch;

    fetcher.loadMore(filters, limit, loginContext);
  }, [fetcher, filters, loginContextRaw]);

  const onInstructorCreated = useCallback((instructor: Instructor) => {
    setItems((i) => [...i, instructor]);
  }, []);

  return (
    <Crud
      title="Instructors"
      listing={
        <CrudListing
          items={items}
          component={(i) => (
            <InstructorBlock
              key={i.uid}
              instructor={i}
              setInstructor={(i) => {
                setItems((items) => {
                  const index = items.findIndex((item) => item.uid === i.uid);
                  if (index === -1) {
                    return items;
                  }
                  const newItems = [...items];
                  newItems[index] = i;
                  return newItems;
                });
              }}
              imageHandler={imageHandler}
            />
          )}
          loading={loading}
          haveMore={haveMore}
          onMore={onMore}
        />
      }
      create={
        <>
          <CreateInstructor onCreated={onInstructorCreated} />
        </>
      }
      filters={
        <InstructorFilterAndSortBlock
          sort={sort}
          setSort={setSort}
          filter={filters}
          setFilter={setFilters}
        />
      }
    />
  );
};
