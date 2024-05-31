import { OsehMediaContentState } from '../../../../shared/content/OsehMediaContentState';
import { OsehImageExportCropped } from '../../../../shared/images/OsehImageExportCropped';
import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { ScreenResources } from '../../models/Screen';

export type AudioInterstitialResources = ScreenResources & {
  /**
   * The background image to use, or null if either the thumbhash or dark gray
   * gradient should be used
   */
  background: ValueWithCallbacks<OsehImageExportCropped | null>;

  /**
   * The audio to use
   */
  audio: ValueWithCallbacks<OsehMediaContentState<HTMLAudioElement>>;
};