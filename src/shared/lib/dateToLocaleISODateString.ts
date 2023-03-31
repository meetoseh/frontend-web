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

/**
 * The inverse of dateToLocaleISODateString. Takes an iso date and constructs a
 * Date object in the local timezone representing 12:00am on that date.
 *
 * @param date The iso date string.
 * @returns The Date object.
 */
export const isoDateStringToLocaleDate = (date: string): Date => {
  const [year, month, day] = date.split('-').map((part) => parseInt(part, 10));

  const utcDate = new Date(Date.UTC(year, month - 1, day));

  const seenTimezoneOffsets = new Set<number>();
  let nextTimezoneOffset = utcDate.getTimezoneOffset();
  while (true) {
    const localDate = new Date(utcDate.getTime() + nextTimezoneOffset * 60 * 1000);
    if (
      localDate.getFullYear() === year &&
      localDate.getMonth() === month - 1 &&
      localDate.getDate() === day &&
      localDate.getHours() === 0 &&
      localDate.getMinutes() === 0 &&
      localDate.getSeconds() === 0 &&
      localDate.getMilliseconds() === 0
    ) {
      return localDate;
    }

    if (seenTimezoneOffsets.has(nextTimezoneOffset)) {
      console.error('could not determine locale date from iso date string', date);
      return localDate;
    }

    seenTimezoneOffsets.add(nextTimezoneOffset);
    nextTimezoneOffset = localDate.getTimezoneOffset();
  }
};
