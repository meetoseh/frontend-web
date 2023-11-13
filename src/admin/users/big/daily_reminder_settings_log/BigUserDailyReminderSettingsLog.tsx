import { ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { User } from '../../User';
import { CrudItemBlock } from '../../../crud/CrudItemBlock';
import {
  DailyReminderSettingsLog,
  dailyReminderSettingsLogKeyMap,
} from './DailyReminderSettingsLog';
import { CrudFetcher, CrudFetcherFilter, CrudFetcherSort } from '../../../crud/CrudFetcher';
import {
  DailyReminderSettingsLogFilterAndSortBlock,
  createDefaultFilter,
  defaultSort,
} from './DailyReminderSettingsLogFilterAndSortBlock';
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
import { DailyReminderSettingsLogBlock } from './DailyReminderSettingsLogBlock';

const limit = 6;
const path = '/api/1/admin/logs/daily_reminder_settings';

/**
 * Shows the contact method log block for a user, which is a block
 * that can be scrolled with a "show more" button and supports filters
 */
export const BigUserDailyReminderSettingsLog = ({ user }: { user: User }): ReactElement => {
  const loginContext = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const [items, setItems] = useState<DailyReminderSettingsLog[]>([]);
  const [filters, setFilters] = useState<CrudFetcherFilter>(() => createDefaultFilter(user));
  const [sort, setSort] = useState<CrudFetcherSort>(defaultSort);
  const [loading, setLoading] = useState(true);
  const [haveMore, setHaveMore] = useState(false);
  const showingFilters = useWritableValueWithCallbacks(() => false);

  const fetcher = useMemo(
    () => new CrudFetcher(path, dailyReminderSettingsLogKeyMap, setItems, setLoading, setHaveMore),
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
            <DailyReminderSettingsLogFilterAndSortBlock
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
      title="Daily Reminder Settings Log"
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
        component={(i) => <DailyReminderSettingsLogBlock key={i.uid} log={i} />}
        loading={loading}
        haveMore={haveMore}
        onMore={onMore}
      />
    </CrudItemBlock>
  );
};
