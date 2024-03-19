import { ReactElement, useContext } from 'react';
import { WritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { CrudFetcherFilter, CrudFetcherSort, SimpleFilterItem } from '../crud/CrudFetcher';
import styles from './OnboardingVideoFilterAndSortBlock.module.css';
import { ModalContext } from '../../shared/contexts/ModalContext';
import { useMappedValueWithCallbacks } from '../../shared/hooks/useMappedValueWithCallbacks';
import { makeInputFromILike, setILikeFilter } from '../../shared/forms/utils';
import { CrudFiltersBlock } from '../crud/CrudFiltersBlock';
import { CrudFormElement } from '../crud/CrudFormElement';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { TextInput } from '../../shared/forms/TextInput';
import { setVWC } from '../../shared/lib/setVWC';
import { Checkbox } from '../../shared/forms/Checkbox';

type OnboardingVideoFilterAndSortBlockProps = {
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
 * The default sort for the onboarding video listing
 */
export const defaultSort: CrudFetcherSort = [
  { key: 'purpose_type', dir: 'asc', after: null, before: null },
  { key: 'created_at', dir: 'desc', after: null, before: null },
];

/**
 * The default filter for the onboarding video listing
 */
export const defaultFilter: CrudFetcherFilter = {
  visible_in_admin: {
    operator: 'eq',
    value: true,
  },
};

const SORTS: { name: string; sort: CrudFetcherSort }[] = [
  {
    name: 'Purpose Type A-Z',
    sort: [
      { key: 'purpose_type', dir: 'asc', after: null, before: null },
      { key: 'created_at', dir: 'desc', after: null, before: null },
    ],
  },
  {
    name: 'Purpose Type Z-A',
    sort: [
      { key: 'purpose_type', dir: 'desc', after: null, before: null },
      { key: 'created_at', dir: 'desc', after: null, before: null },
    ],
  },
  {
    name: 'Newest to Oldest',
    sort: [{ key: 'created_at', dir: 'desc', after: null, before: null }],
  },
  {
    name: 'Oldest to Newest',
    sort: [{ key: 'created_at', dir: 'asc', after: null, before: null }],
  },
];

export const OnboardingVideoFilterAndSortBlock = ({
  sort: sortVWC,
  filter: filterVWC,
}: OnboardingVideoFilterAndSortBlockProps): ReactElement => {
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

  const purposeTypeVWC = useMappedValueWithCallbacks(filterVWC, (filter) => {
    const purposeType = filter.purpose_type as SimpleFilterItem | undefined;
    if (purposeType === undefined) {
      return '';
    }

    return makeInputFromILike(purposeType.value);
  });

  const visibleInAdminVWC = useMappedValueWithCallbacks(filterVWC, (filter) => {
    const visibleInAdmin = filter.visible_in_admin as SimpleFilterItem | undefined;
    if (visibleInAdmin === undefined) {
      return false;
    }

    return visibleInAdmin.value as boolean;
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
        <RenderGuardedComponent
          props={purposeTypeVWC}
          component={(purposeType) => (
            <TextInput
              label="Purpose Type"
              value={purposeType}
              onChange={(newVal) => {
                setVWC(
                  filterVWC,
                  setILikeFilter(filterVWC.get(), 'purpose_type', newVal),
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
          props={visibleInAdminVWC}
          component={(visibleInAdmin) => (
            <Checkbox
              label="Visible In Admin"
              value={visibleInAdmin}
              setValue={(newVal) => {
                setVWC(
                  filterVWC,
                  { ...filterVWC.get(), visible_in_admin: { operator: 'eq', value: newVal } },
                  Object.is
                );
              }}
              disabled={false}
            />
          )}
        />
      </div>
    </CrudFiltersBlock>
  );
};
