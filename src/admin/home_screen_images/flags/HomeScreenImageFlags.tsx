/**
 * Bit flag enum. Mostly, this works as you expect.
 *
 * Each flag is 1 in the do-nothing state and 0 in the do-something state; this
 * is because a flag being set can restrict when a home image shows up, but may not
 * be the _only_ restriction.
 *
 * For clarity we say a flag is "SET" if the corresponding bit is 1 and "UNSET"
 * if the corresponding bit is 0. We use caps when we are specifically referring
 * to this meaning, and lowercase when using the word in a more general sense.
 *
 * API conversion details:
 *   The backend accepts the decimal representation, determines the
 *   binary representation of that decimal representation as a twos-complement
 *   big-endian 64-bit integer, and then that binary representation determines
 *   the flags.
 */
export enum HomeScreenImageFlags {
  VISIBLE_SUNDAY = 1 << 0,
  VISIBLE_MONDAY = 1 << 1,
  VISIBLE_TUESDAY = 1 << 2,
  VISIBLE_WEDNESDAY = 1 << 3,
  VISIBLE_THURSDAY = 1 << 4,
  VISIBLE_FRIDAY = 1 << 5,
  VISIBLE_SATURDAY = 1 << 6,
  VISIBLE_JANUARY = 1 << 7,
  VISIBLE_FEBRUARY = 1 << 8,
  VISIBLE_MARCH = 1 << 9,
  VISIBLE_APRIL = 1 << 10,
  VISIBLE_MAY = 1 << 11,
  VISIBLE_JUNE = 1 << 12,
  VISIBLE_JULY = 1 << 13,
  VISIBLE_AUGUST = 1 << 14,
  VISIBLE_SEPTEMBER = 1 << 15,
  VISIBLE_OCTOBER = 1 << 16,
  VISIBLE_NOVEMBER = 1 << 17,
  VISIBLE_DECEMBER = 1 << 18,
  VISIBLE_WITHOUT_PRO = 1 << 19,
  VISIBLE_WITH_PRO = 1 << 20,
  VISIBLE_IN_ADMIN = 1 << 21,
}

export const homeScreenImageFlagsKeyMap = (raw: any): HomeScreenImageFlags => {
  if (typeof raw !== 'number') {
    throw new Error(`Expected number, got ${typeof raw}`);
  }

  return raw;
};
