import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerAPI,
} from '../../models/ScreenConfigurableTrigger';
import {
  ScreenTextContentAPI,
  ScreenTextContentMapped,
} from '../../models/ScreenTextContentMapped';

/** API-style parameters for the text interstitial screen */
export type TextInterstitialParamsAPI = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** The message at the top of the screen, typically providing context */
  top?: string | null;

  /** The text content for the screen */
  content: ScreenTextContentAPI;

  /** handles the primary, filled button, if there is one */
  primary_button?: {
    /** the text on the button */
    text: string;
    /** the exit for this button */
    exit: StandardScreenTransition;
    /** the trigger when the button is pressed */
    trigger: ScreenConfigurableTriggerAPI;
  } | null;

  /** handles the secondary, outline button, if there is one */
  secondary_button?: {
    /** the text on the button */
    text: string;
    /** the exit for this button */
    exit: StandardScreenTransition;
    /** the trigger when the button is pressed */
    trigger: ScreenConfigurableTriggerAPI;
  } | null;

  /** handles the tertiary, text link button, if there is one */
  tertiary_button?: {
    /** the text on the button */
    text: string;
    /** the exit for this button */
    exit: StandardScreenTransition;
    /** the trigger when the button is pressed */
    trigger: ScreenConfigurableTriggerAPI;
  } | null;
};

/** JS-style parameters for the text interstitial screen */
export type TextInterstitialParamsMapped = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** The message at the top of the screen, typically providing context */
  top: string | null;

  /** The text content for the screen */
  content: ScreenTextContentMapped;

  /** handles the primary, filled button, if there is one */
  primaryButton: {
    /** the text on the button */
    text: string;
    /** the exit for this button */
    exit: StandardScreenTransition;
    /** the trigger when the button is pressed */
    trigger: ScreenConfigurableTrigger;
  } | null;

  /** handles the secondary, outline button, if there is one */
  secondaryButton: {
    /** the text on the button */
    text: string;
    /** the exit for this button */
    exit: StandardScreenTransition;
    /** the trigger when the button is pressed */
    trigger: ScreenConfigurableTrigger;
  } | null;

  /** handles the tertiary, text link button, if there is one */
  tertiaryButton: {
    /** the text on the button */
    text: string;
    /** the exit for this button */
    exit: StandardScreenTransition;
    /** the trigger when the button is pressed */
    trigger: ScreenConfigurableTrigger;
  } | null;

  __mapped: true;
};
