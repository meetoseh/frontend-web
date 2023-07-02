import { ReactElement } from 'react';
import { OsehImageState } from '../../../../shared/images/OsehImageState';
import { JourneyRef } from '../../../journey/models/JourneyRef';
import { JourneyShared } from '../../../journey/models/JourneyShared';
import { Emotion } from './Emotion';
import { MyProfilePictureState } from '../../../../shared/hooks/useMyProfilePicture';

/**
 * The resources required to show the PickEmotionJourney step without
 * any spinners.
 */
export type PickEmotionJourneyResources = {
  /**
   * True if we're waiting for more resources, false if we're ready to
   * show the step.
   */
  loading: boolean;

  /**
   * If an error occurred that prevents progress loading resources,
   * this will be set to the error to show.
   */
  error: ReactElement | null;

  /**
   * The users profile picture, may be loading.
   */
  profilePicture: MyProfilePictureState;

  /**
   * The client-side uid assigned to the word set that the user is
   * currently viewing, and the words that the user is currently viewing.
   * Null if the words haven't been loaded yet.
   */
  options: { clientUid: string; words: Emotion[] } | null;

  /**
   * If the user selected a word from the options already, then this
   * corresponds to the word they selected, the journey that this
   * directs to, the shared state for that journey, and some information
   * about who voted for that journey.
   */
  selected: {
    /**
     * The word the user chose
     */
    word: Emotion;
    /**
     * The uid of the emotion/user relationship that was created when they
     * selected this emotion
     */
    emotionUserUid: string;
    /**
     * The journey that, as a result, we should go to
     */
    journey: JourneyRef;
    /**
     * The shared state for the journey. This may be loading, which should
     * disable the Start Your Class button
     */
    shared: JourneyShared;
    /**
     * The number of selections of this emotion recently
     */
    numVotes: number;
    /**
     * The number of selections for any emotion recently
     */
    numTotalVotes: number;
    /**
     * A small number of profile pictures representing people who have selected this
     * emotion recently. This may contain loading images.
     */
    profilePictures: OsehImageState[];

    /**
     * True if the user should jump straight to the journey start screen,
     * false if they should see stats first.
     */
    skipsStats: boolean;
  } | null;

  /**
   * The background image to use, may be loading
   */
  background: OsehImageState;

  /**
   * True if a splash screen should be shown, false otherwise.
   */
  forceSplash: boolean;

  /**
   * True if we should show the onboarding variants of the journey screens,
   * false if we should show the regular variants.
   */
  isOnboarding: boolean;

  /**
   * Should be called when the user selects a word from a set of words.
   * This should be called instead of state.onSelection, as it will
   * call state.onSelection if it successfully loads the journey.
   *
   * @param word The word that the user selected
   */
  onSelect: (this: void, word: Emotion) => void;

  /**
   * Can be called to start a new class with the same emotion.
   */
  takeAnotherClass: () => void;

  /**
   * Should be called when the user completes the journey, so that we can
   * reset back to the initial state and inform other states
   */
  onFinishedJourney: () => void;
};
