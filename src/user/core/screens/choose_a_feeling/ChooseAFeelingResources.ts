import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { Emotion } from '../../../../shared/models/Emotion';
import { ScreenResources } from '../../models/Screen';

export type ChooseAFeelingResources = ScreenResources & {
  /** The emotions the user can choose from, or null if not available */
  emotions: ValueWithCallbacks<Emotion[] | null>;
};
