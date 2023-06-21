import { CrudFetcherKeyMap } from '../../../admin/crud/CrudFetcher';
import { OsehContentRef } from '../../../shared/content/OsehContentRef';
import { OsehImageRef } from '../../../shared/images/OsehImageRef';

export type JourneyRef = {
  /**
   * The UID of the journey to show. When the journey is initialized, this
   * already has a session active, but that session doesn't yet have any events
   * (including the join event)
   */
  uid: string;

  /**
   * The JWT which allows us access to the journey and session
   */
  jwt: string;

  /**
   * The duration of the journey in seconds, which should match the audio content
   */
  durationSeconds: number;

  /**
   * The background image to the journey prior to applying filters; we don't use this,
   * but it's helpful for trying out new features (such as a different darkening/blur
   * algorithm)
   */
  backgroundImage: OsehImageRef;

  /**
   * The image to show as the background of the journey
   */
  darkenedBackgroundImage: OsehImageRef;

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
   * If a short sample of this journey is available in video form (typically
   * a 1080x1920 15s vertical video), this is the content ref for that video.
   */
  sample: OsehContentRef | null;
};

/**
 * The key map for parsing journey refs
 */
export const journeyRefKeyMap: CrudFetcherKeyMap<JourneyRef> = {
  duration_seconds: 'durationSeconds',
  background_image: 'backgroundImage',
  darkened_background_image: 'darkenedBackgroundImage',
  blurred_background_image: 'blurredBackgroundImage',
  audio_content: 'audioContent',
  category: (_, val) => ({
    key: 'category',
    value: {
      externalName: val.external_name,
    },
  }),
};
