import { OsehImageExportCropped } from '../../../../shared/images/OsehImageExportCropped';
import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { ScreenResources } from '../../models/Screen';

export type RateClassResources = ScreenResources & {
  /**
   * The background image to use. The VWCs will always have a null value if the
   * dark gray gradient was requested.
   */
  background: {
    image: ValueWithCallbacks<OsehImageExportCropped | null>;
    thumbhash: ValueWithCallbacks<string | null>;
  };
};
