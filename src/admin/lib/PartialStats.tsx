/**
 * Describes a single value within a point-in-time datapoint. This
 * format is only efficient if there aren't many points in time or
 * if the data is extremely sparse. Since the former is the more
 * likely case where this format is used, the name is called
 * PartialStatsItem, indicating that only a few points in time are
 * present.
 */
export type PartialStatsItem = {
  key: string;
  label: string;
  data: number;
  breakdown?: Record<string, number>;
};

/**
 * Parses the api representation for a partial stats item into
 * a PartialStatsItem object.
 *
 * @param raw the raw api representation
 * @returns the parsed PartialStatsItem
 */
export const parsePartialStatsItems = (raw: any): PartialStatsItem[] => {
  const result: PartialStatsItem[] = [];
  for (let [key, value] of Object.entries(raw)) {
    if (key.endsWith('_breakdown')) {
      continue;
    }
    result.push({
      key,
      label: fromSnakeToTitleCase(key),
      data: value as number,
      breakdown: raw[`${key}_breakdown`],
    });
  }
  return result;
};

/**
 * Describes stats for just today and yesterday. This is generally
 * returned when either the long-term data isn't stored at all, or
 * is stored in a different place (and returned in a different format
 * more suitable for a large number of points in time)
 */
export type PartialStats = {
  /**
   * The stats for today
   */
  today: PartialStatsItem[];
  /**
   * The stats for yesterday
   */
  yesterday: PartialStatsItem[];
};

/**
 * Parses the api representation for a partial stats object into
 * a PartialStats object.
 *
 * @param raw the raw api representation
 * @returns the parsed PartialStats
 */
export const parsePartialStats = (raw: any): PartialStats => {
  return {
    today: parsePartialStatsItems(raw.today),
    yesterday: parsePartialStatsItems(raw.yesterday),
  };
};

/*
 * Convenience function to convert from snake_case to Title Case
 */
const fromSnakeToTitleCase = (snake: string): string => {
  return snake
    .split('_')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
};
