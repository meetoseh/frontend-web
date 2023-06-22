import { Emotion } from './Emotion';

/**
 * The state required to determine if the user should pick an emotion
 * and then go to a journey based on that, plus any state that we want
 * exposed for other steps to use.
 */
export type PickEmotionJourneyState = {
  /**
   * A list of lists, where each item in the inner list corresponds to a
   * set of words that the user was prompted with. We arbitrarily assign
   * a uid client-side to each collection of words for record-keeping.
   *
   * The selected emotion is guarranteed to be an item within words,
   * i.e., the words.find(selected) is truthy iff selected is not null.
   */
  recentlyViewed: { clientUid: string; words: Emotion[]; at: Date; selected: Emotion | null }[];

  /**
   * How many journeys the user has taken in this session. This is
   * incremented when they would return back to the pick emotion screen.
   */
  classesTakenThisSession: number;

  /**
   * Should be called whenever the user views a set of words. This will
   * assign a uid and update recentlyViewed.
   *
   * @param words The words the user is prompted with
   * @returns The uid assigned to the word set
   */
  onViewed: (this: void, words: Emotion[]) => string;

  /**
   * Should be called whenever the user selects a word from a set of words.
   *
   * @param clientUid The uid assigned to the word set
   * @param word The word the user selected
   */
  onSelection: (this: void, clientUid: string, word: Emotion) => void;

  /**
   * Increments classesTakenThisSession.
   */
  onFinishedClass: () => void;
};
