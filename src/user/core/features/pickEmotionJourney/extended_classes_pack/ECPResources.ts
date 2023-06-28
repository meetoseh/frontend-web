import { InappNotificationSession } from '../../../../../shared/hooks/useInappNotificationSession';
import { OsehImageState } from '../../../../../shared/images/OsehImageState';
import { JourneyShared } from '../../../../journey/models/JourneyShared';

export type ECPResources = {
  /**
   * The in-app notification session to use, or null if it's still loading
   */
  session: InappNotificationSession | null;

  /**
   * The image showing the new backgrounds in the tall form; used in the
   * prompt part
   */
  tallPreview: OsehImageState;

  /**
   * The image showing the new backgrounds in square form, used in the
   * purchase screen
   */
  shortPreview: OsehImageState;

  /**
   * The shared resources for the journey; we wait for the darkened background
   * image to be available, but not for the audio to be playable (preferring
   * to get them to the first screen faster, at the potential cost of another
   * loading screen later)
   */
  journeyShared: JourneyShared;

  /**
   * True if some resources are still loading, false otherwise
   */
  loading: boolean;
};
