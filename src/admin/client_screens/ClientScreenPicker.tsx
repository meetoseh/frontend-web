import { ReactElement } from 'react';
import { makeILikeFromInput } from '../../shared/forms/utils';
import { CrudFetcherFilter, CrudFetcherSort } from '../crud/CrudFetcher';
import { ClientScreen, clientScreenKeyMap } from './ClientScreen';
import { ClientScreenFlags } from './ClientScreenFlags';
import { CrudPickerItem } from '../crud/CrudPickerItem';
import { CrudPicker } from '../crud/CrudPicker';

export type ClientScreenPickerProps = {
  /**
   * The current query string. This can be used to prefill the search
   */
  query: string;

  /**
   * Used to update the query string when the user types
   */
  setQuery: (this: void, query: string) => void;

  /**
   * Called in response to the user selecting an item. The query
   * is not changed automatically, so it is up to the caller to
   * update the query if desired.
   * @param item The item selected
   */
  setSelected: (this: void, item: ClientScreen) => void;

  /**
   * If the component is disabled
   */
  disabled?: boolean;
};

const sort: CrudFetcherSort = [{ key: 'slug', dir: 'asc', before: null, after: null }];

const makeFilter = (query: string): CrudFetcherFilter => {
  return {
    slug: {
      operator: 'ilike',
      value: makeILikeFromInput(query),
    },
    flags: {
      mutation: {
        operator: 'and',
        value: ClientScreenFlags.SHOWS_IN_ADMIN,
      },
      comparison: {
        operator: 'neq',
        value: 0,
      },
    },
  };
};

const makePickerComponent = (item: ClientScreen, query: string): ReactElement => {
  return <CrudPickerItem query={query} match={item.slug} />;
};

/**
 * A basic picker component where the user can type in a query and
 * auto-fill slugs of client screens, from which they can select one.
 */
export const ClientScreenPicker = ({
  query,
  setQuery,
  setSelected,
  disabled = false,
}: ClientScreenPickerProps) => {
  return (
    <CrudPicker
      path="/api/1/client_screens/search"
      keyMap={clientScreenKeyMap}
      sort={sort}
      filterMaker={makeFilter}
      component={makePickerComponent}
      query={query}
      setQuery={setQuery}
      setSelected={setSelected}
      disabled={disabled ?? false}
      variant="up"
    />
  );
};
