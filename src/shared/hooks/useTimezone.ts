/**
 * Fetches the users current timezone as an IANA timezone string
 */
export const useTimezone = (): string => {
  const result = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (result === undefined) {
    return 'America/Los_Angeles';
  }
  return result;
};
