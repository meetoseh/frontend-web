import { OsehImageRef } from '../../shared/images/OsehImageRef';
import { CrudFetcherKeyMap } from '../crud/CrudFetcher';

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
   * The users primary email address, not necessarily unique
   */
  email: string;

  /**
   * True if the backend is fairly confident the user actually controls this
   * email address, false if it's essentially just a text value the user
   * provided
   */
  emailVerified: boolean;

  /**
   * The users phone number, formatted via E.164, e.g., +15555555555
   */
  phoneNumber: string | null;

  /**
   * Null if the phone number is null. Otherwise, true if the backend is fairly
   * confident the user actually controls this phone number, false if it's
   * essentially just a text value the user provided
   */
  phoneNumberVerified: boolean | null;

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
   * The users id on revenue cat, which can be used to track their purchases
   */
  revenueCatID: string | null;

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
  email_verified: 'emailVerified',
  phone_number: 'phoneNumber',
  phone_number_verified: 'phoneNumberVerified',
  given_name: 'givenName',
  family_name: 'familyName',
  revenue_cat_id: 'revenueCatID',
  profile_picture: 'profilePicture',
  created_at: (_, v) => ({ key: 'createdAt', value: new Date(v * 1000) }),
  last_seen_at: (_, v) => ({ key: 'lastSeenAt', value: new Date(v * 1000) }),
};
