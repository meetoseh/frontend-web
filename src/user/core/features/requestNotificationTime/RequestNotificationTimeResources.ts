import { InappNotificationSession } from '../../../../shared/hooks/useInappNotificationSession';
import { DayOfWeek } from '../../../../shared/models/DayOfWeek';
import { Channel } from './RequestNotificationTimeState';

export type ChannelSettings = {
  /** The days of the week to receive reminders */
  days: Set<DayOfWeek>;

  /**
   * Earliest that notifications are received on the given days, in seconds since midnight
   */
  start: number;

  /**
   * Latest that notifications are received on the given days, in seconds since midnight
   */
  end: number;

  /**
   * True if these are exactly the server-side saved settings, false otherwise
   */
  isReal: boolean;
};

/**
 * The resources required to render
 */
export type RequestNotificationTimeResources = {
  /**
   * The in-app notification session, if it's been loaded, otherwise null
   */
  session: InappNotificationSession | null;

  /**
   * The channels we should prompt the user to update the reminder times for.
   */
  channels: Channel[];

  /**
   * The existing settings for the users channels, if they've been loaded,
   * otherwise null
   */
  currentSettings: Record<Channel, ChannelSettings> | null;

  /**
   * Updates our internal state for what the users existing settings are for
   * each channel.
   */
  setCurrentSettings: (settings: Record<Channel, ChannelSettings>) => void;

  /**
   * True if we're still loading resources, false if we're ready to present.
   */
  loading: boolean;
};
