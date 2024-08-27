import { OsehImageExportCropped } from '../../../../shared/images/OsehImageExportCropped';
import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { StreakInfo } from '../../../journey/models/StreakInfo';
import { ScreenResources } from '../../models/Screen';
import { HomeCopy } from '../home/lib/createHomeCopyRequestHandler';

export type HomeV4Resources = ScreenResources & {
  /** The home copy to use or null if not available */
  copy: ValueWithCallbacks<HomeCopy | null>;

  /** The background image to use, or null if not available */
  image: ValueWithCallbacks<OsehImageExportCropped | null>;

  /** The thumbhash for the background image, or null if not available */
  imageThumbhash: ValueWithCallbacks<string | null>;

  /** The user streak information, or null if not available */
  streak: ValueWithCallbacks<StreakInfo | null>;
};
