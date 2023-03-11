/**
 * A prompt where we show a number spinner and the user selects
 * a number from that.
 */
export type NumericPrompt = {
  /**
   * The style of the prompt. This is always 'numeric' for this type.
   */
  style: 'numeric';

  /**
   * The text to show to the user which they use to select a number.
   */
  text: string;

  /**
   * The minimum number that the user can select. Integer value, inclusive.
   */
  min: number;

  /**
   * The maximum number that the user can select. Integer value, inclusive.
   */
  max: number;

  /**
   * The step size between numbers. Integer value, results in about 10 or
   * fewer numbers being shown.
   */
  step: number;
};

/**
 * A prompt where we show the user a button and they can press (and hold)
 * whenever they want.
 */
export type PressPrompt = {
  /**
   * The style of the prompt. This is always 'press' for this type.
   */
  style: 'press';

  /**
   * The text to show to the user which they use to decide when to press
   */
  text: string;
};

/**
 * A prompt where we show the user multiple colors and they select one.
 */
export type ColorPrompt = {
  /**
   * The style of the prompt. This is always 'color' for this type.
   */
  style: 'color';

  /**
   * The text to show to the user which they use to decide which color to select.
   */
  text: string;

  /**
   * The colors the user can choose from; 2-8 colors as rgb strings, e.g., #ff0000
   */
  colors: string[];
};

/**
 * A prompt where we show the user multiple words and they select one.
 */
export type WordPrompt = {
  /**
   * The style of the prompt. This is always 'word' for this type.
   */
  style: 'word';

  /**
   * The text to show to the user which they use to decide which word to select.
   */
  text: string;

  /**
   * The words the user can choose from; 2-8 words as strings
   */
  options: string[];
};

/**
 * A prompt that a journey can have
 */
export type Prompt = NumericPrompt | PressPrompt | ColorPrompt | WordPrompt;
