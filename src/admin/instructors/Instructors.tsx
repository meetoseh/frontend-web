import { ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LoginContext } from '../../shared/LoginContext';
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

const limit = 6;
const path = '/api/1/instructors/search';

export const keyMap: CrudFetcherKeyMap<Instructor> = {
  created_at: (_, val) => ({ key: 'createdAt', value: new Date(val * 1000) }),
  deleted_at: (_, val) => ({ key: 'deletedAt', value: val === null ? null : new Date(val * 1000) }),
};

export const Instructors = (): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [items, setItems] = useState<Instructor[]>([]);
  const [filters, setFilters] = useState<CrudFetcherFilter>(defaultFilter);
  const [sort, setSort] = useState<CrudFetcherSort>(defaultSort);
  const [loading, setLoading] = useState(true);
  const [haveMore, setHaveMore] = useState(false);

  const fetcher = useMemo(
    () => new CrudFetcher(path, keyMap, setItems, setLoading, setHaveMore),
    []
  );

  useEffect(() => {
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
  }, [fetcher, filters, sort, loginContext]);

  const onMore = useCallback(() => {
    fetcher.loadMore(filters, limit, loginContext);
  }, [fetcher, filters, loginContext]);

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
            />
          )}
          loading={loading}
          haveMore={haveMore}
          onMore={onMore}
        />
      }
      create={<CreateInstructor onCreated={onInstructorCreated} />}
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
