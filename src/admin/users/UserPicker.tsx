import { ReactElement } from 'react';
import { makeILikeFromInput } from '../../shared/forms/utils';
import { CrudFetcherFilter, CrudFetcherSort, convertUsingMapper } from '../crud/CrudFetcher';
import { CrudPickerItem } from '../crud/CrudPickerItem';
import { CrudPicker } from '../crud/CrudPicker';
import { User, userKeyMap } from './User';

export type UserPickerProps = {
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
  setSelected: (this: void, item: User) => void;

  /**
   * If the component is disabled
   */
  disabled?: boolean;
};

const sort: CrudFetcherSort = [{ key: 'last_seen_at', dir: 'desc', before: null, after: null }];

const makeFilter = (query: string): CrudFetcherFilter => {
  return {
    name: {
      operator: 'ilike',
      value: makeILikeFromInput(query),
    },
  };
};

const makePickerComponent = (item: User, query: string): ReactElement => {
  return (
    <CrudPickerItem
      query={query}
      match={`${item.givenName} ${
        item.familyName
      } (created ${item.createdAt.toLocaleDateString()})`}
    />
  );
};

/**
 * A basic picker component where the user can type in a query and
 * auto-fill names of users, from which they can select one.
 */
export const UserPicker = ({ query, setQuery, setSelected, disabled = false }: UserPickerProps) => {
  return (
    <CrudPicker
      path="/api/1/users/search"
      keyMap={(raw: any): User & { uid: string } => {
        const res = convertUsingMapper(raw, userKeyMap) as User & { uid: string };
        res.uid = res.sub;
        return res;
      }}
      sort={sort}
      filterMaker={makeFilter}
      component={makePickerComponent}
      query={query}
      setQuery={setQuery}
      setSelected={(v) => {
        const cp = { ...v } as User & { uid?: string };
        delete cp.uid;
        setSelected(cp);
      }}
      disabled={disabled ?? false}
      variant="up"
    />
  );
};
