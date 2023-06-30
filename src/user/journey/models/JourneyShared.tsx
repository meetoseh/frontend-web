import { OsehAudioContentState } from '../../../shared/content/OsehAudioContentState';
import { OsehImageState } from '../../../shared/images/OsehImageState';

/**
 * Describes some state that is shared between journey and journey start,
 * to reduce unnecessary network requests. This should generally be loaded
 * with useJourneyShared, which returns it as a value with callbacks so that
 * react rerenders can be tighter (i.e., in more nested components).
 */
export type JourneyShared = {
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
   * (audio.loaded).
   */
  audio: OsehAudioContentState;
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
