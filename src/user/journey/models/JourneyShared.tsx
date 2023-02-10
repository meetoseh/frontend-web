import { OsehImageState } from '../../../shared/OsehImage';
import { JourneyAudio } from '../hooks/useJourneyAudio';

/**
 * Describes some state that is shared between journey and journey start,
 * to reduce unnecessary network requests.
 */
export type JourneyShared = {
  /** As if from useWindowSize */
  windowSize: { width: number; height: number };
  /** This is actually the darkened image, since we don't need the original */
  image: OsehImageState | null;
  /** If we're still loading the darkened image */
  imageLoading: boolean;
  /** The blurred image so the share screen comes up quick */
  blurredImage: OsehImageState | null;
  /** If we're still loading the blurred image */
  blurredImageLoading: boolean;
  /**
   * The audio for the journey; has loaded state inside
   * (audio.loaded)
   */
  audio: JourneyAudio | null;
};
