import { Dispatch, ReactElement, SetStateAction, useMemo } from 'react';
import { TextInput } from '../../../shared/forms/TextInput';
import { makeILikeFromInput, makeInputFromILike } from '../../../shared/forms/utils';
import { CrudFetcherFilter, CrudFetcherSort } from '../../crud/CrudFetcher';
import { CrudFiltersBlock } from '../../crud/CrudFiltersBlock';
import { CrudFormElement } from '../../crud/CrudFormElement';
import styles from './JourneySubcategoryFilterAndSortBlock.module.css';

type JourneySubcategoryFitlerAndSortBlockProps = {
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
 * The default sort for the journey subcategory listing
 */
export const defaultSort: CrudFetcherSort = [
  { key: 'internal_name', dir: 'asc', after: null, before: null },
];

/**
 * The default filter for the journey subcategory listing
 */
export const defaultFilter: CrudFetcherFilter = {};

const SORTS: { name: string; sort: CrudFetcherSort }[] = [
  {
    name: 'Internal Name (A-Z)',
    sort: [{ key: 'internal_name', dir: 'asc', after: null, before: null }],
  },
  {
    name: 'Internal Name (Z-A)',
    sort: [{ key: 'internal_name', dir: 'desc', after: null, before: null }],
  },
  {
    name: 'External Name (A-Z)',
    sort: [{ key: 'external_name', dir: 'asc', after: null, before: null }],
  },
  {
    name: 'External Name (Z-A)',
    sort: [{ key: 'external_name', dir: 'desc', after: null, before: null }],
  },
];

export const JourneySubcategoryFilterAndSortBlock = ({
  sort,
  setSort,
  filter,
  setFilter,
}: JourneySubcategoryFitlerAndSortBlockProps): ReactElement => {
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
          label="Internal Name"
          value={makeInputFromILike(filter.internal_name?.value)}
          onChange={(newVal) => {
            setFilter((oldFilter) => {
              const newFilter = { ...oldFilter };
              if (newVal === '') {
                delete newFilter.internal_name;
              } else {
                newFilter.internal_name = {
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
          label="External Name"
          value={makeInputFromILike(filter.external_name?.value)}
          onChange={(newVal) => {
            setFilter((oldFilter) => {
              const newFilter = { ...oldFilter };
              if (newVal === '') {
                delete newFilter.external_name;
              } else {
                newFilter.external_name = {
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
