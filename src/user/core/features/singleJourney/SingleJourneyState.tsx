import { SingleJourneyContext } from './SingleJourneyContext';

/**
 * The state required to determine if the single journey feature should
 * be shown plus any state that we want to share with other features
 */
export type SingleJourneyState = {
  /** The journey this feature is showing or null for not showing one */
  show: SingleJourneyContext | null;

  /** Sets the journey this feature is showing */
  setShow: (ref: SingleJourneyContext | null) => void;
};
