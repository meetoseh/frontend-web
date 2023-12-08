import { ReactElement, useCallback, useContext, useMemo, useState } from 'react';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { User, userKeyMap } from './User';
import { CrudFetcher, CrudFetcherFilter, CrudFetcherSort } from '../crud/CrudFetcher';
import { UserFilterAndSortBlock, defaultFilter, defaultSort } from './UserFilterAndSortBlock';
import { Crud } from '../crud/Crud';
import { CrudListing } from '../crud/CrudListing';
import { UserBlock } from './UserBlock';
import { useOsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';

const limit = 5;
const path = '/api/1/users/search';

/**
 * Shows the crud listing for users. Only basic information is displayed on
 * each user block, and the only control is to go to the bigger user page,
 * which shows one user's information.
 */
export const Users = (): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const [items, setItems] = useState<User[]>([]);
  const [filters, setFilters] = useState<CrudFetcherFilter>(defaultFilter);
  const [sort, setSort] = useState<CrudFetcherSort>(defaultSort);
  const [loading, setLoading] = useState(true);
  const [haveMore, setHaveMore] = useState(false);
  const imageHandler = useOsehImageStateRequestHandler({});

  const fetcher = useMemo(
    () => new CrudFetcher(path, userKeyMap, setItems, setLoading, setHaveMore),
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

  return (
    <Crud
      title="Users"
      listing={
        <CrudListing
          items={items}
          component={(i) => (
            <UserBlock
              key={i.sub}
              user={i}
              setUser={(i) => {
                setItems((items) => {
                  const index = items.findIndex((item) => item.sub === i.sub);
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
      create={<></>}
      filters={
        <UserFilterAndSortBlock
          sort={sort}
          setSort={setSort}
          filter={filters}
          setFilter={setFilters}
        />
      }
    />
  );
};
