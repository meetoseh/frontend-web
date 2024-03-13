import { CrudFetcherMapper, convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { OsehImageRef } from '../../../../shared/images/OsehImageRef';
import { JourneyRef, journeyRefKeyMap } from '../../../journey/models/JourneyRef';

/**
 * Describes the result of preparing to start a journey related to
 * a particular emotion. This can be performed in anticipation of
 * a user clicking a button to actually start the journey, and hence
 * needs to be confirmed for tracking purposes.
 */
export type EmotionJourney = {
  /** The journey the user would start */
  journey: JourneyRef;
  /** The UID that can be used to confirm they started this journey */
  emotionUserUid: string;
  /** The number of votes there are for this emotion recently */
  numVotes: number;
  /** The number of votes there are for all emotions recently */
  numTotalVotes: number;
  /** The profile pictures of other users who've picked this emotion recently */
  voterPictures: OsehImageRef[];
};

export const emotionJourneyKeyMap: CrudFetcherMapper<EmotionJourney> = {
  journey: (_, v) => ({ key: 'journey', value: convertUsingMapper(v, journeyRefKeyMap) }),
  emotion_user_uid: 'emotionUserUid',
  num_votes: 'numVotes',
  num_total_votes: 'numTotalVotes',
  voter_pictures: 'voterPictures',
};
