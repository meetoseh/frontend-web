import { CrudFetcherKeyMap, convertUsingKeymap } from '../../../../admin/crud/CrudFetcher';
import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import { DayOfWeek } from '../../../../shared/models/DayOfWeek';
import { OauthProvider } from '../../../login/lib/OauthProvider';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerTransitioningPreferredAPI,
  ScreenConfigurableTriggerTransitioningTemporaryAPI,
} from '../../models/ScreenConfigurableTrigger';

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
  provider: OauthProvider;
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

type ResolveMergeConflictParams<T> = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** The header message */
  header: string;

  /** The subheader message */
  message: string | null;

  // docs in mapped as its more likely to be hovered
  conflict: unknown;

  /** Handles the button at the bottom */
  cta: {
    /** The call-to-action text on the button. */
    text: string;

    /** exit transition for cta */
    exit: StandardScreenTransition;
  } & T;

  /** Handles the skip button which only appears if there is an error */
  skip: {
    /** The text on the skip button */
    text: string;

    /** exit transition for skip */
    exit: StandardScreenTransition;
  } & T;

  /** handles what to do if the merge jwt is expired */
  expired: T;
};

export type ResolveMergeConflictAPIParams = ResolveMergeConflictParams<{
  trigger: ScreenConfigurableTriggerTransitioningPreferredAPI;
  triggerv75: ScreenConfigurableTriggerTransitioningTemporaryAPI;
}>;

export type ResolveMergeConflictMappedParams = Omit<
  ResolveMergeConflictParams<{
    trigger: ScreenConfigurableTrigger;
  }>,
  'conflict'
> & {
  /** The conflict which needs to be resolved */
  conflict: OauthMergeConfirmationRequiredDetails;
  __mapped: true;
};
