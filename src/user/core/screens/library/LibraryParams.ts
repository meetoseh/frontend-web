import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerAPI,
} from '../../models/ScreenConfigurableTrigger';
import { LibraryFilterAPI, LibraryFilter } from './lib/LibraryFilter';

type LibraryAPIParamsTooltip = {
  /** Header for the tooltip */
  header: string;

  /** Body of the tooltip */
  body: string;
};

type LibraryAPIParamsCTA = {
  /** The text for the call to action */
  text: string;

  /** The trigger when the user clicks the button */
  trigger: ScreenConfigurableTriggerAPI;

  /** exit transition for cta */
  exit: StandardScreenTransition;
};

export type LibraryMappedParamsTooltip = LibraryAPIParamsTooltip;
export type LibraryMappedParamsCTA = {
  /** The text for the call to action */
  text: string;
  /** The trigger when the user clicks the button, with no parameters */
  trigger: ScreenConfigurableTrigger;
  /** exit transition for cta */
  exit: StandardScreenTransition;
};

export type LibraryAPIParams = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** the header text to show */
  header: string;

  /** configures the close button */
  close: {
    /** the variant to use for the icon and placement */
    variant: 'x' | 'back' | 'menu';
    /** the trigger when the close button is pressed */
    trigger: ScreenConfigurableTriggerAPI;
    /** exit transition */
    exit: StandardScreenTransition;
  };

  /** The tooltip above the first journey, if any */
  tooltip: LibraryAPIParamsTooltip | null;

  /** The call to action, if any, displayed as a bottom button */
  cta: LibraryAPIParamsCTA | null;

  /** The initial filter */
  filter: LibraryFilterAPI;

  /** Handles what to do if a journey is clicked; includes `journey_uid` in the params */
  journey_trigger: ScreenConfigurableTriggerAPI;

  /**
   * Handles what to do if the filter button is pressed; includes `filter` in the params
   * for the filter at that point, which may have been changed
   */
  edit_filter_trigger: ScreenConfigurableTriggerAPI;
};

export type LibraryMappedParams = Pick<LibraryAPIParams, 'entrance' | 'header'> & {
  /** configures the close button */
  close: {
    /** the variant to use for the icon and placement */
    variant: 'x' | 'back' | 'menu';
    /** the trigger when the close button is pressed */
    trigger: ScreenConfigurableTrigger;
    /** exit transition */
    exit: StandardScreenTransition;
  };

  /** The tooltip above the first journey, if any */
  tooltip: LibraryMappedParamsTooltip | null;

  /** The call to action, if any, displayed as a bottom button */
  cta: LibraryMappedParamsCTA | null;

  /** The initial filter */
  filter: LibraryFilter;

  /** Handles what to do if a journey is clicked; includes `journey_uid` in the params */
  journeyTrigger: ScreenConfigurableTrigger;

  /**
   * Handles what to do if the filter button is pressed; includes `filter` in the params
   * for the filter at that point, which may have been changed
   */
  editFilterTrigger: ScreenConfigurableTrigger;

  __mapped: true;
};
