import { JourneyRouterScreenId } from '../JourneyRouter';
import { JourneyRef } from './JourneyRef';
import { JourneyShared } from './JourneyShared';

export type JourneyScreenProps = {
  /**
   * The journey the screen is handling
   */
  journey: JourneyRef;

  /**
   * The shared state for the journey, to avoid repeating work
   */
  shared: JourneyShared;

  /**
   * Used to move to a different journey screen. Privileged is true if the
   * function is being called from a user interaction handler and false otherwise.
   */
  setScreen: (screen: JourneyRouterScreenId, privileged: boolean) => void;

  /**
   * Should be called if we're done with the journey and should return back to
   * the home screen. Privileged is true if the function is being called from a
   * user interaction handler and false otherwise.
   */
  onJourneyFinished: (privileged: boolean) => void;

  /**
   * True if this is an onboarding journey, false otherwise.
   */
  isOnboarding: boolean;
};
