import { ReactElement } from 'react';
import { makeILikeFromInput } from '../../shared/forms/utils';
import { CrudFetcherFilter, CrudFetcherSort } from '../crud/CrudFetcher';
import { CrudPickerItem } from '../crud/CrudPickerItem';
import { CrudPicker } from '../crud/CrudPicker';
import { ClientFlow, clientFlowKeyMap } from './ClientFlow';
import { ClientFlowFlags } from './ClientFlowFlags';

export type ClientFlowPickerProps = {
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
  setSelected: (this: void, item: ClientFlow) => void;

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
        value: ClientFlowFlags.SHOWS_IN_ADMIN,
      },
      comparison: {
        operator: 'neq',
        value: 0,
      },
    },
  };
};

const makePickerComponent = (item: ClientFlow, query: string): ReactElement => {
  return <CrudPickerItem query={query} match={item.slug} />;
};

/**
 * A basic picker component where the user can type in a query and
 * auto-fill slugs of client flows, from which they can select one.
 */
export const ClientFlowPicker = ({
  query,
  setQuery,
  setSelected,
  disabled = false,
}: ClientFlowPickerProps) => {
  return (
    <CrudPicker
      path="/api/1/client_flows/search"
      keyMap={clientFlowKeyMap}
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
