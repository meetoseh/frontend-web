import { Instructor } from '../instructors/Instructor';
import { JourneySubcategory } from './subcategories/JourneySubcategory';

/**
 * A journey is an audio experience combined with a prompt and background image.
 * This describes the admin view of a journey, which is accessed by admin users
 * with standard authorization. A slightly different view is available for users
 * when using a journey JWT.
 */
export type Journey = {
  /**
   * Stable unique identifier
   */
  uid: string;

  /**
   * A reference to the content file containing the audio for the journey
   */
  audioContent: {
    uid: string;
    jwt: string;
  };

  /**
   * A reference to the image file containing the background image for the journey
   */
  backgroundImage: {
    uid: string;
    jwt: string;
  };

  /**
   * A reference to the image file containing the blurred background image for the journey
   */
  blurredBackgroundImage: {
    uid: string;
    jwt: string;
  };

  /**
   * The subcategory of the journey
   */
  subcategory: JourneySubcategory;

  /**
   * The instructor for the journey
   */
  instructor: Instructor;

  /**
   * The title for the journey, very short
   */
  title: string;

  /**
   * The description for the journey, longer than the title but still short
   */
  description: string;

  /**
   * The prompt information for the journey. See the API docs for more information
   */
  prompt: any & { style: 'numeric' | 'press' | 'color' | 'word' };

  /**
   * When the journey was created
   */
  createdAt: Date;

  /**
   * If the journey has been soft-deleted, when it was deleted
   */
  deletedAt: Date | null;

  /**
   * The UID of the daily event that this journey is a part of.
   * Null if we know the journey is not part of a daily event.
   * Undefined if we don't know if the journey is part of a daily event.
   */
  dailyEventUID: string | null | undefined;
};
