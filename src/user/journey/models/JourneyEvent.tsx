type JoinData = {};
type LeaveData = {};
type LikeData = {};
type NumericPromptResponseData = {
  rating: number;
};
type PressPromptStartResponseData = {};
type PressPromptEndResponseData = {};
type ColorPromptResponseData = {
  index: number;
};
type WordPromptResponseData = {
  index: number;
};

type EventData =
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
};
