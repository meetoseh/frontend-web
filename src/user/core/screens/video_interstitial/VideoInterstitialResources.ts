import { OsehMediaContentState } from '../../../../shared/content/OsehMediaContentState';
import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { ScreenResources } from '../../models/Screen';

export type VideoInterstitialResources = ScreenResources & {
  /**
   * The video to use
   */
  video: ValueWithCallbacks<OsehMediaContentState<HTMLVideoElement>>;
};
