import { OsehImageRef } from '../../../shared/images/OsehImageRef';

export type JoinData = {
  name: string;
};
export type LeaveData = {
  name: string;
};
export type LikeData = {};
export type NumericPromptResponseData = {
  rating: number;
};
export type PressPromptStartResponseData = {};
export type PressPromptEndResponseData = {};
export type ColorPromptResponseData = {
  index: number;
};
export type WordPromptResponseData = {
  index: number;
};

export type EventData =
  | JoinData
  | LeaveData
  | LikeData
  | NumericPromptResponseData
  | PressPromptStartResponseData
  | PressPromptEndResponseData
  | ColorPromptResponseData
  | WordPromptResponseData;

/**
 * Describes the format of an event from the server. The casing matches the
 * way it's returned, as recasing events could be a significant performance
 * bottleneck if not done carefully.
 *
 * This is the least common denominator between the historical endpoint and
 * the live endpoint
 */
export type JourneyEvent = {
  /**
   * A unique, stable identifier for the event
   */
  uid: string;
  /**
   * The sub of the user who performed the event
   */
  user_sub: string;
  /**
   * The uid of the session the event is within
   */
  session_uid: string;
  /**
   * The type of event, determines the data format
   */
  evtype:
    | 'join'
    | 'leave'
    | 'like'
    | 'numeric_prompt_response'
    | 'press_prompt_start_response'
    | 'press_prompt_end_response'
    | 'color_prompt_response'
    | 'word_prompt_response';
  /**
   * The journey time when the event occurred
   */
  journey_time: number;
  /**
   * The data associated with the event, which depends on the type
   */
  data: EventData;
  /**
   * If an icon is associated with this event, usually the users profile picture,
   * a reference to the corresponding image
   */
  icon: OsehImageRef | null;
};
