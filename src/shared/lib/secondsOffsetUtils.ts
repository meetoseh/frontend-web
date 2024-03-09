/**
 * Converts the given number of seconds from midnight to the most
 * typical time of day it represents. This is only exact if there
 * are no leap seconds, repeat seconds, leap hours, or skip hours
 * on the day, e.g., due to daylight saving time.
 *
 * @param seconds The number of seconds since midnight
 * @returns The time of day as a string in the format "HH:MM", appropriate
 *   for time inputs
 */
export const secondsOffsetToInput = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds - hours * 3600) / 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

/**
 * Converts the given time of day to the number of seconds from midnight
 * assuming no leap seconds, repeat seconds, leap hours, or skip hours
 * on the day, e.g., due to daylight saving time.
 *
 * @param input The time of day as a string in the format "HH:MM"
 * @param isEnd If true, then 00:00 is interpreted as 24:00
 * @returns The number of seconds since midnight, or null if the input
 *   is not in the expected format
 */
export const inputToSecondsOffset = (input: string, isEnd?: boolean): number | null => {
  if (input.length === 5 && input[2] === ':') {
    try {
      const hours = parseInt(input.slice(0, 2));
      const minutes = parseInt(input.slice(3, 5));
      const result = hours * 3600 + minutes * 60;
      if (result < 0 || result >= 86400) {
        return null;
      }
      if (result === 0 && isEnd) {
        return 86400;
      }
      return result;
    } catch (e) {
      return null;
    }
  }

  return null;
};
