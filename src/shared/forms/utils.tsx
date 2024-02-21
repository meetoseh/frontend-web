import { CrudFetcherFilter } from '../../admin/crud/CrudFetcher';

/**
 * Converts an input into the appropriate representation for use in a LIKE query
 *
 * @param input The raw input from the user
 * @returns The input for use in a LIKE query
 */
export const makeILikeFromInput = (input: string): string => {
  return `%${input}%`;
};

/**
 * Undoes the conversion from makeILikeFromInput
 *
 * @param ilike the converted input from a LIKE query
 * @returns the original input
 */
export const makeInputFromILike = (ilike: string | null | undefined): string => {
  if (ilike === '' || ilike === null || ilike === undefined) {
    return '';
  }

  return ilike.substring(1, ilike.length - 1);
};

/**
 * Sets the simple filter with the given key to be ilike the given input
 * and returns the new filters, if they are different
 */
export const setILikeFilter = (
  filters: CrudFetcherFilter,
  key: string,
  input: string
): CrudFetcherFilter => {
  const item = filters[key];
  if (input === '') {
    if (item === undefined) {
      return filters;
    }

    const newFilters = { ...filters };
    delete newFilters[key];
    return newFilters;
  }

  const ilike = makeILikeFromInput(input);
  if (item?.value === ilike) {
    return filters;
  }

  return { ...filters, [key]: { operator: 'ilike', value: ilike } };
};
