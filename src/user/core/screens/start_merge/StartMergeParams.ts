import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import { OauthProvider } from '../../../login/lib/OauthProvider';

export type StartMergeAPIParams = {
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
  skip: {
    /** The text on the button */
    text: string;

    /** The flow which is triggered when the button is pressed, with no parameters */
    trigger: string | null;

    /** The transition to use when the button is pressed */
    exit: StandardScreenTransition;
  };
};

export type StartMergeMappedParams = StartMergeAPIParams & {
  __mapped: true;
};
