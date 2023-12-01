import { OsehImageRef } from '../../shared/images/OsehImageRef';
import { CrudFetcherKeyMap } from '../crud/CrudFetcher';

export type UserEmail = {
  /**
   * The email address
   */
  address: string;

  /**
   * True if we are fairly sure the user owns this email address, false
   * if we're not sure.
   */
  verified: boolean;

  /**
   * True if this email address should receive passive notifications,
   * false otherwise. A passive notification is any that occurs without
   * explicitly asking immediately prior, e.g., daily reminders. An active
   * notification is e.g. a 2FA code.
   */
  enabled: boolean;

  /**
   * True if this email address cannot be contacted, false if it might
   * be technically possible to contact it.
   */
  suppressed: boolean;
};

export type UserPhone = {
  /**
   * The phone number, formatted via E.164, e.g., +15555555555
   */
  number: string;

  /**
   * True if we are fairly sure the user owns this phone number, false
   * if we're not sure.
   */
  verified: boolean;

  /**
   * True if this phone number should receive passive notifications,
   * false otherwise.
   */
  enabled: boolean;

  /**
   * True if this phone number cannot be contacted, false if it might
   * be technically possible to contact it.
   */
  suppressed: boolean;
};

/**
 * A user as returned from detailed admin endpoints. Most of the time, you'll
 * get a reference to a user via just a sub and maybe an email for showing them
 * inline.
 */
export type User = {
  /**
   * The primary stable unique identifier for the user, which will be used as
   * the subject of all user-related JWTs
   */
  sub: string;

  /**
   * Email addresses associated with the user.
   */
  emails: UserEmail[];

  /**
   * Phone numbers associated with the user.
   */
  phones: UserPhone[];

  /**
   * The users given name, i.e., the name given to them by their parents.
   * Often referred to as their first name.
   */
  givenName: string | null;

  /**
   * The users family name, i.e., the name passed down to them from their
   * parents. Often referred to as their last name.
   */
  familyName: string | null;

  /**
   * True if the user is an admin, false otherwise
   */
  admin: boolean;

  /**
   * The users ids on revenue cat, which can be used to track their purchases
   */
  revenueCatIDs: string[];

  /**
   * The users profile picture, if they have one.
   */
  profilePicture: OsehImageRef | null;

  /**
   * When the user record was created
   */
  createdAt: Date;

  /**
   * The last time we saw the user on the website; this is collected passively,
   * and thus may be out of date. Even when collected this is updated in the
   * background and thus can still be a few minutes behind.
   */
  lastSeenAt: Date;
};

/**
 * The key map that can be used to parse a user from the backend
 */
export const userKeyMap: CrudFetcherKeyMap<User> | ((raw: any) => User) = {
  given_name: 'givenName',
  family_name: 'familyName',
  revenue_cat_ids: 'revenueCatIDs',
  profile_picture: 'profilePicture',
  created_at: (_, v) => ({ key: 'createdAt', value: new Date(v * 1000) }),
  last_seen_at: (_, v) => ({ key: 'lastSeenAt', value: new Date(v * 1000) }),
};
