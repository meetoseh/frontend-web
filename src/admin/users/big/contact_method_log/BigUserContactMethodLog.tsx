import { ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { User } from '../../User';
import { CrudItemBlock } from '../../../crud/CrudItemBlock';
import { ContactMethodLog, contactMethodLogKeyMap } from './ContactMethodLog';
import { CrudFetcher, CrudFetcherFilter, CrudFetcherSort } from '../../../crud/CrudFetcher';
import {
  ContactMethodLogFilterAndSortBlock,
  createDefaultFilter,
  defaultSort,
} from './ContactMethodLogFilterAndSortBlock';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import styles from '../../UserBlock.module.css';
import { IconButton } from '../../../../shared/forms/IconButton';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import {
  ModalContext,
  addModalWithCallbackToRemove,
} from '../../../../shared/contexts/ModalContext';
import { ModalWrapper } from '../../../../shared/ModalWrapper';
import { CrudListing } from '../../../crud/CrudListing';
import { ContactMethodLogBlock } from './ContactMethodLogBlock';

const limit = 6;
const path = '/api/1/admin/logs/contact_method';

/**
 * Shows the contact method log block for a user, which is a block
 * that can be scrolled with a "show more" button and supports filters
 */
export const BigUserContactMethodLog = ({ user }: { user: User }): ReactElement => {
  const loginContext = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const [items, setItems] = useState<ContactMethodLog[]>([]);
  const [filters, setFilters] = useState<CrudFetcherFilter>(() => createDefaultFilter(user));
  const [sort, setSort] = useState<CrudFetcherSort>(defaultSort);
  const [loading, setLoading] = useState(true);
  const [haveMore, setHaveMore] = useState(false);
  const showingFilters = useWritableValueWithCallbacks(() => false);

  const fetcher = useMemo(
    () => new CrudFetcher(path, contactMethodLogKeyMap, setItems, setLoading, setHaveMore),
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

  useValueWithCallbacksEffect(
    showingFilters,
    useCallback(
      (showFilters) => {
        if (!showFilters) {
          return;
        }

        return addModalWithCallbackToRemove(
          modalContext.modals,
          <ModalWrapper onClosed={() => setVWC(showingFilters, false)}>
            <ContactMethodLogFilterAndSortBlock
              sort={sort}
              setSort={setSort}
              filter={filters}
              setFilter={setFilters}
            />
          </ModalWrapper>
        );
      },
      [showingFilters, modalContext.modals, sort, filters]
    )
  );

  return (
    <CrudItemBlock
      title="Contact Method Log"
      containsNested
      controls={
        <>
          <IconButton
            icon={styles.iconFilter}
            onClick={(e) => {
              e.preventDefault();
              setVWC(showingFilters, true);
            }}
            srOnlyName="Filter"
          />
        </>
      }>
      <CrudListing
        items={items}
        component={(i) => <ContactMethodLogBlock key={i.uid} contactMethodLog={i} />}
        loading={loading}
        haveMore={haveMore}
        onMore={onMore}
      />
    </CrudItemBlock>
  );
};
