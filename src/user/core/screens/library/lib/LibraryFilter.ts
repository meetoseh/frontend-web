import { CrudFetcherMapper } from '../../../../../admin/crud/CrudFetcher';

/**
 * The reparameterized filters for the search_public endpoint that we can actually
 * represent in the UI
 */
export type LibraryFilterAPI = {
  /**
   * How to handle if the user has favorited the class;
   *
   * `only`: restrict the results to those the user has favorited
   * `exclude`: restrict the results to those the user has not favorited
   * `ignore`: do not filter by favorites
   */
  favorites: 'ignore' | 'only' | 'exclude';
  /** How to handle if the user has taken the class; see `favorites` for details */
  taken: 'ignore' | 'only' | 'exclude';
  /** The uids of the instructors to restrict the results to; an empty list is treated as no filter */
  instructors: string[];
  __mapped?: false;
};

export type LibraryFilter = Omit<LibraryFilterAPI, '__mapped'> & { __mapped: true };

export const libraryFilterMapper: CrudFetcherMapper<LibraryFilter> = {};

/** Returns a stable serialization of the given library filter */
export const stableSerializeLibraryFilter = (filter: LibraryFilter): string => {
  const sortedInstructors = Array.from(new Set(filter.instructors)).sort().join(',');
  return `${filter.favorites}-${filter.taken}-${sortedInstructors}`;
};

/** Determines if two library filters are equal */
export const areLibraryFiltersEqual = (a: LibraryFilter, b: LibraryFilter): boolean =>
  stableSerializeLibraryFilter(a) === stableSerializeLibraryFilter(b);

/** Converts the internal representation of the given library filter to the api representation */
export const convertLibraryFilterToAPI = (filter: LibraryFilter): LibraryFilterAPI =>
  filter as any as LibraryFilterAPI;
