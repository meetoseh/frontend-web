import { Dispatch, ReactElement, SetStateAction, useCallback, useMemo } from 'react';
import { CrudFetcherFilter, CrudFetcherSort } from '../crud/CrudFetcher';
import { CrudFormElement } from '../crud/CrudFormElement';
import { CrudFiltersBlock } from '../crud/CrudFiltersBlock';
import styles from './UserFilterAndSortBlock.module.css';
import { makeILikeFromInput, makeInputFromILike } from '../../shared/forms/utils';
import { TextInput } from '../../shared/forms/TextInput';
import {
  dateToLocaleISODateString,
  isoDateStringToLocaleDate,
} from '../../shared/lib/dateToLocaleISODateString';
import { Checkbox } from '../../shared/forms/Checkbox';

type UserFilterAndSortBlockProps = {
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
 * The default user sort
 */
export const defaultSort: CrudFetcherSort = [
  { key: 'last_seen_at', dir: 'desc', after: null, before: null },
];

/**
 * The default user filter
 */
export const defaultFilter: CrudFetcherFilter = {};

const SORTS: { name: string; sort: CrudFetcherSort }[] = [
  {
    name: 'Recently Active',
    sort: [{ key: 'last_seen_at', dir: 'desc', after: null, before: null }],
  },
  {
    name: 'Least Recently Active',
    sort: [{ key: 'last_seen_at', dir: 'asc', after: null, before: null }],
  },
  {
    name: 'Newest to Oldest',
    sort: [{ key: 'created_at', dir: 'desc', after: null, before: null }],
  },
  {
    name: 'Oldest to Newest',
    sort: [{ key: 'created_at', dir: 'asc', after: null, before: null }],
  },
  {
    name: 'Email (A-Z)',
    sort: [{ key: 'email', dir: 'asc', after: null, before: null }],
  },
  {
    name: 'Email (Z-A)',
    sort: [{ key: 'email', dir: 'desc', after: null, before: null }],
  },
];

const INTERESTS = ['sleep', 'anxiety', 'mindful'];

/**
 * Controls the filter and sort for the user listing
 */
export const UserFilterAndSortBlock = ({
  sort,
  setSort,
  filter,
  setFilter,
}: UserFilterAndSortBlockProps): ReactElement => {
  const sortName = useMemo(() => {
    return SORTS.find((s) => JSON.stringify(s.sort) === JSON.stringify(sort))!.name;
  }, [sort]);

  const [filteringCreatedAt, createdAtStartDateInLocalTime, createdAtEndDateInLocalTime] = useMemo<
    [boolean, Date, Date]
  >(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    if (filter.created_at === null || filter.created_at === undefined) {
      return [false, startOfDay, startOfDay];
    }

    if (filter.created_at.operator !== 'bt') {
      return [false, startOfDay, startOfDay];
    }

    if (filter.created_at.value.length !== 2) {
      return [false, startOfDay, startOfDay];
    }

    const date1 = new Date(filter.created_at.value[0] * 1000);
    const date2 = new Date((filter.created_at.value[1] - 86400) * 1000);
    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) {
      return [false, startOfDay, startOfDay];
    }
    return [true, date1, date2];
  }, [filter.created_at]);

  const setCreatedAtFilter = useCallback(
    (checked: boolean) => {
      setFilter((oldFilter) => {
        if (checked) {
          return {
            ...oldFilter,
            created_at: {
              operator: 'bt',
              value: [
                createdAtStartDateInLocalTime.getTime() / 1000,
                createdAtEndDateInLocalTime.getTime() / 1000 + 86400,
              ],
            },
          };
        } else {
          const res = { ...oldFilter };
          if (res.created_at !== undefined) {
            delete res.created_at;
          }
          return res;
        }
      });
    },
    [setFilter, createdAtStartDateInLocalTime, createdAtEndDateInLocalTime]
  );

  const onCreatedAtStartDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.valueAsDate) {
        const localeDate = isoDateStringToLocaleDate(e.target.value);
        setFilter((oldFilter) => ({
          ...oldFilter,
          created_at: {
            operator: 'bt',
            value: [
              localeDate.getTime() / 1000,
              createdAtEndDateInLocalTime.getTime() / 1000 + 86400,
            ],
          },
        }));
      }
    },
    [setFilter, createdAtEndDateInLocalTime]
  );

  const onCreatedAtEndDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.valueAsDate) {
        const localeDate = isoDateStringToLocaleDate(e.target.value);
        setFilter((oldFilter) => ({
          ...oldFilter,
          created_at: {
            operator: 'bt',
            value: [
              createdAtStartDateInLocalTime.getTime() / 1000,
              localeDate.getTime() / 1000 + 86400,
            ],
          },
        }));
      }
    },
    [setFilter, createdAtStartDateInLocalTime]
  );

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
          label="Email"
          value={makeInputFromILike(filter.email?.value)}
          onChange={(newVal) => {
            setFilter((oldFilter) => {
              const newFilter = { ...oldFilter };
              if (newVal === '') {
                delete newFilter.email;
              } else {
                newFilter.email = {
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
        <TextInput
          label="Phone Number"
          value={makeInputFromILike(filter.phone_number?.value)}
          onChange={(newVal) => {
            setFilter((oldFilter) => {
              const newFilter = { ...oldFilter };
              if (newVal === '') {
                delete newFilter.phone_number;
              } else {
                newFilter.phone_number = {
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
        <CrudFormElement title="Primary Interest">
          <select
            className={styles.select}
            value={filter.primary_interest?.value ?? ''}
            onChange={(e) => {
              setFilter((oldFilter) => {
                const newFilter = { ...oldFilter };
                if (e.target.value === '') {
                  delete newFilter.primary_interest;
                } else {
                  newFilter.primary_interest = {
                    operator: 'eq',
                    value: e.target.value,
                  };
                }
                return newFilter;
              });
            }}>
            <option value="">All</option>
            {INTERESTS.map((pi) => (
              <option key={pi} value={pi}>
                {pi}
              </option>
            ))}
          </select>
        </CrudFormElement>
        <CrudFormElement title="Created">
          <Checkbox value={filteringCreatedAt} setValue={setCreatedAtFilter} label="Filter" />
          <div
            className={styles.fromToContainer}
            style={filteringCreatedAt ? undefined : { display: 'none' }}>
            <CrudFormElement title="From">
              <input
                className={styles.dateInput}
                type="date"
                value={dateToLocaleISODateString(createdAtStartDateInLocalTime)}
                onChange={onCreatedAtStartDateChange}
              />
            </CrudFormElement>

            <CrudFormElement title="To">
              <input
                className={styles.dateInput}
                type="date"
                value={dateToLocaleISODateString(createdAtEndDateInLocalTime)}
                onChange={onCreatedAtEndDateChange}
              />
            </CrudFormElement>
          </div>
        </CrudFormElement>
      </div>
    </CrudFiltersBlock>
  );
};
