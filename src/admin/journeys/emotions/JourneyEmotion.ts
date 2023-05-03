export type JourneyEmotion = {
  /**
   * The UID of the relationship record between the journey and emotion
   */
  uid: string;

  /**
   * The uid of the journey
   */
  journeyUid: string;

  /**
   * The emotion word associated with the journey
   */
  emotion: string;

  /**
   * A hint for how the association was created
   */
  creationHint:
    | {
        /**
         * An admin manually created the record
         */
        type: 'manual';
        /**
         * The sub of the admin who created the record
         */
        userSub: string;
      }
    | {
        /**
         * The record was automatically generated
         */
        type: 'ai';
        /**
         * The identifier of the model used to generate the record
         */
        model: string;
        /**
         * The version of the prompt provided to the model, formatted
         * like semver
         */
        promptVersion: string;
      }
    | null;

  /**
   * When the record was created
   */
  createdAt: Date;
};

/**
 * Parses the journey emotion from the api response
 */
export const parseJourneyEmotion = (raw: any): JourneyEmotion => {
  return {
    uid: raw.uid,
    journeyUid: raw.journey_uid,
    emotion: raw.emotion,
    creationHint: ((rawHint: any) => {
      if (rawHint === null) {
        return null;
      }
      if (rawHint.type === 'manual') {
        return {
          type: 'manual',
          userSub: rawHint.user_sub,
        };
      }
      if (rawHint.type === 'ai') {
        return {
          type: 'ai',
          model: rawHint.model,
          promptVersion: rawHint.prompt_version,
        };
      }
      throw new Error(`Unknown creation hint type: ${rawHint.type}`);
    })(raw.creation_hint),
    createdAt: new Date(raw.created_at * 1000),
  };
};
