import { ReactElement } from 'react';
import { CrudFetcherFilter, CrudFetcherSort, SimpleFilterItem } from '../crud/CrudFetcher';
import styles from './CourseFilterAndSortBlock.module.css';
import { CourseFlags } from './flags/CourseFlags';
import { WritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { useMappedValueWithCallbacks } from '../../shared/hooks/useMappedValueWithCallbacks';
import { CrudFiltersBlock } from '../crud/CrudFiltersBlock';
import { CrudFormElement } from '../crud/CrudFormElement';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { setVWC } from '../../shared/lib/setVWC';
import { makeInputFromILike, setILikeFilter } from '../../shared/forms/utils';
import { TextInput } from '../../shared/forms/TextInput';
import { TogglableSmoothExpandable } from '../../shared/components/TogglableSmoothExpandable';
import { Checkbox } from '../../shared/forms/Checkbox';

type CourseFilterAndSortBlockProps = {
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
 * The default sort for the course listing
 */
export const defaultSort: CrudFetcherSort = [
  { key: 'created_at', dir: 'desc', after: null, before: null },
];

/**
 * The default filter for the course listing
 */
export const defaultFilter: CrudFetcherFilter = {
  flags: {
    mutation: {
      operator: 'and',
      value: CourseFlags.SERIES_IN_ADMIN_AREA,
    },
    comparison: {
      operator: 'neq',
      value: 0,
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
    name: 'Title (A-Z)',
    sort: [{ key: 'title', dir: 'asc', after: null, before: null }],
  },
  {
    name: 'Title (Z-A)',
    sort: [{ key: 'title', dir: 'desc', after: null, before: null }],
  },
  {
    name: 'Instructor (A-Z)',
    sort: [
      { key: 'instructor_name', dir: 'asc', after: null, before: null },
      { key: 'created_at', dir: 'desc', after: null, before: null },
    ],
  },
  {
    name: 'Instructor (Z-A)',
    sort: [
      { key: 'instructor_name', dir: 'desc', after: null, before: null },
      { key: 'created_at', dir: 'desc', after: null, before: null },
    ],
  },
];

export const FLAG_NAMES: [CourseFlags, string][] = [
  [CourseFlags.JOURNEYS_IN_SERIES_PUBLIC_SHAREABLE, 'Journeys in series public shareable'],
  [CourseFlags.JOURNEYS_IN_SERIES_CODE_SHAREABLE, 'Journeys in series code shareable'],
  [CourseFlags.SERIES_PUBLIC_SHAREABLE, 'Series public shareable'],
  [CourseFlags.SERIES_CODE_SHAREABLE, 'Series code shareable'],
  [CourseFlags.SERIES_VISIBLE_IN_OWNED, 'Series visible in owned'],
  [CourseFlags.JOURNEYS_IN_SERIES_IN_HISTORY, 'Journeys in series in history'],
  [CourseFlags.SERIES_IN_SERIES_TAB, 'Series in series tab'],
  [CourseFlags.JOURNEYS_IN_SERIES_ARE_1MINUTE, 'Journeys in series are 1 minute'],
  [CourseFlags.JOURNEYS_IN_SERIES_ARE_PREMIUM, 'Journeys in series are premium'],
  [CourseFlags.SERIES_ATTACHABLE_FOR_FREE, 'Series attachable for free'],
  [CourseFlags.SERIES_IN_ADMIN_AREA, 'Series in admin area'],
];

const FLAG_PRESETS: [CourseFlags | 0, string][] = [
  [0, 'No Filters'],
  [CourseFlags.SERIES_IN_ADMIN_AREA, 'Series in admin area'],
  [CourseFlags.SERIES_ATTACHABLE_FOR_FREE, 'Series attachable for free'],
  [CourseFlags.SERIES_IN_SERIES_TAB, 'Series in series tab'],
];
const FLAG_PRESETS_LOOKUP = new Map(FLAG_PRESETS);

/**
 * Controls the filter and sort for the course listing
 */
export const CourseFilterAndSortBlock = ({
  sort: sortVWC,
  filter: filterVWC,
}: CourseFilterAndSortBlockProps): ReactElement => {
  const sortNameVWC = useMappedValueWithCallbacks(sortVWC, (sort) => {
    const expected = JSON.stringify(sort);
    return SORTS.find((s) => JSON.stringify(s.sort) === expected)!.name;
  });

  const titleVWC = useMappedValueWithCallbacks(filterVWC, (filter) => {
    const title = filter.title as SimpleFilterItem | undefined;
    if (title === undefined) {
      return '';
    }

    return makeInputFromILike(title.value);
  });

  const instructorNameVWC = useMappedValueWithCallbacks(filterVWC, (filter) => {
    const instructorName = filter.instructor_name as SimpleFilterItem | undefined;
    if (instructorName === undefined) {
      return '';
    }

    return makeInputFromILike(instructorName.value);
  });

  const uidVWC = useMappedValueWithCallbacks(filterVWC, (filter) => {
    const uid = filter.uid as SimpleFilterItem | undefined;
    if (uid === undefined) {
      return '';
    }

    return makeInputFromILike(uid.value);
  });

  const slugVWC = useMappedValueWithCallbacks(filterVWC, (filter) => {
    const slug = filter.slug as SimpleFilterItem | undefined;
    if (slug === undefined) {
      return '';
    }

    return makeInputFromILike(slug.value);
  });

  const flagVWC = useMappedValueWithCallbacks(filterVWC, (filter) => {
    if (filter.flags === undefined) {
      return 0;
    }

    const flag = (filter as any).flags.mutation.value;
    return flag as CourseFlags;
  });

  const flagPresetVWC = useMappedValueWithCallbacks(flagVWC, (flag) => {
    return FLAG_PRESETS_LOOKUP.get(flag);
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
          props={titleVWC}
          component={(title) => (
            <TextInput
              label="Title"
              value={title}
              onChange={(newVal) => {
                setVWC(filterVWC, setILikeFilter(filterVWC.get(), 'title', newVal), Object.is);
              }}
              help={null}
              disabled={false}
              inputStyle="normal"
              html5Validation={null}
            />
          )}
        />
        <RenderGuardedComponent
          props={instructorNameVWC}
          component={(instructor) => (
            <TextInput
              label="Instructor"
              value={instructor}
              onChange={(newVal) => {
                setVWC(
                  filterVWC,
                  setILikeFilter(filterVWC.get(), 'instructor_name', newVal),
                  Object.is
                );
              }}
              help={null}
              disabled={false}
              inputStyle="normal"
              html5Validation={null}
            />
          )}
        />
        <RenderGuardedComponent
          props={slugVWC}
          component={(slug) => (
            <TextInput
              label="Slug"
              value={slug}
              onChange={(newVal) => {
                setVWC(filterVWC, setILikeFilter(filterVWC.get(), 'slug', newVal), Object.is);
              }}
              help={null}
              disabled={false}
              inputStyle="normal"
              html5Validation={null}
            />
          )}
        />
        <RenderGuardedComponent
          props={uidVWC}
          component={(uid) => (
            <TextInput
              label="UID"
              value={uid}
              onChange={(newVal) => {
                setVWC(filterVWC, setILikeFilter(filterVWC.get(), 'uid', newVal), Object.is);
              }}
              help={null}
              disabled={false}
              inputStyle="normal"
              html5Validation={null}
            />
          )}
        />
        <CrudFormElement title="Required Access Flags">
          <RenderGuardedComponent
            props={flagPresetVWC}
            component={(preset) => (
              <select
                className={styles.select}
                value={preset ?? 'custom'}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    return;
                  }

                  const parsed = parseInt(e.target.value) as CourseFlags | 0;
                  const currentFilter = filterVWC.get();
                  if (parsed === 0) {
                    if (currentFilter.flags === undefined) {
                      return;
                    }
                    const newFilters = { ...currentFilter };
                    delete newFilters.flags;
                    setVWC(filterVWC, newFilters, () => false);
                    return;
                  }

                  if (currentFilter.flags !== undefined) {
                    const currentFlag = (currentFilter as any).flags.mutation.value;
                    if (currentFlag === parsed) {
                      return;
                    }
                  }

                  setVWC(
                    filterVWC,
                    {
                      ...currentFilter,
                      flags: {
                        mutation: { operator: 'and', value: parsed },
                        comparison: { operator: 'neq', value: 0 },
                      },
                    },
                    () => false
                  );
                }}>
                <option value="custom">Custom</option>
                {FLAG_PRESETS.map(([flags, name]) => (
                  <option key={flags.toString()} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            )}
          />
          <TogglableSmoothExpandable>
            <RenderGuardedComponent
              props={flagVWC}
              component={(flag) => (
                <div className={styles.checks}>
                  {FLAG_NAMES.map(([flagValue, name]) => (
                    <Checkbox
                      key={flagValue}
                      value={(flag & flagValue) !== 0}
                      setValue={(checked) => {
                        const newFlag = checked ? flag | flagValue : flag & ~flagValue;

                        if (newFlag === flag) {
                          return;
                        }

                        if (newFlag === 0) {
                          const newFilters = { ...filterVWC.get() };
                          delete newFilters.flags;
                          setVWC(filterVWC, newFilters, () => false);
                          return;
                        }

                        setVWC(
                          filterVWC,
                          {
                            ...filterVWC.get(),
                            flags: {
                              mutation: { operator: 'and', value: newFlag },
                              comparison: { operator: 'neq', value: 0 },
                            },
                          },
                          () => false
                        );
                      }}
                      label={name}
                    />
                  ))}
                </div>
              )}
            />
          </TogglableSmoothExpandable>
        </CrudFormElement>
      </div>
    </CrudFiltersBlock>
  );
};
