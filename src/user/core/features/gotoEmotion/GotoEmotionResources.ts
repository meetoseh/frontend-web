import { NetworkResponse } from '../../../../shared/hooks/useNetworkResponse';
import { OsehImageState } from '../../../../shared/images/OsehImageState';
import { EmotionJourney } from './EmotionJourney';

/**
 * The resources required to display the goto emotion screen
 */
export type GotoEmotionResources = {
  /** True if waiting for more resources, false if ready to be shown */
  loading: boolean;

  /**
   * The journey that the user will see if they ask for a 1-minute journey
   */
  freeEmotionJourney: NetworkResponse<EmotionJourney>;

  /**
   * If the user has the pro entitlement. If true, clicking on the
   * premium button goes to the corresponding premium journey. If false, it
   * goes to the upgrade screen.
   */
  havePro: NetworkResponse<boolean>;

  /**
   * The premium journey if havePro, else unavailable
   */
  premiumEmotionJourney: NetworkResponse<EmotionJourney>;

  /** The profile pictures to use for social proof */
  socialProofPictures: OsehImageState[];

  /** Handles if the user decides not to take the class after all */
  onBack: () => void;

  /** Handles if the user wants to go to the free class */
  onTakeFreeJourney: () => void;

  /** Handles if the user wants to go to the premium class */
  onTakePremiumJourney: () => void;
};
