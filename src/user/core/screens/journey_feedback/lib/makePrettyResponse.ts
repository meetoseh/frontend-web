/**
 * Takes a journey feedback response identified by index
 * and returns a more interpretable string describing it
 */
export const makePrettyResponse = (response: number | null): string => {
  return response === null
    ? 'null'
    : ['hated', 'disliked', 'liked', 'loved'][response] ?? 'unknown';
};
