import { ReactElement } from 'react';
import { CrudFetcherKeyMap, convertUsingKeymap } from '../../../../admin/crud/CrudFetcher';
import { MergeProvider } from '../mergeAccount/MergeAccountState';

export type EmailForConflict = {
  /** The email address, e.g., anonymous@example.com */
  emailAddress: string;
  /**
   * True if we cannot send emails to this address because of explicit opt out,
   * or a bounce/complaint. False otherwise
   */
  suppressed: boolean;
  /**
   * True if we are reasonably sure the user owns this email address,
   * false otherwise
   */
  verified: boolean;
  /**
   * True if this email address receives notifications, false otherwise
   */
  enabled: boolean;
};

export const emailForConflictKeyMap: CrudFetcherKeyMap<EmailForConflict> = {
  email_address: 'emailAddress',
};

export type PhoneForConflict = {
  /** The E.164 phone number */
  phoneNumber: string;
  /**
   * True if we cannot send SMS to this number because of explicit opt out,
   * e.g., STOP or we simply can't contact the carrier. False otherwise
   */
  suppressed: boolean;
  /**
   * True if we are reasonably sure the user owns this phone number,
   * false otherwise
   */
  verified: boolean;
  /**
   * True if this phone number receives notifications, false otherwise
   */
  enabled: boolean;
};

export const phoneForConflictKeyMap: CrudFetcherKeyMap<PhoneForConflict> = {
  phone_number: 'phoneNumber',
};

export type DayOfWeek =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';
export const DAYS_OF_WEEK: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export type DailyReminderSettingsForConflict = {
  /** The days of the week they receive notifications on this channel */
  daysOfWeek: DayOfWeek[];
  /**
   * The earliest they receive notifications on this channel in seconds
   * from midnight
   */
  startTime: number;
  /**
   * The latest they receive notifications on this channel in seconds
   * from midnight
   */
  endTime: number;
};

export const dailyReminderSettingsForConflictKeyMap: CrudFetcherKeyMap<DailyReminderSettingsForConflict> =
  {
    days_of_week: 'daysOfWeek',
    start_time: 'startTime',
    end_time: 'endTime',
  };

export type OauthEmailConflictInfo = {
  /**
   * The emails associated with the original user
   */
  original: EmailForConflict[];

  /**
   * The emails associated with the merging user
   */
  merging: EmailForConflict[];

  /**
   * The email settings for the original user
   */
  originalSettings: DailyReminderSettingsForConflict;

  /**
   * The email settings for the merging user
   */
  mergingSettings: DailyReminderSettingsForConflict;
};

export const oauthEmailConflictInfoKeyMap: CrudFetcherKeyMap<OauthEmailConflictInfo> = {
  original: (k, v) => ({
    key: 'original',
    value: (v as any[]).map((e) => convertUsingKeymap(e, emailForConflictKeyMap)),
  }),
  merging: (k, v) => ({
    key: 'merging',
    value: (v as any[]).map((e) => convertUsingKeymap(e, emailForConflictKeyMap)),
  }),
  original_settings: (k, v) => ({
    key: 'originalSettings',
    value: convertUsingKeymap(v, dailyReminderSettingsForConflictKeyMap),
  }),
  merging_settings: (k, v) => ({
    key: 'mergingSettings',
    value: convertUsingKeymap(v, dailyReminderSettingsForConflictKeyMap),
  }),
};

export type OauthPhoneConflictInfo = {
  /**
   * The phones associated with the original user
   */
  original: PhoneForConflict[];

  /**
   * The phones associated with the merging user
   */
  merging: PhoneForConflict[];

  /**
   * The phone settings for the original user
   */
  originalSettings: DailyReminderSettingsForConflict;

  /**
   * The phone settings for the merging user
   */
  mergingSettings: DailyReminderSettingsForConflict;
};

export const oauthPhoneConflictInfoKeyMap: CrudFetcherKeyMap<OauthPhoneConflictInfo> = {
  original: (k, v) => ({
    key: 'original',
    value: (v as any[]).map((e) => convertUsingKeymap(e, phoneForConflictKeyMap)),
  }),
  merging: (k, v) => ({
    key: 'merging',
    value: (v as any[]).map((e) => convertUsingKeymap(e, phoneForConflictKeyMap)),
  }),
  original_settings: (k, v) => ({
    key: 'originalSettings',
    value: convertUsingKeymap(v, dailyReminderSettingsForConflictKeyMap),
  }),
  merging_settings: (k, v) => ({
    key: 'mergingSettings',
    value: convertUsingKeymap(v, dailyReminderSettingsForConflictKeyMap),
  }),
};

export type OauthMergeConfirmationRequiredDetails = {
  /**
   * The email conflict which needs to be resolved, if any
   */
  email: OauthEmailConflictInfo | null;

  /**
   * The phone conflict which needs to be resolved, if any
   */
  phone: OauthPhoneConflictInfo | null;

  /**
   * The JWT to use to confirm the merge once the conflict has been resolved
   */
  mergeJwt: string;
};

export const oauthMergeConfirmationRequiredDetailsKeyMap: CrudFetcherKeyMap<OauthMergeConfirmationRequiredDetails> =
  {
    email: (k, v) => ({
      key: 'email',
      value:
        v === null || v === undefined ? null : convertUsingKeymap(v, oauthEmailConflictInfoKeyMap),
    }),
    phone: (k, v) => ({
      key: 'phone',
      value:
        v === null || v === undefined ? null : convertUsingKeymap(v, oauthPhoneConflictInfoKeyMap),
    }),
    merge_jwt: 'mergeJwt',
  };

export type OauthMergeResultCategory =
  | 'noChangeRequired'
  | 'createdAndAttached'
  | 'trivialMerge'
  | 'confirmationRequired'
  | 'originalUserDeleted';
