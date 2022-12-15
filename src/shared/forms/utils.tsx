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
