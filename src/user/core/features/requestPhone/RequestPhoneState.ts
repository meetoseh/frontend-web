import { InappNotification } from '../../../../shared/hooks/useInappNotification';

/**
 * Describes the state required to determine if we need to request a users
 * phone number.
 */
export type RequestPhoneState = {
  /**
   * If loaded, the regular phone number in-app notification
   */
  phoneNumberIAN: InappNotification | null;

  /**
   * If loaded, the onboarding phone number in-app notification
   */
  onboardingPhoneNumberIAN: InappNotification | null;

  /**
   * Whether the user has a phone number associated with their account.
   */
  hasPhoneNumber: boolean | undefined;

  /**
   * True if the user has added a phone number this session, false otherwise.
   * This is intended to be used by other states.
   */
  justAddedPhoneNumber: boolean;
};
