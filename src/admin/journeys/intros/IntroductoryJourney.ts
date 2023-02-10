import { Journey } from '../Journey';
import { convertUsingKeymap, CrudFetcherKeyMap } from '../../crud/CrudFetcher';
import { journeyRefKeyMap } from '../../../user/journey/models/JourneyRef';

/**
 * An introductory journey is a journey that is shown to a user when they first
 * sign up to the platform. They see one of these journeys at random, prior to
 * seeing the current daily event, to provide a more consistent onboarding
 * experience.
 */
export type IntroductoryJourney = {
  /**
   * The unique identifier for this introductoy journey
   */
  uid: string;

  /**
   * The underlying journey that can be shown to users during onboarding
   */
  journey: Journey;

  /**
   * The sub of the user who marked the journey as introductory, if they still
   * exist, otherwise null
   */
  userSub: string | null;

  /**
   * When the journey was marked introductory
   */
  createdAt: Date;
};

export const keyMap: CrudFetcherKeyMap<IntroductoryJourney> = {
  journey: (_, raw) => ({ key: 'journey', value: convertUsingKeymap(raw, journeyRefKeyMap) }),
  user_sub: 'userSub',
  created_at: (_, raw) => ({ key: 'createdAt', value: new Date(raw * 1000) }),
};
