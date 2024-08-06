import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import { OauthProvider } from '../../../login/lib/OauthProvider';
import {
  ScreenTriggerWithExitAPI,
  ScreenTriggerWithExitMapped,
} from '../../lib/convertTriggerWithExit';

type StartMergeParams<T> = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** The header message */
  header: string;

  /** The subheader message */
  message: string | null;

  /**
   * The providers to suggest logging in with.
   */
  providers: {
    /** The identifier for the provider, which configures the button */
    provider: OauthProvider;

    /** The URL when the button is pressed */
    url: string;
  }[];

  /** The skip button configuration */
  skip: T & {
    /** The text on the button */
    text: string;
  };
};

export type StartMergeAPIParams = StartMergeParams<ScreenTriggerWithExitAPI>;
export type StartMergeMappedParams = StartMergeParams<ScreenTriggerWithExitMapped> & {
  __mapped: true;
};
