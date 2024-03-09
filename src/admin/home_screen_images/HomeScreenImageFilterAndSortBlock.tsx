import { ReactElement, useCallback, useContext } from 'react';
import { CrudFetcherFilter, CrudFetcherSort, SimpleFilterItem } from '../crud/CrudFetcher';
import styles from './HomeScreenImageFilterAndSortBlock.module.css';
import {
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../shared/lib/Callbacks';
import { useMappedValueWithCallbacks } from '../../shared/hooks/useMappedValueWithCallbacks';
import { CrudFiltersBlock } from '../crud/CrudFiltersBlock';
import { CrudFormElement } from '../crud/CrudFormElement';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { setVWC } from '../../shared/lib/setVWC';
import { makeInputFromILike, setILikeFilter } from '../../shared/forms/utils';
import { TextInput } from '../../shared/forms/TextInput';
import { TogglableSmoothExpandable } from '../../shared/components/TogglableSmoothExpandable';
import { Checkbox } from '../../shared/forms/Checkbox';
import { HomeScreenImageFlags } from './flags/HomeScreenImageFlags';
import { useWorkingModal } from '../../shared/hooks/useWorkingModal';
import { ModalContext } from '../../shared/contexts/ModalContext';
import { computeFileSha512 } from '../../shared/computeFileSha512';
import { useMappedValuesWithCallbacks } from '../../shared/hooks/useMappedValuesWithCallbacks';
import { Button } from '../../shared/forms/Button';

type HomeScreenImageFilterAndSortBlockProps = {
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
      value: HomeScreenImageFlags.VISIBLE_IN_ADMIN,
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
];

export const FLAG_NAMES: [HomeScreenImageFlags, string][] = [
  [HomeScreenImageFlags.VISIBLE_MONDAY, 'Visible Monday'],
  [HomeScreenImageFlags.VISIBLE_TUESDAY, 'Visible Tuesday'],
  [HomeScreenImageFlags.VISIBLE_WEDNESDAY, 'Visible Wednesday'],
  [HomeScreenImageFlags.VISIBLE_THURSDAY, 'Visible Thursday'],
  [HomeScreenImageFlags.VISIBLE_FRIDAY, 'Visible Friday'],
  [HomeScreenImageFlags.VISIBLE_SATURDAY, 'Visible Saturday'],
  [HomeScreenImageFlags.VISIBLE_SUNDAY, 'Visible Sunday'],
  [HomeScreenImageFlags.VISIBLE_JANUARY, 'Visible January'],
  [HomeScreenImageFlags.VISIBLE_FEBRUARY, 'Visible February'],
  [HomeScreenImageFlags.VISIBLE_MARCH, 'Visible March'],
  [HomeScreenImageFlags.VISIBLE_APRIL, 'Visible April'],
  [HomeScreenImageFlags.VISIBLE_MAY, 'Visible May'],
  [HomeScreenImageFlags.VISIBLE_JUNE, 'Visible June'],
  [HomeScreenImageFlags.VISIBLE_JULY, 'Visible July'],
  [HomeScreenImageFlags.VISIBLE_AUGUST, 'Visible August'],
  [HomeScreenImageFlags.VISIBLE_SEPTEMBER, 'Visible September'],
  [HomeScreenImageFlags.VISIBLE_OCTOBER, 'Visible October'],
  [HomeScreenImageFlags.VISIBLE_NOVEMBER, 'Visible November'],
  [HomeScreenImageFlags.VISIBLE_DECEMBER, 'Visible December'],
  [HomeScreenImageFlags.VISIBLE_WITHOUT_PRO, 'Visible Without Pro'],
  [HomeScreenImageFlags.VISIBLE_WITH_PRO, 'Visible With Pro'],
  [HomeScreenImageFlags.VISIBLE_IN_ADMIN, 'Visible In Admin'],
];

const FLAG_PRESETS: [HomeScreenImageFlags | 0, string][] = [
  [0, 'No Filters'],
  [HomeScreenImageFlags.VISIBLE_IN_ADMIN, 'Visible in admin'],
  [HomeScreenImageFlags.VISIBLE_WITHOUT_PRO, 'Visible for free users'],
  [HomeScreenImageFlags.VISIBLE_WITH_PRO, 'Visible for premium users'],
  [
    HomeScreenImageFlags.VISIBLE_SUNDAY |
      HomeScreenImageFlags.VISIBLE_MONDAY |
      HomeScreenImageFlags.VISIBLE_TUESDAY |
      HomeScreenImageFlags.VISIBLE_WEDNESDAY |
      HomeScreenImageFlags.VISIBLE_THURSDAY |
      HomeScreenImageFlags.VISIBLE_FRIDAY |
      HomeScreenImageFlags.VISIBLE_SATURDAY,
    'Visible all days of week',
  ],
  [
    HomeScreenImageFlags.VISIBLE_JANUARY |
      HomeScreenImageFlags.VISIBLE_FEBRUARY |
      HomeScreenImageFlags.VISIBLE_MARCH |
      HomeScreenImageFlags.VISIBLE_APRIL |
      HomeScreenImageFlags.VISIBLE_MAY |
      HomeScreenImageFlags.VISIBLE_JUNE |
      HomeScreenImageFlags.VISIBLE_JULY |
      HomeScreenImageFlags.VISIBLE_AUGUST |
      HomeScreenImageFlags.VISIBLE_SEPTEMBER |
      HomeScreenImageFlags.VISIBLE_OCTOBER |
      HomeScreenImageFlags.VISIBLE_NOVEMBER |
      HomeScreenImageFlags.VISIBLE_DECEMBER,
    'Visible all months',
  ],
];
const FLAG_PRESETS_LOOKUP = new Map(FLAG_PRESETS);
const FLAG_PRESETS_INVERTED_LOOKUP = new Map(FLAG_PRESETS.map(([flags, name]) => [name, flags]));

/**
 * Controls the filter and sort for the home screen image listing
 */
export const HomeScreenImageFilterAndSortBlock = ({
  sort: sortVWC,
  filter: filterVWC,
}: HomeScreenImageFilterAndSortBlockProps): ReactElement => {
  const modalContext = useContext(ModalContext);

  const sortNameVWC = useMappedValueWithCallbacks(sortVWC, (sort) => {
    const expected = JSON.stringify(sort);
    return SORTS.find((s) => JSON.stringify(s.sort) === expected)!.name;
  });

  const uidVWC = useMappedValueWithCallbacks(filterVWC, (filter) => {
    const uid = filter.uid as SimpleFilterItem | undefined;
    if (uid === undefined) {
      return '';
    }

    return makeInputFromILike(uid.value);
  });

  const flagVWC = useMappedValueWithCallbacks(filterVWC, (filter) => {
    if (filter.flags === undefined) {
      return 0;
    }

    const flag = (filter as any).flags.mutation.value;
    return flag as HomeScreenImageFlags;
  });

  const flagPresetVWC = useMappedValueWithCallbacks(flagVWC, (flag) => {
    return FLAG_PRESETS_LOOKUP.get(flag);
  });

  const originalFileSHA512VWC = useMappedValueWithCallbacks(
    filterVWC,
    (filter): string | undefined => {
      const sha512 = filter.image_file_original_sha512 as SimpleFilterItem | undefined;
      if (sha512 === undefined) {
        return undefined;
      }

      return sha512.value;
    }
  );

  const originalFileInputVWC = useWritableValueWithCallbacks<HTMLInputElement | null>(() => null);
  const computingSha512FileSizeVWC = useWritableValueWithCallbacks<number | null>(() => null);
  const computingSha512VWC = useMappedValueWithCallbacks(
    computingSha512FileSizeVWC,
    (size) => size !== null
  );
  const computingSha512HashedSoFarVWC = useWritableValueWithCallbacks<number>(() => 0);
  const computingSha512ProgressFractionVWC = useMappedValuesWithCallbacks(
    [computingSha512FileSizeVWC, computingSha512HashedSoFarVWC],
    () => {
      const size = computingSha512FileSizeVWC.get();
      if (size === null || size === 0) {
        return 0;
      }
      const progressBytes = computingSha512HashedSoFarVWC.get();
      return progressBytes / size;
    }
  );
  useWorkingModal(
    modalContext.modals,
    computingSha512VWC,
    'Computing SHA512...',
    computingSha512ProgressFractionVWC,
    'nospinner' // spinner will look laggy due to the cpu usage going to the hashing
  );

  const onOriginalFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file === undefined) {
        return;
      }

      if (computingSha512FileSizeVWC.get() !== null) {
        e.preventDefault();
        return;
      }

      setVWC(computingSha512HashedSoFarVWC, 0);
      setVWC(computingSha512FileSizeVWC, file.size);
      const sha512 = await computeFileSha512(file, computingSha512HashedSoFarVWC);

      const newFilter = Object.assign({}, filterVWC.get());
      newFilter.image_file_original_sha512 = { operator: 'eq', value: sha512 };
      setVWC(filterVWC, newFilter, () => false);
      setVWC(computingSha512FileSizeVWC, null);
    },
    [computingSha512FileSizeVWC, computingSha512HashedSoFarVWC, filterVWC, originalFileSHA512VWC]
  );

  const hasDateVWC = useMappedValueWithCallbacks(filterVWC, (filter): string | null | undefined => {
    const dates = filter.dates as SimpleFilterItem | undefined;
    if (dates === undefined) {
      return undefined;
    }

    return dates.value as string | null;
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
        <CrudFormElement title="Required Flags">
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

                  const parsed = FLAG_PRESETS_INVERTED_LOOKUP.get(e.target.value);
                  const currentFilter = filterVWC.get();
                  if (parsed === 0 || parsed === undefined) {
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
        <CrudFormElement title="Original File">
          <RenderGuardedComponent
            props={originalFileSHA512VWC}
            component={(sha512) => (
              <div className={styles.fileInputContainer}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={onOriginalFileSelected}
                  ref={(r) => setVWC(originalFileInputVWC, r)}
                />

                {sha512 !== undefined && (
                  <div className={styles.sha512AndClearContainer}>
                    <div className={styles.sha512}>
                      SHA512: <code>{sha512}</code>
                    </div>
                    <div className={styles.clearButtonContainer}>
                      <Button
                        type="button"
                        variant="outlined"
                        fullWidth
                        onClick={(e) => {
                          e.preventDefault();
                          const filters = { ...filterVWC.get() };
                          delete filters.image_file_original_sha512;
                          setVWC(filterVWC, filters, () => false);
                          const input = originalFileInputVWC.get();
                          if (input !== null) {
                            input.value = '';
                          }
                        }}>
                        Clear
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          />
        </CrudFormElement>
        <CrudFormElement title="Has Date">
          <RenderGuardedComponent
            props={hasDateVWC}
            component={(hasDate) => (
              <>
                <Checkbox
                  value={hasDate !== undefined}
                  setValue={(checked) => {
                    const newFilter = { ...filterVWC.get() };
                    if (checked) {
                      newFilter.dates = { operator: 'eq', value: null };
                    } else {
                      delete newFilter.dates;
                    }
                    setVWC(filterVWC, newFilter, () => false);
                  }}
                  label="Has Date"
                />
                {hasDate !== undefined && (
                  <input
                    className={styles.dateInput}
                    type="date"
                    value={hasDate ?? ''}
                    onChange={(e) => {
                      const newValue = e.target.valueAsDate;
                      setVWC(filterVWC, {
                        ...filterVWC.get(),
                        dates: {
                          operator: 'eq',
                          value: newValue?.toISOString()?.split('T')?.[0] ?? null,
                        },
                      });
                    }}
                  />
                )}
              </>
            )}
            applyInstantly
          />
        </CrudFormElement>
      </div>
    </CrudFiltersBlock>
  );
};
