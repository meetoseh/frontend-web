import { ReactElement, useCallback, useContext, useMemo, useState } from 'react';
import { LoginContext } from '../../shared/contexts/LoginContext';
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
import { useOsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';

const limit = 3;
const path = '/api/1/journeys/search';
export const keyMap: CrudFetcherKeyMap<Journey> = {
  audio_content: 'audioContent',
  background_image: 'backgroundImage',
  blurred_background_image: 'blurredBackgroundImage',
  darkened_background_image: 'darkenedBackgroundImage',
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
  special_category: 'specialCategory',
  variation_of_journey_uid: 'variationOfJourneyUID',
};

/**
 * Shows the crud components for journeys
 */
export const Journeys = (): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const [items, setItems] = useState<Journey[]>([]);
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
              imageHandler={imageHandler}
            />
          )}
          loading={loading}
          haveMore={haveMore}
          onMore={onMore}
        />
      }
      create={<CreateJourney onCreated={onItemCreated} imageHandler={imageHandler} />}
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
