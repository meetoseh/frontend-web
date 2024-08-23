import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerAPI,
} from '../../models/ScreenConfigurableTrigger';
import { LibraryFilterAPI, LibraryFilter } from '../library/lib/LibraryFilter';

export type LibraryFilterAPIParams = {
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

  /** The call to action, if any, displayed as a bottom button */
  cta: {
    /** The text for the call to action */
    text: string;

    /** The trigger when the user clicks the button. Includes `filter` in the params */
    trigger: ScreenConfigurableTriggerAPI;

    /** exit transition for cta */
    exit: StandardScreenTransition;
  } | null;

  /** The initial filter */
  filter: LibraryFilterAPI;
};

export type LibraryFilterMappedParams = Pick<LibraryFilterAPIParams, 'entrance' | 'header'> & {
  /** configures the close button */
  close: {
    /** the variant to use for the icon and placement */
    variant: 'x' | 'back' | 'menu';
    /** the trigger when the close button is pressed. Includes `filter` in the params */
    trigger: ScreenConfigurableTrigger;
    /** exit transition */
    exit: StandardScreenTransition;
  };

  /** The call to action, if any, displayed as a bottom button */
  cta: {
    /** The text for the call to action */
    text: string;

    /** The trigger when the user clicks the button. Includes `filter` in the params */
    trigger: ScreenConfigurableTrigger;

    /** exit transition for cta */
    exit: StandardScreenTransition;
  } | null;

  /** The initial filter */
  filter: LibraryFilter;

  __mapped: true;
};
