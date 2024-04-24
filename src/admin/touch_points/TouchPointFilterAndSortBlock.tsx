import { ReactElement } from 'react';
import { TextInput } from '../../shared/forms/TextInput';
import { makeInputFromILike, setILikeFilter } from '../../shared/forms/utils';
import { CrudFetcherFilter, CrudFetcherSort, SimpleFilterItem } from '../crud/CrudFetcher';
import { CrudFiltersBlock } from '../crud/CrudFiltersBlock';
import { CrudFormElement } from '../crud/CrudFormElement';
import styles from './TouchPointFilterAndSortBlock.module.css';
import { WritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { useMappedValueWithCallbacks } from '../../shared/hooks/useMappedValueWithCallbacks';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { setVWC } from '../../shared/lib/setVWC';

type TouchPointFilterAndSortBlockProps = {
  /**
   * The current sort. Not all sorts are supported - this should
   * initially be the exported defaultSort and should only be set
   * by this component.
   */
  sort: WritableValueWithCallbacks<CrudFetcherSort>;

  /**
   * The current filter. Not all filters are supported - this should
   * initially be the exported defaultFilter and should only be set
   * by this component.
   */
  filter: WritableValueWithCallbacks<CrudFetcherFilter>;
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
  deleted_at: {
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
    name: 'Event Slug (A-Z)',
    sort: [{ key: 'event_slug', dir: 'asc', after: null, before: null }],
  },
  {
    name: 'Event Slug (Z-A)',
    sort: [{ key: 'event_slug', dir: 'desc', after: null, before: null }],
  },
];

/**
 * Controls the filter and sort for the touch point listing
 */
export const TouchPointFilterAndSortBlock = ({
  sort: sortVWC,
  filter: filterVWC,
}: TouchPointFilterAndSortBlockProps): ReactElement => {
  const sortNameVWC = useMappedValueWithCallbacks(sortVWC, (sort) => {
    return SORTS.find((s) => JSON.stringify(s.sort) === JSON.stringify(sort))!.name;
  });

  const eventSlugVWC = useMappedValueWithCallbacks(filterVWC, (filter) => {
    const eventSlug = filter.event_slug as SimpleFilterItem | undefined;
    if (eventSlug === undefined) {
      return '';
    }

    return makeInputFromILike(eventSlug.value);
  });

  return (
    <CrudFiltersBlock>
      <div className={styles.container}>
        <CrudFormElement title="Sort By">
          <RenderGuardedComponent
            props={sortNameVWC}
            component={(sortName) => (
              <select
                className={styles.select}
                value={sortName}
                onChange={(e) => {
                  const newSort = SORTS.find((s) => s.name === e.target.value)!.sort;
                  setVWC(sortVWC, newSort, Object.is);
                }}>
                {SORTS.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          />
        </CrudFormElement>
        <RenderGuardedComponent
          props={eventSlugVWC}
          component={(eventSlug) => (
            <TextInput
              label="Event Slug"
              value={eventSlug}
              onChange={(newVal) => {
                setVWC(filterVWC, setILikeFilter(filterVWC.get(), 'event_slug', newVal), Object.is);
              }}
              help={null}
              disabled={false}
              inputStyle="normal"
              html5Validation={null}
            />
          )}
        />
      </div>
    </CrudFiltersBlock>
  );
};
