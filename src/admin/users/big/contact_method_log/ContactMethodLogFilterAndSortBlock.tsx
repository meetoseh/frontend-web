import { Dispatch, ReactElement, SetStateAction, useCallback, useMemo } from 'react';
import { CrudFetcherFilter, CrudFetcherSort } from '../../../crud/CrudFetcher';
import { User } from '../../User';
import { CrudFiltersBlock } from '../../../crud/CrudFiltersBlock';
import { CrudFormElement } from '../../../crud/CrudFormElement';
import styles from './ContactMethodLogFilterAndSortBlock.module.css';
import { TextInput } from '../../../../shared/forms/TextInput';
import { makeILikeFromInput, makeInputFromILike } from '../../../../shared/forms/utils';
import { Checkbox } from '../../../../shared/forms/Checkbox';
import {
  dateToLocaleISODateString,
  isoDateStringToLocaleDate,
} from '../../../../shared/lib/dateToLocaleISODateString';

type ContactMethodLogFilterAndSortBlockProps = {
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
 * The default sort for the listing
 */
export const defaultSort: CrudFetcherSort = [
  { key: 'created_at', dir: 'desc', after: null, before: null },
];

/**
 * The default filter for the listing
 */
export const createDefaultFilter = (user: User): CrudFetcherFilter => {
  return {
    user_sub: {
      operator: 'eq',
      value: user.sub,
    },
  };
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
];

/**
 * Controls the filter and sort
 */
export const ContactMethodLogFilterAndSortBlock = ({
  sort,
  setSort,
  filter,
  setFilter,
}: ContactMethodLogFilterAndSortBlockProps): ReactElement => {
  const sortName = useMemo(() => {
    return SORTS.find((s) => JSON.stringify(s.sort) === JSON.stringify(sort))!.name;
  }, [sort]);

  const channelValue = (filter.channel?.value ?? 'any') as 'any' | 'email' | 'phone' | 'push';
  const actionValue:
    | 'create_any'
    | 'create_verified'
    | 'create_unverified'
    | 'delete'
    | 'verify'
    | 'any_notifs'
    | 'enable_notifs'
    | 'disable_notifs' = (() => {
    const raw = filter.action?.value ?? 'any';
    if (raw === 'create%') {
      return 'create_any';
    }
    if (raw === '%notifs') {
      return 'any_notifs';
    }
    return raw;
  })();

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
        <CrudFormElement title="Channel">
          <select
            className={styles.select}
            value={channelValue}
            onChange={(e) => {
              const newVal = e.target.value;
              setFilter((oldFilter) => {
                const newFilter = { ...oldFilter };
                if (newVal === 'any') {
                  delete newFilter.channel;
                } else {
                  newFilter.channel = {
                    operator: 'eq',
                    value: newVal,
                  };
                }
                return newFilter;
              });
            }}>
            <option key="any" value="any">
              Any
            </option>
            <option key="email" value="email">
              Email
            </option>
            <option key="phone" value="phone">
              Phone
            </option>
            <option key="push" value="push">
              Push
            </option>
          </select>
        </CrudFormElement>
        {channelValue !== 'any' && (
          <TextInput
            label={
              {
                email: 'Email Address',
                phone: 'Phone Number',
                push: 'Push Token',
              }[channelValue] || 'Identifier'
            }
            value={makeInputFromILike(filter.identifier?.value)}
            onChange={(newVal) => {
              setFilter((oldFilter) => {
                const newFilter = { ...oldFilter };
                if (newVal === '') {
                  delete newFilter.identifier;
                } else {
                  newFilter.identifier = {
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
        )}
        <CrudFormElement title="Action">
          <select
            className={styles.select}
            value={actionValue}
            onChange={(e) => {
              const newVal = e.target.value;
              setFilter((oldFilter) => {
                const newFilter = { ...oldFilter };
                if (newVal === 'any') {
                  delete newFilter.action;
                } else if (newVal === 'create_any') {
                  newFilter.action = {
                    operator: 'ilike',
                    value: 'create%',
                  };
                } else if (newVal === 'any_notifs') {
                  newFilter.action = {
                    operator: 'ilike',
                    value: '%notifs',
                  };
                } else {
                  newFilter.action = {
                    operator: 'eq',
                    value: newVal,
                  };
                }
                return newFilter;
              });
            }}>
            <option key="any" value="any">
              Any
            </option>
            <option key="create_any" value="create%">
              Create Any
            </option>
            <option key="create_verified" value="create_verified">
              Create Verified
            </option>
            <option key="create_unverified" value="create\_unverified">
              Create Unverified
            </option>
            <option key="delete" value="delete">
              Delete
            </option>
            <option key="verify" value="verify">
              Verify
            </option>
            <option key="any_notifs" value="%notifs">
              Any Notification
            </option>
            <option key="enable_notifs" value="enable\_notifs">
              Enable Notifications
            </option>
            <option key="disable_notifs" value="disable\_notifs">
              Disable Notifications
            </option>
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
