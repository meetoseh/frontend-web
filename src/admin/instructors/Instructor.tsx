/**
 * An instructor is the concept of a person who can create content. They are not
 * usually related 1-1 to users; any admin can specify which instructor created
 * a specific piece of content or edit their metadata.
 */
export type Instructor = {
  /**
   * The unique stable identifier
   */
  uid: string;
  /**
   * The display name
   */
  name: string;
  /**
   * A non-negative number generally less than one which influences content
   * selection towards this instructor. Higher numbers are more influential.
   */
  bias: number;
  /**
   * A bitfield of flags for the instructor. From least to most significant bit:
   * - 0x01: unset to prevent the instructor from showing in admin by default
   * - 0x02: unset to prevent the instructor from showing in the Classes filter
   */
  flags: number;
  /**
   * If a picture is set, a reference to the picture
   */
  picture: {
    /**
     * The image file stable identifier
     */
    uid: string;

    /**
     * A JWT which temporarily permits access to the image file
     */
    jwt: string;
  } | null;

  /**
   * When the instructor was created
   */
  createdAt: Date;
};
