import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { ScreenResources } from '../../models/Screen';
import { ReminderChannelsInfo } from './lib/createReminderChannelsHandler';
import { ReminderSettings } from './lib/createReminderSettingsHandler';

export type ReminderTimesResources = ScreenResources & {
  /**
   * What channels they can _meaningfully_ configure. For example, if they
   * don't have a phone attached, it won't make sense to update their SMS
   * settings (even if we can do so for if they add a phone later).
   *
   * Null if unavailable.
   */
  channelsInfo: ValueWithCallbacks<ReminderChannelsInfo | null>;

  /** The users settings by channel, or null if unavailable */
  settings: ValueWithCallbacks<ReminderSettings | null>;
};
