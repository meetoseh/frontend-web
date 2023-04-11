import { ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LoginContext } from '../../shared/LoginContext';
import { Crud } from '../crud/Crud';
import { CrudFetcher, CrudFetcherFilter, CrudFetcherSort } from '../crud/CrudFetcher';
import { CrudListing } from '../crud/CrudListing';
import {
  defaultFilter,
  defaultSort,
  VipChatRequestFilterAndSortBlock,
} from './VipChatRequestFilterAndSortBlock';
import { VipChatRequest, convertVipChatRequest } from './VipChatRequest';
import { VipChatRequestBlock } from './VipChatRequestBlock';
import { CreateVipChatRequest } from './CreateVipChatRequest';

const limit = 6;
const path = '/api/1/vip_chat_requests/search';

/**
 * Shows the crud components for instructors
 */
export const VipChatRequests = (): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [items, setItems] = useState<VipChatRequest[]>([]);
  const [filters, setFilters] = useState<CrudFetcherFilter>(defaultFilter);
  const [sort, setSort] = useState<CrudFetcherSort>(defaultSort);
  const [loading, setLoading] = useState(true);
  const [haveMore, setHaveMore] = useState(false);

  const fetcher = useMemo(
    () => new CrudFetcher(path, convertVipChatRequest, setItems, setLoading, setHaveMore),
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

  const onVipChatRequestCreated = useCallback((chatRequest: VipChatRequest) => {
    setItems((i) => [...i, chatRequest]);
  }, []);

  return (
    <Crud
      title="VIP Chat Requests"
      listing={
        <CrudListing
          items={items}
          component={(i) => <VipChatRequestBlock key={i.uid} chatRequest={i} />}
          loading={loading}
          haveMore={haveMore}
          onMore={onMore}
        />
      }
      create={<CreateVipChatRequest onCreated={onVipChatRequestCreated} />}
      filters={
        <VipChatRequestFilterAndSortBlock
          sort={sort}
          setSort={setSort}
          filter={filters}
          setFilter={setFilters}
        />
      }
    />
  );
};
