import { Dispatch, ReactElement, SetStateAction, useMemo } from 'react';
import { TextInput } from '../../shared/forms/TextInput';
import { makeILikeFromInput, makeInputFromILike } from '../../shared/forms/utils';
import { BitwiseFilterItem, CrudFetcherFilter, CrudFetcherSort } from '../crud/CrudFetcher';
import { CrudFiltersBlock } from '../crud/CrudFiltersBlock';
import { CrudFormElement } from '../crud/CrudFormElement';
import styles from './InstructorFilterAndSortBlock.module.css';

type InstructorFilterAndSortBlockProps = {
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
export const defaultFilter: CrudFetcherFilter = {
  flags: {
    mutation: {
      operator: 'and',
      value: 1,
    },
    comparison: {
      operator: 'eq',
      value: 1,
    },
  },
};

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
    name: 'Name (A-Z)',
    sort: [{ key: 'name', dir: 'asc', after: null, before: null }],
  },
  {
    name: 'Name (Z-A)',
    sort: [{ key: 'name', dir: 'desc', after: null, before: null }],
  },
  {
    name: 'Bias (Most to Least)',
    sort: [
      { key: 'bias', dir: 'desc', after: null, before: null },
      { key: 'name', dir: 'asc', after: null, before: null },
    ],
  },
  {
    name: 'Bias (Least to Most)',
    sort: [
      { key: 'bias', dir: 'asc', after: null, before: null },
      { key: 'name', dir: 'asc', after: null, before: null },
    ],
  },
];

/**
 * Controls the filter and sort for the instructor listing
 */
export const InstructorFilterAndSortBlock = ({
  sort,
  setSort,
  filter,
  setFilter,
}: InstructorFilterAndSortBlockProps): ReactElement => {
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
          value={makeInputFromILike(filter.name?.value)}
          onChange={(newVal) => {
            setFilter((oldFilter) => {
              const newFilter = { ...oldFilter };
              if (newVal === '') {
                delete newFilter.name;
              } else {
                newFilter.name = {
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
        <CrudFormElement title="Flags">
          <select
            className={styles.select}
            value={(filter.flags as BitwiseFilterItem).mutation.value.toString()}
            onChange={(e) => {
              const newFilter = { ...filter };
              const newFlags = parseInt(e.target.value, 10);
              newFilter.flags = {
                mutation: {
                  operator: 'and',
                  value: newFlags,
                },
                comparison: {
                  operator: 'eq',
                  value: newFlags,
                },
              };
              setFilter(newFilter);
            }}>
            <option value="0">No Restriction</option>
            <option value="1">Shows in admin</option>
            <option value="2">Shows in Classes filter</option>
            <option value="3">Shows in admin and Classes filter</option>
          </select>
        </CrudFormElement>
      </div>
    </CrudFiltersBlock>
  );
};
