import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { StreakInfo } from '../../../journey/models/StreakInfo';
import { ScreenResources } from '../../models/Screen';

export type SetGoalResources = ScreenResources & {
  /** The user streak information, or null if not available */
  streak: ValueWithCallbacks<StreakInfo | null>;
};
