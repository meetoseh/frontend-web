import { Dispatch, ReactElement, SetStateAction, useMemo } from 'react';
import { TextInput } from '../../shared/forms/TextInput';
import { makeILikeFromInput, makeInputFromILike } from '../../shared/forms/utils';
import { CrudFetcherFilter, CrudFetcherSort } from '../crud/CrudFetcher';
import { CrudFiltersBlock } from '../crud/CrudFiltersBlock';
import { CrudFormElement } from '../crud/CrudFormElement';
import styles from './JourneyFilterAndSortBlock.module.css';

type JourneyFilterAndSortBlockProps = {
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
 * The default sort for the journey listing
 */
export const defaultSort: CrudFetcherSort = [
  { key: 'created_at', dir: 'desc', after: null, before: null },
];

/**
 * The default filter for the instructor listing
 */
export const defaultFilter: CrudFetcherFilter = {
  deleted_at: {
    operator: 'eq',
    value: null,
  },
  special_category: {
    operator: 'eq',
    value: null,
  },
  variation_of_journey_uid: {
    operator: 'eq',
    value: null,
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
    name: 'Title (A-Z)',
    sort: [{ key: 'title', dir: 'asc', after: null, before: null }],
  },
  {
    name: 'Title (Z-A)',
    sort: [{ key: 'title', dir: 'desc', after: null, before: null }],
  },
];

/**
 * Controls the filter and sort for the journey listing
 */
export const JourneyFilterAndSortBlock = ({
  sort,
  setSort,
  filter,
  setFilter,
}: JourneyFilterAndSortBlockProps): ReactElement => {
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
          label="Title"
          value={makeInputFromILike(filter.title?.value)}
          onChange={(newVal) => {
            setFilter((oldFilter) => {
              const newFilter = { ...oldFilter };
              if (newVal === '') {
                delete newFilter.title;
              } else {
                newFilter.title = {
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
        <CrudFormElement title="Show Deleted">
          <select
            className={styles.select}
            value={filter.deleted_at?.value === null ? 'false' : 'true'}
            onChange={(e) => {
              const newFilter = { ...filter };
              if (e.target.value === 'false') {
                newFilter.deleted_at = {
                  operator: 'eq',
                  value: null,
                };
              } else {
                delete newFilter.deleted_at;
              }
              setFilter(newFilter);
            }}>
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </CrudFormElement>
        <CrudFormElement title="Show Variations">
          <select
            className={styles.select}
            value={filter.variation_of_journey_uid?.value === null ? 'false' : 'true'}
            onChange={(e) => {
              const newFilter = { ...filter };
              if (e.target.value === 'false') {
                newFilter.variation_of_journey_uid = {
                  operator: 'eq',
                  value: null,
                };
              } else {
                delete newFilter.variation_of_journey_uid;
              }
              setFilter(newFilter);
            }}>
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </CrudFormElement>
        <CrudFormElement title="Special Category">
          <select
            className={styles.select}
            value={filter.special_category?.value ?? 'normal'}
            onChange={(e) => {
              const newFilter = { ...filter };
              if (e.target.value === 'normal') {
                newFilter.special_category = {
                  operator: 'eq',
                  value: null,
                };
              } else {
                newFilter.special_category = {
                  operator: 'eq',
                  value: e.target.value,
                };
              }
              setFilter(newFilter);
            }}>
            <option value="normal">Normal</option>
            <option value="ai">AI</option>
          </select>
        </CrudFormElement>
      </div>
    </CrudFiltersBlock>
  );
};
