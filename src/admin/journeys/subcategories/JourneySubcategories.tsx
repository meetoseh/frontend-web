import { ReactElement, useCallback, useContext, useMemo, useState } from 'react';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { Crud } from '../../crud/Crud';
import {
  CrudFetcher,
  CrudFetcherFilter,
  CrudFetcherKeyMap,
  CrudFetcherSort,
} from '../../crud/CrudFetcher';
import { CrudListing } from '../../crud/CrudListing';
import { CreateJourneySubcategory } from './CreateJourneySubcategory';
import { JourneySubcategory } from './JourneySubcategory';
import { JourneySubcategoryBlock } from './JourneySubcategoryBlock';
import {
  defaultFilter,
  defaultSort,
  JourneySubcategoryFilterAndSortBlock,
} from './JourneySubcategoryFilterAndSortBlock';
import { useValueWithCallbacksEffect } from '../../../shared/hooks/useValueWithCallbacksEffect';

const limit = 6;
const path = '/api/1/journeys/subcategories/search';

export const keyMap: CrudFetcherKeyMap<JourneySubcategory> = {
  internal_name: 'internalName',
  external_name: 'externalName',
};

/**
 * Shows the crud components for journey subcategories
 */
export const JourneySubcategories = (): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const [items, setItems] = useState<JourneySubcategory[]>([]);
  const [filters, setFilters] = useState<CrudFetcherFilter>(defaultFilter);
  const [sort, setSort] = useState<CrudFetcherSort>(defaultSort);
  const [loading, setLoading] = useState(true);
  const [haveMore, setHaveMore] = useState(false);

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

  const onItemCreated = useCallback((item: JourneySubcategory) => {
    setItems((i) => [...i, item]);
  }, []);

  const onMore = useCallback(() => {
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      return;
    }
    const loginContext = loginContextUnch;
    fetcher.loadMore(filters, limit, loginContext);
  }, [fetcher, filters, loginContextRaw.value]);

  return (
    <Crud
      title="Journey Categorization"
      listing={
        <CrudListing
          items={items}
          component={(i) => (
            <JourneySubcategoryBlock
              key={i.uid}
              journeySubcategory={i}
              setJourneySubcategory={(i) => {
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
      create={<CreateJourneySubcategory onCreated={onItemCreated} />}
      filters={
        <JourneySubcategoryFilterAndSortBlock
          sort={sort}
          setSort={setSort}
          filter={filters}
          setFilter={setFilters}
        />
      }
    />
  );
};
