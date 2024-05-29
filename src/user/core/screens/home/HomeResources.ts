import { OsehImageExportCropped } from '../../../../shared/images/OsehImageExportCropped';
import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { Emotion } from '../../../../shared/models/Emotion';
import { StreakInfo } from '../../../journey/models/StreakInfo';
import { ScreenResources } from '../../models/Screen';
import { HomeCopy } from './lib/createHomeCopyRequestHandler';

export type HomeResources = ScreenResources & {
  /** The home copy to use or null if not available */
  copy: ValueWithCallbacks<HomeCopy | null>;

  /**
   * The display size the image is targeting, updated without a debounce
   * delay. The actual image content may not match this size until a debounce
   * period or longer.
   */
  imageSizeImmediate: ValueWithCallbacks<{ width: number; height: number }>;

  /** The background image to use, or null if not available */
  image: ValueWithCallbacks<OsehImageExportCropped | null>;

  /** The thumbhash for the background image, or null if not available */
  imageThumbhash: ValueWithCallbacks<string | null>;

  /** The profile picture to use, or null if not available */
  profilePicture: ValueWithCallbacks<OsehImageExportCropped | null>;

  /** The user streak information, or null if not available */
  streak: ValueWithCallbacks<StreakInfo | null>;

  /** The emotions the user can choose from, or null if not available */
  emotions: ValueWithCallbacks<Emotion[] | null>;
};
