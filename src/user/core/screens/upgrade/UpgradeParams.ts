import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import { ScreenImageAPI, ScreenImageParsed } from '../../models/ScreenImage';

export type UpgradeCopy<ImageT extends object> = {
  /**
   * The header message. Since within the app the exact details are
   * only available on the client, supports some client-side substitutions:
   *
   * When in the `trial` section:
   * - `[trial_interval_count]`: ex: `7` - the number of intervals in the trial
   * - `[trial_interval_unit_autoplural]`: ex: `days`; the unit, pluralized if the
   *   count isn't 1, singular otherwise
   * - `[trial_interval_unit_singular]`: ex `day`; the unit, singularized regardless
   *   of the interval count
   */
  header: string;

  /** The image to show in the background, 410px shorter than the screen height, or null for no image */
  image: ImageT | null;

  /** Discriminated union on type; describes the body copy */
  body:
    | {
        /** Shows a list of value props with a checkmark as the list bullet */
        type: 'checklist';
        /** The items */
        items: string[];
      }
    | {
        /** Shows a list of sections, where each section contains an icon, text, and body */
        type: 'sequence';
        /** The items */
        items: {
          /** The icon utf-8 character */
          icon: string;
          /** The title */
          title: string;
          /** The body */
          body: string;
        }[];
      };
};

type UpgradeParams<ImageT extends object> = {
  // provided for compatibility with old clients. as a client we do not
  // need to provide backwards compatibility with the old params as we will
  // always receive the new version. the backend has to maintain backwards
  // compatibility with old clients.

  /** @deprecated */
  header: string;
  /** @deprecated */
  image: ImageT;

  // actual params

  /** Configures what to show if there is a trial available */
  trial: {
    /** There is, precisely, a 7-day trial */
    days7: UpgradeCopy<ImageT>;
    /** There is a trial but it's not 7 days */
    default: UpgradeCopy<ImageT>;
  };

  /** Configures what to show if there is either no trial available, or we're not sure how it works */
  immediate: UpgradeCopy<ImageT>;

  /** entrance transition */
  entrance: StandardScreenTransition;

  /** exit transition for the back button. in native, this also applies to after checkout */
  exit: StandardScreenTransition;

  /** The client flow slug to trigger when they hit the back button with no parameters */
  back: string | null;

  checkout: {
    /**
     * On the web this is ignored and configured via empty_with_checkout_uid on the backend.
     * On the app, the trigger if checkout succeeds.
     *
     * In order for the behavior to be consistent, this cannot be configured.
     */
    success: 'post_checkout_success';

    /**
     * On the web this is ignored and configured via empty_with_checkout_uid on the backend.
     * On the app, the trigger if checkout fails.
     *
     * In order for the behavior to be consistent, this cannot be configured.
     */
    failure: 'post_checkout_failure';
  };
};

export type UpgradeAPIParams = UpgradeParams<ScreenImageAPI>;
export type UpgradeMappedParams = UpgradeParams<ScreenImageParsed> & {
  __mapped?: true;
};
