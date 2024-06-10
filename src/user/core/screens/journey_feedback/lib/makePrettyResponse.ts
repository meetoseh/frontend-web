/**
 * Takes a journey feedback response identified by index
 * and returns a more interpretable string describing it
 */
export const makePrettyResponse = (response: number | null): string => {
  return response === null
    ? 'null'
    : ['loved', 'liked', 'disliked', 'hated'][response - 1] ?? 'unknown';
};
