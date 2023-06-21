import { OsehAudioContentState } from '../../../shared/content/OsehAudioContentState';
import { OsehImageState } from '../../../shared/images/OsehImageState';

/**
 * Describes some state that is shared between journey and journey start,
 * to reduce unnecessary network requests.
 */
export type JourneyShared = {
  /** As if from useWindowSize */
  windowSize: { width: number; height: number };
  /**
   * The original background image, prior to darkening.
   * This should be used selectively, since contrast may be poor. It is
   * only shown within a preview for the share export, and hence is loaded
   * at a lowered resolution.
   */
  originalImage: OsehImageState;
  /** This is actually the darkened image, since we don't need the original */
  darkenedImage: OsehImageState;
  /** The blurred image so the share screen comes up quick */
  blurredImage: OsehImageState;
  /**
   * The audio for the journey; has loaded state inside
   * (audio.loaded)
   */
  audio: OsehAudioContentState | null;
  /**
   * True if the user has favorited this journey, false if they have
   * not, null if we don't know yet.
   */
  favorited: boolean | null;
  /**
   * If the user favorites/unfavorites the journey, this can be called to update
   * our in-memory state.
   * @param favorited True if the user has favorited the journey, false if they have not
   */
  setFavorited: (favorited: boolean) => void;
};
