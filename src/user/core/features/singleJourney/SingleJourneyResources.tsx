import { JourneyRouterScreenId } from '../../../journey/JourneyRouter';
import { JourneyShared } from '../../../journey/models/JourneyShared';

/** Resources required to display the single journey component */
export type SingleJourneyResources = {
  /** Whether more time is required before the component can be shown or not */
  loading: boolean;

  /** The step we're on; resets to `lobby` if the journey changes */
  step: JourneyRouterScreenId;

  /** The shared journey state */
  journeyShared: JourneyShared;

  /** Moves to a different step, without doing any of the necessary work to e.g. start audio */
  setStep(step: JourneyRouterScreenId): void;

  /** Should be called to indicate the journey is complete and to stop showing this screen */
  onJourneyFinished(): void;
};
