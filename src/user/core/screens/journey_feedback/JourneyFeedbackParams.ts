import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import { ScreenJourneyMapped } from '../../models/ScreenJourney';

export type JourneyFeedbackAPIParams = {
  journey: unknown;

  /** entrance transition */
  entrance: StandardScreenTransition;

  /** the first, more prominent button */
  cta1: {
    /** The text on the button */
    text: string;

    /** The transition to use if they click this option */
    exit: StandardScreenTransition;

    /** If not null, included in the client parameters for the cta1 trigger */
    emotion: string | null;

    /** The client flow slug to trigger when they hit the button */
    trigger: string | null;
  };

  /** the second, optional, less prominent button */
  cta2: {
    /** The text on the button */
    text: string;

    /** The transition to use if they click this option */
    exit: StandardScreenTransition;

    /** If not null, included in the client parameters for the cta2 trigger */
    emotion: string | null;

    /** The client flow slug to trigger when they hit the button */
    trigger: string | null;
  } | null;
};

export type JourneyFeedbackMappedParams = Omit<JourneyFeedbackAPIParams, 'journey'> & {
  /** The journey they are giving feedback for */
  journey: ScreenJourneyMapped;
  __mapped: true;
};
