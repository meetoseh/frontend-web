import { OsehImageExportCropped } from '../../../../shared/images/OsehImageExportCropped';
import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { RequestResultConcrete } from '../../../../shared/requests/RequestHandler';
import { ScreenResources } from '../../models/Screen';

export type LargeImageInterstitialResources = ScreenResources & {
  /**
   * The display size the image is targeting, updated without a debounce
   * delay. The actual image content may not match this size until a debounce
   * period or longer.
   */
  imageSizeImmediate: ValueWithCallbacks<{ width: number; height: number }>;

  /**
   * The image to use
   */
  image: ValueWithCallbacks<OsehImageExportCropped | null>;
};
