import { CrudFetcherMapper } from '../../../../admin/crud/CrudFetcher';
import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  convertTriggerWithExit,
  ScreenTriggerWithExitAPI,
  ScreenTriggerWithExitMapped,
} from '../../lib/convertTriggerWithExit';

type VerifyPhoneParams<T, ExpiresT> = {
  /** The entrance transition to use */
  entrance: StandardScreenTransition;

  /** The large header text */
  header: string;

  /** The message below the header */
  message: string;

  /** Information about the code that was sent */
  verification: ExpiresT & {
    /** A stable external identifier that can be used to check the code */
    uid: string;
  };

  /** Manages the primary call to action, triggered after the verification succeeds */
  cta: T & {
    /** The text on the call to action */
    text: string;
  };

  /** Manages the back button if verification fails or the code expires */
  back: T & {
    /** The text on the back button */
    text: string;
  };
};

export type VerifyPhoneAPIParams = VerifyPhoneParams<
  ScreenTriggerWithExitAPI,
  {
    /**
     * When the verification code won't work even if they enter it correctly,
     * in seconds since the unix epoch
     */
    expires_at: number;
  }
>;

export type VerifyPhoneMappedParams = VerifyPhoneParams<
  ScreenTriggerWithExitMapped,
  {
    /** When the verification code won't work even if they enter it correctly */
    expiresAt: Date;
  }
> & {
  __mapped: true;
};

export const verifyPhoneParamsMapper: CrudFetcherMapper<VerifyPhoneMappedParams> = (raw) => {
  const api = raw as VerifyPhoneAPIParams;
  return {
    entrance: api.entrance,
    header: api.header,
    message: api.message,
    verification: {
      uid: api.verification.uid,
      expiresAt: new Date(api.verification.expires_at * 1000),
    },
    cta: {
      ...convertTriggerWithExit(api.cta),
      text: api.cta.text,
    },
    back: {
      ...convertTriggerWithExit(api.back),
      text: api.back.text,
    },
    __mapped: true,
  };
};
