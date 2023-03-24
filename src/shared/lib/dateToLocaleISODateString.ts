/**
 * Returns the iso-formatted date representing the given date in the local timezone.
 * This differs from the native Date.toISOString() method in the following ways:
 * 1. No time parts are included in the returned string.
 * 2. The returned string represents the date in the local timezone, not utc.
 *
 * Example:
 *
 * new Date('2023-03-24:01:00:00Z')
 * Thu Mar 23 2023 18:00:00 GMT-0700 (Pacific Daylight Time)
 *
 * new Date('2023-03-24:01:00:00Z').toISOString()
 * '2023-03-24T01:00:00.000Z'
 *
 * dateToLocaleISODateString(new Date('2023-03-24:01:00:00Z'))
 * '2023-03-23'
 */
export const dateToLocaleISODateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`;
};
