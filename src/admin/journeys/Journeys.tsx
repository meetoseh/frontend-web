import { ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LoginContext } from '../../shared/LoginContext';
import {
  convertUsingKeymap,
  CrudFetcher,
  CrudFetcherFilter,
  CrudFetcherKeyMap,
  CrudFetcherSort,
} from '../crud/CrudFetcher';
import { Journey } from './Journey';
import { defaultFilter, defaultSort, JourneyFilterAndSortBlock } from './JourneyFilterAndSortBlock';
import { keyMap as journeySubcategoryKeyMap } from './subcategories/JourneySubcategories';
import { keyMap as instructorKeyMap } from '../instructors/Instructors';
import { Crud } from '../crud/Crud';
import { CrudListing } from '../crud/CrudListing';
import { JourneyBlock } from './JourneyBlock';
import { CreateJourney } from './CreateJourney';

const limit = 3;
const path = '/api/1/journeys/search';
export const keyMap: CrudFetcherKeyMap<Journey> = {
  audio_content: 'audioContent',
  background_image: 'backgroundImage',
  subcategory: (_, val) => ({
    key: 'subcategory',
    value: convertUsingKeymap(val, journeySubcategoryKeyMap),
  }),
  instructor: (_, val) => ({
    key: 'instructor',
    value: convertUsingKeymap(val, instructorKeyMap),
  }),
  created_at: (_, val) => ({ key: 'createdAt', value: new Date(val * 1000) }),
  deleted_at: (_, val) => ({ key: 'deletedAt', value: val ? new Date(val * 1000) : null }),
  daily_event_uid: 'dailyEventUID',
};

/**
 * Shows the crud components for journeys
 */
export const Journeys = (): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [items, setItems] = useState<Journey[]>([]);
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

  const onItemCreated = useCallback((item: Journey) => {
    setItems((i) => [...i, item]);
  }, []);

  return (
    <Crud
      title="Journeys"
      listing={
        <CrudListing
          items={items}
          component={(i) => (
            <JourneyBlock
              key={i.uid}
              journey={i}
              setJourney={(i) => {
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
      create={<CreateJourney onCreated={onItemCreated} />}
      filters={
        <JourneyFilterAndSortBlock
          sort={sort}
          setSort={setSort}
          filter={filters}
          setFilter={setFilters}
        />
      }
    />
  );
};
