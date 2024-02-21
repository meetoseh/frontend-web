import { Dispatch, ReactElement, SetStateAction, useMemo } from 'react';
import { makeILikeFromInput } from '../../shared/forms/utils';
import { OsehImage } from '../../shared/images/OsehImage';
import { CrudFetcherFilter, CrudFetcherSort } from '../crud/CrudFetcher';
import { CrudPickerItem } from '../crud/CrudPickerItem';
import { Instructor } from './Instructor';
import { keyMap as instructorKeyMap } from '../instructors/Instructors';
import styles from './InstructorPicker.module.css';
import { CrudPicker } from '../crud/CrudPicker';
import { OsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';

type InstructorPickerProps = {
  /**
   * The current query string. This can be used to prefill the search
   */
  query: string;

  /**
   * Used to update the query string when the user types
   */
  setQuery: Dispatch<SetStateAction<string>>;

  /**
   * Called in response to the user selecting an item. The query
   * is not changed automatically, so it is up to the caller to
   * update the query if desired.
   * @param item The item selected
   */
  setSelected: (this: void, item: Instructor) => void;

  /**
   * The handler for fetching images
   */
  imageHandler: OsehImageStateRequestHandler;

  /**
   * If the component is disabled
   */
  disabled?: boolean;
};

/**
 * The sort for the instructor crud picker
 */
const instructorSort: CrudFetcherSort = [{ key: 'name', dir: 'asc', before: null, after: null }];

/**
 * Constructs the filter for the instructor crud picker
 * @param query The query to filter by
 * @returns The filter to use
 */
const makeInstructorFilter = (query: string): CrudFetcherFilter => {
  return {
    name: {
      operator: 'ilike',
      value: makeILikeFromInput(query),
    },
    deleted_at: {
      operator: 'eq',
      value: null,
    },
  };
};

/**
 * Makes the component to render in the instructor picker
 * @param imageHandler The image handler to use
 * @param item The matching item
 * @param query The query used
 * @returns The component to allow the user to select the item
 */
const makeInstructorPickerComponent = (
  imageHandler: OsehImageStateRequestHandler,
  item: Instructor,
  query: string
): ReactElement => {
  return (
    <div className={styles.instructorContainer}>
      {item.picture !== null ? (
        <div className={styles.instructorPictureContainer}>
          <OsehImage
            uid={item.picture.uid}
            jwt={item.picture.jwt}
            displayWidth={60}
            displayHeight={60}
            alt="Profile"
            handler={imageHandler}
          />
        </div>
      ) : null}
      <CrudPickerItem query={query} match={item.name} />
    </div>
  );
};

/**
 * Shows a crud picker component for picking instructors. When using the
 * crud picker directly, it's easy to accidentally cause unnecessary
 * server requests.
 */
export const InstructorPicker = ({
  query,
  setQuery,
  setSelected,
  imageHandler,
  disabled,
}: InstructorPickerProps): ReactElement => {
  const boundMakeComponent = useMemo(
    () => makeInstructorPickerComponent.bind(undefined, imageHandler),
    [imageHandler]
  );
  return (
    <CrudPicker
      path="/api/1/instructors/search"
      keyMap={instructorKeyMap}
      sort={instructorSort}
      filterMaker={makeInstructorFilter}
      component={boundMakeComponent}
      query={query}
      setQuery={setQuery}
      setSelected={setSelected}
      disabled={disabled ?? false}
      variant="up"
    />
  );
};