export const convertAPIOauthMergeResultCategory = (v: string): OauthMergeResultCategory => {
  switch (v) {
    case 'no_change_required':
      return 'noChangeRequired';
    case 'created_and_attached':
      return 'createdAndAttached';
    case 'trivial_merge':
      return 'trivialMerge';
    case 'confirmation_required':
      return 'confirmationRequired';
    case 'original_user_deleted':
      return 'originalUserDeleted';
    default:
      throw new Error(`Unexpected value ${v}`);
  }
};

export type OauthMergeLoginOption = {
  /**
   * The provider for this identity
   */
  provider: MergeProvider;
  /**
   * The email address on the identity
   */
  email: string;
};

export type OauthMergeResult = {
  /**
   * What action was taken immediately
   */
  result: OauthMergeResultCategory;

  /**
   * If the result is confirmationRequired, the details of the conflict
   * that need to be resolved
   */
  conflictDetails: OauthMergeConfirmationRequiredDetails | null;

  /**
   * The login options for the original user, prior to the merge.
   */
  originalLoginOptions: OauthMergeLoginOption[];

  /**
   * The login options for the merging user, prior to the merge. For
   * `createdAndAttached` this will just be the login option on the
   * merge token. For `noChangeRequired` this will be empty. For
   * `confirmationRequired`, this is the login options still available
   * on the merging user.
   */
  mergingLoginOptions: OauthMergeLoginOption[];
};

export const oauthMergeResultKeyMap: CrudFetcherKeyMap<OauthMergeResult> = {
  result: (k, v) => ({
    key: 'result',
    value: convertAPIOauthMergeResultCategory(v),
  }),
  conflict_details: (k, v) => ({
    key: 'conflictDetails',
    value:
      v === null || v === undefined
        ? null
        : convertUsingKeymap(v, oauthMergeConfirmationRequiredDetailsKeyMap),
  }),
  original_login_options: 'originalLoginOptions',
  merging_login_options: 'mergingLoginOptions',
};

/**
 * The state required to determine if the confirm merge account feature
 * should be displayed and any state we want to share with other components.
 *
 * We do a somewhat redux-style approach here as it can be helpful
 * for other components to learn about merges to e.g. reprompt about
 * settings with context.
 */
export type ConfirmMergeAccountState = {
  /**
   * The start merge token from the URL hash, or null if not handling a merge,
   * or undefined if we're not sure yet
   *
   * Note that this is set to null once we complete the merge, so it is
   * primarily for determining if a merge is in progress
   *
   * NOTE: On the web this can be determined synchronously and by this component
   * and hence is never in the undefined state. For the app, this has to be
   * coordinated from the message pipe, hence is initialized to the undefined
   * state when showing the secure login screen and then updated once the user
   * returns to the app.
   */
  mergeToken: string | null | undefined;

  /**
   * True if we are prompting the user to review their reminder settings after
   * we completed a merge, false otherwise
   */
  promptingReviewReminderSettings: boolean;

  /**
   * The result of the initial merge step, null if we have not gotten it yet
   * (possibly because there was no merge token), undefined if we're not sure
   * yet, false if an error occurred.
   *
   * Note this is not set to null when the merge completes, meaning it can
   * be used to observe the result of the merge completed this session
   */
  result: OauthMergeResult | false | null | undefined;

  /**
   * The result of the confirmation step after resolving the
   * conflict, null if we haven't resolved a conflict, undefined
   * if still loading the result.
   *
   * Note this is not set to null when the merge completes, meaning it can
   * be used to observe the result of the merge completed this session
   */
  confirmResult: boolean | null | undefined;

  /**
   * The error from the latest step, if any
   *
   * Note this is not set to null when the merge completes, meaning it can
   * be used to observe the result of the merge completed this session
   */
  error: ReactElement | null;

  /**
   * True if we have merged accounts this session, false otherwise. Intended
   * for other features as it does not impact this feature.
   */
  mergedThisSession: boolean;

  /**
   * May be called when mergeToken is null to set it to undefined.
   * Used by the app and kept here for consistency.
   */
  onShowingSecureLogin: () => void;

  /**
   * May be called when mergeToken is undefined to set it to the given
   * value. Used by the app and kept here for consistency.
   */
  onSecureLoginCompleted: (mergeToken: string | null) => void;

  /**
   * If mergeToken is a string but result is null, this can be called
   * to set result to undefined.
   */
  onFetchingInitialMergeResult: () => void;

  /**
   * If result is undefined, this can be called to set result to
   * the result of the initial merge step. If the result is false,
   * error should be set to a ReactElement describing the error and
   * the merge token will be set to null.
   *
   * If the result is not false and not confirmationRequired, this will set
   * mergedThisSession to true.
   *
   * @param result
   * @param error
   * @returns
   */
  onInitialMergeResult: (result: OauthMergeResult | false, error: ReactElement | null) => void;

  /**
   * If result is confirmationRequired, confirmResult is null, and error is
   * null, this can be called to set confirmResult to undefined.
   */
  onResolvingConflict: () => void;

  /**
   * If confirmResult is undefined, this can be called to set confirmResult to
   * true or false and set an error if result is false. Regardless of result,
   * the merge token will be set to null.
   *
   * If result is true, this will set mergedThisSession to true.
   */
  onResolveConflict: (result: boolean, error: ReactElement | null) => void;

  /**
   * Can be set if the user dismisses the component to set the merge token
   * to null. Sets promptingReviewReminderSettings to true if a merge occurred
   */
  onDismissed: () => void;

  /**
   * Can be called to set promptingReviewReminderSettings to false
   */
  onReviewReminderSettingsPrompted: () => void;
};
