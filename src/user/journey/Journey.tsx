import { ReactElement } from "react";
import { OsehContentRef } from "../../shared/OsehContent";
import { OsehImageRef } from "../../shared/OsehImage";

/**
 * A prompt where we show a number spinner and the user selects
 * a number from that.
 */
type NumericPrompt = {
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
type PressPrompt = {
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
type ColorPrompt = {
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
type WordPrompt = {
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

type JourneyProps = {
  /**
   * The UID of the journey to show. When the journey is initialized, this
   * already has a session active, but that session doesn't yet have any events
   * (including the join event)
   */
  uid: string;

  /**
   * The UID of the session within the journey that we will add events to when
   * the user interacts with the journey.
   */
  sessionUid: string;

  /**
   * The JWT which allows us access to the journey and session
   */
  jwt: string;

  /**
   * The duration of the journey in seconds, which should match the audio content
   */
  durationSeconds: number;

  /**
   * The image to show as the background of the journey
   */
  backgroundImage: OsehImageRef;

  /**
   * The audio file to play during the journey
   */
  audioContent: OsehContentRef;

  /**
   * The category of the journey
   */
  category: {
    /**
     * The name of the category, as we show users
     */
    externalName: string;
  };

  /**
   * The very short title for the journey
   */
  title: string;

  /**
   * Who made the journey
   */
  instructor: {
    /**
     * Their display name
     */
    name: string;
  };

  /**
   * A brief description of what to expect in the journey
   */
  description: {
    /**
     * As raw text
     */
    text: string;
  };

  /**
   * The prompt to show to the user during the journey
   */
  prompt: Prompt;
};

/**
 * Takes the meta information about a journey returned from any of the endpoints
 * which start a session in the journey (e.g., start_random), then uses that to
 * connect to the "live" information (the true live events, the historical
 * events, profile pictures, and the stats endpoints) and playback the journey
 * to the user, while they are allowed to engage via the prompt and a "like"
 * button.
 */
export const Journey = ({
  uid,
  sessionUid,
  jwt,
  backgroundImage,
  audioContent,
  category,
  title,
  instructor,
  description,
  prompt,
}: JourneyProps): ReactElement => {
  return <></>;
};