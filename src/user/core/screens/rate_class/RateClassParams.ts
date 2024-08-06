import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerTransitioningPreferredAPI,
  ScreenConfigurableTriggerTransitioningTemporaryAPI,
} from '../../models/ScreenConfigurableTrigger';
import { ScreenJourneyMapped } from '../../models/ScreenJourney';

export type RateClassAPIParams = {
  journey: unknown;

  /** entrance transition */
  entrance: StandardScreenTransition;

  /** The header message which frames the question */
  header: string;

  /** The text below the header */
  message: string | null;

  /** The background style - either the journey background or just a dark gray gradient */
  background: 'journey' | 'dark-gray';

  /** the button at the bottom */
  cta: {
    /** The text on the button */
    text: string;

    /** The transition to use if they click this option */
    exit: StandardScreenTransition;

    /** The client flow slug to trigger when they hit the button. No parameters. */
    trigger: {
      /** The flow if they hated the class */
      hated: ScreenConfigurableTriggerTransitioningPreferredAPI;
      hatedv75: ScreenConfigurableTriggerTransitioningTemporaryAPI;
      /** The flow if they disliked the class */
      disliked: ScreenConfigurableTriggerTransitioningPreferredAPI;
      dislikedv75: ScreenConfigurableTriggerTransitioningTemporaryAPI;
      /** The flow if they liked the class */
      liked: ScreenConfigurableTriggerTransitioningPreferredAPI;
      likedv75: ScreenConfigurableTriggerTransitioningTemporaryAPI;
      /** The flow if they loved the class */
      loved: ScreenConfigurableTriggerTransitioningPreferredAPI;
      lovedv75: ScreenConfigurableTriggerTransitioningTemporaryAPI;
    };
  };
};

export type RateClassMappedParams = Omit<RateClassAPIParams, 'journey' | 'cta'> & {
  /** The journey they are giving feedback for */
  journey: ScreenJourneyMapped;

  /** the button at the bottom */
  cta: {
    /** The text on the button */
    text: string;

    /** The transition to use if they click this option */
    exit: StandardScreenTransition;

    /** The client flow slug to trigger when they hit the button. No parameters. */
    trigger: {
      /** The flow if they hated the class */
      hated: ScreenConfigurableTrigger;
      /** The flow if they disliked the class */
      disliked: ScreenConfigurableTrigger;
      /** The flow if they liked the class */
      liked: ScreenConfigurableTrigger;
      /** The flow if they loved the class */
      loved: ScreenConfigurableTrigger;
    };
  };

  __mapped: true;
};
