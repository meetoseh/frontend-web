import { Dispatch, ReactElement, SetStateAction } from 'react';
import { makeILikeFromInput } from '../../../shared/forms/utils';
import { CrudFetcherFilter, CrudFetcherSort } from '../../crud/CrudFetcher';
import { CrudPicker } from '../../crud/CrudPicker';
import { CrudPickerItem } from '../../crud/CrudPickerItem';
import { JourneySubcategory } from './JourneySubcategory';
import { keyMap as journeySubcategoryKeyMap } from './JourneySubcategories';

type JourneySubcategoryPickerProps = {
  /**
   * The users current query. This can be used to prefill the search
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
  setSelected: (this: void, item: JourneySubcategory) => void;
};

/**
 * The sort for matching results
 */
const sort: CrudFetcherSort = [{ key: 'internal_name', dir: 'asc', before: null, after: null }];

/**
 * Constructs the filter for the journey subcategory picker
 * @param query The query to filter by
 * @returns The filter to use
 */
const filterMaker = (query: string): CrudFetcherFilter => {
  return {
    internal_name: {
      operator: 'ilike',
      value: makeILikeFromInput(query),
    },
  };
};

/**
 * Constructs the component that the user clicks on to pick an item
 * @param item The matching item
 * @param query The query used
 * @returns The component to allow the user to select the item
 */
const component = (item: JourneySubcategory, query: string): ReactElement => {
  return <CrudPickerItem query={query} match={item.internalName} />;
};

/**
 * A crud picker specifically for journey subcategories. When using crud picker
 * directly, it's easy to accidentally make extra requests to the server. This
 * component minimizes the number of requests made.
 */
export const JourneySubcategoryPicker = ({
  query,
  setQuery,
  setSelected,
}: JourneySubcategoryPickerProps): ReactElement => {
  return (
    <CrudPicker
      path="/api/1/journeys/subcategories/search"
      keyMap={journeySubcategoryKeyMap}
      sort={sort}
      filterMaker={filterMaker}
      component={component}
      query={query}
      setQuery={setQuery}
      setSelected={setSelected}
    />
  );
};