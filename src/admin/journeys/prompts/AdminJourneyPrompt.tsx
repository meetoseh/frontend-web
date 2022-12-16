/**
 * E.g., what is your mood? 1-10
 */
export type AdminJourneyPromptNumeric = {
  style: 'numeric';

  /**
   * The text to display to the user to prompt them for a response
   */
  text: string;

  /**
   * The minimum value, inclusive, integer
   */
  min: number;

  /**
   * The maximum value, inclusive, integer
   */
  max: number;

  /**
   * The step size, currently must be 1
   */
  step: 1;
};

export type AdminJourneyPromptPress = {
  style: 'press';

  /**
   * The text to display to the user to prompt them for a response
   */
  text: string;
};

export type AdminJourneyPromptColor = {
  style: 'color';

  /**
   * The text to display to the user to prompt them for a response
   */
  text: string;

  /**
   * The colors they can choose from. 2-8 colors, each represented
   * as a 6-digit hex string, e.g., '#FFFFFF' for white
   */
  colors: string[];
};

export type AdminJourneyPromptWord = {
  style: 'word';

  /**
   * The text to display to the user to prompt them for a response
   */
  text: string;

  /**
   * The options they can choose from. 2-8 options, each 1-45 characters
   * trimmed and without newlines
   */
  options: string[];
};

/**
 * A prompt that can be specified for a journey
 */
export type AdminJourneyPrompt =
  | AdminJourneyPromptNumeric
  | AdminJourneyPromptPress
  | AdminJourneyPromptColor
  | AdminJourneyPromptWord;
