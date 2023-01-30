import { useEffect, useState } from 'react';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { OsehImageRef, OsehImageState, useOsehImageState } from '../../shared/OsehImage';
import { OsehContentRef } from '../../shared/OsehContent';
import { CrudFetcherKeyMap } from '../../admin/crud/CrudFetcher';

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

export type JourneyRef = {
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
   * The image to show as the blurred version of the background of the journey
   */
  blurredBackgroundImage: OsehImageRef;

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

  /**
   * If a short sample of this journey is available in video form (typically
   * a 1080x1920 15s vertical video), this is the content ref for that video.
   */
  sample: OsehContentRef | null;
};

/**
 * The key map for parsing journey refs
 */
export const journeyRefKeyMap: CrudFetcherKeyMap<JourneyRef> = {
  session_uid: 'sessionUid',
  duration_seconds: 'durationSeconds',
  background_image: 'backgroundImage',
  blurred_background_image: 'blurredBackgroundImage',
  audio_content: 'audioContent',
  category: (_, val) => ({
    key: 'category',
    value: {
      externalName: val.external_name,
    },
  }),
};

/**
 * Describes some state that is shared between journey and journey start,
 * to reduce unnecessary network requests.
 */
export type JourneyAndJourneyStartShared = {
  windowSize: { width: number; height: number };
  image: OsehImageState | null;
  imageLoading: boolean;
  blurredImage: OsehImageState | null;
  blurredImageLoading: boolean;
};

/**
 * Creates the initial journey & journey start shared state
 */
export const useJourneyAndJourneyStartShared = (
  journey: JourneyRef | null
): JourneyAndJourneyStartShared => {
  const windowSize = useWindowSize();
  const [shared, setShared] = useState<JourneyAndJourneyStartShared>({
    image: null,
    imageLoading: true,
    windowSize,
    blurredImage: null,
    blurredImageLoading: true,
  });
  const [imageLoading, setImageLoading] = useState(true);
  const image = useOsehImageState({
    uid: journey?.backgroundImage?.uid ?? null,
    jwt: journey?.backgroundImage?.jwt ?? null,
    displayWidth: windowSize.width,
    displayHeight: windowSize.height,
    alt: '',
    setLoading: setImageLoading,
  });
  const [blurredImageLoading, setBlurredImageLoading] = useState(true);
  const blurredImage = useOsehImageState({
    uid: journey?.blurredBackgroundImage?.uid ?? null,
    jwt: journey?.blurredBackgroundImage?.jwt ?? null,
    displayWidth: windowSize.width,
    displayHeight: windowSize.height,
    alt: '',
    setLoading: setBlurredImageLoading,
  });

  useEffect(() => {
    setShared({
      image,
      imageLoading,
      blurredImage,
      blurredImageLoading,
      windowSize,
    });
  }, [image, imageLoading, blurredImage, blurredImageLoading, windowSize]);

  return shared;
};
