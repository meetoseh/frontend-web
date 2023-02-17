import { Dispatch, ReactElement, SetStateAction, useMemo } from 'react';
import { makeILikeFromInput } from '../../shared/forms/utils';
import { CrudFetcherFilter, CrudFetcherSort } from '../crud/CrudFetcher';
import { CrudPicker } from '../crud/CrudPicker';
import { CrudPickerItem } from '../crud/CrudPickerItem';
import { Journey } from './Journey';
import { keyMap } from './Journeys';

type JourneyPickerProps = {
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
  setSelected: (this: void, item: Journey) => void;

  /**
   * If true, only show journeys that are not in an event
   * @default false
   */
  filterInEvent?: boolean;

  /**
   * If true, only show journeys that are not already marked introductory
   * @default false
   */
  filterIsIntroductory?: boolean;

  /**
   * If true, only journeys which do not have any sessions will be shown
   * @default false
   */
  filterHasSessions?: boolean;

  /**
   * If true the picker is disabled
   * @default false
   */
  disabled?: boolean;
};

/**
 * The sort for matching results
 */
const sort: CrudFetcherSort = [{ key: 'title', dir: 'asc', before: null, after: null }];

/**
 * Constructs the filter for the journey picker
 * @param filterInEvent If true, filters out journeys that are in an event
 * @param query The query to filter by
 * @returns The filter to use
 */
const generalFilterMaker = (
  filterInEvent: boolean,
  filterIsIntroductory: boolean,
  filterHasSessions: boolean,
  query: string
): CrudFetcherFilter => {
  const res: CrudFetcherFilter = {
    title: {
      operator: 'ilike',
      value: makeILikeFromInput(query),
    },
    deleted_at: {
      operator: 'eq',
      value: null,
    },
  };
  if (filterInEvent) {
    res.daily_event_uid = {
      operator: 'eq',
      value: null,
    };
  }
  if (filterIsIntroductory) {
    res.introductory_journey_uid = {
      operator: 'eq',
      value: null,
    };
  }
  if (filterHasSessions) {
    res.has_sessions = {
      operator: 'eq',
      value: false,
    };
  }
  return res;
};

/**
 * Constructs the component that the user clicks on to pick an item
 * @param item The matching item
 * @param query The query used
 * @returns The component to allow the user to select the item
 */
const component = (item: Journey, query: string): ReactElement => {
  return <CrudPickerItem query={query} match={item.title} />;
};

/**
 * A crud picker specifically for journey. When using crud picker directly, it's
 * easy to accidentally make extra requests to the server. This component
 * minimizes the number of requests made.
 */
export const JourneyPicker = ({
  query,
  setQuery,
  setSelected,
  filterInEvent = false,
  filterIsIntroductory = false,
  filterHasSessions = false,
  disabled = false,
}: JourneyPickerProps): ReactElement => {
  const filterMaker = useMemo(
    () =>
      generalFilterMaker.bind(undefined, filterInEvent, filterIsIntroductory, filterHasSessions),
    [filterInEvent, filterIsIntroductory, filterHasSessions]
  );
  return (
    <CrudPicker
      path="/api/1/journeys/search"
      keyMap={keyMap}
      sort={sort}
      filterMaker={filterMaker}
      component={component}
      query={query}
      setQuery={setQuery}
      setSelected={setSelected}
      disabled={disabled}
    />
  );
};
