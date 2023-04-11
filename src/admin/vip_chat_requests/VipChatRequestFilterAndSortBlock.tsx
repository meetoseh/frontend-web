import { Dispatch, ReactElement, SetStateAction, useMemo } from 'react';
import { CrudFetcherFilter, CrudFetcherSort } from '../crud/CrudFetcher';
import { CrudFiltersBlock } from '../crud/CrudFiltersBlock';
import { CrudFormElement } from '../crud/CrudFormElement';
import styles from './VipChatRequestFilterAndSortBlock.module.css';
import { makeILikeFromInput, makeInputFromILike } from '../../shared/forms/utils';
import { TextInput } from '../../shared/forms/TextInput';

type VipChatRequestFilterAndSortBlockProps = {
  /**
   * The current sort. Not all sorts are supported - this should
   * initially be the exported defaultSort and should only be set
   * by this component.
   */
  sort: CrudFetcherSort;

  /**
   * Used to set the sort.
   */
  setSort: Dispatch<SetStateAction<CrudFetcherSort>>;

  /**
   * The current filter. Not all filters are supported - this should
   * initially be the exported defaultFilter and should only be set
   * by this component.
   */
  filter: CrudFetcherFilter;

  /**
   * Used to set the filter
   */
  setFilter: Dispatch<SetStateAction<CrudFetcherFilter>>;
};

/**
 * The default sort for the instructor listing
 */
export const defaultSort: CrudFetcherSort = [
  { key: 'created_at', dir: 'desc', after: null, before: null },
];

/**
 * The default filter for the instructor listing
 */
export const defaultFilter: CrudFetcherFilter = {};

const SORTS: { name: string; sort: CrudFetcherSort }[] = [
  {
    name: 'Newest to Oldest',
    sort: [{ key: 'created_at', dir: 'desc', after: null, before: null }],
  },
  {
    name: 'Oldest to Newest',
    sort: [{ key: 'created_at', dir: 'asc', after: null, before: null }],
  },
  {
    name: 'User Name (A-Z)',
    sort: [{ key: 'user_name', dir: 'asc', after: null, before: null }],
  },
  {
    name: 'User Name (Z-A)',
    sort: [{ key: 'user_name', dir: 'desc', after: null, before: null }],
  },
  {
    name: 'User Email (A-Z)',
    sort: [{ key: 'user_email', dir: 'asc', after: null, before: null }],
  },
  {
    name: 'User Email (Z-A)',
    sort: [{ key: 'user_email', dir: 'desc', after: null, before: null }],
  },
];

/**
 * Controls the filter and sort for the vip chat request listing
 */
export const VipChatRequestFilterAndSortBlock = ({
  sort,
  setSort,
  filter,
  setFilter,
}: VipChatRequestFilterAndSortBlockProps): ReactElement => {
  const sortName = useMemo(() => {
    return SORTS.find((s) => JSON.stringify(s.sort) === JSON.stringify(sort))!.name;
  }, [sort]);

  return (
    <CrudFiltersBlock>
      <div className={styles.container}>
        <CrudFormElement title="Sort By">
          <select
            className={styles.select}
            value={sortName}
            onChange={(e) => {
              const newSort = SORTS.find((s) => s.name === e.target.value)!.sort;
              setSort(newSort);
            }}>
            {SORTS.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </CrudFormElement>
        <TextInput
          label="Name"
          value={makeInputFromILike(filter.user_name?.value)}
          onChange={(newVal) => {
            setFilter((oldFilter) => {
              const newFilter = { ...oldFilter };
              if (newVal === '') {
                delete newFilter.user_name;
              } else {
                newFilter.user_name = {
                  operator: 'ilike',
                  value: makeILikeFromInput(newVal),
                };
              }
              return newFilter;
            });
          }}
          help={null}
          disabled={false}
          inputStyle="normal"
          html5Validation={null}
        />
        <TextInput
          label="Email"
          value={makeInputFromILike(filter.user_email?.value)}
          onChange={(newVal) => {
            setFilter((oldFilter) => {
              const newFilter = { ...oldFilter };
              if (newVal === '') {
                delete newFilter.user_email;
              } else {
                newFilter.user_email = {
                  operator: 'ilike',
                  value: makeILikeFromInput(newVal),
                };
              }
              return newFilter;
            });
          }}
          help={null}
          disabled={false}
          inputStyle="normal"
          html5Validation={null}
        />
      </div>
    </CrudFiltersBlock>
  );
};
