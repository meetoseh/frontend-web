import { OsehImageExportCropped } from '../../../../shared/images/OsehImageExportCropped';
import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { ScreenResources } from '../../models/Screen';

export type InteractivePromptResources = ScreenResources & {
  /**
   * The background image to use, or null if either the thumbhash or dark gray
   * gradient should be used
   */
  background: ValueWithCallbacks<OsehImageExportCropped | null>;
};
