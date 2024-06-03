import { CrudFetcherMapper } from '../../../../admin/crud/CrudFetcher';
import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';

export type VerifyPhoneAPIParams = {
  /** The entrance transition to use */
  entrance: StandardScreenTransition;

  /** The large header text */
  header: string;

  /** The message below the header */
  message: string;

  // documented in mapped params as its more likely to be hovered
  verification: {
    uid: string;
    expires_at: number;
  };

  /** Manages the primary call to action, triggered after the verification succeeds */
  cta: {
    /** The text on the call to action */
    text: string;

    /** The flow to trigger with no parameters */
    trigger: string | null;

    /** The exit transition to use */
    exit: StandardScreenTransition;
  };

  /** Manages the back button if verification fails or the code expires */
  back: {
    /** The text on the back button */
    text: string;

    /** The flow to trigger with no parameters */
    trigger: string | null;

    /** The exit transition to use */
    exit: StandardScreenTransition;
  };
};

export type VerifyPhoneMappedParams = Omit<VerifyPhoneAPIParams, 'verification'> & {
  /** Information about the code that was sent */
  verification: {
    /** A stable external identifier that can be used to check the code */
    uid: string;

    /** When the code is likely to expire and we should automatically trigger the back flow */
    expiresAt: Date;
  };
  __mapped: true;
};

export const verifyPhoneParamsMapper: CrudFetcherMapper<VerifyPhoneMappedParams> = (raw) => ({
  ...(raw as VerifyPhoneAPIParams),
  verification: {
    uid: raw.verification.uid,
    expiresAt: new Date(raw.verification.expires_at * 1000),
  },
  __mapped: true,
});
