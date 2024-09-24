import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerAPI,
} from '../../models/ScreenConfigurableTrigger';

export type UnsubscribeEmailParamsAPI = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** the header text to show */
  header: string;

  /** configures the close button */
  close: {
    /** the variant to use for the icon and placement */
    variant: 'x' | 'back' | 'menu';
    /** the trigger when the close button is pressed. Includes `filter` in the params  */
    trigger: ScreenConfigurableTriggerAPI;
    /** exit transition */
    exit: StandardScreenTransition;
  };

  /** The title text to show above the input, if any */
  title?: string | null;

  /** The text below the title above the input, if any  */
  body?: string | null;

  /** the touch link code to forward to the CTA trigger parameters */
  code?: string | null;

  /** The input placeholder */
  placeholder: string;

  /** Help text below the input, if any */
  help?: string | null;

  cta: {
    /** the text on the cta */
    text: string;

    /** the trigger to call with the extra client parameter `email` and `code` */
    trigger: ScreenConfigurableTriggerAPI;

    /** the cta exit transition */
    exit: StandardScreenTransition;
  };
};

export type UnsubscribeEmailParamsMapped = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** the header text to show */
  header: string;

  /** configures the close button */
  close: {
    /** the variant to use for the icon and placement */
    variant: 'x' | 'back' | 'menu';
    /** the trigger when the close button is pressed. Includes `filter` in the params  */
    trigger: ScreenConfigurableTrigger;
    /** exit transition */
    exit: StandardScreenTransition;
  };

  /** The title text to show above the input, if any */
  title: string | null;

  /** The text below the title above the input, if any  */
  body: string | null;

  /** The code to forward to the CTA trigger parameters */
  code: string | null;

  /** The input placeholder */
  placeholder: string;

  /** Help text below the input, if any */
  help: string | null;

  cta: {
    /** the text on the cta */
    text: string;

    /** the trigger to call with the extra client parameter `email` and `code` */
    trigger: ScreenConfigurableTrigger;

    /** the cta exit transition */
    exit: StandardScreenTransition;
  };

  __mapped: true;
};
