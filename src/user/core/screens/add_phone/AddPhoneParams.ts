import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';

export type AddPhoneAPIParams = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** The header message */
  header: string;

  /** The subheader message */
  message: string;

  /** True if the phone should be immediately registered for reminders once verified, false not to */
  reminders: boolean;

  /**
   * The legal text at the bottom. `"[Terms]"` is replaced with the terms of
   * service link, and `"[Privacy Policy]"` is replaced with the privacy policy
   * link.
   */
  legal: string | null;

  /** Handles the call to action after they input a phone number */
  cta: {
    /** The text on the button. */
    text: string;

    /**
     * The action to take when the button is clicked. Uses pop_to_phone_verify
     * to trigger with server parameters like the following example:
     * ```json
     * {
     *   "phone_number": "+15555555555",
     *   "verification": {
     *     "uid": "string",
     *     "expires_at": 1234567890
     *   }
     * }
     * ```
     * where the phone number is in E.164 format, and the verification object
     * contains the uid for checking the verification status and the time when
     * the code is unlikely to continue working after.
     */
    trigger: string | null;

    /** The exit transition to use */
    exit: StandardScreenTransition;
  };

  /**
   * Configures the skip button; this is in the upper left if theres nav
   * and below the CTA if there isn't
   */
  back: {
    /** The exit transition to use */
    exit: StandardScreenTransition;

    /** The trigger with no parameters */
    trigger: string | null;
  };

  /**
   * Determines if we should use the standard bottom and top bar vs just
   * a skip button below the primary cta
   */
  nav:
    | {
        /** just a back button */
        type: 'no-nav';

        /** The text on the skip button which handles "back" */
        back: string;
      }
    | {
        /** standard bottom and top bar */
        type: 'nav';

        /** The title of the screen in the top bar */
        title: string;

        /** For if the user taps the home button in the bottom bar */
        home: {
          trigger: string | null;
          // uses fade exit to avoid nesting x-enum-discriminator
        };

        /** For if the user taps the series button in the bottom bar */
        series: {
          trigger: string | null;
          // uses fade exit to avoid nesting x-enum-discriminator
        };
      };
};

export type AddPhoneMappedParams = AddPhoneAPIParams & {
  __mapped: true;
};
