import { OsehMediaContentState } from '../../../shared/content/OsehMediaContentState';
import { OsehImageState } from '../../../shared/images/OsehImageState';

/**
 * Describes some state that is shared between journey and journey start,
 * to reduce unnecessary network requests. This should generally be loaded
 * with useJourneyShared, which returns it as a value with callbacks so that
 * react rerenders can be tighter (i.e., in more nested components).
 */
export type JourneyShared = {
  /** The image, pre-darkened, for the full background */
  darkenedImage: OsehImageState;

  /** The blurred image so the feedback and post-class screens comes up quick */
  blurredImage: OsehImageState;

  /**
   * The audio for the journey; has loaded state inside
   * (audio.loaded).
   */
  audio: OsehMediaContentState<HTMLAudioElement>;
  /**
   * True if the user has favorited this journey, false if they have
   * not, null if we don't know yet. Setting this value only changes
   * our local state.
   */
  favorited: boolean | null;

  /**
   * A setter for favorited which can only be used if favorited is not null
   */
  setFavorited: (favorited: boolean) => void;
};
