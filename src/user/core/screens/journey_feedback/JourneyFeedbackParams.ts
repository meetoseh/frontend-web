import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerTransitioningPreferredAPI,
  ScreenConfigurableTriggerTransitioningTemporaryAPI,
} from '../../models/ScreenConfigurableTrigger';
import { ScreenJourneyMapped } from '../../models/ScreenJourney';

type JourneyFeedbackParams<JourneyT, TriggerT> = {
  journey: JourneyT;

  /** entrance transition */
  entrance: StandardScreenTransition;

  /** the first, more prominent button */
  cta1: {
    /** The text on the button */
    text: string;

    /** The transition to use if they click this option */
    exit: StandardScreenTransition;

    /**
     * If not null, included in the client parameters for the cta1 trigger. Not
     * really necessary with the new trigger param format, but helpful for older clients.
     */
    emotion: string | null;
  } & TriggerT;

  /** the second, optional, less prominent button */
  cta2:
    | ({
        /** The text on the button */
        text: string;

        /** The transition to use if they click this option */
        exit: StandardScreenTransition;

        /**
         * If not null, included in the client parameters for the cta2 trigger. Not
         * really necessary with the new trigger param format, but helpful for older clients.
         */
        emotion: string | null;
      } & TriggerT)
    | null;
};

export type JourneyFeedbackAPIParams = JourneyFeedbackParams<
  unknown,
  {
    trigger: ScreenConfigurableTriggerTransitioningPreferredAPI;
    triggerv75: ScreenConfigurableTriggerTransitioningTemporaryAPI;
  }
>;

export type JourneyFeedbackMappedParams = JourneyFeedbackParams<
  ScreenJourneyMapped,
  { trigger: ScreenConfigurableTrigger }
> & {
  __mapped: true;
};
