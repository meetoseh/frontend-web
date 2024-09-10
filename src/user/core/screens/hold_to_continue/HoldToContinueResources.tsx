import { OsehImageExportCropped } from '../../../../shared/images/OsehImageExportCropped';
import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { ScreenResources } from '../../models/Screen';

export type HoldToContinueResources = ScreenResources & {
  /**
   * The image to use; null while loading, undefined if an error occurred
   * loading the image. This image should be in the large size (200x200),
   * and we will use scaleX / scaleY transforms to reduce it as required.
   */
  image: ValueWithCallbacks<OsehImageExportCropped | null | undefined>;
};
