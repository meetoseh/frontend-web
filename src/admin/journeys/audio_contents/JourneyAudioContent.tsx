export type JourneyAudioContent = {
  /**
   * The stable identifier for referencing this join row, which shows
   * that a content file is suitable for journey audio content
   */
  uid: string;

  /**
   * The reference to the underlying content file
   */
  contentFile: {
    /**
     * The stable identifier for the content file
     */
    uid: string;

    /**
     * A JWT allowing access to the content file temporarily
     */
    jwt: string;
  };

  /**
   * When the content file was originally created
   */
  contentFileCreatedAt: Date;

  /**
   * The sub of the user who originally uploaded the content file, if known
   */
  uploadedByUserSub: string | null;

  /**
   * When the content file was last uploaded, which could be later than when
   * it's created due to deduplication.
   */
  lastUploadedAt: Date;
};
