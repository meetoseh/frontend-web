import {
  Dispatch,
  ReactElement,
  SetStateAction,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
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
import { LoginContext } from '../../shared/contexts/LoginContext';
import { apiFetch } from '../../shared/ApiConstants';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';

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

/**
 * Controls the filter and sort for the user listing
 */
export const UserFilterAndSortBlock = ({
  sort,
  setSort,
  filter,
  setFilter,
}: UserFilterAndSortBlockProps): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const [interests, setInterests] = useState<string[]>(['anxiety', 'mindful', 'sleep']);

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback((loginContextUnch) => {
      if (loginContextUnch.state !== 'logged-in') {
        return;
      }
      const loginContext = loginContextUnch;

      let active = true;
      fetchInterests();
      return () => {
        active = false;
      };

      async function fetchInterestsInner() {
        const response = await apiFetch(
          '/api/1/interests/search',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              sort: [
                {
                  key: 'slug',
                  dir: 'asc',
                  before: null,
                  after: null,
                },
              ],
              limit: 100,
            }),
          },
          loginContext
        );
        if (!response.ok) {
          throw response;
        }
        const interests: { items: { slug: string }[] } = await response.json();
        if (active) {
          setInterests(interests.items.map((i) => i.slug));
        }
      }

      async function fetchInterests() {
        try {
          await fetchInterestsInner();
        } catch (e) {
          console.warn('failed to fetch interests for filtering: ', e);
        }
      }
    }, [])
  );

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

  const [filteringUTM, utmSource, utmMedium, utmCampaign, utmTerm, utmContent] = useMemo<
    [boolean, string, string, string, string, string]
  >(() => {
    if (filter.utm === null || filter.utm === undefined) {
      return [false, '', '', '', '', ''];
    }

    if (filter.utm.operator !== 'ilike') {
      return [false, '', '', '', '', ''];
    }

    const filterRepresentation = filter.utm.value;
    const canonicalRepresentation = ((f) => {
      if (f.startsWith('%')) {
        f = f.slice(1);
      }
      // replace all % which aren't escaped with \\ with &
      let result = '';
      let lastIndex = 0;
      let escaped = false;
      for (let i = 0; i < f.length; i++) {
        if (f[i] === '%' && !escaped) {
          result += f.slice(lastIndex, i) + '&';
          lastIndex = i + 1;
        }
        escaped = f[i] === '\\' && !escaped;
      }
      result += f.slice(lastIndex);

      return result;
    })(filterRepresentation);
    const parsed = new URLSearchParams(canonicalRepresentation);

    return [
      true,
      parsed.get('utm_source') || '',
      parsed.get('utm_medium') || '',
      parsed.get('utm_campaign') || '',
      parsed.get('utm_term') || '',
      parsed.get('utm_content') || '',
    ];
  }, [filter.utm]);

  const setUTMFilter = useCallback(
    (
      checked: boolean,
      newUtmSource?: string,
      newUtmMedium?: string,
      newUtmCampaign?: string,
      newUtmTerm?: string,
      newUtmContent?: string
    ) => {
      setFilter((oldFilter) => {
        if (checked) {
          const source = newUtmSource ?? utmSource;
          const medium = newUtmMedium ?? utmMedium;
          const campaign = newUtmCampaign ?? utmCampaign;
          const term = newUtmTerm ?? utmTerm;
          const content = newUtmContent ?? utmContent;

          let searchTerm = '';
          if (campaign !== '') {
            searchTerm += `utm_campaign=${encodeURIComponent(campaign).replaceAll('%', '\\%')}%`;
          } else {
            searchTerm += '%';
          }

          if (content !== '') {
            searchTerm += `utm_content=${encodeURIComponent(content).replaceAll('%', '\\%')}%`;
          }
          if (medium !== '') {
            searchTerm += `utm_medium=${encodeURIComponent(medium).replaceAll('%', '\\%')}%`;
          }
          if (source !== '') {
            searchTerm += `utm_source=${encodeURIComponent(source).replaceAll('%', '\\%')}%`;
          }
          if (term !== '') {
            searchTerm += `utm_term=${encodeURIComponent(term).replaceAll('%', '\\%')}%`;
          }

          return {
            ...oldFilter,
            utm: {
              operator: 'ilike',
              value: searchTerm,
            },
          };
        } else {
          const res = { ...oldFilter };
          if (res.utm !== undefined) {
            delete res.utm;
          }
          return res;
        }
      });
    },
    [setFilter, utmSource, utmMedium, utmCampaign, utmTerm, utmContent]
  );

  const [filteringLastSeenAt, lastSeenAtStartDateInLocalTime, lastSeenAtEndDateInLocalTime] =
    useMemo<[boolean, Date, Date]>(() => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      if (filter.last_seen_at === null || filter.last_seen_at === undefined) {
        return [false, startOfDay, startOfDay];
      }

      if (filter.last_seen_at.operator !== 'bt') {
        return [false, startOfDay, startOfDay];
      }

      if (filter.last_seen_at.value.length !== 2) {
        return [false, startOfDay, startOfDay];
      }

      const date1 = new Date(filter.last_seen_at.value[0] * 1000);
      const date2 = new Date((filter.last_seen_at.value[1] - 86400) * 1000);
      if (isNaN(date1.getTime()) || isNaN(date2.getTime())) {
        return [false, startOfDay, startOfDay];
      }
      return [true, date1, date2];
    }, [filter.last_seen_at]);

  const setLastSeenAtFilter = useCallback(
    (checked: boolean) => {
      setFilter((oldFilter) => {
        if (checked) {
          return {
            ...oldFilter,
            last_seen_at: {
              operator: 'bt',
              value: [
                lastSeenAtStartDateInLocalTime.getTime() / 1000,
                lastSeenAtEndDateInLocalTime.getTime() / 1000 + 86400,
              ],
            },
          };
        } else {
          const res = { ...oldFilter };
          if (res.last_seen_at !== undefined) {
            delete res.last_seen_at;
          }
          return res;
        }
      });
    },
    [setFilter, lastSeenAtStartDateInLocalTime, lastSeenAtEndDateInLocalTime]
  );

  const onLastSeenAtStartDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.valueAsDate) {
        const localeDate = isoDateStringToLocaleDate(e.target.value);
        setFilter((oldFilter) => ({
          ...oldFilter,
          last_seen_at: {
            operator: 'bt',
            value: [
              localeDate.getTime() / 1000,
              lastSeenAtEndDateInLocalTime.getTime() / 1000 + 86400,
            ],
          },
        }));
      }
    },
    [setFilter, lastSeenAtEndDateInLocalTime]
  );

  const onLastSeenAtEndDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.valueAsDate) {
        const localeDate = isoDateStringToLocaleDate(e.target.value);
        setFilter((oldFilter) => ({
          ...oldFilter,
          last_seen_at: {
            operator: 'bt',
            value: [
              lastSeenAtStartDateInLocalTime.getTime() / 1000,
              localeDate.getTime() / 1000 + 86400,
            ],
          },
        }));
      }
    },
    [setFilter, lastSeenAtStartDateInLocalTime]
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
            {interests.map((pi) => (
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
        <CrudFormElement title="Last Seen">
          <Checkbox value={filteringLastSeenAt} setValue={setLastSeenAtFilter} label="Filter" />
          <div
            className={styles.fromToContainer}
            style={filteringLastSeenAt ? undefined : { display: 'none' }}>
            <CrudFormElement title="From">
              <input
                className={styles.dateInput}
                type="date"
                value={dateToLocaleISODateString(lastSeenAtStartDateInLocalTime)}
                onChange={onLastSeenAtStartDateChange}
              />
            </CrudFormElement>

            <CrudFormElement title="To">
              <input
                className={styles.dateInput}
                type="date"
                value={dateToLocaleISODateString(lastSeenAtEndDateInLocalTime)}
                onChange={onLastSeenAtEndDateChange}
              />
            </CrudFormElement>
          </div>
        </CrudFormElement>
        <CrudFormElement title="UTM">
          <Checkbox value={filteringUTM} setValue={setUTMFilter} label="Filter" />
          <div
            className={styles.utmContainer}
            style={filteringUTM ? undefined : { display: 'none' }}>
            <TextInput
              label="Source"
              value={utmSource}
              onChange={(newVal) => {
                setUTMFilter(true, newVal);
              }}
              help={null}
              disabled={false}
              inputStyle="normal"
              html5Validation={null}
            />
            <TextInput
              label="Medium"
              value={utmMedium}
              onChange={(newVal) => {
                setUTMFilter(true, undefined, newVal);
              }}
              help={null}
              disabled={false}
              inputStyle="normal"
              html5Validation={null}
            />
            <TextInput
              label="Campaign"
              value={utmCampaign}
              onChange={(newVal) => {
                setUTMFilter(true, undefined, undefined, newVal);
              }}
              help={null}
              disabled={false}
              inputStyle="normal"
              html5Validation={null}
            />
            <TextInput
              label="Term"
              value={utmTerm}
              onChange={(newVal) => {
                setUTMFilter(true, undefined, undefined, undefined, newVal);
              }}
              help={null}
              disabled={false}
              inputStyle="normal"
              html5Validation={null}
            />
            <TextInput
              label="Content"
              value={utmContent}
              onChange={(newVal) => {
                setUTMFilter(true, undefined, undefined, undefined, undefined, newVal);
              }}
              help={null}
              disabled={false}
              inputStyle="normal"
              html5Validation={null}
            />
          </div>
        </CrudFormElement>
      </div>
    </CrudFiltersBlock>
  );
};
