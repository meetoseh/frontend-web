import { ReactElement } from 'react';
import { TextInput } from '../../shared/forms/TextInput';
import { makeInputFromILike, setILikeFilter } from '../../shared/forms/utils';
import { CrudFetcherFilter, CrudFetcherSort, SimpleFilterItem } from '../crud/CrudFetcher';
import { CrudFiltersBlock } from '../crud/CrudFiltersBlock';
import { CrudFormElement } from '../crud/CrudFormElement';
import styles from './ClientFlowFilterAndSortBlock.module.css';
import { WritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { useMappedValueWithCallbacks } from '../../shared/hooks/useMappedValueWithCallbacks';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { setVWC } from '../../shared/lib/setVWC';
import { TogglableSmoothExpandable } from '../../shared/components/TogglableSmoothExpandable';
import { Checkbox } from '../../shared/forms/Checkbox';
import { ClientFlowFlags } from './ClientFlowFlags';

type ClientFlowFilterAndSortBlockProps = {
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
  flags: {
    mutation: {
      operator: 'and',
      value: ClientFlowFlags.SHOWS_IN_ADMIN,
    },
    comparison: {
      operator: 'neq',
      value: 0,
    },
  },
};

const SORTS: { name: string; sort: CrudFetcherSort }[] = [
  {
    name: 'Name (A-Z)',
    sort: [
      { key: 'name', dir: 'asc', after: null, before: null },
      { key: 'slug', dir: 'asc', after: null, before: null },
    ],
  },
  {
    name: 'Name (Z-A)',
    sort: [
      { key: 'name', dir: 'desc', after: null, before: null },
      { key: 'slug', dir: 'desc', after: null, before: null },
    ],
  },
  {
    name: 'Created (Newest First)',
    sort: [{ key: 'created_at', dir: 'desc', after: null, before: null }],
  },
  {
    name: 'Created (Oldest First)',
    sort: [{ key: 'created_at', dir: 'asc', after: null, before: null }],
  },
];

export const FLAG_NAMES: [ClientFlowFlags, string][] = [
  [ClientFlowFlags.SHOWS_IN_ADMIN, 'Shows in admin'],
  [ClientFlowFlags.IS_CUSTOM, 'Can be edited'],
  [ClientFlowFlags.BROWSER_TRIGGERABLE, 'Triggerable by browser clients'],
  [ClientFlowFlags.IOS_TRIGGERABLE, 'Triggerable by ios clients'],
  [ClientFlowFlags.ANDROID_TRIGGERABLE, 'Triggerable by android clients'],
];

const FLAG_PRESETS: [ClientFlowFlags | 0, string][] = [
  [0, 'No Filters'],
  [ClientFlowFlags.SHOWS_IN_ADMIN, 'Shows in admin'],
  [ClientFlowFlags.SHOWS_IN_ADMIN | ClientFlowFlags.IS_CUSTOM, 'Custom Flows'],
];
export const FLAG_PRESETS_LOOKUP = new Map(FLAG_PRESETS);

/**
 * Controls the filter and sort for the client flow listing
 */
export const ClientFlowFilterAndSortBlock = ({
  sort: sortVWC,
  filter: filterVWC,
}: ClientFlowFilterAndSortBlockProps): ReactElement => {
  const sortNameVWC = useMappedValueWithCallbacks(sortVWC, (sort) => {
    return SORTS.find((s) => JSON.stringify(s.sort) === JSON.stringify(sort))!.name;
  });

  const slugVWC = useMappedValueWithCallbacks(filterVWC, (filter) => {
    const slug = filter.slug as SimpleFilterItem | undefined;
    if (slug === undefined) {
      return '';
    }

    return makeInputFromILike(slug.value);
  });

  const nameVWC = useMappedValueWithCallbacks(filterVWC, (filter) => {
    const name = filter.name as SimpleFilterItem | undefined;
    if (name === undefined) {
      return '';
    }

    return makeInputFromILike(name.value);
  });

  const flagVWC = useMappedValueWithCallbacks(filterVWC, (filter) => {
    if (filter.flags === undefined) {
      return 0;
    }

    const flag = (filter as any).flags.mutation.value;
    return flag as ClientFlowFlags;
  });

  const flagPresetVWC = useMappedValueWithCallbacks(flagVWC, (flag) => {
    return FLAG_PRESETS_LOOKUP.has(flag) ? flag.toString() : 'custom';
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
          props={nameVWC}
          component={(name) => (
            <TextInput
              label="Name"
              value={name}
              onChange={(newVal) => {
                setVWC(filterVWC, setILikeFilter(filterVWC.get(), 'name', newVal), Object.is);
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

                  const parsed = parseInt(e.target.value) as ClientFlowFlags | 0;
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
                  <option key={flags.toString()} value={flags.toString()}>
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
