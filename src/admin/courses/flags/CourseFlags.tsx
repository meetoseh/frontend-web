import { CrudFetcherMapper } from '../../crud/CrudFetcher';

/**
 * Bit flag enum. Mostly, this works as you expect.
 *
 * Each flag is 1 in the do-nothing state and 0 in the do-something state; this
 * is because a flag being set can restrict where a course shows up, but may not
 * be the _only_ restriction. For example, a course won't be in the Owned tab
 * for a user if they do not own the course, so a flag cannot be said to "Make
 * the course appear in the owned tab". However, a flag can be said to "Prevent
 * the course from appearing the owned tab", which means even if all the other
 * conditions are met (owning the course), the course will not appear in the
 * owned tab.
 *
 * For clarity we say a flag is "SET" if the corresponding bit is 1 and "UNSET"
 * if the corresponding bit is 0. We use caps when we are specifically referring
 * to this meaning, and lowercase when using the word in a more general sense.
 *
 * NOTE: Series and course refer to the same thing; generally, series is the
 * external name, course is the internal name. These flags are described in
 * the external content so that the description can map more exactly to how it
 * shows up in the admin area.
 *
 * API conversion details:
 *   The backend accepts the decimal representation, determines the
 *   binary representation of that decimal representation as a twos-complement
 *   big-endian 64-bit integer, and then that binary representation determines
 *   the flags.
 */
export enum CourseFlags {
  /**
   * UNSET to prevent serving a public share page for journeys within this
   * series.
   */
  JOURNEYS_IN_SERIES_PUBLIC_SHAREABLE = 1 << 0,

  /**
   * UNSET to prevent creating or using share codes which link to journeys
   * in this series.
   */
  JOURNEYS_IN_SERIES_CODE_SHAREABLE = 1 << 1,

  /**
   * UNSET to prevent serving a public share page for this series.
   */
  SERIES_PUBLIC_SHAREABLE = 1 << 2,

  /**
   * UNSET to prevent creating or using share codes which link to this series.
   */
  SERIES_CODE_SHAREABLE = 1 << 3,

  /**
   * UNSET to prevent this series from appearing in the "Owned" tab for a user.
   */
  SERIES_VISIBLE_IN_OWNED = 1 << 4,

  /**
   * UNSET to prevent journeys in this series from appearing in the "History"
   * tab for a user.
   */
  JOURNEYS_IN_SERIES_IN_HISTORY = 1 << 5,

  /**
   * UNSET to prevent the series from appearing in the Series section.
   */
  SERIES_IN_SERIES_TAB = 1 << 6,

  /**
   * UNSET to prevent the journeys in this series from being selected
   * when personalization is selecting a 1 minute journey related to an
   * emotion
   */
  JOURNEYS_IN_SERIES_ARE_1MINUTE = 1 << 7,

  /**
   * UNSET to prevent the journeys in this series from being selected
   * when personalization is selecting a premium journey related to an
   * emotion
   */
  JOURNEYS_IN_SERIES_ARE_PREMIUM = 1 << 8,

  /**
   * UNSET to prevent attaching the series without the corresponding
   * revenue cat entitlement. Note that attaching a series without
   * the corresponding entitlement actually grants the revenue cat
   * entitlement, so this should only be SET if the series has its own
   * revenue cat entitlement.
   */
  SERIES_ATTACHABLE_FOR_FREE = 1 << 9,

  /**
   * UNSET to prevent the series from showing _by default_ in the admin
   * area.
   */
  SERIES_IN_ADMIN_AREA = 1 << 10,
}

export const courseFlagsKeyMap: CrudFetcherMapper<CourseFlags> = (raw: any) => {
  if (typeof raw !== 'number') {
    throw new Error(`Expected number, got ${typeof raw}`);
  }

  return raw;
};
